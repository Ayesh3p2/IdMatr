export const ROLE_HIERARCHY = {
  platform_admin: 4,
  tenant_admin: 3,
  analyst: 2,
  user: 1,
} as const;

export const ROLE_PERMISSIONS = {
  platform_admin: [
    'tenant:create',
    'tenant:read',
    'tenant:update',
    'tenant:delete',
    'tenant:manage',
    'user:create',
    'user:read',
    'user:update',
    'user:delete',
    'user:manage',
    'system:read',
    'system:manage',
    'audit:read',
    'settings:manage',
  ],
  tenant_admin: [
    'user:create',
    'user:read',
    'user:update',
    'user:delete',
    'user:manage',
    'tenant:read',
    'tenant:update',
    'audit:read',
    'settings:read',
  ],
  analyst: [
    'user:read',
    'audit:read',
    'reports:read',
    'analytics:read',
  ],
  user: [
    'profile:read',
    'profile:update',
    'mfa:manage',
  ],
} as const;

export type Permission = typeof ROLE_PERMISSIONS[keyof typeof ROLE_PERMISSIONS][number];
