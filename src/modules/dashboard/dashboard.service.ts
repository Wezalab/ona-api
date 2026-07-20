import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { StatisticsService } from '../statistics/statistics.service';
import { StarknetService } from '../blockchain/starknet.service';
import { Clinic, ClinicDocument, ClinicStatus } from '../clinics/schemas/clinic.schema';
import { Patient, PatientDocument } from '../patients/schemas/patient.schema';

/**
 * Internal admin dashboard snapshot. Reads from MongoDB (operational truth).
 * The PUBLIC dashboard is served by the website reading StarkNet directly —
 * this endpoint is intentionally auth-gated and never public.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly statistics: StatisticsService,
    private readonly starknet: StarknetService,
    @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
    @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument>,
  ) {}

  async summary() {
    const [overview, totalClinics, activeClinics, totalPatients, network] = await Promise.all([
      this.statistics.overview(),
      this.clinicModel.countDocuments(),
      this.clinicModel.countDocuments({ status: ClinicStatus.Active }),
      this.patientModel.countDocuments(),
      this.starknet.getNetworkStatus(),
    ]);

    return {
      screenings: overview,
      clinics: { total: totalClinics, active: activeClinics },
      patients: { total: totalPatients },
      blockchain: network,
      generatedAt: new Date().toISOString(),
    };
  }
}
