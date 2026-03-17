'use client';
import { useState, useEffect } from 'react';
import { isAuthenticated, getSystemOverview, getPlatformStats } from '@/lib/api';

const STATUS_COLOR: Record<string, string> = {
  operational: '#22c55e', degraded: '#f59e0b', critical: '#ef4444', unknown: '#6b7280',
};

const TENANT_STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#22c55e', SUSPENDED: '#ef4444', TRIAL: '#f59e0b', PENDING: '#6b7280', OFFBOARDED: '#374151',
};

function StatCard({ label, value, sub, color }: { label: string; value: any; sub?: string; color?: string }) {
  return (
    <div style={{
      background: '#13151f', border: '1px solid #1e2030', borderRadius: 12, padding: '20px 24px',
    }}>
      <div style={{ color: '#64748b', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', marginBottom: 8 }}>{label}</div>
      <div style={{ color: color || '#e2e8f0', fontSize: 28, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const color = TENANT_STATUS_COLOR[status] || '#6b7280';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600,
      background: `${color}18`, color, border: `1px solid ${color}30`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      {status}
    </span>
  );
}

export default function HomePage() {
  const [overview, setOverview] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isAuthenticated()) {
      window.location.href = '/login';
      return;
    }
    Promise.allSettled([getSystemOverview(), getPlatformStats()]).then(([ov, st]) => {
      if (ov.status === 'fulfilled') setOverview(ov.value);
      if (st.status === 'fulfilled') setStats(st.value);
      setLoading(false);
    });
  }, []);

  const S = {
    page: { padding: '32px 40px', color: '#e2e8f0' } as React.CSSProperties,
    header: { marginBottom: 32 } as React.CSSProperties,
    grid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 } as React.CSSProperties,
    section: { background: '#13151f', border: '1px solid #1e2030', borderRadius: 12, padding: '20px 24px', marginBottom: 24 } as React.CSSProperties,
    sectionTitle: { color: '#94a3b8', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 16, textTransform: 'uppercase' as const },
  };

  if (loading) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ color: '#64748b', fontSize: 14 }}>Loading platform data…</div>
    </div>
  );

  const platStatus = overview?.platform?.status || 'unknown';
  const tenants = stats || {};

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#e2e8f0' }}>Platform Health</h1>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
              IdMatr Control Plane · {new Date().toLocaleString()}
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
            borderRadius: 100, fontSize: 13, fontWeight: 600,
            background: `${STATUS_COLOR[platStatus]}15`, color: STATUS_COLOR[platStatus],
            border: `1px solid ${STATUS_COLOR[platStatus]}30`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[platStatus], animation: 'pulse 2s infinite' }} />
            All Systems {platStatus.charAt(0).toUpperCase() + platStatus.slice(1)}
          </div>
        </div>
      </div>

      {/* Tenant Stats Grid */}
      <div style={S.grid}>
        <StatCard label="TOTAL TENANTS" value={tenants.total ?? '—'} />
        <StatCard label="ACTIVE" value={tenants.active ?? '—'} color="#22c55e" sub="Running normally" />
        <StatCard label="SUSPENDED" value={tenants.suspended ?? '—'} color="#ef4444" sub="Access blocked" />
        <StatCard label="TRIAL" value={tenants.trial ?? '—'} color="#f59e0b" sub="Evaluating" />
      </div>

      {/* Plan breakdown */}
      {tenants.byPlan && Object.keys(tenants.byPlan).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div style={S.section}>
            <div style={S.sectionTitle}>Tenants by Plan</div>
            {Object.entries(tenants.byPlan).map(([plan, count]: [string, any]) => (
              <div key={plan} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid #1e2030',
              }}>
                <span style={{ color: '#94a3b8', textTransform: 'capitalize', fontSize: 13 }}>{plan}</span>
                <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 16 }}>{count}</span>
              </div>
            ))}
          </div>

          {/* Integration Summary */}
          {overview?.integrations && (
            <div style={S.section}>
              <div style={S.sectionTitle}>Integration Status</div>
              {Object.entries(overview.integrations).map(([prov, data]: [string, any]) => (
                <div key={prov} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid #1e2030',
                }}>
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>
                    {prov.replace(/_/g, ' ')}
                  </span>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                    <span style={{ color: '#22c55e' }}>{data.active} active</span>
                    {data.error > 0 && <span style={{ color: '#ef4444' }}>{data.error} err</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Tenants */}
      {tenants.recentTenants?.length > 0 && (
        <div style={S.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={S.sectionTitle}>Recently Onboarded</div>
            <a href="/tenants" style={{ color: '#6366f1', fontSize: 12, textDecoration: 'none' }}>View all →</a>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>
                <th style={{ textAlign: 'left', padding: '0 0 10px', letterSpacing: '0.05em' }}>TENANT</th>
                <th style={{ textAlign: 'left', padding: '0 0 10px', letterSpacing: '0.05em' }}>PLAN</th>
                <th style={{ textAlign: 'left', padding: '0 0 10px', letterSpacing: '0.05em' }}>STATUS</th>
                <th style={{ textAlign: 'left', padding: '0 0 10px', letterSpacing: '0.05em' }}>CREATED</th>
              </tr>
            </thead>
            <tbody>
              {tenants.recentTenants.map((t: any) => (
                <tr key={t.id} style={{ borderTop: '1px solid #1e2030' }}>
                  <td style={{ padding: '12px 0' }}>
                    <a href={`/tenants/${t.id}`} style={{ color: '#e2e8f0', textDecoration: 'none', fontWeight: 500 }}>
                      {t.name}
                    </a>
                    <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{t.slug}</div>
                  </td>
                  <td style={{ padding: '12px 0' }}>
                    <span style={{ color: '#94a3b8', textTransform: 'capitalize', fontSize: 13 }}>{t.plan}</span>
                  </td>
                  <td style={{ padding: '12px 0' }}><Badge status={t.status} /></td>
                  <td style={{ padding: '12px 0', color: '#64748b', fontSize: 12 }}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!tenants.total && (
        <div style={{
          textAlign: 'center', padding: '60px 24px', background: '#13151f',
          border: '1px dashed #1e2030', borderRadius: 12,
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⊞</div>
          <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 8 }}>No tenants yet</div>
          <div style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
            Onboard your first tenant to start managing identity security
          </div>
          <a href="/tenants/new" style={{
            display: 'inline-block', padding: '10px 24px', borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: 14,
          }}>
            + Onboard First Tenant
          </a>
        </div>
      )}

      {/* Recent Activity */}
      {overview?.recentActivity?.length > 0 && (
        <div style={S.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={S.sectionTitle}>Recent Operator Activity</div>
            <a href="/audit" style={{ color: '#6366f1', fontSize: 12, textDecoration: 'none' }}>Full log →</a>
          </div>
          {overview.recentActivity.map((log: any) => (
            <div key={log.id} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '10px 0', borderBottom: '1px solid #1e2030',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                background: log.severity === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)',
                color: log.severity === 'warning' ? '#f59e0b' : '#818cf8',
                marginTop: 2, flexShrink: 0,
              }}>{log.category?.toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#e2e8f0', fontSize: 13 }}>{log.description}</div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>
                  {log.operator?.email} · {new Date(log.createdAt).toLocaleString()}
                  {log.tenant && ` · ${log.tenant.name}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
