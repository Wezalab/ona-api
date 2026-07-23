import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnchorStatus, RiskLevel, Screening, ScreeningDocument } from './schemas/screening.schema';
import { StarknetService, RiskLevel as ChainRisk } from '../blockchain/starknet.service';
import { ClinicsService } from '../clinics/clinics.service';
import { AppConfig } from '../../config/configuration';

const MAX_ATTEMPTS = 5;

const RISK_MAP: Record<RiskLevel, ChainRisk> = {
  [RiskLevel.Low]: 'low',
  [RiskLevel.Medium]: 'medium',
  [RiskLevel.High]: 'high',
};

/**
 * Owns the async, idempotent anchoring of screenings to StarkNet. New records
 * are enqueued immediately; a periodic sweep is the safety net for offline
 * syncs, transient RPC failures, and retries.
 */
@Injectable()
export class AnchorService implements OnModuleInit {
  private readonly logger = new Logger(AnchorService.name);

  constructor(
    @InjectModel(Screening.name) private readonly screeningModel: Model<ScreeningDocument>,
    private readonly starknet: StarknetService,
    private readonly clinics: ClinicsService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const sn = this.config.get('starknet', { infer: true });
    if (!sn.enabled) {
      this.logger.warn('Anchor worker idle — BLOCKCHAIN_ENABLED=false');
      return;
    }
    const ms = sn.retryIntervalSec * 1000;
    const interval = setInterval(() => {
      this.sweep().catch((e) => this.logger.error(`sweep failed: ${e?.message ?? e}`));
    }, ms);
    this.scheduler.addInterval('anchor-sweep', interval);
    this.logger.log(`Anchor sweep scheduled every ${sn.retryIntervalSec}s`);
  }

  /** Fire-and-forget anchoring for a freshly created screening. */
  enqueue(screeningId: string): void {
    void this.anchorOne(screeningId).catch((e) =>
      this.logger.error(`anchor ${screeningId} failed: ${e?.message ?? e}`),
    );
  }

  /**
   * Reset all screenings that reached MAX_ATTEMPTS in Failed state back to
   * Pending so the next sweep (or a fresh enqueue) can retry them.
   * Call this after fixing the underlying RPC/gas issue.
   * Returns the number of screenings re-queued.
   */
  async retryFailed(): Promise<{ requeued: number }> {
    const result = await this.screeningModel.updateMany(
      { 'blockchain.status': AnchorStatus.Failed },
      { $set: { 'blockchain.status': AnchorStatus.Pending, 'blockchain.attempts': 0, 'blockchain.error': undefined } },
    );
    const requeued = result.modifiedCount;
    this.logger.log(`retryFailed: reset ${requeued} failed screenings to pending`);
    // Kick off a sweep immediately so they don't have to wait for the next interval
    void this.sweep().catch((e) => this.logger.error(`post-retry sweep failed: ${e?.message ?? e}`));
    return { requeued };
  }

  /** Sweep pending/failed screenings and (re)attempt anchoring. */
  async sweep(): Promise<void> {
    if (!this.starknet.isEnabled()) return;
    const due = await this.screeningModel
      .find({
        'blockchain.status': { $in: [AnchorStatus.Pending, AnchorStatus.Failed] },
        'blockchain.attempts': { $lt: MAX_ATTEMPTS },
      })
      .limit(20)
      .select('_id');
    for (const doc of due) {
      await this.anchorOne(doc.id);
    }
  }

  /** Anchor a single screening; idempotent and safe to retry. */
  async anchorOne(screeningId: string): Promise<void> {
    if (!this.starknet.isEnabled()) return;

    const screening = await this.screeningModel.findById(screeningId);
    if (!screening) return;
    if (screening.blockchain.status === AnchorStatus.Anchored) return;
    if (screening.blockchain.attempts >= MAX_ATTEMPTS) return;

    // Mark in-flight
    screening.blockchain.status = AnchorStatus.Anchoring;
    screening.blockchain.attempts += 1;
    await screening.save();

    try {
      const clinic = await this.clinics.findById(screening.clinic.toString());

      // Ensure the facility exists on-chain (first-run safety)
      if (!clinic.onChain?.registered) {
        const { txHash } = await this.starknet.registerFacility(clinic.code, clinic.name);
        clinic.onChain = { registered: true, facilityCode: clinic.code, txHash };
        await clinic.save();
      }

      const createdAt = (screening as unknown as { createdAt?: Date }).createdAt ?? new Date();
      const capturedAt = screening.sync?.capturedAt ?? createdAt;
      const timestamp = Math.floor(new Date(capturedAt).getTime() / 1000);

      const result = await this.starknet.anchorScreening({
        timestamp,
        riskLevel: RISK_MAP[screening.ai.riskLevel],
        facilityCode: clinic.code,
        isReferral: screening.isReferral,
      });

      screening.blockchain.status = AnchorStatus.Anchored;
      screening.blockchain.proof = result.proof;
      screening.blockchain.txHash = result.txHash;
      screening.blockchain.contractAddress = result.contractAddress;
      screening.blockchain.blockNumber = result.blockNumber ?? undefined;
      screening.blockchain.fee = result.fee ?? undefined;
      screening.blockchain.feeUnit = result.feeUnit ?? undefined;
      screening.blockchain.anchoredAt = new Date();
      screening.blockchain.error = undefined;
      await screening.save();
      this.logger.log(`Anchored screening ${screeningId} (tx ${result.txHash})`);
    } catch (err) {
      screening.blockchain.status = AnchorStatus.Failed;
      screening.blockchain.error = err instanceof Error ? err.message : String(err);
      await screening.save();
      throw err;
    }
  }
}
