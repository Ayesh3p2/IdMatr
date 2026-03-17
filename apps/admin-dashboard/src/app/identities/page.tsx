'use client';
import { useState, useEffect } from 'react';
import { getIdentities } from '@/lib/api';

export default function IdentitiesPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  useEffect(() => {
    setLoading(true);
    getIdentities()
      .then(data => { setUsers(Array.isArray(data) ? data : []); setError(null); })
      .catch(err => setError(err?.message || 'Failed to load identities'))
      .finally(() => setLoading(false));
  }, []);

  const riskColor = (r: number) => r > 80 ? '#ef4444' : r > 60 ? '#f97316' : r > 40 ? '#eab308' : '#22c55e';
  const riskLabel = (r: number) => r > 80 ? 'Critical' : r > 60 ? 'High' : r > 40 ? 'Medium' : 'Low';

  const total = users.length;
  const privileged = users.filter(u => u.isAdmin || u.privileged).length;
  const highRisk = users.filter(u => (u.riskScore ?? 0) > 70).length;
  const noMfa = users.filter(u => u.mfaEnabled === false || u.mfa === false).length;

  const stats = [
    { label: 'Total Identities', value: loading ? '…' : total.toLocaleString(), sub: `${users.filter(u => u.type === 'service' || u.accountType === 'service').length} service accounts`, color: '#6366f1' },
    { label: 'Privileged Users', value: loading ? '…' : privileged.toLocaleString(), sub: total > 0 ? `${((privileged / total) * 100).toFixed(1)}% of total` : '—', color: '#8b5cf6' },
    { label: 'High Risk (>70)', value: loading ? '…' : highRisk.toLocaleString(), sub: 'Risk score above threshold', color: '#ef4444' },
    { label: 'No MFA', value: loading ? '…' : noMfa.toLocaleString(), sub: total > 0 ? `${((noMfa / total) * 100).toFixed(1)}% without MFA` : '—', color: '#f97316' },
  ];

  const filtered = users.filter(u => {
    const name = u.name || u.email || '';
    const email = u.email || '';
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
    const status = (u.status || 'active').toLowerCase();
    const isPriv = u.isAdmin || u.privileged;
    const isService = u.type === 'service' || u.accountType === 'service';
    const matchStatus = filter === 'all' || status === filter || (filter === 'privileged' && isPriv) || (filter === 'service' && isService);
    const risk = u.riskScore ?? u.risk ?? 0;
    const matchRisk = riskFilter === 'all' || (riskFilter === 'critical' && risk > 80) || (riskFilter === 'high' && risk > 60 && risk <= 80) || (riskFilter === 'low' && risk <= 40);
    return matchSearch && matchStatus && matchRisk;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Identity Intelligence</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Unified view of all human and service identities across your organization</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>↓ Export</button>
          <button style={{ background: '#6366f1', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: 'none' }}>+ Provision Identity</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#f1f5f9' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input placeholder="Search identities..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '8px', padding: '9px 14px', color: '#f1f5f9', fontSize: '13px', outline: 'none', width: '260px' }} />
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['all','All'], ['active','Active'], ['suspended','Suspended'], ['privileged','Privileged'], ['service','Service Accounts']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter(val)}
              style={{ padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid', borderColor: filter === val ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)', background: filter === val ? 'rgba(99,102,241,0.15)' : 'transparent', color: filter === val ? '#818cf8' : '#64748b' }}>
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

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#475569', fontSize: '14px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⟳</div>Loading identities…
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '16px 20px', color: '#f87171', marginBottom: '16px' }}>
          ⚠ {error}
        </div>
      )}

      {!loading && !error && users.length === 0 && (
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>👤</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No identities discovered yet</div>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto 20px' }}>
            Connect identity sources (Google Workspace, Microsoft 365, Okta) and run a discovery scan to populate this view.
          </p>
          <button onClick={() => window.location.href = '/applications'}
            style={{ background: '#6366f1', color: 'white', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: 'none' }}>
            Go to Applications → Run Discovery
          </button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Identity', 'Type', 'Status', 'Risk Score', 'Roles', 'Last Activity', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((user, idx) => {
                const name = user.name || user.email?.split('@')[0] || 'Unknown';
                const email = user.email || '—';
                const status = user.status || 'Active';
                const risk = user.riskScore ?? user.risk ?? 0;
                const isPriv = user.isAdmin || user.privileged;
                const isService = user.type === 'service' || user.accountType === 'service';
                const hasMfa = user.mfaEnabled !== false && user.mfa !== false;
                const roles: string[] = user.roles?.map((r: any) => r.name || r) || [];
                const lastLogin = user.lastLogin || user.lastActivity || '—';
                return (
                  <tr key={user.id ?? idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isService ? 'linear-gradient(135deg,#0891b2,#0e7490)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: 'white', flexShrink: 0 }}>
                          {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {name}
                            {isPriv && <span style={{ fontSize: '9px', fontWeight: '700', color: '#facc15', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)', padding: '1px 5px', borderRadius: '3px' }}>PRIV</span>}
                          </div>
                          <div style={{ fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>{email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '4px', background: isService ? 'rgba(6,182,212,0.1)' : 'rgba(99,102,241,0.1)', color: isService ? '#22d3ee' : '#818cf8', border: `1px solid ${isService ? 'rgba(6,182,212,0.25)' : 'rgba(99,102,241,0.25)'}` }}>
                        {isService ? 'Service Acct' : 'Human'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: status === 'Active' || status === 'active' ? '#22c55e' : status === 'Suspended' || status === 'suspended' ? '#ef4444' : '#64748b', boxShadow: (status === 'Active' || status === 'active') ? '0 0 6px rgba(34,197,94,0.5)' : 'none' }}></div>
                        <span style={{ fontSize: '12px', color: (status === 'Active' || status === 'active') ? '#4ade80' : (status === 'Suspended' || status === 'suspended') ? '#f87171' : '#94a3b8', fontWeight: '600', textTransform: 'capitalize' }}>{status}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '18px', fontWeight: '800', color: riskColor(risk), fontFamily: 'monospace' }}>{risk}</span>
                          <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 6px', borderRadius: '3px', background: `${riskColor(risk)}18`, color: riskColor(risk), border: `1px solid ${riskColor(risk)}30` }}>{riskLabel(risk)}</span>
                        </div>
                        <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', width: '80px' }}>
                          <div style={{ height: '100%', width: `${risk}%`, background: riskColor(risk) }}></div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '180px' }}>
                        {roles.slice(0, 2).map((r: string) => (
                          <span key={r} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.08)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', whiteSpace: 'nowrap' }}>{r}</span>
                        ))}
                        {roles.length > 2 && <span style={{ fontSize: '10px', color: '#475569' }}>+{roles.length - 2}</span>}
                        {roles.length === 0 && <span style={{ fontSize: '10px', color: '#475569' }}>—</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {!hasMfa && <span style={{ fontSize: '9px', color: '#f97316', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', padding: '1px 5px', borderRadius: '3px', fontWeight: '700' }}>NO MFA</span>}
                        {typeof lastLogin === 'string' ? lastLogin : new Date(lastLogin).toLocaleDateString()}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button style={{ fontSize: '11px', fontWeight: '600', color: '#818cf8', padding: '4px 10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px', cursor: 'pointer' }}>Review</button>
                        {risk > 60 && <button style={{ fontSize: '11px', fontWeight: '600', color: '#f87171', padding: '4px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', cursor: 'pointer' }}>Remediate</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#475569' }}>Showing {filtered.length} of {total.toLocaleString()} identities</span>
          </div>
        </div>
      )}
    </div>
  );
}
