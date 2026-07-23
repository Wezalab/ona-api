import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Account, Contract, RpcProvider, Signer, hash, num, shortString } from 'starknet';
import { AppConfig } from '../../config/configuration';
import { IMPACT_REGISTRY_ABI } from './abi/impact-registry.abi';

export type RiskLevel = 'low' | 'medium' | 'high';
export const RISK_CODE: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3 };

export interface ScreeningProofInput {
  timestamp: number; // unix seconds
  riskLevel: RiskLevel;
  facilityCode: number;
  isReferral: boolean;
}

export interface AnchorResult {
  proof: string;
  txHash: string;
  blockNumber: number | null;
  fee: string | null;
  feeUnit: string | null;
  contractAddress: string;
}

export interface NetworkStatus {
  connected: boolean;
  enabled: boolean;
  blockNumber: number | null;
  network: string;
  contractAddress: string;
}

/**
 * Low-level StarkNet integration for the ImpactRegistry v2 contract.
 * Pure chain operations (no database) so it stays easily testable and mockable.
 */
@Injectable()
export class StarknetService implements OnModuleInit {
  private readonly logger = new Logger(StarknetService.name);
  private provider!: RpcProvider;
  private account?: Account;
  private readonly contractAddress: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const sn = this.config.get('starknet', { infer: true });
    this.contractAddress = sn.contractAddress;
    this.enabled = sn.enabled;
  }

  onModuleInit(): void {
    const sn = this.config.get('starknet', { infer: true });
    this.provider = new RpcProvider({ nodeUrl: sn.rpcUrl });
    if (this.enabled) {
      this.account = new Account({
        provider: this.provider,
        address: sn.ownerAddress,
        signer: new Signer(sn.ownerPrivateKey),
      });
      this.logger.log(`StarkNet writer ready (contract ${this.contractAddress})`);
    } else {
      this.logger.warn('BLOCKCHAIN_ENABLED=false — on-chain writes are disabled');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getContractAddress(): string {
    return this.contractAddress;
  }

  // ─── Proof computation (mirrors mobile services/starknet.ts) ────────────────

  /**
   * Anonymized Poseidon proof. Inputs are non-identifying: timestamp, risk code,
   * facility code. No patient data is ever included.
   */
  computeProof(input: ScreeningProofInput): string {
    const riskCode = RISK_CODE[input.riskLevel];
    return hash.computePoseidonHash(
      num.toHex(input.timestamp),
      num.toHex(riskCode * 1000 + input.facilityCode),
    );
  }

  // ─── Reads ──────────────────────────────────────────────────────────────────

  private readContract(): Contract {
    return new Contract({
      abi: IMPACT_REGISTRY_ABI as any,
      address: this.contractAddress,
      providerOrAccount: this.provider,
    });
  }

  async getNetworkStatus(): Promise<NetworkStatus> {
    const sn = this.config.get('starknet', { infer: true });
    try {
      const block = await this.provider.getBlockLatestAccepted();
      return {
        connected: true,
        enabled: this.enabled,
        blockNumber: block.block_number,
        network: sn.network,
        contractAddress: this.contractAddress,
      };
    } catch {
      return {
        connected: false,
        enabled: this.enabled,
        blockNumber: null,
        network: sn.network,
        contractAddress: this.contractAddress,
      };
    }
  }

  async isProofAnchored(proof: string): Promise<boolean> {
    return Boolean(await this.readContract().is_proof_anchored(proof));
  }

  async isFacilityRegistered(code: number): Promise<boolean> {
    return Boolean(await this.readContract().is_facility_registered(code));
  }

  async getTransactionStatus(txHash: string): Promise<unknown> {
    return this.provider.getTransactionReceipt(txHash);
  }

  // ─── Writes (owner only) ────────────────────────────────────────────────────

  /**
   * Register/rename a facility on-chain so the public site can enumerate clinics.
   * `name` is stored as a felt252 short string (truncated to 31 chars).
   */
  async registerFacility(code: number, name: string): Promise<{ txHash: string }> {
    this.assertWriter();
    const encoded = shortString.encodeShortString(name.slice(0, 31));
    const resourceBounds = await this.buildInvokeBounds();
    const { transaction_hash } = await this.account!.execute(
      {
        contractAddress: this.contractAddress,
        entrypoint: 'register_facility',
        calldata: [num.toHex(code), encoded],
      },
      { resourceBounds },
    );
    await this.provider.waitForTransaction(transaction_hash);
    this.logger.log(`Registered facility ${code} on-chain (tx ${transaction_hash})`);
    return { txHash: transaction_hash };
  }

  /** Anchor an anonymized screening and update on-chain aggregates. */
  async anchorScreening(input: ScreeningProofInput): Promise<AnchorResult> {
    this.assertWriter();
    const proof = this.computeProof(input);
    const resourceBounds = await this.buildInvokeBounds();

    const { transaction_hash } = await this.account!.execute(
      {
        contractAddress: this.contractAddress,
        entrypoint: 'anchor_screening',
        calldata: [
          proof,
          num.toHex(input.timestamp),
          num.toHex(RISK_CODE[input.riskLevel]),
          num.toHex(input.facilityCode),
          input.isReferral ? '0x1' : '0x0',
        ],
      },
      { resourceBounds },
    );

    const receipt: any = await this.provider.waitForTransaction(transaction_hash);
    const blockNumber = typeof receipt?.block_number === 'number' ? receipt.block_number : null;
    const actualFee = receipt?.actual_fee;
    const fee = actualFee?.amount ?? (typeof actualFee === 'string' ? actualFee : null);
    const feeUnit = actualFee?.unit ?? null;

    return {
      proof,
      txHash: transaction_hash,
      blockNumber,
      fee: fee ?? null,
      feeUnit,
      contractAddress: this.contractAddress,
    };
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────────

  private assertWriter(): void {
    if (!this.enabled || !this.account) {
      throw new Error('Blockchain writes are disabled (BLOCKCHAIN_ENABLED=false)');
    }
  }

  /**
   * Manual resource bounds so starknet.js skips fee estimation — public RPC
   * nodes frequently return -32603 when simulating against this contract.
   * Invokes are cheap; these ceilings leave generous headroom.
   *
   * Guard: Cartridge Sepolia sometimes returns "0x0" (or omits price_in_fri)
   * for one or more gas tiers. A zero max_price_per_unit causes the sequencer
   * to reject the tx with "fee too low" even on testnet.  We apply a per-tier
   * minimum so the tx is always accepted when the account has sufficient STRK.
   */
  private async buildInvokeBounds() {
    const block: any = await this.provider.getBlockWithTxHashes('latest');
    const priceFri = (p?: { price_in_fri?: string }, floor = 1n): bigint => {
      const raw = p?.price_in_fri ? BigInt(p.price_in_fri) : 0n;
      return raw > 0n ? raw : floor;
    };
    const BUFFER = 3n;
    return {
      l1_gas: {
        max_amount: 0x400n,
        max_price_per_unit: priceFri(block.l1_gas_price, 1_000_000n) * BUFFER,
      },
      l1_data_gas: {
        max_amount: 0x20000n,
        max_price_per_unit: priceFri(block.l1_data_gas_price, 1_000_000n) * BUFFER,
      },
      l2_gas: {
        max_amount: 0x4000000n,
        max_price_per_unit: priceFri(block.l2_gas_price, 1_000_000_000n) * BUFFER,
      },
    };
  }
}
