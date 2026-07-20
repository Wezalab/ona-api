import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Min } from 'class-validator';
import { ClinicStatus } from '../schemas/clinic.schema';

export class CreateClinicDto {
  @ApiProperty({ description: 'Unique numeric facility code (on-chain u32)', example: 1 })
  @IsInt()
  @Min(1)
  code: number;

  @ApiProperty({ example: 'Clinique Ngaliema' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Kinshasa' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  healthZone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: ClinicStatus, default: ClinicStatus.Active })
  @IsOptional()
  @IsEnum(ClinicStatus)
  status?: ClinicStatus;
}
