import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuditLogsService } from './audit-logs.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

const AUDITED_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Records state-changing requests (POST/PATCH/PUT/DELETE) to the audit log
 * after the response is produced. GET traffic is ignored by design.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogs: AuditLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    if (!AUDITED_METHODS.has(req.method)) return next.handle();

    const start = Date.now();
    const user = req.user as AuthUser | undefined;
    const base = {
      method: req.method,
      path: req.originalUrl ?? req.url,
      userId: user?.userId,
      role: user?.role,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    };

    const write = (statusCode: number, error: boolean) =>
      void this.auditLogs.record({ ...base, statusCode, durationMs: Date.now() - start, error });

    return next.handle().pipe(
      tap(() => write(context.switchToHttp().getResponse()?.statusCode ?? 200, false)),
      catchError((err) => {
        write(err?.status ?? 500, true);
        throw err;
      }),
    );
  }
}
