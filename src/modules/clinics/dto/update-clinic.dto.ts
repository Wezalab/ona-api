import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateClinicDto } from './create-clinic.dto';

// Facility `code` is immutable once created (it is the on-chain key).
export class UpdateClinicDto extends PartialType(OmitType(CreateClinicDto, ['code'] as const)) {}
