import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TENANT_ADMIN_ROLE, TENANT_USER_ROLE, VIEWER_ROLE, normalizeTenantRole } from './security';

/**
 * Role alias expansion — maps semantic role names to actual stored roles.
 *
 * 'admin'    — tenant_admin only (read and write)
 * 'analyst'  — tenant_admin + tenant_user (read-sensitive + write; no viewer)
 * 'readonly' — tenant_admin + tenant_user + viewer (genuinely non-sensitive reads)
 *
 * Security-sensitive endpoints (ITDR, risk, graph, attack paths) use 'analyst'
 * so that viewer-only accounts cannot access threat intelligence data.
 */
function expandRoleAliases(role: string) {
  switch (role) {
    case 'admin':
      return [TENANT_ADMIN_ROLE];
    case 'analyst':
      return [TENANT_ADMIN_ROLE, TENANT_USER_ROLE];
    case 'readonly':
      return [TENANT_ADMIN_ROLE, TENANT_USER_ROLE, VIEWER_ROLE];
    default:
      return [role];
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    if (!user || !user.roles) {
      throw new ForbiddenException('Access denied');
    }

    const userRoles = (user.roles as string[]).map((role) => normalizeTenantRole(role));
    const allowed = requiredRoles.some((role) =>
      expandRoleAliases(role).some((candidate) => userRoles.includes(candidate)),
    );

    if (!allowed) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
