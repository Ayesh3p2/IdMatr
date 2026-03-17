'use client';
import { useState, useEffect } from 'react';
import { getApplications, triggerScan } from '@/lib/api';

export default function ApplicationsPage() {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'table' | 'grid'>('table');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadApps = () => {
    setLoading(true);
    getApplications()
      .then(data => { setApps(Array.isArray(data) ? data : []); setError(null); })
      .catch(err => setError(err?.message || 'Failed to load applications'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadApps();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    setScanMsg(null);
    try {
      const result = await triggerScan('all');
      setScanMsg(`Scan complete — ${result.detected_identities ?? 0} identities, ${result.detected_apps ?? 0} apps discovered`);
      loadApps();
    } catch (err: any) {
      setScanMsg(`Scan error: ${err?.message}`);
    } finally {
      setScanning(false);
    }
  };

  const riskColor = (r: number) => r > 70 ? '#ef4444' : r > 50 ? '#f97316' : r > 30 ? '#eab308' : '#22c55e';

  const total = apps.length;
  const managed = apps.filter(a => a.status === 'identified' || a.status === 'managed').length;
  const shadowIT = apps.filter(a => a.status === 'shadow-it' || a.status === 'shadowit').length;
  const users = apps.reduce((s: number, a) => s + (a.users?.length ?? a.userCount ?? 0), 0);

  const stats = [
    { label: 'Total Applications', value: loading ? '…' : total.toString(), sub: `${managed} managed • ${shadowIT} shadow IT`, color: '#6366f1' },
    { label: 'Shadow IT Detected', value: loading ? '…' : shadowIT.toString(), sub: 'Unsanctioned apps', color: '#f97316' },
    { label: 'Total App Users', value: loading ? '…' : users.toLocaleString(), sub: 'Across all apps', color: '#22c55e' },
    { label: 'Managed Apps', value: loading ? '…' : managed.toString(), sub: `${total > 0 ? ((managed / total) * 100).toFixed(0) : 0}% of total`, color: '#8b5cf6' },
  ];

  const filtered = apps.filter(a => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'managed') return a.status === 'identified' || a.status === 'managed';
    if (statusFilter === 'shadow-it') return a.status === 'shadow-it' || a.status === 'shadowit';
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Application Access Intelligence</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>All discovered applications, access patterns, and shadow IT detection</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleScan} disabled={scanning}
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: scanning ? '#475569' : '#818cf8', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: scanning ? 'not-allowed' : 'pointer' }}>
            {scanning ? '⟳ Scanning…' : '◎ Run Discovery Scan'}
          </button>
        </div>
      </div>

      {scanMsg && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#4ade80', fontSize: '13px' }}>
          ✓ {scanMsg}
        </div>
      )}

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

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        {[['all', 'All Apps'], ['managed', 'Managed'], ['shadow-it', 'Shadow IT']].map(([val, lbl]) => (
          <button key={val} onClick={() => setStatusFilter(val)}
            style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid', borderColor: statusFilter === val ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)', background: statusFilter === val ? 'rgba(99,102,241,0.15)' : 'transparent', color: statusFilter === val ? '#818cf8' : '#64748b' }}>
            {lbl}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <button onClick={() => setView('table')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: view === 'table' ? 'rgba(99,102,241,0.15)' : 'transparent', border: '1px solid rgba(99,102,241,0.2)', color: view === 'table' ? '#818cf8' : '#475569' }}>Table</button>
          <button onClick={() => setView('grid')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: view === 'grid' ? 'rgba(99,102,241,0.15)' : 'transparent', border: '1px solid rgba(99,102,241,0.2)', color: view === 'grid' ? '#818cf8' : '#475569' }}>Grid</button>
        </div>
      </div>

      {shadowIT > 0 && (
        <div style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316', boxShadow: '0 0 8px rgba(249,115,22,0.6)', flexShrink: 0 }}></div>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#fb923c' }}>Shadow IT Alert:</span>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>{shadowIT} unsanctioned app{shadowIT !== 1 ? 's' : ''} detected — review and classify immediately</span>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#475569', fontSize: '14px' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⟳</div>Loading applications…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '16px 20px', color: '#f87171' }}>⚠ {error}</div>}

      {!loading && !error && apps.length === 0 && (
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔍</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No applications discovered yet</div>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto 20px' }}>
            Configure your connectors (Google Workspace, Microsoft 365, Slack, GitHub) and run a discovery scan.
          </p>
          <button onClick={handleScan} disabled={scanning}
            style={{ background: '#6366f1', color: 'white', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: 'none' }}>
            {scanning ? '⟳ Scanning…' : '◎ Run Discovery Scan'}
          </button>
        </div>
      )}

      {!loading && filtered.length > 0 && view === 'table' && (
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Application', 'Source', 'Users', 'Status', 'First Detected', 'Last Detected', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((app, idx) => {
                const isShadow = app.status === 'shadow-it' || app.status === 'shadowit';
                const appUsers = app.users?.length ?? app.userCount ?? 0;
                const firstDetected = app.firstDetected ? new Date(app.firstDetected).toLocaleDateString() : '—';
                const lastDetected = app.lastDetected ? new Date(app.lastDetected).toLocaleDateString() : '—';
                return (
                  <tr key={app.id ?? idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '14px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: isShadow ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0, border: `1px solid ${isShadow ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.25)'}` }}>
                          {(app.name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9' }}>{app.name}</div>
                          {app.metadata?.vendor && <div style={{ fontSize: '10px', color: '#475569' }}>{app.metadata.vendor}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px', fontSize: '12px', color: '#64748b', textTransform: 'capitalize' }}>{app.source || '—'}</td>
                    <td style={{ padding: '14px', fontSize: '14px', fontWeight: '700', color: '#94a3b8' }}>{appUsers.toLocaleString()}</td>
                    <td style={{ padding: '14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '999px', background: isShadow ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.1)', color: isShadow ? '#f87171' : '#4ade80', border: `1px solid ${isShadow ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.2)'}` }}>
                        {isShadow ? 'Shadow IT' : 'Managed'}
                      </span>
                    </td>
                    <td style={{ padding: '14px', fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>{firstDetected}</td>
                    <td style={{ padding: '14px', fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>{lastDetected}</td>
                    <td style={{ padding: '14px' }}>
                      <button style={{ fontSize: '11px', fontWeight: '600', color: '#818cf8', padding: '4px 10px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '6px', cursor: 'pointer' }}>Details</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length > 0 && view === 'grid' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {filtered.map((app, idx) => {
            const isShadow = app.status === 'shadow-it' || app.status === 'shadowit';
            const appUsers = app.users?.length ?? app.userCount ?? 0;
            return (
              <div key={app.id ?? idx} style={{ background: '#111827', border: `1px solid ${isShadow ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.15)'}`, borderRadius: '12px', padding: '20px', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = isShadow ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.15)')}>
                {isShadow && (
                  <div style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '9px', fontWeight: '700', color: '#f87171', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', padding: '2px 7px', borderRadius: '3px' }}>SHADOW IT</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: isShadow ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', border: `1px solid ${isShadow ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.2)'}` }}>
                    {(app.name || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>{app.name}</div>
                    <div style={{ fontSize: '11px', color: '#475569', textTransform: 'capitalize' }}>{app.source || app.metadata?.type || '—'}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[['Users', appUsers.toLocaleString()], ['Source', app.source || '—']].map(([l, v]) => (
                    <div key={l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 10px' }}>
                      <div style={{ fontSize: '10px', color: '#475569', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
