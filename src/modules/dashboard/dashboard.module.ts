import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Clinic, ClinicSchema } from '../clinics/schemas/clinic.schema';
import { Patient, PatientSchema } from '../patients/schemas/patient.schema';
import { StatisticsModule } from '../statistics/statistics.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Clinic.name, schema: ClinicSchema },
      { name: Patient.name, schema: PatientSchema },
    ]),
    StatisticsModule,
    BlockchainModule,
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
