'use client';
import { useState } from 'react';

const APPS = [
  { id: 1, name: 'Google Workspace', category: 'Productivity', users: 1248, admins: 12, owners: 3, risk: 35, privilege: 'High', status: 'Managed', source: 'Google', dataClass: 'Confidential', lastScan: '5m ago', violations: 2 },
  { id: 2, name: 'GitHub Enterprise', category: 'Development', users: 487, admins: 24, owners: 4, risk: 68, privilege: 'Critical', status: 'Managed', source: 'GitHub', dataClass: 'Restricted', lastScan: '5m ago', violations: 7 },
  { id: 3, name: 'Slack', category: 'Collaboration', users: 1156, admins: 8, owners: 2, risk: 22, privilege: 'Medium', status: 'Managed', source: 'Slack', dataClass: 'Internal', lastScan: '5m ago', violations: 1 },
  { id: 4, name: 'AWS Production', category: 'Cloud Infra', users: 89, admins: 18, owners: 5, risk: 82, privilege: 'Critical', status: 'Managed', source: 'AWS', dataClass: 'Restricted', lastScan: '5m ago', violations: 12 },
  { id: 5, name: 'Salesforce CRM', category: 'CRM', users: 342, admins: 7, owners: 2, risk: 44, privilege: 'High', status: 'Managed', source: 'Salesforce', dataClass: 'Confidential', lastScan: '5m ago', violations: 3 },
  { id: 6, name: 'Notion', category: 'Knowledge', users: 156, admins: 4, owners: 0, risk: 71, privilege: 'Medium', status: 'Shadow IT', source: 'Detected', dataClass: 'Unknown', lastScan: '1h ago', violations: 0 },
  { id: 7, name: 'Dropbox Personal', category: 'Storage', users: 47, admins: 2, owners: 0, risk: 84, privilege: 'High', status: 'Shadow IT', source: 'Detected', dataClass: 'Unknown', lastScan: '1h ago', violations: 0 },
  { id: 8, name: 'Zoom', category: 'Communication', users: 1089, admins: 6, owners: 2, risk: 18, privilege: 'Low', status: 'Managed', source: 'Zoom', dataClass: 'Internal', lastScan: '5m ago', violations: 0 },
  { id: 9, name: 'Figma', category: 'Design', users: 89, admins: 3, owners: 1, risk: 29, privilege: 'Low', status: 'Managed', source: 'Figma', dataClass: 'Internal', lastScan: '5m ago', violations: 0 },
  { id: 10, name: 'ChatGPT Plus', category: 'AI Tool', users: 234, admins: 0, owners: 0, risk: 76, privilege: 'Medium', status: 'Shadow IT', source: 'Browser', dataClass: 'Unknown', lastScan: '2h ago', violations: 0 },
];

const APP_STATS = [
  { label: 'Total Applications', value: '284', sub: '261 managed • 23 shadow IT', color: '#6366f1' },
  { label: 'Critical Risk Apps', value: '18', sub: 'Require immediate review', color: '#ef4444' },
  { label: 'Shadow IT Detected', value: '23', sub: '8 with sensitive data', color: '#f97316' },
  { label: 'Access Violations', value: '48', sub: 'Across all applications', color: '#eab308' },
];

