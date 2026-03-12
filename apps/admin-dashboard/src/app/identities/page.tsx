'use client';
import { useState } from 'react';

const USERS = [
  { id: 1, name: 'John Doe', email: 'john.doe@corp.com', dept: 'Engineering', status: 'Active', risk: 89, apps: 14, roles: ['Global Admin', 'Dev Lead'], lastLogin: '2m ago', mfa: true, privileged: true, type: 'human' },
  { id: 2, name: 'Sarah Chen', email: 'sarah.chen@corp.com', dept: 'Finance', status: 'Active', risk: 76, apps: 8, roles: ['Finance Approver', 'Vendor Creator'], lastLogin: '34m ago', mfa: true, privileged: true, type: 'human' },
  { id: 3, name: 'Bob Johnson', email: 'bob.johnson@corp.com', dept: 'IT', status: 'Suspended', risk: 12, apps: 0, roles: ['IT Admin'], lastLogin: '15d ago', mfa: false, privileged: false, type: 'human' },
  { id: 4, name: 'Alice Brown', email: 'alice.brown@corp.com', dept: 'HR', status: 'Active', risk: 65, apps: 11, roles: ['HR Admin', 'Self-Approver'], lastLogin: '1h ago', mfa: true, privileged: true, type: 'human' },
  { id: 5, name: 'SA-PROD-DB01', email: 'svc-db@system.internal', dept: 'Infrastructure', status: 'Active', risk: 71, apps: 3, roles: ['DB Admin', 'Backup Operator'], lastLogin: '94d ago', mfa: false, privileged: true, type: 'service' },
  { id: 6, name: 'Charlie Davis', email: 'charlie.davis@corp.com', dept: 'Sales', status: 'Inactive', risk: 28, apps: 5, roles: ['Sales User'], lastLogin: '45d ago', mfa: false, privileged: false, type: 'human' },
  { id: 7, name: 'Emily Rodriguez', email: 'emily.r@corp.com', dept: 'Engineering', status: 'Active', risk: 42, apps: 9, roles: ['Developer', 'CI/CD Pipeline'], lastLogin: '3h ago', mfa: true, privileged: false, type: 'human' },
  { id: 8, name: 'SVC-OKTA-SYNC', email: 'okta-sync@system.internal', dept: 'Identity', status: 'Active', risk: 55, apps: 12, roles: ['Directory Sync', 'User Provisioner'], lastLogin: '5m ago', mfa: false, privileged: true, type: 'service' },
];

const IDENTITY_STATS = [
  { label: 'Total Identities', value: '14,832', sub: '14,218 human • 614 service', color: '#6366f1' },
  { label: 'Privileged Users', value: '1,247', sub: '8.4% of total identities', color: '#8b5cf6' },
  { label: 'High Risk (>70)', value: '347', sub: '↑ 23 new this week', color: '#ef4444' },
  { label: 'No MFA', value: '892', sub: '6.0% without MFA enabled', color: '#f97316' },
];

