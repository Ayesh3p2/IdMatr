'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  isOperatorAuthenticated, operatorLogout,
  getTenant, updateTenant, suspendTenant, activateTenant,
  regenerateOnboarding, hardDeleteTenant,
  SUPPORTED_FRAMEWORKS, FRAMEWORK_DESCRIPTIONS,
} from '@/lib/operator-api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantDetail {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  plan: string;
  status: string;
  region: string;
  createdAt: string;
  onboardingCompletedAt: string | null;
  suspendedAt: string | null;
  suspendReason: string | null;
  settings?: { frameworks: string[]; discoveryEnabled: boolean; ssoEnforced: boolean };
  tenantUsers: {
    id: string; email: string; name: string; role: string;
    isActive: boolean; forcePasswordChange: boolean;
    lastLogin: string | null; createdAt: string;
  }[];
  integrations: {
    provider: string; status: string; enabled: boolean; lastSyncAt: string | null;
  }[];
  apiKeys: {
    id: string; name: string; keyPrefix: string; scopes: string[];
    expiresAt: string | null; lastUsedAt: string | null; createdAt: string;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  ACTIVE:     { bg: 'rgba(16,185,129,0.12)',  text: '#10b981', border: 'rgba(16,185,129,0.3)' },
  PENDING:    { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  SUSPENDED:  { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  TRIAL:      { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8', border: 'rgba(99,102,241,0.3)' },
  OFFBOARDED: { bg: 'rgba(100,116,139,0.12)', text: '#64748b', border: 'rgba(100,116,139,0.3)' },
  DELETED:    { bg: 'rgba(100,116,139,0.12)', text: '#334155', border: 'rgba(100,116,139,0.3)' },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.PENDING;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: '20px', padding: '3px 12px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px' }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.text, display: 'inline-block' }} />
      {status}
    </span>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{title}</div>
        {action}
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '8px 0', borderBottom: '1px solid rgba(30,58,95,0.3)' }}>
      <div style={{ minWidth: '180px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '13px', color: '#cbd5e1', flex: 1 }}>{value || '—'}</div>
    </div>
  );
}