export default function ApplicationsPage() {
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = APPS.filter(a => statusFilter === 'all' || a.status.toLowerCase().replace(' ', '-') === statusFilter || (statusFilter === 'critical' && a.risk > 70));
  const riskColor = (r: number) => r > 70 ? '#ef4444' : r > 50 ? '#f97316' : r > 30 ? '#eab308' : '#22c55e';
  const privColor = (p: string) => p === 'Critical' ? '#ef4444' : p === 'High' ? '#f97316' : p === 'Medium' ? '#eab308' : '#22c55e';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            Application Access Intelligence
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            All discovered applications, access patterns, and shadow IT detection
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            ◎ Run Discovery Scan
          </button>
          <button style={{ background: '#6366f1', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: 'none' }}>
            Connect Source
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {APP_STATS.map(s => (
          <div key={s.label} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#f1f5f9' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        {[['all', 'All Apps'], ['managed', 'Managed'], ['shadow-it', 'Shadow IT'], ['critical', 'Critical Risk']].map(([val, lbl]) => (
          <button key={val} onClick={() => setStatusFilter(val)}
            style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid', borderColor: statusFilter === val ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)', background: statusFilter === val ? 'rgba(99,102,241,0.15)' : 'transparent', color: statusFilter === val ? '#818cf8' : '#64748b', transition: 'all 0.2s' }}>
            {lbl}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <button onClick={() => setView('table')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: view === 'table' ? 'rgba(99,102,241,0.15)' : 'transparent', border: '1px solid rgba(99,102,241,0.2)', color: view === 'table' ? '#818cf8' : '#475569' }}>Table</button>
          <button onClick={() => setView('grid')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: view === 'grid' ? 'rgba(99,102,241,0.15)' : 'transparent', border: '1px solid rgba(99,102,241,0.2)', color: view === 'grid' ? '#818cf8' : '#475569' }}>Grid</button>
        </div>
      </div>

      {/* Shadow IT Banner */}
      <div style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316', boxShadow: '0 0 8px rgba(249,115,22,0.6)', flexShrink: 0 }}></div>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#fb923c' }}>Shadow IT Alert:</span>
        <span style={{ fontSize: '13px', color: '#94a3b8' }}>3 newly detected apps (Notion, Dropbox Personal, ChatGPT Plus) — 234 employees using unmanaged AI tools with potential data exposure</span>
        <button style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: '600', color: '#fb923c', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Review All →</button>
      </div>

      {/* Content */}
      {view === 'table' ? (
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Application', 'Category', 'Users', 'Admins', 'Privilege', 'Risk Score', 'Data Class', 'Status', 'Violations', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(app => (
                <tr key={app.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '14px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: app.status === 'Shadow IT' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0, border: `1px solid ${app.status === 'Shadow IT' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.25)'}` }}>
                        {app.name[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9' }}>{app.name}</div>
                        <div style={{ fontSize: '10px', color: '#475569' }}>Last scan: {app.lastScan}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px', fontSize: '12px', color: '#64748b' }}>{app.category}</td>
                  <td style={{ padding: '14px', fontSize: '14px', fontWeight: '700', color: '#94a3b8' }}>{app.users.toLocaleString()}</td>
                  <td style={{ padding: '14px', fontSize: '14px', fontWeight: '700', color: app.admins > 15 ? '#f97316' : '#94a3b8' }}>{app.admins}</td>
                  <td style={{ padding: '14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', background: `${privColor(app.privilege)}15`, color: privColor(app.privilege), border: `1px solid ${privColor(app.privilege)}30` }}>
                      {app.privilege}
                    </span>
                  </td>
                  <td style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: riskColor(app.risk), fontFamily: 'monospace' }}>{app.risk}</span>
                      <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', width: '50px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${app.risk}%`, background: riskColor(app.risk) }}></div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px' }}>
                    <span style={{ fontSize: '11px', color: app.dataClass === 'Restricted' ? '#f87171' : app.dataClass === 'Confidential' ? '#fb923c' : app.dataClass === 'Unknown' ? '#94a3b8' : '#4ade80', fontWeight: '600' }}>
                      {app.dataClass}
                    </span>
                  </td>
                  <td style={{ padding: '14px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '999px', background: app.status === 'Shadow IT' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.1)', color: app.status === 'Shadow IT' ? '#f87171' : '#4ade80', border: `1px solid ${app.status === 'Shadow IT' ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.2)'}` }}>
                      {app.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px' }}>
                    {app.violations > 0 ? (
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '4px' }}>{app.violations}</span>
                    ) : <span style={{ fontSize: '12px', color: '#4ade80' }}>✓</span>}
                  </td>
                  <td style={{ padding: '14px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button style={{ fontSize: '11px', fontWeight: '600', color: '#818cf8', padding: '4px 10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px', cursor: 'pointer' }}>Details</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {filtered.map(app => (
            <div key={app.id} style={{ background: '#111827', border: `1px solid ${app.status === 'Shadow IT' ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.15)'}`, borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden', transition: 'all 0.2s', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = app.status === 'Shadow IT' ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.15)')}>
              {app.status === 'Shadow IT' && (
                <div style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '9px', fontWeight: '700', color: '#f87171', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', padding: '2px 7px', borderRadius: '3px', letterSpacing: '0.05em' }}>SHADOW IT</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: app.status === 'Shadow IT' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', border: `1px solid ${app.status === 'Shadow IT' ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.2)'}` }}>
                  {app.name[0]}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>{app.name}</div>
                  <div style={{ fontSize: '11px', color: '#475569' }}>{app.category}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                {[['Users', app.users.toLocaleString()], ['Admins', app.admins.toString()], ['Risk', app.risk.toString()], ['Violations', app.violations.toString()]].map(([l, v]) => (
                  <div key={l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 10px' }}>
                    <div style={{ fontSize: '10px', color: '#475569', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#f1f5f9' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${app.risk}%`, background: riskColor(app.risk) }}></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
