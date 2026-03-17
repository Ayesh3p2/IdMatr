import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SetMetadata } from '@nestjs/common';

/**
 * Audit Log Event Model
 */
export interface AuditLogEvent {
  id: string;
  timestamp: Date;
  tenantId?: string;
  actor: {
    type: 'operator' | 'tenant_user' | 'service';
    id: string;
    email?: string;
  };
  action: string;
  category: 'auth' | 'user' | 'tenant' | 'config' | 'access' | 'integration' | 'security' | 'other';
  resource?: {
    type: string;
    id: string;
  };
  changes?: {
    before?: any;
    after?: any;
  };
  result: 'success' | 'failure' | 'denied';
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Audit Logger Service - centralized event logging
 * Inject into any service to log security events
 */
@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger('AuditLogger');

  async logEvent(event: Omit<AuditLogEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: AuditLogEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      ...event,
    };

    // Log to structured logger
    this.logger.log(JSON.stringify(auditEvent));

    // Attempt to send to audit service via NATS
    // (Implementation depends on NATS client availability)
    try {
      // await this.natsClient.send('audit.log', auditEvent).toPromise();
    } catch (error) {
      this.logger.error(`Failed to send audit event: ${error.message}`);
    }
  }

  /**
   * Auth Event - login, logout, password change
   */
  async logAuthEvent(
    actor: AuditLogEvent['actor'],
    action: 'login' | 'logout' | 'password.change' | 'mfa.enable' | 'mfa.disable',
    result: 'success' | 'failure',
    metadata?: any,
  ) {
    await this.logEvent({
      tenantId: metadata?.tenantId,
      actor,
      action,
      category: 'auth',
      result,
      reason: metadata?.reason,
      ipAddress: metadata?.ipAddress,
      metadata,
    });
  }

  /**
   * Access Control Event - permission denial, role grant/revoke
   */
  async logAccessEvent(
    actor: AuditLogEvent['actor'],
    action: 'permission.granted' | 'permission.revoked' | 'role.changed' | 'access.denied',
    resource: AuditLogEvent['resource'],
    result: 'success' | 'denied',
    metadata?: any,
  ) {
    await this.logEvent({
      actor,
      action,
      category: 'access',
      resource,
      result,
      ipAddress: metadata?.ipAddress,
      metadata,
    });
  }

  /**
   * Configuration Change Event
   */
  async logConfigEvent(
    actor: AuditLogEvent['actor'],
    action: string,
    tenantId: string,
    changes: { before: any; after: any },
    metadata?: any,
  ) {
    await this.logEvent({
      tenantId,
      actor,
      action,
      category: 'config',
      resource: { type: 'config', id: action },
      changes,
      result: 'success',
      metadata,
    });
  }

  /**
   * Security Event - suspicious activity, violations
   */
  async logSecurityEvent(
    actor: AuditLogEvent['actor'],
    action: string,
    result: 'success' | 'failure' | 'denied',
    metadata?: any,
  ) {
    await this.logEvent({
      actor,
      action,
      category: 'security',
      result,
      ipAddress: metadata?.ipAddress,
      metadata,
    });
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Audit Interceptor - automatically logs HTTP requests to sensitive endpoints
 * Logs are created for endpoints marked with @Audited()
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const auditMetadata = Reflect.getMetadata('auditAction', context.getHandler());

    if (!auditMetadata) {
      return next.handle();  // No audit required
    }

    const startTime = Date.now();
    const { action, category } = auditMetadata;

    return next.handle().pipe(
      tap(
        async (response) => {
          // Log successful operation
          const duration = Date.now() - startTime;
          await this.auditService.logEvent({
            tenantId: request.tenantId,
            actor: {
              type: request.user?.type || 'tenant_user',
              id: request.user?.id || 'unknown',
              email: request.user?.email,
            },
            action,
            category,
            resource: {
              type: context.getClass().name,
              id: request.params?.id || 'N/A',
            },
            result: 'success',
            ipAddress: this.getClientIp(request),
            userAgent: request.headers['user-agent'],
            metadata: {
              method: request.method,
              path: request.path,
              durationMs: duration,
              statusCode: context.switchToHttp().getResponse().statusCode,
            },
          });
        },
        async (error) => {
          // Log failed operation
          const duration = Date.now() - startTime;
          await this.auditService.logEvent({
            tenantId: request.tenantId,
            actor: {
              type: request.user?.type || 'tenant_user',
              id: request.user?.id || 'unknown',
              email: request.user?.email,
            },
            action,
            category,
            resource: {
              type: context.getClass().name,
              id: request.params?.id || 'N/A',
            },
            result: 'failure',
            reason: error.message,
            ipAddress: this.getClientIp(request),
            userAgent: request.headers['user-agent'],
            metadata: {
              method: request.method,
              path: request.path,
              durationMs: duration,
              error: error.message,
            },
          });
          throw error;
        },
      ),
    );
  }

  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.connection?.remoteAddress ||
      'unknown'
    );
  }
}

/**
 * @Audited decorator - marks action for audit logging
 * Usage: @Audited('user.create', 'user')
 */
export const Audited = (action: string, category: string = 'other') => {
  return SetMetadata('auditAction', { action, category });
};
