import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClinicDocument = HydratedDocument<Clinic>;

export enum ClinicStatus {
  Active = 'active',
  Inactive = 'inactive',
}

/** On-chain registration metadata for the facility. */
@Schema({ _id: false })
export class ClinicOnChain {
  @Prop({ default: false })
  registered: boolean;

  @Prop()
  facilityCode?: number;

  @Prop()
  txHash?: string;
}
const ClinicOnChainSchema = SchemaFactory.createForClass(ClinicOnChain);

@Schema({ timestamps: true })
export class Clinic {
  /** Numeric facility code, unique; used as the on-chain facility_code (u32). */
  @Prop({ required: true, unique: true, index: true })
  code: number;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  province?: string;

  @Prop({ trim: true })
  district?: string;

  @Prop({ trim: true })
  healthZone?: string;

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop({ trim: true })
  address?: string;

  @Prop({ type: String, enum: ClinicStatus, default: ClinicStatus.Active, index: true })
  status: ClinicStatus;

  @Prop({ type: ClinicOnChainSchema, default: () => ({ registered: false }) })
  onChain: ClinicOnChain;
}

export const ClinicSchema = SchemaFactory.createForClass(Clinic);
