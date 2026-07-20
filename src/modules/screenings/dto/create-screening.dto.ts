import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { RiskLevel, SyncSource } from '../schemas/screening.schema';

export class AiResultDto {
  @ApiProperty({ example: 'cataract_suspected' })
  @IsString()
  prediction: string;

  @ApiProperty({ enum: RiskLevel })
  @IsEnum(RiskLevel)
  riskLevel: RiskLevel;

  @ApiProperty({ minimum: 0, maximum: 1, example: 0.92 })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @ApiPropertyOptional({ example: 'ona-vision-v1.3' })
  @IsOptional()
  @IsString()
  modelVersion?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  rawScores?: Record<string, number>;
}

export class DeviceInfoDto {
  @ApiPropertyOptional() @IsOptional() @IsString() platform?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() osVersion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() appVersion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deviceId?: string;
}

export class SyncInfoDto {
  @ApiPropertyOptional({ enum: SyncSource, default: SyncSource.Online })
  @IsOptional()
  @IsEnum(SyncSource)
  source?: SyncSource;

  @ApiPropertyOptional({ description: 'Client id for offline idempotency' })
  @IsOptional()
  @IsString()
  clientRecordId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  capturedAt?: Date;
}

export class CreateScreeningDto {
  @ApiProperty({ description: 'Patient ObjectId' })
  @IsMongoId()
  patient: string;

  @ApiProperty({ description: 'Clinic ObjectId (selected in the app)' })
  @IsMongoId()
  clinic: string;

  @ApiProperty({ type: AiResultDto })
  @ValidateNested()
  @Type(() => AiResultDto)
  ai: AiResultDto;

  @ApiPropertyOptional({ type: [String], description: 'Upload ObjectIds for captured images' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  images?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isReferral?: boolean;

  @ApiPropertyOptional({ type: DeviceInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device?: DeviceInfoDto;

  @ApiPropertyOptional({ type: SyncInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SyncInfoDto)
  sync?: SyncInfoDto;
}
