'use client';
import { useState, useEffect } from 'react';
import { isAuthenticated, getTenants, suspendTenant, activateTenant } from '@/lib/api';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#22c55e', SUSPENDED: '#ef4444', TRIAL: '#f59e0b', PENDING: '#6b7280', OFFBOARDED: '#374151',
};
const PROVIDER_ICON: Record<string, string> = {
  GOOGLE_WORKSPACE: 'G', MICROSOFT_365: 'M', SLACK: 'S', GITHUB: '⌥',
};

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] || '#6b7280';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 600,
      background: `${c}15`, color: c, border: `1px solid ${c}25`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
      {status}
    </span>
  );
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isAuthenticated()) { window.location.href = '/login'; return; }
    load();
  }, []);

  const load = () => {
    setLoading(true);
    getTenants({ search: search || undefined, status: statusFilter || undefined })
      .then(data => setTenants(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  const handleAction = async (id: string, action: 'suspend' | 'activate') => {
    setActionLoading(id);
    try {
      if (action === 'suspend') await suspendTenant(id, 'Operator-initiated suspension');
      else await activateTenant(id);
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  const S = {
    page: { padding: '32px 40px', color: '#e2e8f0' } as React.CSSProperties,
    th: { textAlign: 'left' as const, padding: '0 16px 12px 0', color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em' },
    td: { padding: '16px 16px 16px 0', borderTop: '1px solid #1e2030', verticalAlign: 'top' as const },
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Tenants</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
            {tenants.length} tenant{tenants.length !== 1 ? 's' : ''} managed
          </p>
        </div>
        <a href="/tenants/new" style={{
          padding: '10px 20px', borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          + Onboard Tenant
        </a>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tenants…"
          onKeyDown={e => e.key === 'Enter' && load()}
          style={{
            flex: 1, padding: '9px 14px', borderRadius: 8, border: '1px solid #2d3147',
            background: '#13151f', color: '#e2e8f0', fontSize: 13, outline: 'none',
          }}
        />
        <select
          value={statusFilter} onChange={e => { setStatusFilter(e.target.value); }}
          style={{
            padding: '9px 14px', borderRadius: 8, border: '1px solid #2d3147',
            background: '#13151f', color: '#e2e8f0', fontSize: 13, outline: 'none',
          }}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="TRIAL">Trial</option>
          <option value="PENDING">Pending</option>
        </select>
        <button onClick={load} style={{
          padding: '9px 16px', borderRadius: 8, border: '1px solid #2d3147',
          background: '#13151f', color: '#94a3b8', fontSize: 13, cursor: 'pointer',
        }}>Apply</button>
      </div>

      {/* Table */}
      <div style={{ background: '#13151f', border: '1px solid #1e2030', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading tenants…</div>
        ) : tenants.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⊞</div>
            <div style={{ color: '#94a3b8', fontWeight: 600, marginBottom: 6 }}>No tenants found</div>
            <div style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>Start by onboarding your first tenant</div>
            <a href="/tenants/new" style={{
              display: 'inline-block', padding: '9px 20px', borderRadius: 8,
              background: '#6366f1', color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 13,
            }}>+ Onboard First Tenant</a>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', padding: '0 24px' }}>
            <thead>
              <tr style={{ padding: '0 24px' }}>
                {['TENANT', 'STATUS', 'PLAN', 'INTEGRATIONS', 'HEALTH', 'CREATED', 'ACTIONS'].map(h => (
                  <th key={h} style={{ ...S.th, paddingLeft: h === 'TENANT' ? 24 : 0 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t: any) => {
                const activeInt = (t.integrations || []).filter((i: any) => i.enabled).length;
                const health = t.latestHealth;
                return (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/tenants/${t.id}`}>
                    <td style={{ ...S.td, paddingLeft: 24 }}>
                      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 14 }}>{t.name}</div>
                      <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>
                        {t.slug} {t.domain ? `· ${t.domain}` : ''}
                      </div>
                    </td>
                    <td style={S.td}><StatusBadge status={t.status} /></td>
                    <td style={S.td}>
                      <span style={{
                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        background: t.plan === 'enterprise' ? 'rgba(99,102,241,0.1)' : 'rgba(30,32,48,0.8)',
                        color: t.plan === 'enterprise' ? '#818cf8' : '#64748b', textTransform: 'capitalize',
                      }}>{t.plan}</span>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(t.integrations || []).map((i: any) => (
                          <span key={i.provider} title={i.provider} style={{
                            width: 22, height: 22, borderRadius: 4, fontSize: 10, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: i.enabled ? 'rgba(34,197,94,0.1)' : 'rgba(30,32,48,0.8)',
                            color: i.enabled ? '#22c55e' : '#374151',
                            border: `1px solid ${i.enabled ? 'rgba(34,197,94,0.2)' : '#1e2030'}`,
                          }}>{PROVIDER_ICON[i.provider] || '?'}</span>
                        ))}
                      </div>
                      <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>{activeInt} active</div>
                    </td>
                    <td style={S.td}>
                      {health ? (
                        <div>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                            background: health.status === 'healthy' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: health.status === 'healthy' ? '#22c55e' : '#ef4444',
                          }}>{health.status}</span>
                          <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>
                            {health.userCount} users · {health.appCount} apps
                          </div>
                        </div>
                      ) : <span style={{ color: '#374151', fontSize: 12 }}>No data</span>}
                    </td>
                    <td style={S.td}>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>{new Date(t.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td style={S.td} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <a href={`/tenants/${t.id}`} style={{
                          padding: '5px 10px', borderRadius: 6, border: '1px solid #2d3147',
                          color: '#94a3b8', textDecoration: 'none', fontSize: 11, fontWeight: 500,
                        }}>View</a>
                        {t.status === 'ACTIVE' ? (
                          <button
                            disabled={actionLoading === t.id}
                            onClick={() => handleAction(t.id, 'suspend')}
                            style={{
                              padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)',
                              color: '#ef4444', background: 'rgba(239,68,68,0.08)',
                              fontSize: 11, fontWeight: 500, cursor: 'pointer',
                            }}>
                            {actionLoading === t.id ? '…' : 'Suspend'}
                          </button>
                        ) : t.status === 'SUSPENDED' ? (
                          <button
                            disabled={actionLoading === t.id}
                            onClick={() => handleAction(t.id, 'activate')}
                            style={{
                              padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(34,197,94,0.3)',
                              color: '#22c55e', background: 'rgba(34,197,94,0.08)',
                              fontSize: 11, fontWeight: 500, cursor: 'pointer',
                            }}>
                            {actionLoading === t.id ? '…' : 'Activate'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
