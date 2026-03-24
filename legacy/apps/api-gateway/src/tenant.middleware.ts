import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AUTH_COOKIE_NAME, parseCookie } from './security';

/**
 * TenantMiddleware — extracts tenant context from every authenticated request.
 *
 * Tenant context is derived only from the authenticated JWT.
 *
 * The resolved tenantId is attached to `req.tenantId` so controllers can
 * include it in every downstream NATS message for strict data isolation.
 *
 * Routes that are truly cross-tenant (admin aggregates, health checks) set
 * `req.crossTenant = true` and skip tenant enforcement.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly CROSS_TENANT_PATHS = [
    '/api/health',
    '/api/auth/login',
    '/api/auth/me',
    '/api/auth/onboarding/complete',
    '/control/auth/login',     // Platform operator login (no tenant context)
    '/control/auth/logout',    // Platform operator logout
    '/control/auth/me',        // Platform operator self endpoint
    '/health',                 // Health check endpoints
    '/metrics',                // Metrics endpoints
  ];

  use(req: Request & { tenantId?: string; crossTenant?: boolean }, res: Response, next: NextFunction) {
    // Skip enforcement on public / cross-tenant paths
    const isCrossTenant = this.CROSS_TENANT_PATHS.some(p => req.path === p || req.path.includes(p));
    
    if (isCrossTenant) {
      req.crossTenant = true;
      return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : parseCookie(req, AUTH_COOKIE_NAME);
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
          if (payload.tenantId && this.isValidUuid(payload.tenantId)) {
            req.tenantId = payload.tenantId;
            return next();
          }
        }
      } catch {
        // AuthGuard handles signed JWT validation later.
      }
    }

    if (!req.crossTenant) {
      throw new ForbiddenException('Tenant context is required');
    }

    next();
  }

  private isValidUuid(v: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  }
}
