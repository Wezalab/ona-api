import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';

export interface AuditEntry {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: string;
  role?: string;
  ip?: string;
  userAgent?: string;
  error: boolean;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(@InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>) {}

  /** Best-effort write; auditing must never break the request path. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditModel.create({
        method: entry.method,
        path: entry.path,
        statusCode: entry.statusCode,
        durationMs: entry.durationMs,
        user: entry.userId ? new Types.ObjectId(entry.userId) : undefined,
        role: entry.role,
        ip: entry.ip,
        userAgent: entry.userAgent,
        error: entry.error,
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log: ${err instanceof Error ? err.message : err}`);
    }
  }

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<AuditLog>> {
    const [items, total] = await Promise.all([
      this.auditModel
        .find()
        .skip(pagination.skip)
        .limit(pagination.limit)
        .sort({ createdAt: -1 })
        .populate('user', 'email name'),
      this.auditModel.countDocuments(),
    ]);
    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      pages: Math.ceil(total / pagination.limit),
    };
  }
}
