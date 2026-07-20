import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Patient, PatientDocument } from './schemas/patient.schema';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class PatientsService {
  constructor(@InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument>) {}

  async create(dto: CreatePatientDto, user: AuthUser): Promise<PatientDocument> {
    this.assertClinicAccess(user, dto.clinic);
    return this.patientModel.create({
      reference: dto.reference,
      age: dto.age,
      sex: dto.sex,
      clinic: new Types.ObjectId(dto.clinic),
      createdBy: new Types.ObjectId(user.userId),
    });
  }

  async findAll(pagination: PaginationDto, user: AuthUser): Promise<PaginatedResult<Patient>> {
    const filter: FilterQuery<PatientDocument> = {};
    // Health workers only see their own clinic's patients
    if (user.role === Role.HealthWorker && user.clinicId) {
      filter.clinic = new Types.ObjectId(user.clinicId);
    }
    const [items, total] = await Promise.all([
      this.patientModel
        .find(filter)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .sort({ createdAt: -1 }),
      this.patientModel.countDocuments(filter),
    ]);
    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      pages: Math.ceil(total / pagination.limit),
    };
  }

  async findById(id: string, user: AuthUser): Promise<PatientDocument> {
    const patient = await this.patientModel.findById(id);
    if (!patient) throw new NotFoundException('Patient not found');
    this.assertClinicAccess(user, patient.clinic.toString());
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto, user: AuthUser): Promise<PatientDocument> {
    await this.findById(id, user); // access check
    const update: Record<string, unknown> = { ...dto };
    if (dto.clinic) update.clinic = new Types.ObjectId(dto.clinic);
    const patient = await this.patientModel.findByIdAndUpdate(id, update, { new: true });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    await this.findById(id, user); // access check
    await this.patientModel.findByIdAndDelete(id);
  }

  /** Health workers are confined to their assigned clinic. */
  private assertClinicAccess(user: AuthUser, clinicId: string): void {
    if (user.role === Role.HealthWorker && user.clinicId && user.clinicId !== clinicId) {
      throw new ForbiddenException('Patient belongs to another clinic');
    }
  }
}
