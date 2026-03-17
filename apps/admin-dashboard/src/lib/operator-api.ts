const CP_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_CP_API_URL || 'http://localhost:3010')
    : (process.env.NEXT_PUBLIC_CP_API_URL || 'http://localhost:3010');

const OP_SESSION_FLAG = 'idmatr_operator_authenticated';

export function isOperatorAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(OP_SESSION_FLAG) === '1';
}

function markOperatorAuthenticated(value: boolean) {
  if (typeof window === 'undefined') return;
  if (value) {
    sessionStorage.setItem(OP_SESSION_FLAG, '1');
  } else {
    sessionStorage.removeItem(OP_SESSION_FLAG);
  }
}

export async function operatorLogout() {
  try {
    await cpFetch<{ success: boolean }>('/control/auth/logout', { method: 'POST', body: '{}' });
  } catch {
    // Best effort.
  }
  markOperatorAuthenticated(false);
  if (typeof window !== 'undefined') window.location.href = '/operator/login';
}

async function cpFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${CP_BASE}${path}`, { ...options, headers, credentials: 'include' });

  if (res.status === 401) {
    markOperatorAuthenticated(false);
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/operator/login')) {
      window.location.href = '/operator/login';
    }
    throw new Error('401 Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const msg = body?.errors ? body.errors.join('; ') : (body?.message || `Error ${res.status}`);
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

export async function operatorLogin(email: string, password: string, totpCode?: string) {
  const data = await cpFetch<{ operator: any }>('/control/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, totpCode }),
  });
  markOperatorAuthenticated(true);
  return data;
}

export function getOperatorMe() {
  return cpFetch<{ id: string; email: string; name: string; role: string; mfaEnabled: boolean }>('/control/auth/me');
}

export function getOperatorMfaStatus() {
  return cpFetch<{ mfaEnabled: boolean }>('/control/auth/mfa/status');
}

export function setupOperatorMfa() {
  return cpFetch<{ secret: string; otpAuthUrl: string; mfaEnabled: boolean }>('/control/auth/mfa/setup', {
    method: 'POST',
    body: '{}',
  });
}

export function enableOperatorMfa(code: string) {
  return cpFetch<{ success: boolean; mfaEnabled: boolean }>('/control/auth/mfa/enable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function disableOperatorMfa(code: string) {
  return cpFetch<{ success: boolean; mfaEnabled: boolean }>('/control/auth/mfa/disable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export type TenantStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'TRIAL' | 'OFFBOARDED' | 'DELETED';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  plan: string;
  status: TenantStatus;
  region: string;
  createdAt: string;
  onboardingCompletedAt: string | null;
  suspendedAt: string | null;
  suspendReason: string | null;
  settings?: { frameworks: string[]; discoveryEnabled: boolean; ssoEnforced: boolean };
  _count?: { apiKeys: number; tenantUsers: number };
}

export interface CreateTenantPayload {
  name: string;
  adminEmail: string;
  frameworks: string[];
  domain?: string;
  plan?: string;
  region?: string;
}

export interface CreateTenantResult extends Tenant {
  adminCreated: boolean;
  adminEmail?: string;
  onboardingUrl?: string;
  adminUserId?: string;
  onboardingNote?: string;
}

export function getTenants(filters?: { status?: string; plan?: string; search?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.plan) params.set('plan', filters.plan);
  if (filters?.search) params.set('search', filters.search);
  const qs = params.toString();
  return cpFetch<Tenant[]>(`/control/tenants${qs ? `?${qs}` : ''}`);
}

export function getTenantStats() {
  return cpFetch<any>('/control/tenants/stats');
}

export function getTenant(id: string) {
  return cpFetch<Tenant & { tenantUsers: any[]; integrations: any[]; apiKeys: any[] }>(`/control/tenants/${id}`);
}

export function createTenant(data: CreateTenantPayload) {
  return cpFetch<CreateTenantResult>('/control/tenants', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateTenant(id: string, data: { name?: string; domain?: string; plan?: string }) {
  return cpFetch<Tenant>(`/control/tenants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function suspendTenant(id: string, reason: string) {
  return cpFetch<{ success: boolean }>(`/control/tenants/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function activateTenant(id: string) {
  return cpFetch<{ success: boolean }>(`/control/tenants/${id}/activate`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function hardDeleteTenant(id: string) {
  return cpFetch<{ success: boolean; message: string }>(`/control/tenants/${id}?confirm=permanently-delete`, {
    method: 'DELETE',
  });
}

export function regenerateOnboarding(id: string) {
  return cpFetch<{
    success: boolean;
    message: string;
    adminEmail: string;
    onboardingUrl: string;
  }>(`/control/tenants/${id}/regenerate-onboarding`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export const SUPPORTED_FRAMEWORKS = ['SOC2', 'ISO27001', 'PCI-DSS', 'GDPR', 'HIPAA', 'NIST', 'CIS'] as const;

export const FRAMEWORK_DESCRIPTIONS: Record<string, string> = {
  SOC2: 'Service Organization Controls 2 — security & availability',
  ISO27001: 'Information Security Management System standard',
  'PCI-DSS': 'Payment Card Industry Data Security Standard',
  GDPR: 'EU General Data Protection Regulation',
  HIPAA: 'Health Insurance Portability & Accountability Act',
  NIST: 'NIST Cybersecurity Framework',
  CIS: 'Center for Internet Security Controls',
};
