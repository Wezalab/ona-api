import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Role } from '../../../common/enums/role.enum';

export type UserDocument = HydratedDocument<User>;

export enum UserStatus {
  Active = 'active',
  Suspended = 'suspended',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ type: String, enum: Role, default: Role.HealthWorker, index: true })
  role: Role;

  /** Facility the health worker belongs to (optional for admins). */
  @Prop({ type: Types.ObjectId, ref: 'Clinic', index: true })
  clinic?: Types.ObjectId;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.Active })
  status: UserStatus;

  /** Hashed refresh token for rotation/revocation. */
  @Prop({ select: false })
  refreshTokenHash?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
