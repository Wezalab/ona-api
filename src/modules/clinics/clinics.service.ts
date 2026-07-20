import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Clinic, ClinicDocument, ClinicStatus } from './schemas/clinic.schema';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { StarknetService } from '../blockchain/starknet.service';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class ClinicsService {
  private readonly logger = new Logger(ClinicsService.name);

  constructor(
    @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
    private readonly starknet: StarknetService,
  ) {}

  async create(dto: CreateClinicDto): Promise<ClinicDocument> {
    const existing = await this.clinicModel.findOne({ code: dto.code });
    if (existing) throw new ConflictException(`Clinic code ${dto.code} already exists`);

    const clinic = await this.clinicModel.create(dto);
    await this.registerOnChain(clinic);
    return clinic;
  }

  /** Active clinics for the mobile app's clinic picker. */
  async findAllActive(): Promise<Clinic[]> {
    return this.clinicModel.find({ status: ClinicStatus.Active }).sort({ name: 1 });
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<Clinic>> {
    const [items, total] = await Promise.all([
      this.clinicModel.find().skip(pagination.skip).limit(pagination.limit).sort({ code: 1 }),
      this.clinicModel.countDocuments(),
    ]);
    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      pages: Math.ceil(total / pagination.limit),
    };
  }

  async findById(id: string): Promise<ClinicDocument> {
    const clinic = await this.clinicModel.findById(id);
    if (!clinic) throw new NotFoundException('Clinic not found');
    return clinic;
  }

  async findByCode(code: number): Promise<ClinicDocument | null> {
    return this.clinicModel.findOne({ code });
  }

  async update(id: string, dto: UpdateClinicDto): Promise<ClinicDocument> {
    const clinic = await this.clinicModel.findByIdAndUpdate(id, dto, { new: true });
    if (!clinic) throw new NotFoundException('Clinic not found');
    // Re-sync the on-chain name if it changed and the facility is registered
    if (dto.name && clinic.onChain?.registered) {
      await this.registerOnChain(clinic);
    }
    return clinic;
  }

  async remove(id: string): Promise<void> {
    const res = await this.clinicModel.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Clinic not found');
  }

  /**
   * Register (or rename) the facility on-chain. Best-effort: a chain failure
   * does not roll back the DB write; the clinic simply stays `registered=false`
   * and can be retried on the next update.
   */
  private async registerOnChain(clinic: ClinicDocument): Promise<void> {
    if (!this.starknet.isEnabled()) return;
    try {
      const { txHash } = await this.starknet.registerFacility(clinic.code, clinic.name);
      clinic.onChain = { registered: true, facilityCode: clinic.code, txHash };
      await clinic.save();
    } catch (err) {
      this.logger.error(
        `Failed to register clinic ${clinic.code} on-chain: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }
}
