import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PatientDocument = HydratedDocument<Patient>;

export enum Sex {
  Male = 'male',
  Female = 'female',
  Other = 'other',
}

/**
 * Minimal, pseudonymized patient record. Identifying data is intentionally
 * kept out of the model; `reference` is a clinic-assigned pseudonym.
 */
@Schema({ timestamps: true })
export class Patient {
  @Prop({ required: true, trim: true, index: true })
  reference: string;

  @Prop({ min: 0, max: 120 })
  age?: number;

  @Prop({ type: String, enum: Sex })
  sex?: Sex;

  @Prop({ type: Types.ObjectId, ref: 'Clinic', required: true, index: true })
  clinic: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);
// Pseudonym unique within a clinic
PatientSchema.index({ clinic: 1, reference: 1 }, { unique: true });
