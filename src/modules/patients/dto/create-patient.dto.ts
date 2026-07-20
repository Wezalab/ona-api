import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsMongoId, IsOptional, IsString, Max, Min } from 'class-validator';
import { Sex } from '../schemas/patient.schema';

export class CreatePatientDto {
  @ApiProperty({ description: 'Clinic-assigned pseudonym', example: 'PT-2026-0001' })
  @IsString()
  reference: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 120 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  age?: number;

  @ApiPropertyOptional({ enum: Sex })
  @IsOptional()
  @IsEnum(Sex)
  sex?: Sex;

  @ApiProperty({ description: 'Clinic ObjectId' })
  @IsMongoId()
  clinic: string;
}
