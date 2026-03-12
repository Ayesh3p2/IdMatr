/**
 * IDMatr API Client
 * Connects the admin dashboard to the API Gateway.
 * Falls back to mock data when API is unavailable (DEMO_MODE).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ── Identities ────────────────────────────────
export const getIdentities = () => apiFetch('/api/identities');
export const getIdentityById = (id: string) => apiFetch(`/api/identities/${id}`);

// ── Applications ──────────────────────────────
export const getApplications = () => apiFetch('/api/apps');
export const triggerDiscoveryScan = (source?: string) =>
  apiFetch('/api/discovery/scan', {
    method: 'POST',
    body: JSON.stringify({ source }),
  });

// ── Risk Engine ───────────────────────────────
export const getRiskScores = () => apiFetch('/api/risk/scores');
export const getRiskEvents = () => apiFetch('/api/risk/events');

// ── Governance ────────────────────────────────
export const getWorkflows = () => apiFetch('/api/governance/workflows');
export const updateWorkflow = (id: string, action: string, approverId: string, comment?: string) =>
  apiFetch(`/api/governance/workflows/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ action, approverId, comment }),
  });

// ── Audit Logs ────────────────────────────────
export const getAuditLogs = (filters?: Record<string, string>) => {
  const params = filters ? `?${new URLSearchParams(filters)}` : '';
  return apiFetch(`/api/audit${params}`);
};

// ── Graph Service ─────────────────────────────
export const getIdentityGraph = (userId: string) => apiFetch(`/api/graph/${userId}`);

// ── Policy ────────────────────────────────────
export const getPolicies = () => apiFetch('/api/policies');
export const checkPolicy = (userId: string, resource: string, action: string) =>
  apiFetch('/api/policies/check', {
    method: 'POST',
    body: JSON.stringify({ userId, resource, action }),
  });

// ── Health ────────────────────────────────────
export const getHealth = () => apiFetch('/api/health');
