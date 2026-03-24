import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredRoles) {
      return true;
    }
    
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // 🔒 FIXED: Validate user exists and has tenant context
    if (!user || !user.tenantId) {
      throw new UnauthorizedException('User not authenticated or missing tenant context');
    }
    
    // 🔒 FIXED: Validate tenant context matches request
    const requestTenantId = request.tenantId || request.params.tenantId || request.query.tenantId;
    if (requestTenantId && user.tenantId !== requestTenantId) {
      throw new UnauthorizedException('Tenant context mismatch');
    }
    
    // 🔒 FIXED: Check role match
    const hasRole = requiredRoles.some((role) => user.role === role);
    if (!hasRole) {
      throw new UnauthorizedException('Insufficient permissions');
    }
    
    return true;
  }
}
