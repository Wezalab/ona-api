import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnchorStatus, Screening, ScreeningDocument } from '../screenings/schemas/screening.schema';

export interface OverviewStats {
  totalScreenings: number;
  referrals: number;
  referralRate: number;
  riskDistribution: Record<string, number>;
  anchoring: Record<string, number>;
}

@Injectable()
export class StatisticsService {
  constructor(
    @InjectModel(Screening.name) private readonly screeningModel: Model<ScreeningDocument>,
  ) {}

  async overview(): Promise<OverviewStats> {
    const [totalScreenings, referrals, riskAgg, anchorAgg] = await Promise.all([
      this.screeningModel.countDocuments(),
      this.screeningModel.countDocuments({ isReferral: true }),
      this.screeningModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$ai.riskLevel', count: { $sum: 1 } } },
      ]),
      this.screeningModel.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$blockchain.status', count: { $sum: 1 } } },
      ]),
    ]);

    const riskDistribution = riskAgg.reduce<Record<string, number>>((acc, r) => {
      acc[r._id] = r.count;
      return acc;
    }, {});
    const anchoring = Object.values(AnchorStatus).reduce<Record<string, number>>((acc, s) => {
      acc[s] = 0;
      return acc;
    }, {});
    anchorAgg.forEach((a) => (anchoring[a._id] = a.count));

    return {
      totalScreenings,
      referrals,
      referralRate: totalScreenings ? referrals / totalScreenings : 0,
      riskDistribution,
      anchoring,
    };
  }

  /** Per-clinic breakdown with names, for the internal admin dashboard. */
  async byClinic() {
    return this.screeningModel.aggregate([
      {
        $group: {
          _id: '$clinic',
          screenings: { $sum: 1 },
          referrals: { $sum: { $cond: ['$isReferral', 1, 0] } },
        },
      },
      { $lookup: { from: 'clinics', localField: '_id', foreignField: '_id', as: 'clinic' } },
      { $unwind: { path: '$clinic', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          clinicId: '$_id',
          code: '$clinic.code',
          name: '$clinic.name',
          screenings: 1,
          referrals: 1,
        },
      },
      { $sort: { screenings: -1 } },
    ]);
  }

  /** Daily screening counts over the trailing `days` window. */
  async timeseries(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.screeningModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          referrals: { $sum: { $cond: ['$isReferral', 1, 0] } },
        },
      },
      { $project: { _id: 0, date: '$_id', count: 1, referrals: 1 } },
      { $sort: { date: 1 } },
    ]);
  }
}
