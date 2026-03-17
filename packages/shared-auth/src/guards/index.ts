import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';

/**
 * JWT Guard for NATS Message Patterns - validates service-to-service authentication
 * Required for all microservice communication
 */
@Injectable()
export class NatsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const payload = context.switchToRpc().getData();

    // NATS messages must include JWT token in headers or payload
    const token = payload.__servicejwt__ || payload?.headers?.['x-service-jwt'];

    if (!token) {
      throw new UnauthorizedException('Service JWT required in NATS message (field: __servicejwt__)');
    }

    try {
      const decoded = this.jwtService.verify(token, {
        secret: process.env.SERVICE_JWT_SECRET,
      });

      // Attach decoded token to payload for downstream use
      payload.__serviceauth__ = decoded;
      return true;
    } catch (error) {
      throw new UnauthorizedException(`Invalid service JWT: ${error.message}`);
    }
  }
}

/**
 * Tenant Context Guard - validates tenant_id matches authenticated user/service
 * Prevents cross-tenant access
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const rpcData = context.switchToRpc().getData();
    const httpRequest = context.switchToHttp().getRequest();
    const request = rpcData || httpRequest;

    // Get authenticated context
    const serviceAuth = request.__serviceauth__;
    const userAuth = request?.user;
    const authContext = serviceAuth || userAuth;

    if (!authContext) {
      throw new UnauthorizedException('No authentication context');
    }

    // Get requested tenant
    const requestedTenantId = request.tenantId || request.tenant_id;

    // Validate tenant ownership
    if (authContext.tenantId && authContext.tenantId !== requestedTenantId) {
      // Service/user is scoped to specific tenant but requesting different tenant
      if (authContext.role !== 'system_admin' && authContext.role !== 'super_admin') {
        throw new ForbiddenException(
          `Tenant context mismatch: service scoped to ${authContext.tenantId}, ` +
          `requested ${requestedTenantId}`
        );
      }
    }

    // Attach validated context
    request.__validatedauth__ = authContext;
    request.__validatedtenantid__ = requestedTenantId;
    return true;
  }
}

/**
 * Role-Based Access Control Guard
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor() {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = Reflect.getMetadata('roles', context.getHandler());

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;  // No role requirement
    }

    const rpcData = context.switchToRpc().getData();
    const request = context.switchToHttp().getRequest() || rpcData;
    const authContext = request.__validatedauth__ || request?.user;

    if (!authContext) {
      throw new UnauthorizedException('No authentication context');
    }

    const hasRole = requiredRoles.includes(authContext.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}. ` +
        `User role: ${authContext.role}`
      );
    }

    return true;
  }
}

/**
 * Permission-Level Guard - checks resource + action permissions
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = Reflect.getMetadata('permissions', context.getHandler());

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authContext = request?.user;

    if (!authContext) {
      throw new UnauthorizedException('No authentication context');
    }

    const hasPermission = requiredPermissions.every((permission: string) =>
      authContext.permissions?.includes(permission)
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`
      );
    }

    return true;
  }
}
