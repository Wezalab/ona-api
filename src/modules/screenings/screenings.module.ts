import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Screening, ScreeningSchema } from './schemas/screening.schema';
import { ScreeningsService } from './screenings.service';
import { ScreeningsController } from './screenings.controller';
import { AnchorService } from './anchor.service';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ClinicsModule } from '../clinics/clinics.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Screening.name, schema: ScreeningSchema }]),
    BlockchainModule,
    ClinicsModule,
  ],
  providers: [ScreeningsService, AnchorService],
  controllers: [ScreeningsController],
  exports: [ScreeningsService, AnchorService],
})
export class ScreeningsModule {}