function fmt(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [tenant, setTenant]         = useState<TenantDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [actionModal, setAction]    = useState<string | null>(null);
  const [actionInput, setInput]     = useState('');
  const [working, setWorking]       = useState(false);
  const [deleteConfirm, setDel]     = useState('');
  const [actionResult, setResult]   = useState<{ ok: boolean; msg: string; onboardingUrl?: string } | null>(null);
  const [editMode, setEditMode]     = useState(false);
  const [editName, setEditName]     = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [editPlan, setEditPlan]     = useState('');
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    if (!isOperatorAuthenticated()) {
      window.location.href = '/operator/login';
      return;
    }
    load();
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const t = await getTenant(id) as unknown as TenantDetail;
      setTenant(t);
      setEditName(t.name);
      setEditDomain(t.domain || '');
      setEditPlan(t.plan);
    } catch (e: any) {
      if (e.message?.includes('401')) { operatorLogout(); return; }
      setError(e.message || 'Failed to load tenant');
    } finally {
      setLoading(false);
    }
  }, [id]);

  async function doAction() {
    if (!tenant) return;
    setWorking(true);
    try {
      if (actionModal === 'suspend') {
        await suspendTenant(tenant.id, actionInput || 'Operator-initiated suspension');
        setResult({ ok: true, msg: `Tenant "${tenant.name}" suspended.` });
      } else if (actionModal === 'activate') {
        await activateTenant(tenant.id);
        setResult({ ok: true, msg: `Tenant "${tenant.name}" activated.` });
      } else if (actionModal === 'regen') {
        const r = await regenerateOnboarding(tenant.id);
        setResult({ ok: true, msg: r.message, onboardingUrl: r.onboardingUrl });
      } else if (actionModal === 'delete') {
        if (deleteConfirm !== `DELETE ${tenant.name}`) {
          alert(`Type exactly: DELETE ${tenant.name}`);
          setWorking(false);
          return;
        }
        await hardDeleteTenant(tenant.id);
        setResult({ ok: true, msg: `Tenant "${tenant.name}" permanently deleted.` });
        setTimeout(() => { window.location.href = '/operator'; }, 2500);
        return;
      }
      await load();
    } catch (e: any) {
      setResult({ ok: false, msg: e.message || 'Action failed' });
    } finally {
      setWorking(false);
    }
  }

  async function saveEdit() {
    if (!tenant) return;
    setSaving(true);
    try {
      await updateTenant(tenant.id, {
        name: editName.trim() || undefined,
        domain: editDomain.trim() || undefined,
        plan: editPlan || undefined,
      });
      setEditMode(false);
      await load();
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  function closeModal() {
    setAction(null);
    setResult(null);
    setInput('');
    setDel('');
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#060b16', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontFamily: 'system-ui, sans-serif' }}>
      Loading tenant…
    </div>
  );

  if (error && !tenant) return (
    <div style={{ minHeight: '100vh', background: '#060b16', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: '#ef4444', fontFamily: 'system-ui, sans-serif' }}>
      <div>{error}</div>
      <Link href="/operator" style={{ color: '#818cf8', textDecoration: 'none', fontSize: '14px' }}>← Back to Dashboard</Link>
    </div>
  );

  const t = tenant!;
  const superAdmin = t.tenantUsers?.find(u => u.role === 'tenant_admin' || u.role === 'TENANT_SUPER_ADMIN');
  const frameworks = t.settings?.frameworks || [];

  return (
    <div style={{ minHeight: '100vh', background: '#060b16', fontFamily: 'system-ui, sans-serif', color: '#e2e8f0' }}>

      {/* Top bar */}
      <div style={{ background: '#0a1225', borderBottom: '1px solid #1e3a5f', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="/logo-teal.svg" alt="IDMatr" style={{ height: '36px' }} />
          <div style={{ height: '20px', width: '1px', background: '#1e3a5f' }} />
          <div style={{ fontSize: '11px', color: '#475569' }}>
            <Link href="/operator" style={{ color: '#475569', textDecoration: 'none' }}>Control Plane</Link>
            <span style={{ margin: '0 6px' }}>›</span>
            <Link href="/operator" style={{ color: '#475569', textDecoration: 'none' }}>Tenants</Link>
            <span style={{ margin: '0 6px' }}>›</span>
            <span style={{ color: '#94a3b8' }}>{t.name}</span>
          </div>
        </div>
        <button onClick={operatorLogout} style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#64748b', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', cursor: 'pointer' }}>
          Sign Out
        </button>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '6px' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#f1f5f9' }}>{t.name}</h1>
              <StatusBadge status={t.status} />
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#475569' }}>
              <span>Slug: <code style={{ color: '#64748b', background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: '4px' }}>{t.slug}</code></span>
              <span>Plan: <strong style={{ color: '#818cf8' }}>{t.plan.toUpperCase()}</strong></span>
              <span>Region: {t.region}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setEditMode(!editMode)}
              style={{ background: editMode ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '7px', padding: '8px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              {editMode ? '✕ Cancel Edit' : '✎ Edit'}
            </button>
            {(t.status === 'PENDING' || t.status === 'SUSPENDED') && (
              <button onClick={() => { setAction('activate'); setResult(null); }}
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '7px', padding: '8px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                ✓ Activate
              </button>
            )}
            {t.status === 'ACTIVE' && (
              <button onClick={() => { setAction('suspend'); setResult(null); setInput(''); }}
                style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '7px', padding: '8px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                ⊘ Suspend
              </button>
            )}
            <button onClick={() => { setAction('regen'); setResult(null); }}
              style={{ background: 'rgba(13,148,136,0.1)', color: '#2dd4bf', border: '1px solid rgba(13,148,136,0.2)', borderRadius: '7px', padding: '8px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              🔄 Regen Onboarding
            </button>
            <button onClick={() => { setAction('delete'); setResult(null); setDel(''); }}
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '7px', padding: '8px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              🗑 Delete
            </button>
          </div>
        </div>

        {/* Onboarding status banner */}
        {t.status === 'PENDING' && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', padding: '12px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#f59e0b' }}>
            <span style={{ fontSize: '18px' }}>⏳</span>
            <div>
              <strong>Onboarding in progress</strong>
              <span style={{ color: '#94a3b8', marginLeft: '8px' }}>
                Waiting for super-admin to complete first login and change their temporary password.
              </span>
              {superAdmin?.forcePasswordChange && (
                <span style={{ marginLeft: '8px', background: 'rgba(245,158,11,0.15)', borderRadius: '4px', padding: '1px 8px', fontSize: '11px' }}>
                  Password change pending
                </span>
              )}
            </div>
          </div>
        )}

        {t.status === 'SUSPENDED' && t.suspendReason && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '12px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#ef4444' }}>
            <span style={{ fontSize: '18px' }}>⛔</span>
            <div>
              <strong>Suspended</strong>
              <span style={{ color: '#94a3b8', marginLeft: '8px' }}>{t.suspendReason}</span>
              {t.suspendedAt && <span style={{ color: '#64748b', marginLeft: '8px', fontSize: '11px' }}>{fmt(t.suspendedAt)}</span>}
            </div>
          </div>
        )}

        {/* Edit form */}
        {editMode && (
          <div style={{ background: '#0d1424', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' }}>Edit Tenant Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Tenant Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  style={{ width: '100%', background: '#060b16', border: '1px solid #1e3a5f', borderRadius: '6px', color: '#e2e8f0', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Domain</label>
                <input value={editDomain} onChange={e => setEditDomain(e.target.value)}
                  placeholder="example.com"
                  style={{ width: '100%', background: '#060b16', border: '1px solid #1e3a5f', borderRadius: '6px', color: '#e2e8f0', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Plan</label>
                <select value={editPlan} onChange={e => setEditPlan(e.target.value)}
                  style={{ width: '100%', background: '#060b16', border: '1px solid #1e3a5f', borderRadius: '6px', color: '#e2e8f0', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}>
                  {['starter', 'growth', 'enterprise'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={saveEdit} disabled={saving}
                style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: '7px', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditMode(false)}
                style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#64748b', borderRadius: '7px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '0' }}>

          {/* Left: Overview */}
          <Section title="Overview">
            <InfoRow label="Tenant ID" value={<code style={{ fontSize: '11px', color: '#64748b' }}>{t.id}</code>} />
            <InfoRow label="Status" value={<StatusBadge status={t.status} />} />
            <InfoRow label="Plan" value={<span style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', padding: '2px 10px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>{t.plan}</span>} />
            <InfoRow label="Region" value={t.region} />
            <InfoRow label="Domain" value={t.domain} />
            <InfoRow label="Created" value={fmt(t.createdAt)} />
            <InfoRow label="Onboarding Completed" value={t.onboardingCompletedAt ? <span style={{ color: '#10b981' }}>{fmt(t.onboardingCompletedAt)}</span> : <span style={{ color: '#f59e0b' }}>Pending</span>} />
            {t.suspendedAt && <InfoRow label="Suspended At" value={<span style={{ color: '#ef4444' }}>{fmt(t.suspendedAt)}</span>} />}
          </Section>

          {/* Right: Compliance Frameworks */}
          <Section title="Compliance Frameworks">
            {frameworks.length === 0 ? (
              <div style={{ color: '#475569', fontSize: '13px', padding: '8px 0' }}>No frameworks configured.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {SUPPORTED_FRAMEWORKS.map(fw => {
                  const active = frameworks.includes(fw);
                  return (
                    <div key={fw} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '7px', background: active ? 'rgba(13,148,136,0.06)' : 'transparent', border: active ? '1px solid rgba(13,148,136,0.15)' : '1px solid transparent', opacity: active ? 1 : 0.35 }}>
                      <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: active ? '#0d9488' : '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {active && <span style={{ color: '#fff', fontSize: '10px', lineHeight: 1 }}>✓</span>}
                      </span>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: active ? '#2dd4bf' : '#475569' }}>{fw}</div>
                        <div style={{ fontSize: '11px', color: '#475569' }}>{FRAMEWORK_DESCRIPTIONS[fw]}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        {/* Users */}
        <Section title={`Users (${t.tenantUsers?.length || 0})`}>
          {!t.tenantUsers?.length ? (
            <div style={{ color: '#475569', fontSize: '13px' }}>No users.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Name', 'Email', 'Role', 'Status', 'Password', 'Last Login', 'Created'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1e3a5f' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.tenantUsers.map(u => (
                  <tr key={u.id}>
                    <td style={{ padding: '10px', color: '#f1f5f9', fontWeight: 600 }}>{u.name}</td>
                    <td style={{ padding: '10px', color: '#94a3b8' }}>{u.email}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ background: (u.role === 'tenant_admin' || u.role === 'TENANT_SUPER_ADMIN') ? 'rgba(99,102,241,0.15)' : 'rgba(30,58,95,0.4)', color: (u.role === 'tenant_admin' || u.role === 'TENANT_SUPER_ADMIN') ? '#818cf8' : '#64748b', border: `1px solid ${(u.role === 'tenant_admin' || u.role === 'TENANT_SUPER_ADMIN') ? 'rgba(99,102,241,0.3)' : '#1e3a5f'}`, borderRadius: '4px', padding: '2px 8px', fontSize: '10px', fontWeight: 700 }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ color: u.isActive ? '#10b981' : '#ef4444', fontSize: '12px' }}>
                        {u.isActive ? '● Active' : '○ Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {u.forcePasswordChange ? (
                        <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '4px', padding: '2px 8px', fontSize: '10px', fontWeight: 700 }}>
                          CHANGE REQUIRED
                        </span>
                      ) : (
                        <span style={{ color: '#10b981', fontSize: '11px' }}>✓ Set</span>
                      )}
                    </td>
                    <td style={{ padding: '10px', color: '#475569', fontSize: '11px' }}>{u.lastLogin ? fmt(u.lastLogin) : <span style={{ color: '#334155' }}>Never</span>}</td>
                    <td style={{ padding: '10px', color: '#475569', fontSize: '11px' }}>{fmt(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Integrations */}
        <Section title={`Integrations (${t.integrations?.length || 0})`}>
          {!t.integrations?.length ? (
            <div style={{ color: '#475569', fontSize: '13px' }}>No integrations.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {t.integrations.map(ig => (
                <div key={ig.provider} style={{ background: '#060b16', border: `1px solid ${ig.enabled ? 'rgba(13,148,136,0.25)' : '#1e3a5f'}`, borderRadius: '8px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: ig.enabled ? '#2dd4bf' : '#64748b' }}>{ig.provider}</div>
                    <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: ig.enabled ? 'rgba(13,148,136,0.1)' : 'rgba(30,58,95,0.5)', color: ig.enabled ? '#0d9488' : '#475569', fontWeight: 700 }}>
                      {ig.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569' }}>
                    Status: <span style={{ color: ig.status === 'ACTIVE' ? '#10b981' : '#64748b' }}>{ig.status}</span>
                  </div>
                  {ig.lastSyncAt && (
                    <div style={{ fontSize: '10px', color: '#334155', marginTop: '4px' }}>Last sync: {fmt(ig.lastSyncAt)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* API Keys */}
        <Section title={`API Keys (${t.apiKeys?.length || 0})`}>
          {!t.apiKeys?.length ? (
            <div style={{ color: '#475569', fontSize: '13px' }}>No active API keys.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['Name', 'Key Prefix', 'Scopes', 'Last Used', 'Expires', 'Created'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #1e3a5f' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.apiKeys.map(k => (
                  <tr key={k.id}>
                    <td style={{ padding: '10px', color: '#f1f5f9', fontWeight: 600 }}>{k.name}</td>
                    <td style={{ padding: '10px' }}>
                      <code style={{ background: '#060b16', border: '1px solid #1e3a5f', borderRadius: '4px', padding: '2px 8px', color: '#94a3b8', fontSize: '11px' }}>{k.keyPrefix}…</code>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {(k.scopes || []).map(s => (
                          <span key={s} style={{ background: 'rgba(13,148,136,0.08)', color: '#2dd4bf', border: '1px solid rgba(13,148,136,0.15)', borderRadius: '3px', padding: '1px 5px', fontSize: '10px' }}>{s}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '10px', color: '#475569', fontSize: '11px' }}>{k.lastUsedAt ? fmt(k.lastUsedAt) : <span style={{ color: '#334155' }}>Never</span>}</td>
                    <td style={{ padding: '10px', color: '#475569', fontSize: '11px' }}>{k.expiresAt ? fmt(k.expiresAt) : <span style={{ color: '#334155' }}>Never</span>}</td>
                    <td style={{ padding: '10px', color: '#475569', fontSize: '11px' }}>{fmt(k.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

      </div>

      {/* ─── Action Modal ──────────────────────────────────────────────────────── */}
      {actionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a2340', border: '1px solid #1e3a5f', borderRadius: '12px', padding: '32px', maxWidth: '480px', width: '90%' }}>
            {actionResult ? (
              <div>
                <div style={{ fontSize: '22px', marginBottom: '10px' }}>{actionResult.ok ? '✅' : '❌'}</div>
                <div style={{ fontWeight: 700, color: actionResult.ok ? '#10b981' : '#ef4444', marginBottom: '12px', fontSize: '15px' }}>
                  {actionResult.msg}
                </div>
                {actionResult.onboardingUrl && (
                  <div style={{ background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.3)', borderRadius: '8px', padding: '14px 16px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New Onboarding Link</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#2dd4bf', wordBreak: 'break-all' }}>{actionResult.onboardingUrl}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>Share this securely with the admin. The link expires in 15 minutes and can only be used once.</div>
                  </div>
                )}
                <button onClick={closeModal}
                  style={{ background: '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 22px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            ) : (
              <div>
                <h3 style={{ color: '#f1f5f9', margin: '0 0 10px', fontSize: '17px', fontWeight: 700 }}>
                  {actionModal === 'suspend'  && '⚠️ Suspend Tenant'}
                  {actionModal === 'activate' && '✓ Activate Tenant'}
                  {actionModal === 'regen'    && '🔄 Regenerate Onboarding'}
                  {actionModal === 'delete'   && '🗑️ Permanently Delete Tenant'}
                </h3>
                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
                  {actionModal === 'suspend'  && `Suspend "${t.name}". All tenant users lose access immediately. Data is preserved and can be restored by activating.`}
                  {actionModal === 'activate' && `Activate "${t.name}" and restore full access for all tenant users.`}
                  {actionModal === 'regen'    && `Generate a new one-time onboarding link for the tenant administrator of "${t.name}" and resend the welcome email. If the tenant was ACTIVE, it will revert to PENDING until onboarding is re-completed.`}
                  {actionModal === 'delete'   && <span style={{ color: '#ef4444' }}>⚠️ IRREVERSIBLE — All data for "{t.name}" will be permanently destroyed including all users, integrations, API keys, and audit logs.</span>}
                </p>

                {actionModal === 'suspend' && (
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Suspension Reason (optional)</label>
                    <input value={actionInput} onChange={e => setInput(e.target.value)}
                      placeholder="Policy violation, non-payment…"
                      style={{ width: '100%', background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '7px', color: '#e2e8f0', padding: '9px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}

                {actionModal === 'delete' && (
                  <div style={{ marginBottom: '18px' }}>
                    <label style={{ display: 'block', fontSize: '11px', color: '#ef4444', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Type <strong style={{ color: '#ef4444' }}>DELETE {t.name}</strong> to confirm
                    </label>
                    <input value={deleteConfirm} onChange={e => setDel(e.target.value)}
                      placeholder={`DELETE ${t.name}`}
                      style={{ width: '100%', background: '#0f1629', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '7px', color: '#e2e8f0', padding: '9px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={doAction} disabled={working || (actionModal === 'delete' && deleteConfirm !== `DELETE ${t.name}`)}
                    style={{ background: actionModal === 'delete' ? '#dc2626' : '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 22px', fontSize: '13px', fontWeight: 700, cursor: (working || (actionModal === 'delete' && deleteConfirm !== `DELETE ${t.name}`)) ? 'not-allowed' : 'pointer', opacity: (working || (actionModal === 'delete' && deleteConfirm !== `DELETE ${t.name}`)) ? 0.5 : 1 }}>
                    {working ? 'Working…' : (
                      actionModal === 'delete'   ? 'Permanently Delete' :
                      actionModal === 'suspend'  ? 'Suspend Tenant' :
                      actionModal === 'activate' ? 'Activate Tenant' :
                      'Regenerate & Resend'
                    )}
                  </button>
                  <button onClick={closeModal}
                    style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#64748b', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
