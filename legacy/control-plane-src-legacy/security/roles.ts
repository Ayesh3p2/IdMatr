export const PLATFORM_OPERATOR_ROLE = 'platform_operator';
export const TENANT_ADMIN_ROLE = 'tenant_admin';
export const TENANT_USER_ROLE = 'tenant_user';
export const VIEWER_ROLE = 'viewer';

export const PRIVILEGED_TENANT_ROLES = new Set([TENANT_ADMIN_ROLE]);
export const PRIVILEGED_OPERATOR_ROLES = new Set([PLATFORM_OPERATOR_ROLE]);

export function normalizeOperatorRole(role?: string | null): string {
  if (!role) return PLATFORM_OPERATOR_ROLE;
  if (role === 'super_admin' || role === 'operator') return PLATFORM_OPERATOR_ROLE;
  return role;
}

export function normalizeTenantRole(role?: string | null): string {
  if (!role) return TENANT_USER_ROLE;

  switch (role) {
    case 'TENANT_SUPER_ADMIN':
    case 'TENANT_ADMIN':
    case TENANT_ADMIN_ROLE:
      return TENANT_ADMIN_ROLE;
    case 'TENANT_VIEWER':
    case VIEWER_ROLE:
      return VIEWER_ROLE;
    case 'TENANT_SECURITY_ANALYST':
    case TENANT_USER_ROLE:
      return TENANT_USER_ROLE;
    default:
      return role;
  }
}

export function isPrivilegedTenantRole(role?: string | null): boolean {
  return PRIVILEGED_TENANT_ROLES.has(normalizeTenantRole(role));
}

export function isPrivilegedOperatorRole(role?: string | null): boolean {
  return PRIVILEGED_OPERATOR_ROLES.has(normalizeOperatorRole(role));
}
