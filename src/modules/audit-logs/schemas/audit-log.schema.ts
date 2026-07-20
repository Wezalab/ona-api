import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

/**
 * Append-only record of state-changing API calls. Read/GET traffic is not
 * recorded to keep the collection meaningful and small.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  @Prop({ required: true, index: true })
  method: string;

  @Prop({ required: true })
  path: string;

  @Prop({ index: true })
  statusCode: number;

  @Prop()
  durationMs: number;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  user?: Types.ObjectId;

  @Prop()
  role?: string;

  @Prop()
  ip?: string;

  @Prop()
  userAgent?: string;

  @Prop({ default: false })
  error: boolean;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
