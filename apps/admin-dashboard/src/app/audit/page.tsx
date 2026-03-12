'use client';
import { useState } from 'react';

const AUDIT_LOGS = [
  { id: 'AL-8821', ts: '2026-03-12 10:42:33', actor: 'john.doe@corp.com', actorType: 'user', action: 'PRIVILEGE_ESCALATION', target: 'Azure AD Global Admin', status: 'Flagged', ip: '10.20.30.41', risk: 'Critical', category: 'Access Change' },
  { id: 'AL-8820', ts: '2026-03-12 10:38:11', actor: 'sarah.chen@corp.com', actorType: 'user', action: 'LOGIN_ANOMALY', target: 'IDMatr Portal', status: 'Flagged', ip: '185.22.33.44', risk: 'Critical', category: 'Authentication' },
  { id: 'AL-8819', ts: '2026-03-12 10:24:00', actor: 'alice.brown@corp.com', actorType: 'user', action: 'ACCESS_APPROVED', target: 'Salesforce Admin', status: 'Success', ip: '10.20.30.22', risk: 'High', category: 'Approval' },
  { id: 'AL-8818', ts: '2026-03-12 10:15:52', actor: 'system', actorType: 'system', action: 'APP_DISCOVERY_SCAN', target: 'All Connectors', status: 'Success', ip: 'Internal', risk: 'Info', category: 'Discovery' },
  { id: 'AL-8817', ts: '2026-03-12 09:58:44', actor: 'admin@idmatr.com', actorType: 'admin', action: 'POLICY_UPDATED', target: 'RBAC Global Policy v2.3', status: 'Success', ip: '10.0.0.1', risk: 'Medium', category: 'Policy' },
  { id: 'AL-8816', ts: '2026-03-12 09:45:13', actor: 'svc-okta@system', actorType: 'service', action: 'USER_PROVISIONED', target: 'Alex Thompson (New Joiner)', status: 'Success', ip: 'Internal', risk: 'Info', category: 'Provisioning' },
  { id: 'AL-8815', ts: '2026-03-12 09:30:02', actor: 'bob.j@corp.com', actorType: 'user', action: 'ACCESS_REQUEST', target: 'GitHub Enterprise Admin', status: 'Rejected', ip: '10.20.30.55', risk: 'High', category: 'Access Change' },
  { id: 'AL-8814', ts: '2026-03-12 08:55:44', actor: 'emily.r@corp.com', actorType: 'user', action: 'DATA_EXPORT', target: 'Salesforce — Customer Records', status: 'Success', ip: '10.20.30.66', risk: 'High', category: 'Data Access' },
  { id: 'AL-8813', ts: '2026-03-12 08:24:15', actor: 'system', actorType: 'system', action: 'RISK_SCORE_UPDATED', target: 'john.doe@corp.com (89 → 91)', status: 'Success', ip: 'Internal', risk: 'Info', category: 'Risk Engine' },
];

const AUDIT_STATS = [
  { label: 'Events Today', value: '2,847', color: '#6366f1' },
  { label: 'Flagged Events', value: '12', color: '#ef4444' },
  { label: 'Failed Actions', value: '34', color: '#f97316' },
  { label: 'Policy Changes', value: '3', color: '#eab308' },
];

export default function AuditPage() {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');

  const filtered = AUDIT_LOGS.filter(l => {
    const matchSearch = l.actor.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase()) || l.target.toLowerCase().includes(search.toLowerCase());
    const matchRisk = riskFilter === 'all' || l.risk.toLowerCase() === riskFilter;
    const matchCat = catFilter === 'all' || l.category === catFilter;
    return matchSearch && matchRisk && matchCat;
  });

  const riskColor = (r: string) => ({ Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Info: '#6366f1' } as Record<string,string>)[r] || '#94a3b8';
  const statusStyle = (s: string) => ({ Flagged: { color: '#f87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' }, Success: { color: '#4ade80', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' }, Rejected: { color: '#fb923c', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)' } } as Record<string,{color:string,bg:string,border:string}>)[s] || { color: '#94a3b8', bg: 'transparent', border: 'rgba(255,255,255,0.1)' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Audit Trail</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Tamper-proof audit log of all identity and access events</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>↓ Export Audit</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
        {AUDIT_STATS.map(s => (
          <div key={s.label} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#f1f5f9' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '8px', padding: '9px 14px', color: '#f1f5f9', fontSize: '13px', outline: 'none', width: '280px' }} />
        <div style={{ display: 'flex', gap: '5px' }}>
          {['all', 'critical', 'high', 'medium', 'info'].map(f => (
            <button key={f} onClick={() => setRiskFilter(f)}
              style={{ padding: '6px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', border: '1px solid', textTransform: 'capitalize', borderColor: riskFilter === f ? riskColor(f === 'all' ? 'Info' : f.charAt(0).toUpperCase() + f.slice(1)) + '50' : 'rgba(255,255,255,0.08)', background: riskFilter === f ? riskColor(f === 'all' ? 'Info' : f.charAt(0).toUpperCase() + f.slice(1)) + '18' : 'transparent', color: riskFilter === f ? riskColor(f === 'all' ? 'Info' : f.charAt(0).toUpperCase() + f.slice(1)) : '#64748b' }}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '5px', marginLeft: 'auto' }}>
          {['all', 'Authentication', 'Access Change', 'Policy', 'Provisioning'].map(f => (
            <button key={f} onClick={() => setCatFilter(f)}
              style={{ padding: '5px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', border: '1px solid', borderColor: catFilter === f ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)', background: catFilter === f ? 'rgba(99,102,241,0.12)' : 'transparent', color: catFilter === f ? '#818cf8' : '#64748b' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              {['Event ID', 'Timestamp', 'Actor', 'Action', 'Target', 'Risk', 'Category', 'Status', 'IP'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(log => {
              const ss = statusStyle(log.status);
              return (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 14px', fontSize: '11px', fontFamily: 'monospace', color: '#6366f1', fontWeight: '700' }}>{log.id}</td>
                  <td style={{ padding: '12px 14px', fontSize: '11px', fontFamily: 'monospace', color: '#475569', whiteSpace: 'nowrap' }}>{log.ts}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', fontFamily: 'monospace' }}>{log.actor}</div>
                    <div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{log.actorType}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', fontWeight: '700', fontFamily: 'monospace', color: log.risk === 'Critical' ? '#f87171' : log.risk === 'High' ? '#fb923c' : '#94a3b8' }}>{log.action}</td>
                  <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.target}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: riskColor(log.risk), boxShadow: log.risk === 'Critical' ? `0 0 6px ${riskColor(log.risk)}` : 'none' }}></div>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: riskColor(log.risk) }}>{log.risk}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.18)' }}>{log.category}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>{log.status}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: '11px', fontFamily: 'monospace', color: '#475569' }}>{log.ip}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#475569' }}>Showing {filtered.length} of 2,847 events today</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['← Prev', 'Page 1 of 285', 'Next →'].map((p, i) => (
              <button key={i} style={{ fontSize: '12px', color: '#475569', background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}>{p}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
