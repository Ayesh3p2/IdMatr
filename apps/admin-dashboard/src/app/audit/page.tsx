'use client';
import { useState, useEffect } from 'react';
import { getAuditLogs } from '@/lib/api';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    getAuditLogs()
      .then(data => { setLogs(Array.isArray(data) ? data : []); setError(null); })
      .catch(err => setError(err?.message || 'Failed to load audit logs'))
      .finally(() => setLoading(false));
  }, []);

  const riskColor = (r: string) => ({ Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e', Info: '#6366f1' } as Record<string,string>)[r] || '#94a3b8';
  const statusColor = (s: string) => ({ Success: '#22c55e', success: '#22c55e', Flagged: '#ef4444', flagged: '#ef4444', Rejected: '#f97316', rejected: '#f97316', Failed: '#ef4444', failed: '#ef4444' } as Record<string,string>)[s] || '#94a3b8';

  const flagged = logs.filter(l => l.status === 'Flagged' || l.status === 'flagged').length;
  const failed = logs.filter(l => l.status === 'Failed' || l.status === 'failed' || l.status === 'Rejected' || l.status === 'rejected').length;

  const categories = ['all', ...Array.from(new Set(logs.map(l => l.category || l.action?.split('_')[0]).filter(Boolean)))].slice(0, 8);

  const filtered = logs.filter(l => {
    const actor = (l.actor || l.actorId || '').toLowerCase();
    const action = (l.action || l.actionType || '').toLowerCase();
    const matchSearch = !search || actor.includes(search.toLowerCase()) || action.includes(search.toLowerCase());
    const cat = l.category || l.action?.split('_')[0] || '';
    const matchCat = categoryFilter === 'all' || cat === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Audit & Compliance Log</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Immutable audit trail for all identity and access events across the platform</p>
        </div>
        <button style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>↓ Export Logs</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Total Events', value: loading ? '…' : logs.length.toLocaleString(), color: '#6366f1', sub: 'All time' },
          { label: 'Flagged Events', value: loading ? '…' : flagged.toString(), color: '#ef4444', sub: 'Require review' },
          { label: 'Failed Actions', value: loading ? '…' : failed.toString(), color: '#f97316', sub: 'Access denied / rejected' },
          { label: 'Unique Actors', value: loading ? '…' : new Set(logs.map(l => l.actor || l.actorId).filter(Boolean)).size.toString(), color: '#22c55e', sub: 'Distinct identities' },
        ].map(s => (
          <div key={s.label} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#f1f5f9' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Search actor or action…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '8px', padding: '9px 14px', color: '#f1f5f9', fontSize: '13px', outline: 'none', width: '240px' }} />
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              style={{ padding: '5px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', border: '1px solid', borderColor: categoryFilter === cat ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)', background: categoryFilter === cat ? 'rgba(99,102,241,0.15)' : 'transparent', color: categoryFilter === cat ? '#818cf8' : '#64748b', textTransform: 'capitalize' }}>
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⟳</div>Loading audit logs…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '16px', color: '#f87171', marginBottom: '16px' }}>⚠ {error}</div>}

      {!loading && logs.length === 0 && (
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>📜</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No audit events yet</div>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
            Audit events are automatically generated as users and systems interact with the platform.
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Timestamp', 'Actor', 'Action', 'Target', 'Category', 'Risk', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log: any, i: number) => {
                const risk = log.riskLevel || log.risk || 'Info';
                const status = log.status || 'Success';
                const ts = log.createdAt || log.timestamp || log.ts;
                return (
                  <tr key={log.id ?? i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = status === 'Flagged' || status === 'flagged' ? 'rgba(239,68,68,0.04)' : 'rgba(99,102,241,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px', fontSize: '11px', color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {ts ? new Date(ts).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9', fontFamily: 'monospace' }}>{log.actor || log.actorId || '—'}</div>
                      {log.actorType && <div style={{ fontSize: '10px', color: '#475569', textTransform: 'capitalize' }}>{log.actorType}</div>}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8' }}>{log.action || log.actionType || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.target || log.targetId || log.resourceId || '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '10px', color: '#818cf8', background: 'rgba(99,102,241,0.1)', padding: '2px 6px', borderRadius: '4px', textTransform: 'capitalize' }}>
                        {log.category || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: riskColor(risk) }}>{risk}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusColor(status), boxShadow: (status === 'Flagged' || status === 'flagged') ? '0 0 6px rgba(239,68,68,0.5)' : 'none' }}></div>
                        <span style={{ fontSize: '12px', color: statusColor(status), fontWeight: '600', textTransform: 'capitalize' }}>{status}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: '#475569' }}>Showing {filtered.length} of {logs.length} events</span>
          </div>
        </div>
      )}
    </div>
  );
}
