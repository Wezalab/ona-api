import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ScreeningDocument = HydratedDocument<Screening>;

export enum RiskLevel {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export enum SyncSource {
  Online = 'online',
  Offline = 'offline',
}

export enum AnchorStatus {
  Pending = 'pending',
  Anchoring = 'anchoring',
  Anchored = 'anchored',
  Failed = 'failed',
  Disabled = 'disabled',
}

/** AI prediction results embedded in the screening. */
@Schema({ _id: false })
export class AiResult {
  @Prop({ required: true, trim: true })
  prediction: string;

  @Prop({ type: String, enum: RiskLevel, required: true })
  riskLevel: RiskLevel;

  @Prop({ required: true, min: 0, max: 1 })
  confidence: number;

  @Prop({ trim: true })
  modelVersion?: string;

  @Prop({ type: Object })
  rawScores?: Record<string, number>;
}
const AiResultSchema = SchemaFactory.createForClass(AiResult);

@Schema({ _id: false })
export class DeviceInfo {
  @Prop() platform?: string;
  @Prop() osVersion?: string;
  @Prop() appVersion?: string;
  @Prop() deviceId?: string;
}
const DeviceInfoSchema = SchemaFactory.createForClass(DeviceInfo);

@Schema({ _id: false })
export class SyncInfo {
  @Prop({ type: String, enum: SyncSource, default: SyncSource.Online })
  source: SyncSource;

  /** Client-generated id for offline idempotency (indexed via schema.index below). */
  @Prop()
  clientRecordId?: string;

  @Prop()
  capturedAt?: Date;

  @Prop()
  syncedAt?: Date;
}
const SyncInfoSchema = SchemaFactory.createForClass(SyncInfo);

/** Blockchain anchoring reference (permanent DB↔chain mapping). */
@Schema({ _id: false })
export class BlockchainRef {
  @Prop({ type: String, enum: AnchorStatus, default: AnchorStatus.Pending, index: true })
  status: AnchorStatus;

  @Prop() proof?: string;
  @Prop() txHash?: string;
  @Prop() contractAddress?: string;
  @Prop() blockNumber?: number;
  @Prop() fee?: string;
  @Prop() feeUnit?: string;
  @Prop() anchoredAt?: Date;
  @Prop({ default: 0 }) attempts: number;
  @Prop() error?: string;
}
const BlockchainRefSchema = SchemaFactory.createForClass(BlockchainRef);

@Schema({ timestamps: true })
export class Screening {
  @Prop({ type: Types.ObjectId, ref: 'Patient', required: true, index: true })
  patient: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Clinic', required: true, index: true })
  clinic: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  healthWorker: Types.ObjectId;

  @Prop({ type: AiResultSchema, required: true })
  ai: AiResult;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Upload' }], default: [] })
  images: Types.ObjectId[];

  @Prop({ default: false })
  isReferral: boolean;

  @Prop({ type: DeviceInfoSchema, default: () => ({}) })
  device: DeviceInfo;

  @Prop({ type: SyncInfoSchema, default: () => ({ source: SyncSource.Online }) })
  sync: SyncInfo;

  @Prop({
    type: BlockchainRefSchema,
    default: () => ({ status: AnchorStatus.Pending, attempts: 0 }),
  })
  blockchain: BlockchainRef;
}

export const ScreeningSchema = SchemaFactory.createForClass(Screening);
// Idempotency for offline sync: a client record maps to at most one screening
ScreeningSchema.index({ 'sync.clientRecordId': 1 }, { unique: true, sparse: true });
