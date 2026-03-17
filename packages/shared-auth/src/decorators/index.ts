import { SetMetadata, UseGuards } from '@nestjs/common';
import { NatsJwtGuard, TenantContextGuard, RolesGuard, PermissionGuard } from './guards';

/**
 * @Roles decorator - validates user has one of specified roles
 * Usage: @Roles('admin', 'super_admin')
 */
export const Roles = (...roles: string[]) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata('roles', roles)(target, propertyKey, descriptor);
    UseGuards(RolesGuard)(target, propertyKey, descriptor);
  };
};

/**
 * @Permissions decorator - validates user has all specified permissions
 * Usage: @Permissions('read:users', 'write:settings')
 */
export const Permissions = (...permissions: string[]) => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata('permissions', permissions)(target, propertyKey, descriptor);
    UseGuards(PermissionGuard)(target, propertyKey, descriptor);
  };
};

/**
 * @ServiceAuth decorator - validates NATS message is from authorized service
 * Usage: @ServiceAuth() on NATS message handlers
 */
export const ServiceAuth = () => {
  return UseGuards(NatsJwtGuard);
};

/**
 * @TenantScoped decorator - validates tenant context and prevents cross-tenant access
 * Usage: @TenantScoped() on controllers/handlers
 */
export const TenantScoped = () => {
  return UseGuards(TenantContextGuard);
};

/**
 * @SecureHandler decorator - combines service auth + tenant scope
 * Usage: @SecureHandler() on all sensitive NATS message handlers
 */
export const SecureHandler = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    UseGuards(NatsJwtGuard)(target, propertyKey, descriptor);
    UseGuards(TenantContextGuard)(target, propertyKey, descriptor);
  };
};

/**
 * @PublicEndpoint decorator - explicitly marks endpoint as public (no auth required)
 * Usage: @PublicEndpoint() on login, health check, etc.
 */
export const PublicEndpoint = () => {
  return SetMetadata('isPublic', true);
};

/**
 * @RequireAudit decorator - logs this action to audit trail
 * Usage: @RequireAudit('user.create') on sensitive operations
 */
export const RequireAudit = (action: string, category: string = 'default') => {
  return SetMetadata('auditAction', { action, category });
};

/**
 * @AdminOnly decorator - requires admin role
 * Usage: @AdminOnly() as shorthand for @Roles('admin', 'super_admin')
 */
export const AdminOnly = () => {
  return Roles('admin', 'super_admin');
};

/**
 * @SuperAdminOnly decorator - requires super_admin role
 * Usage: @SuperAdminOnly()
 */
export const SuperAdminOnly = () => {
  return Roles('super_admin', 'platform_operator');
};
