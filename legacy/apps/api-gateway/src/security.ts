import type { Request } from 'express';

export const AUTH_COOKIE_NAME = 'idmatr_session';
export const TENANT_ADMIN_ROLE = 'tenant_admin';
export const TENANT_USER_ROLE = 'tenant_user';
export const VIEWER_ROLE = 'viewer';

export function normalizeTenantRole(role?: string | null) {
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

export function parseCookie(req: Request | any, name: string) {
  const rawHeader = req?.headers?.cookie;
  const header = Array.isArray(rawHeader) ? rawHeader.join(';') : rawHeader;
  if (!header) return null;

  for (const part of header.split(';')) {
    const [cookieName, ...value] = part.trim().split('=');
    if (cookieName === name) {
      return decodeURIComponent(value.join('='));
    }
  }

  return null;
}

export function buildSessionCookie(token: string, maxAgeSeconds = 60 * 60 * 8) {
  const isSecure = process.env.NODE_ENV === 'production';
  return [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    isSecure ? 'Secure' : '',
    `Max-Age=${maxAgeSeconds}`,
  ].filter(Boolean).join('; ');
}

export function buildClearedCookie() {
  const isSecure = process.env.NODE_ENV === 'production';
  return [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    isSecure ? 'Secure' : '',
    'Max-Age=0',
  ].filter(Boolean).join('; ');
}

export function getNatsConnectionOptions() {
  if (!process.env.NATS_URL || !process.env.NATS_USER || !process.env.NATS_PASSWORD) {
    throw new Error('NATS_URL, NATS_USER, and NATS_PASSWORD env vars are required');
  }

  return {
    servers: [process.env.NATS_URL],
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASSWORD,
  };
}
