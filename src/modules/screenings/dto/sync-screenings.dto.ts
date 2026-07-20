import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { CreateScreeningDto } from './create-screening.dto';

export class SyncScreeningsDto {
  @ApiProperty({ type: [CreateScreeningDto], description: 'Batch of offline-captured screenings' })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateScreeningDto)
  screenings: CreateScreeningDto[];
}
