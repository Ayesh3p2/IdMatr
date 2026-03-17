const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

const SESSION_FLAG = 'idmatr_authenticated';

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
    sessionStorage.removeItem('idmatr_force_pw_change');
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401) {
    markAuthenticated(false);
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/onboarding')) {
      window.location.href = '/login';
    }
    throw new Error('401 Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function login(email: string, password: string, tenantSlug?: string, totpCode?: string) {
  const data = await apiFetch<{
    user: {
      id: string;
      email: string;
      roles: string[];
      name?: string;
      tenantId?: string | null;
      forcePasswordChange?: boolean;
    };
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, tenantSlug, totpCode }),
  });
  markAuthenticated(true);
  if (typeof window !== 'undefined') {
    if (data.user.forcePasswordChange) {
      sessionStorage.setItem('idmatr_force_pw_change', '1');
    } else {
      sessionStorage.removeItem('idmatr_force_pw_change');
    }
  }
  return data.user;
}

export async function completeOnboarding(token: string, newPassword: string) {
  const data = await apiFetch<{ user: { id: string; email: string } }>('/auth/onboarding/complete', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
  markAuthenticated(true);
  return data.user;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const data = await apiFetch<{ success: boolean; message: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (data.success) {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('idmatr_force_pw_change');
    }
  }
  return data;
}

export async function logout() {
  try {
    await apiFetch<{ success: boolean }>('/auth/logout', { method: 'POST', body: '{}' });
  } catch {
    // Best effort.
  }
  markAuthenticated(false);
  if (typeof window !== 'undefined') window.location.href = '/login';
}

export function getCurrentUser() {
  return apiFetch<{ id: string; email: string; roles: string[]; name: string; tenantId?: string | null }>('/auth/me');
}

export function getDashboardSummary() {
  return apiFetch<any>('/dashboard/summary');
}

export function getIdentities() {
  return apiFetch<any[]>('/identities');
}

export function getIdentity(id: string) {
  return apiFetch<any>(`/identities/${id}`);
}

export function createIdentity(data: any) {
  return apiFetch<any>('/identities', { method: 'POST', body: JSON.stringify(data) });
}

export function getApplications() {
  return apiFetch<any[]>('/applications');
}

export function triggerScan(source?: string) {
  return apiFetch<any>('/discovery/scan', {
    method: 'POST',
    body: JSON.stringify({ source: source || 'all' }),
  });
}

export function getRiskScores() {
  return apiFetch<any[]>('/risk/scores');
}

export function getRiskEvents() {
  return apiFetch<any[]>('/risk/events');
}

export function getThreats() {
  return apiFetch<any[]>('/itdr/threats');
}

export function respondToThreat(id: string, action: string, notes?: string) {
  return apiFetch<any>(`/itdr/threats/${id}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action, notes }),
  });
}

export function getWorkflows() {
  return apiFetch<any[]>('/governance/workflows');
}

export function createWorkflow(data: any) {
  return apiFetch<any>('/governance/workflows', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateWorkflow(id: string, action: string, notes?: string) {
  return apiFetch<any>(`/governance/workflows/${id}/action`, {
    method: 'POST',
    body: JSON.stringify({ action, notes }),
  });
}

export function getJMLEvents() {
  return apiFetch<any[]>('/governance/jml');
}

export function getAuditLogs() {
  return apiFetch<any[]>('/audit/logs');
}

export function getRiskTrends() {
  return apiFetch<any[]>('/analytics/risk-trends');
}

export function getIdentitySummary() {
  return apiFetch<any>('/analytics/identity-summary');
}

export function getAppIntelligence() {
  return apiFetch<any>('/analytics/app-intelligence');
}

export function getComplianceMetrics() {
  return apiFetch<any>('/compliance/metrics');
}

export function getPolicyViolations() {
  return apiFetch<any[]>('/compliance/policy-violations');
}

export function getPostureScore() {
  return apiFetch<any>('/posture/score');
}

export function getIdentityGraph(id: string) {
  return apiFetch<any>(`/graph/identity/${id}`);
}

export function getToxicCombinations() {
  return apiFetch<any[]>('/graph/toxic-combinations');
}

export function getAttackPaths() {
  return apiFetch<any[]>('/graph/attack-paths');
}

export async function getServiceHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.json();
}

export async function getAllSettings() {
  return apiFetch<any>('/settings');
}

export async function updateSettings(category: string, data: any) {
  return apiFetch<any>(`/settings/${category}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function getSettingsApiKeys() {
  return apiFetch<any[]>('/settings/api-keys');
}

export async function createSettingsApiKey(name: string, scopes: string[]) {
  return apiFetch<any>('/settings/api-keys', { method: 'POST', body: JSON.stringify({ name, scopes }) });
}

export async function revokeSettingsApiKey(id: string) {
  return apiFetch<any>(`/settings/api-keys/${id}/revoke`, { method: 'POST' });
}

export async function rotateSettingsApiKey(id: string) {
  return apiFetch<any>(`/settings/api-keys/${id}/rotate`, { method: 'POST' });
}

export async function getSettingsIntegrations() {
  return apiFetch<any[]>('/settings/integrations');
}

export async function updateSettingsIntegration(provider: string, data: any) {
  return apiFetch<any>(`/settings/integrations/${provider}`, { method: 'PUT', body: JSON.stringify(data) });
}
