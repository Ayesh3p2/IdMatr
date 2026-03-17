'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  isOperatorAuthenticated, operatorLogout, getTenants, getTenantStats,
  suspendTenant, activateTenant, regenerateOnboarding, hardDeleteTenant,
  Tenant,
} from '@/lib/operator-api';

const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE:     { bg: 'rgba(16,185,129,0.12)',  text: '#10b981', dot: '#10b981' },
  PENDING:    { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b', dot: '#f59e0b' },
  SUSPENDED:  { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', dot: '#ef4444' },
  TRIAL:      { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8', dot: '#818cf8' },
  OFFBOARDED: { bg: 'rgba(100,116,139,0.12)', text: '#64748b', dot: '#64748b' },
  DELETED:    { bg: 'rgba(100,116,139,0.12)', text: '#334155', dot: '#334155' },
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.PENDING;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: c.bg, color: c.text, border: `1px solid ${c.text}30`, borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
      {status}
    </span>
  );
}

export default function OperatorDashboard() {
  const [tenants, setTenants]     = useState<Tenant[]>([]);
  const [stats, setStats]         = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('');
  const [actionModal, setAction]  = useState<{ type: string; tenant: Tenant } | null>(null);
  const [actionInput, setInput]   = useState('');
  const [actionResult, setResult] = useState<{ msg: string; onboardingUrl?: string } | null>(null);
  const [working, setWorking]     = useState(false);
  const [deleteConfirm, setDel]   = useState('');

  useEffect(() => {
    if (!isOperatorAuthenticated()) {
      window.location.href = '/operator/login';
      return;
    }
    load();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [t, s] = await Promise.all([getTenants(), getTenantStats()]);
      setTenants(t);
      setStats(s);
    } catch (e: any) {
      if (e.message?.includes('401')) { operatorLogout(); return; }
      setError(e.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = tenants.filter(t => {
    const matchSearch = !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.domain?.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  async function doAction() {
    if (!actionModal) return;
    setWorking(true);
    try {
      const { type, tenant } = actionModal;
      if (type === 'suspend') {
        await suspendTenant(tenant.id, actionInput || 'Operator-initiated suspension');
        setResult({ msg: `Tenant "${tenant.name}" suspended.` });
      } else if (type === 'activate') {
        await activateTenant(tenant.id);
        setResult({ msg: `Tenant "${tenant.name}" activated.` });
      } else if (type === 'regen') {
        const r = await regenerateOnboarding(tenant.id);
        setResult({ msg: r.message, onboardingUrl: r.onboardingUrl });
      } else if (type === 'delete') {
        if (deleteConfirm !== `DELETE ${tenant.name}`) {
          alert(`Type exactly: DELETE ${tenant.name}`);
          setWorking(false);
          return;
        }
        await hardDeleteTenant(tenant.id);
        setResult({ msg: `Tenant "${tenant.name}" permanently deleted.` });
      }
      await load();
    } catch (e: any) {
      setResult({ msg: `Error: ${e.message}` });
    } finally {
      setWorking(false);
    }
  }

  const card = (label: string, val: any, color: string) => (
    <div style={{ background: '#0d1424', border: `1px solid ${color}30`, borderRadius: '10px', padding: '18px 22px' }}>
      <div style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color }}>{val ?? '—'}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#060b16', fontFamily: 'system-ui, sans-serif', color: '#e2e8f0' }}>
      {/* Top bar */}
      <div style={{ background: '#0a1225', borderBottom: '1px solid #1e3a5f', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="/logo-teal.svg" alt="IDMatr" style={{ height: '36px' }} />
          <div style={{ height: '20px', width: '1px', background: '#1e3a5f' }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>Control Plane</div>
            <div style={{ fontSize: '10px', color: '#475569' }}>Operator Dashboard</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Link href="/operator/tenants/new" style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            + New Tenant
          </Link>
          <button onClick={operatorLogout} style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#64748b', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Stats row */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '28px' }}>
            {card('Total Tenants', stats.total, '#818cf8')}
            {card('Active', stats.active, '#10b981')}
            {card('Pending', stats.pending, '#f59e0b')}
            {card('Suspended', stats.suspended, '#ef4444')}
            {card('Trial', stats.trial, '#6366f1')}
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#ef4444', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
            <span>{error}</span>
            <button onClick={load} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px' }}>Retry</button>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search tenants…"
            style={{ flex: 1, background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: '8px', color: '#e2e8f0', padding: '9px 14px', fontSize: '13px', outline: 'none' }} />
          <select value={statusFilter} onChange={e => setStatus(e.target.value)}
            style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: '8px', color: '#e2e8f0', padding: '9px 12px', fontSize: '13px', outline: 'none' }}>
            <option value="">All Statuses</option>
            {['ACTIVE','PENDING','SUSPENDED','TRIAL','OFFBOARDED'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={load} style={{ background: '#1e3a5f', border: 'none', color: '#94a3b8', padding: '9px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>↻</button>
        </div>

        {/* Tenant table */}
        <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e3a5f' }}>
                {['Tenant', 'Plan', 'Status', 'Domain', 'Compliance', 'Users', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>
                  {tenants.length === 0 ? 'No tenants yet.' : 'No tenants match your filters.'}
                </td></tr>
              )}
              {!loading && filtered.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(30,58,95,0.4)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{t.name}</div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{t.slug}</div>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>{t.plan}</span>
                  </td>
                  <td style={{ padding: '13px 16px' }}><StatusBadge status={t.status} /></td>
                  <td style={{ padding: '13px 16px', color: '#64748b', fontSize: '12px' }}>{t.domain || '—'}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                      {(t.settings?.frameworks || []).map(f => (
                        <span key={f} style={{ background: 'rgba(13,148,136,0.1)', color: '#2dd4bf', border: '1px solid rgba(13,148,136,0.2)', borderRadius: '3px', padding: '1px 6px', fontSize: '10px', fontWeight: 600 }}>{f}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px', color: '#64748b' }}>{t._count?.tenantUsers ?? '—'}</td>
                  <td style={{ padding: '13px 16px', color: '#64748b', fontSize: '11px' }}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <Link href={`/operator/tenants/${t.id}`}
                        style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '5px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
                        View
                      </Link>
                      {(t.status === 'PENDING' || t.status === 'SUSPENDED') && (
                        <button onClick={() => { setAction({ type: 'activate', tenant: t }); setResult(null); setInput(''); }}
                          style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '5px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                          Activate
                        </button>
                      )}
                      {t.status === 'ACTIVE' && (
                        <button onClick={() => { setAction({ type: 'suspend', tenant: t }); setResult(null); setInput(''); }}
                          style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '5px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                          Suspend
                        </button>
                      )}
                      {(t.status === 'PENDING') && (
                        <button onClick={() => { setAction({ type: 'regen', tenant: t }); setResult(null); setInput(''); }}
                          style={{ background: 'rgba(13,148,136,0.1)', color: '#2dd4bf', border: '1px solid rgba(13,148,136,0.2)', borderRadius: '5px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                          Resend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {actionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a2340', border: '1px solid #1e3a5f', borderRadius: '12px', padding: '32px', maxWidth: '480px', width: '90%' }}>
            {actionResult ? (
              <div>
                <div style={{ fontWeight: 700, color: actionResult.msg.startsWith('Error') ? '#ef4444' : '#10b981', marginBottom: '12px', fontSize: '15px' }}>
                  {actionResult.msg.startsWith('Error') ? '✗' : '✓'} {actionResult.msg}
                </div>
                {actionResult.onboardingUrl && (
                  <div style={{ background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New Onboarding Link</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#2dd4bf', wordBreak: 'break-all' }}>{actionResult.onboardingUrl}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Share this securely. It expires in 15 minutes and can be used only once.</div>
                  </div>
                )}
                <button onClick={() => { setAction(null); setResult(null); setDel(''); }}
                  style={{ background: '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            ) : (
              <div>
                <h3 style={{ color: '#f1f5f9', margin: '0 0 8px', fontSize: '16px', fontWeight: 700 }}>
                  {actionModal.type === 'suspend' && '⚠️ Suspend Tenant'}
                  {actionModal.type === 'activate' && '✓ Activate Tenant'}
                  {actionModal.type === 'regen' && '🔄 Regenerate Onboarding'}
                  {actionModal.type === 'delete' && '🗑️ Permanently Delete Tenant'}
                </h3>
                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
                  {actionModal.type === 'suspend' && `This will disable all access for "${actionModal.tenant.name}". Data is preserved.`}
                  {actionModal.type === 'activate' && `Activate tenant "${actionModal.tenant.name}" and restore access.`}
                  {actionModal.type === 'regen' && `Generate a new one-time onboarding link for "${actionModal.tenant.name}" and resend the welcome email.`}
                  {actionModal.type === 'delete' && <span style={{ color: '#ef4444' }}>⚠️ IRREVERSIBLE. All data for "{actionModal.tenant.name}" will be permanently destroyed.</span>}
                </p>
                {actionModal.type === 'suspend' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Reason (optional)</label>
                    <input value={actionInput} onChange={e => setInput(e.target.value)}
                      placeholder="Policy violation, billing issue…"
                      style={{ width: '100%', background: '#0f1629', border: '1px solid #1e3a5f', borderRadius: '6px', color: '#e2e8f0', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}
                {actionModal.type === 'delete' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '11px', color: '#ef4444', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Type <strong>DELETE {actionModal.tenant.name}</strong> to confirm
                    </label>
                    <input value={deleteConfirm} onChange={e => setDel(e.target.value)}
                      placeholder={`DELETE ${actionModal.tenant.name}`}
                      style={{ width: '100%', background: '#0f1629', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', color: '#e2e8f0', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={doAction} disabled={working}
                    style={{ background: actionModal.type === 'delete' ? '#dc2626' : '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: working ? 'not-allowed' : 'pointer', opacity: working ? 0.7 : 1 }}>
                    {working ? 'Working…' : (
                      actionModal.type === 'delete' ? 'Permanently Delete' :
                      actionModal.type === 'suspend' ? 'Suspend Tenant' :
                      actionModal.type === 'activate' ? 'Activate Tenant' :
                      'Regenerate & Resend'
                    )}
                  </button>
                  <button onClick={() => { setAction(null); setResult(null); setDel(''); }}
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
