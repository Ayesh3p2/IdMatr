'use client';
import { useState, useEffect } from 'react';
import { isAuthenticated, getAuditLogs } from '@/lib/api';

const SEVERITY_COLOR: Record<string, string> = {
  info: '#818cf8', warning: '#f59e0b', critical: '#ef4444', error: '#ef4444',
};
const CATEGORY_ICON: Record<string, string> = {
  tenant: '⊞', integration: '⟲', 'api-key': '⚿', system: '⚙', auth: '🔐',
};

export default function AuditPage() {
  const [data, setData] = useState<any>({ logs: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  useEffect(() => {
    if (typeof window !== 'undefined' && !isAuthenticated()) { window.location.href = '/login'; return; }
    load();
  }, [category, severity, offset]);

  const load = () => {
    setLoading(true);
    getAuditLogs({ category: category || undefined, severity: severity || undefined, limit: LIMIT, offset })
      .then(d => setData(d))
      .finally(() => setLoading(false));
  };

  const S = {
    page: { padding: '32px 40px', color: '#e2e8f0' } as React.CSSProperties,
    th: { textAlign: 'left' as const, color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', paddingBottom: 12 },
    td: { padding: '14px 0', borderTop: '1px solid #1e2030', verticalAlign: 'top' as const, fontSize: 13 },
  };

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Operator Audit Log</h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>
          Every control plane action is recorded here · {data.total} total events
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <select value={category} onChange={e => { setCategory(e.target.value); setOffset(0); }}
          style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #2d3147', background: '#13151f', color: '#e2e8f0', fontSize: 13, outline: 'none' }}>
          <option value="">All categories</option>
          <option value="tenant">Tenant</option>
          <option value="integration">Integration</option>
          <option value="api-key">API Key</option>
          <option value="auth">Auth</option>
          <option value="system">System</option>
        </select>
        <select value={severity} onChange={e => { setSeverity(e.target.value); setOffset(0); }}
          style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #2d3147', background: '#13151f', color: '#e2e8f0', fontSize: 13, outline: 'none' }}>
          <option value="">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div style={{ background: '#13151f', border: '1px solid #1e2030', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Loading audit logs…</div>
        ) : data.logs.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>≡</div>
            <div style={{ color: '#94a3b8', fontWeight: 600 }}>No audit events yet</div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Events will appear here as operators take actions</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', padding: '0 24px' }}>
            <thead>
              <tr>
                {['', 'ACTION', 'DESCRIPTION', 'TENANT', 'OPERATOR', 'TIME'].map(h => (
                  <th key={h} style={{ ...S.th, paddingLeft: h === '' ? 24 : 0, paddingRight: 16 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.logs.map((log: any) => {
                const sevColor = SEVERITY_COLOR[log.severity] || '#6b7280';
                const catIcon = CATEGORY_ICON[log.category] || '•';
                return (
                  <tr key={log.id}>
                    <td style={{ ...S.td, paddingLeft: 24, width: 40 }}>
                      <span style={{ fontSize: 14 }}>{catIcon}</span>
                    </td>
                    <td style={{ ...S.td, paddingRight: 16 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: `${sevColor}12`, color: sevColor, letterSpacing: '0.04em',
                      }}>{log.action}</span>
                    </td>
                    <td style={{ ...S.td, paddingRight: 16, maxWidth: 280 }}>
                      <div style={{ color: '#e2e8f0' }}>{log.description}</div>
                      {log.metadata && (
                        <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>
                          {(() => { try { return Object.entries(JSON.parse(log.metadata)).map(([k, v]) => `${k}: ${v}`).join(' · '); } catch { return ''; } })()}
                        </div>
                      )}
                    </td>
                    <td style={{ ...S.td, paddingRight: 16 }}>
                      {log.tenant ? (
                        <a href={`/tenants/${log.tenantId}`} style={{ color: '#818cf8', textDecoration: 'none', fontSize: 12 }}>
                          {log.tenant.name}
                        </a>
                      ) : <span style={{ color: '#374151', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ ...S.td, paddingRight: 16 }}>
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>
                        {log.operator?.email || 'System'}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={{ color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data.total > LIMIT && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 20 }}>
          <button onClick={() => setOffset(Math.max(0, offset - LIMIT))} disabled={offset === 0}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #2d3147',
              background: '#13151f', color: offset === 0 ? '#374151' : '#94a3b8', cursor: offset === 0 ? 'not-allowed' : 'pointer',
            }}>← Prev</button>
          <span style={{ color: '#64748b', fontSize: 13, alignSelf: 'center' }}>
            {offset + 1}–{Math.min(offset + LIMIT, data.total)} of {data.total}
          </span>
          <button onClick={() => setOffset(offset + LIMIT)} disabled={offset + LIMIT >= data.total}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #2d3147',
              background: '#13151f', color: offset + LIMIT >= data.total ? '#374151' : '#94a3b8',
              cursor: offset + LIMIT >= data.total ? 'not-allowed' : 'pointer',
            }}>Next →</button>
        </div>
      )}
    </div>
  );
}
