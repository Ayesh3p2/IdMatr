import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { normalizeOperatorRole } from './roles.js';

@Injectable()
export class ControlPlaneRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const role = normalizeOperatorRole(request.user?.role);

    if (!requiredRoles.includes(role)) {
      throw new ForbiddenException('Insufficient privileges');
    }

    return true;
  }
}
