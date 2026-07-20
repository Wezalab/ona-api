import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AnchorStatus, Screening, ScreeningDocument, SyncSource } from './schemas/screening.schema';
import { CreateScreeningDto } from './dto/create-screening.dto';
import { AnchorService } from './anchor.service';
import { StarknetService } from '../blockchain/starknet.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';

export interface SyncResult {
  created: number;
  duplicates: number;
  ids: string[];
}

@Injectable()
export class ScreeningsService {
  constructor(
    @InjectModel(Screening.name) private readonly screeningModel: Model<ScreeningDocument>,
    private readonly anchor: AnchorService,
    private readonly starknet: StarknetService,
  ) {}

  async create(dto: CreateScreeningDto, user: AuthUser): Promise<ScreeningDocument> {
    const screening = await this.persist(dto, user);
    this.anchor.enqueue(screening.id);
    return screening;
  }

  /** Batch offline sync. Idempotent per `sync.clientRecordId`. */
  async sync(dtos: CreateScreeningDto[], user: AuthUser): Promise<SyncResult> {
    const result: SyncResult = { created: 0, duplicates: 0, ids: [] };
    for (const dto of dtos) {
      const clientRecordId = dto.sync?.clientRecordId;
      if (clientRecordId) {
        const existing = await this.screeningModel.findOne({
          'sync.clientRecordId': clientRecordId,
        });
        if (existing) {
          result.duplicates += 1;
          result.ids.push(existing.id);
          continue;
        }
      }
      const screening = await this.persist(
        { ...dto, sync: { ...dto.sync, source: SyncSource.Offline } },
        user,
      );
      this.anchor.enqueue(screening.id);
      result.created += 1;
      result.ids.push(screening.id);
    }
    return result;
  }

  async findAll(pagination: PaginationDto, user: AuthUser): Promise<PaginatedResult<Screening>> {
    const filter: FilterQuery<ScreeningDocument> = {};
    if (user.role === Role.HealthWorker && user.clinicId) {
      filter.clinic = new Types.ObjectId(user.clinicId);
    }
    const [items, total] = await Promise.all([
      this.screeningModel
        .find(filter)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .sort({ createdAt: -1 })
        .populate('patient', 'reference')
        .populate('clinic', 'code name'),
      this.screeningModel.countDocuments(filter),
    ]);
    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      pages: Math.ceil(total / pagination.limit),
    };
  }

  async findById(id: string, user: AuthUser): Promise<ScreeningDocument> {
    const screening = await this.screeningModel
      .findById(id)
      .populate('patient', 'reference')
      .populate('clinic', 'code name');
    if (!screening) throw new NotFoundException('Screening not found');
    if (
      user.role === Role.HealthWorker &&
      user.clinicId &&
      screening.clinic._id?.toString() !== user.clinicId &&
      screening.clinic.toString() !== user.clinicId
    ) {
      throw new ForbiddenException('Screening belongs to another clinic');
    }
    return screening;
  }

  /** Blockchain reference + on-chain verification for a screening. */
  async getBlockchainRef(id: string, user: AuthUser) {
    const screening = await this.findById(id, user);
    const ref = screening.blockchain;
    let onChainVerified: boolean | null = null;
    if (ref.status === AnchorStatus.Anchored && ref.proof && this.starknet.isEnabled()) {
      onChainVerified = await this.starknet.isProofAnchored(ref.proof).catch(() => null);
    }
    return { ...((ref as any).toObject?.() ?? ref), onChainVerified };
  }

  private async persist(dto: CreateScreeningDto, user: AuthUser): Promise<ScreeningDocument> {
    const enabled = this.starknet.isEnabled();
    return this.screeningModel.create({
      patient: new Types.ObjectId(dto.patient),
      clinic: new Types.ObjectId(dto.clinic),
      healthWorker: new Types.ObjectId(user.userId),
      ai: dto.ai,
      images: (dto.images ?? []).map((i) => new Types.ObjectId(i)),
      isReferral: dto.isReferral ?? false,
      device: dto.device ?? {},
      sync: {
        source: dto.sync?.source ?? SyncSource.Online,
        clientRecordId: dto.sync?.clientRecordId,
        capturedAt: dto.sync?.capturedAt,
        syncedAt: new Date(),
      },
      blockchain: {
        status: enabled ? AnchorStatus.Pending : AnchorStatus.Disabled,
        attempts: 0,
      },
    });
  }
}
