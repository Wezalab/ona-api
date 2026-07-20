import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Screening, ScreeningSchema } from '../screenings/schemas/screening.schema';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Screening.name, schema: ScreeningSchema }])],
  providers: [StatisticsService],
  controllers: [StatisticsController],
  exports: [StatisticsService],
})
export class StatisticsModule {}
