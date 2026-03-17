const BASE = process.env.NEXT_PUBLIC_CP_API_URL || 'http://localhost:3010';
const SESSION_FLAG = 'idmatr_cp_authenticated';

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SESSION_FLAG) === '1';
}

function markAuthenticated(value: boolean) {
  if (typeof window === 'undefined') return;
  if (value) {
    sessionStorage.setItem(SESSION_FLAG, '1');
  } else {
    sessionStorage.removeItem(SESSION_FLAG);
  }
}

export async function logout() {
  try {
    await apiFetch('/control/auth/logout', { method: 'POST', body: '{}' });
  } catch {
    // Best effort.
  }
  markAuthenticated(false);
  window.location.href = '/login';
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    credentials: 'include',
  });
  if (res.status === 401) { markAuthenticated(false); throw new Error('Unauthorized'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `API error ${res.status}`);
  }
  return res.json();
}

export async function login(email: string, password: string, totpCode?: string) {
  const data: any = await apiFetch('/control/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, totpCode }),
  });
  markAuthenticated(true);
  return data;
}

export function getMe() {
  return apiFetch<any>('/control/auth/me');
}

export function getSystemOverview() {
  return apiFetch<any>('/control/system/overview');
}

export function getPlatformStats() {
  return apiFetch<any>('/control/tenants/stats');
}

export function getTenants(params?: { status?: string; plan?: string; search?: string }) {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString() : '';
  return apiFetch<any[]>(`/control/tenants${qs}`);
}

export function getTenant(id: string) {
  return apiFetch<any>(`/control/tenants/${id}`);
}

export function createTenant(data: {
  name: string; slug?: string; domain?: string;
  plan?: string; region?: string; frameworks?: string[]; adminEmail?: string;
}) {
  return apiFetch<any>('/control/tenants', { method: 'POST', body: JSON.stringify(data) });
}

export function updateTenant(id: string, data: any) {
  return apiFetch<any>(`/control/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function suspendTenant(id: string, reason: string) {
  return apiFetch<any>(`/control/tenants/${id}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) });
}

export function activateTenant(id: string) {
  return apiFetch<any>(`/control/tenants/${id}/activate`, { method: 'POST', body: '{}' });
}

export function offboardTenant(id: string) {
  return apiFetch<any>(`/control/tenants/${id}/offboard`, { method: 'POST', body: '{}' });
}

export function getTenantSettings(id: string) {
  return apiFetch<any>(`/control/tenants/${id}/settings`);
}

export function updateTenantSettings(id: string, data: any) {
  return apiFetch<any>(`/control/tenants/${id}/settings`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function getIntegrations(tenantId: string) {
  return apiFetch<any[]>(`/control/tenants/${tenantId}/integrations`);
}

export function updateIntegration(tenantId: string, provider: string, data: any) {
  return apiFetch<any>(`/control/tenants/${tenantId}/integrations/${provider}`, {
    method: 'PATCH', body: JSON.stringify(data),
  });
}

export function syncIntegration(tenantId: string, provider: string) {
  return apiFetch<any>(`/control/tenants/${tenantId}/integrations/${provider}/sync`, {
    method: 'POST', body: '{}',
  });
}

export function createApiKey(tenantId: string, data: { name: string; scopes?: string[]; expiresAt?: string }) {
  return apiFetch<any>(`/control/tenants/${tenantId}/api-keys`, { method: 'POST', body: JSON.stringify(data) });
}

export function revokeApiKey(tenantId: string, keyId: string) {
  return apiFetch<any>(`/control/tenants/${tenantId}/api-keys/${keyId}`, { method: 'DELETE' });
}

export function getTenantHealth(tenantId: string) {
  return apiFetch<any>(`/control/tenants/${tenantId}/health`);
}

export function getAuditLogs(params?: {
  tenantId?: string; category?: string; severity?: string; limit?: number; offset?: number;
}) {
  const qs = params ? '?' + new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
  ).toString() : '';
  return apiFetch<any>(`/control/audit${qs}`);
}