export default function IdentitiesPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  const filtered = USERS.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filter === 'all' || u.status.toLowerCase() === filter || (filter === 'privileged' && u.privileged) || (filter === 'service' && u.type === 'service');
    const matchRisk = riskFilter === 'all' || (riskFilter === 'critical' && u.risk > 80) || (riskFilter === 'high' && u.risk > 60 && u.risk <= 80) || (riskFilter === 'low' && u.risk <= 40);
    return matchSearch && matchStatus && matchRisk;
  });

  const riskColor = (r: number) => r > 80 ? '#ef4444' : r > 60 ? '#f97316' : r > 40 ? '#eab308' : '#22c55e';
  const riskLabel = (r: number) => r > 80 ? 'Critical' : r > 60 ? 'High' : r > 40 ? 'Medium' : 'Low';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            Identity Intelligence
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Unified view of all human and service identities across your organization
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            ↓ Export
          </button>
          <button style={{ background: '#6366f1', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: 'none' }}>
            + Provision Identity
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {IDENTITY_STATS.map(s => (
          <div key={s.label} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0, borderRadius: '2px 2px 0 0' }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#f1f5f9' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Search identities..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '8px', padding: '9px 14px', color: '#f1f5f9', fontSize: '13px', outline: 'none', width: '260px' }}
        />
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['all','All'], ['active','Active'], ['suspended','Suspended'], ['privileged','Privileged'], ['service','Service Accounts']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter(val)}
              style={{ padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid', borderColor: filter === val ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)', background: filter === val ? 'rgba(99,102,241,0.15)' : 'transparent', color: filter === val ? '#818cf8' : '#64748b', transition: 'all 0.2s' }}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '11px', color: '#475569', alignSelf: 'center' }}>Risk:</span>
          {[['all','All'], ['critical','>80'], ['high','>60'], ['low','Low']].map(([val, lbl]) => (
            <button key={val} onClick={() => setRiskFilter(val)}
              style={{ padding: '5px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', border: '1px solid', borderColor: riskFilter === val ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)', background: riskFilter === val ? 'rgba(239,68,68,0.1)' : 'transparent', color: riskFilter === val ? '#f87171' : '#64748b' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              {['Identity', 'Type', 'Status', 'Risk Score', 'Roles', 'Apps', 'Last Activity', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: user.type === 'service' ? 'linear-gradient(135deg,#0891b2,#0e7490)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: 'white', flexShrink: 0 }}>
                      {user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {user.name}
                        {user.privileged && <span style={{ fontSize: '9px', fontWeight: '700', color: '#facc15', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)', padding: '1px 5px', borderRadius: '3px', letterSpacing: '0.05em' }}>PRIV</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>{user.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '4px', background: user.type === 'service' ? 'rgba(6,182,212,0.1)' : 'rgba(99,102,241,0.1)', color: user.type === 'service' ? '#22d3ee' : '#818cf8', border: `1px solid ${user.type === 'service' ? 'rgba(6,182,212,0.25)' : 'rgba(99,102,241,0.25)'}` }}>
                    {user.type === 'service' ? 'Service Acct' : 'Human'}
                  </span>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: user.status === 'Active' ? '#22c55e' : user.status === 'Suspended' ? '#ef4444' : '#64748b', boxShadow: user.status === 'Active' ? '0 0 6px rgba(34,197,94,0.5)' : 'none' }}></div>
                    <span style={{ fontSize: '12px', color: user.status === 'Active' ? '#4ade80' : user.status === 'Suspended' ? '#f87171' : '#94a3b8', fontWeight: '600' }}>{user.status}</span>
                  </div>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: riskColor(user.risk), fontFamily: 'monospace' }}>{user.risk}</span>
                      <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 6px', borderRadius: '3px', background: `${riskColor(user.risk)}18`, color: riskColor(user.risk), border: `1px solid ${riskColor(user.risk)}30` }}>{riskLabel(user.risk)}</span>
                    </div>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', width: '80px' }}>
                      <div style={{ height: '100%', width: `${user.risk}%`, background: riskColor(user.risk), borderRadius: '2px' }}></div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '180px' }}>
                    {user.roles.slice(0, 2).map(r => (
                      <span key={r} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', whiteSpace: 'nowrap' }}>{r}</span>
                    ))}
                    {user.roles.length > 2 && <span style={{ fontSize: '10px', color: '#475569' }}>+{user.roles.length - 2}</span>}
                  </div>
                </td>
                <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: '700', color: '#94a3b8', textAlign: 'center' }}>{user.apps}</td>
                <td style={{ padding: '14px 16px', fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {!user.mfa && <span style={{ fontSize: '9px', color: '#f97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', padding: '1px 5px', borderRadius: '3px', fontWeight: '700' }}>NO MFA</span>}
                    {user.lastLogin}
                  </div>
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button style={{ fontSize: '11px', fontWeight: '600', color: '#818cf8', padding: '4px 10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px', cursor: 'pointer' }}>Review</button>
                    {user.risk > 60 && <button style={{ fontSize: '11px', fontWeight: '600', color: '#f87171', padding: '4px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', cursor: 'pointer' }}>Remediate</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#475569' }}>Showing {filtered.length} of 14,832 identities</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['←', '1', '2', '3', '...', '148', '→'].map((p, i) => (
              <button key={i} style={{ fontSize: '12px', color: p === '1' ? '#818cf8' : '#475569', background: p === '1' ? 'rgba(99,102,241,0.15)' : 'transparent', border: '1px solid', borderColor: p === '1' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}>{p}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
