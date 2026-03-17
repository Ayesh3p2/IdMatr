'use client';
import { useState, useEffect } from 'react';
import { getRiskScores, getRiskEvents } from '@/lib/api';

export default function RiskPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('events');

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([getRiskEvents(), getRiskScores()])
      .then(([evRes, scRes]) => {
        if (evRes.status === 'fulfilled') setEvents(Array.isArray(evRes.value) ? evRes.value : []);
        if (scRes.status === 'fulfilled') setScores(Array.isArray(scRes.value) ? scRes.value : []);
        if (evRes.status === 'rejected' && scRes.status === 'rejected') setError('Failed to load risk data');
      })
      .finally(() => setLoading(false));
  }, []);

  const sevStyle = (s: string) => ({
    Critical: { dot: '#ef4444', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.2)', text: '#f87171', badge: 'rgba(239,68,68,0.15)' },
    High: { dot: '#f97316', bg: 'rgba(249,115,22,0.07)', border: 'rgba(249,115,22,0.2)', text: '#fb923c', badge: 'rgba(249,115,22,0.15)' },
    Medium: { dot: '#eab308', bg: 'rgba(234,179,8,0.07)', border: 'rgba(234,179,8,0.2)', text: '#facc15', badge: 'rgba(234,179,8,0.12)' },
  } as Record<string, any>)[s] || { dot: '#6366f1', bg: 'rgba(99,102,241,0.07)', border: 'rgba(99,102,241,0.2)', text: '#818cf8', badge: 'rgba(99,102,241,0.12)' };

  const critical = events.filter(e => (e.severity || e.riskLevel || '') === 'Critical').length;
  const high = events.filter(e => (e.severity || e.riskLevel || '') === 'High').length;
  const active = events.filter(e => (e.status || '') === 'Active' || (e.status || '') === 'active').length;
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((s: number, r: any) => s + (r.score ?? r.riskScore ?? 0), 0) / scores.length) : 0;
  const topRiskUsers = [...scores].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Identity Risk & Threat Intelligence</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>AI-powered risk detection, scoring, and threat hunting across all identities</p>
        </div>
        <button style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>⚡ Run Risk Scan</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Avg Risk Score', value: loading ? '…' : avgScore.toString(), color: '#f97316', trend: scores.length > 0 ? `${scores.length} profiles` : '—' },
          { label: 'Critical Events', value: loading ? '…' : critical.toString(), color: '#ef4444', trend: critical > 0 ? 'Active now' : 'None active' },
          { label: 'High Events', value: loading ? '…' : high.toString(), color: '#f97316', trend: `${events.length} total` },
          { label: 'Active Threats', value: loading ? '…' : active.toString(), color: '#eab308', trend: 'Require action' },
          { label: 'Risk Profiles', value: loading ? '…' : scores.length.toString(), color: '#22c55e', trend: 'Tracked identities' },
        ].map(s => (
          <div key={s.label} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{s.trend}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
        <div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[['events', 'Risk Events'], ['scores', 'Risk Profiles']].map(([val, lbl]) => (
              <button key={val} onClick={() => setActiveTab(val)}
                style={{ padding: '7px 16px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: 'none', background: activeTab === val ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === val ? '#818cf8' : '#64748b' }}>
                {lbl}
              </button>
            ))}
          </div>

          {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⟳</div>Loading…</div>}
          {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '16px', color: '#f87171' }}>⚠ {error}</div>}

          {!loading && activeTab === 'events' && events.length === 0 && (
            <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>🛡</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No risk events detected</div>
              <p style={{ fontSize: '13px', color: '#64748b' }}>Risk events will appear here as identities are discovered and analyzed.</p>
            </div>
          )}

          {!loading && activeTab === 'events' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {events.map((event: any, i: number) => {
                const sev = event.severity || event.riskLevel || 'Medium';
                const s = sevStyle(sev);
                const timeAgo = event.detectedAt || event.createdAt ? new Date(event.detectedAt || event.createdAt).toLocaleString() : '—';
                return (
                  <div key={event.id ?? i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '16px 18px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.dot, boxShadow: `0 0 8px ${s.dot}80`, flexShrink: 0, marginTop: '4px' }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: s.text }}>{event.type || event.eventType || 'Risk Event'}</span>
                          <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '3px', background: s.badge, color: s.text, border: `1px solid ${s.border}`, letterSpacing: '0.05em' }}>{sev.toUpperCase()}</span>
                          {event.mitreTactic && <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '3px', background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', fontFamily: 'monospace' }}>MITRE {event.mitreTactic}</span>}
                          <span style={{ fontSize: '11px', color: '#475569', marginLeft: 'auto' }}>{timeAgo}</span>
                        </div>
                        {event.userId && <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', marginBottom: '4px', fontFamily: 'monospace' }}>{event.userId}</div>}
                        <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>{event.description || event.details || 'Risk event detected'}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: s.text, fontFamily: 'monospace' }}>{event.score ?? event.riskScore ?? '—'}</div>
                        <button style={{ fontSize: '11px', fontWeight: '600', color: '#818cf8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}>Investigate</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && activeTab === 'scores' && scores.length === 0 && (
            <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📊</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No risk profiles yet</div>
              <p style={{ fontSize: '13px', color: '#64748b' }}>Risk profiles are computed when identities are discovered and analyzed.</p>
            </div>
          )}

          {!loading && activeTab === 'scores' && scores.length > 0 && (
            <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    {['Identity', 'Risk Score', 'Level', 'Factors', 'Last Updated'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scores.map((r: any, i: number) => {
                    const score = r.score ?? r.riskScore ?? 0;
                    const color = score > 80 ? '#ef4444' : score > 60 ? '#f97316' : score > 40 ? '#eab308' : '#22c55e';
                    const level = score > 80 ? 'Critical' : score > 60 ? 'High' : score > 40 ? 'Medium' : 'Low';
                    return (
                      <tr key={r.id ?? i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '14px 16px', fontSize: '13px', color: '#f1f5f9', fontFamily: 'monospace' }}>{r.userId || r.email || r.identity || '—'}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px', fontWeight: '800', color, fontFamily: 'monospace' }}>{score}</span>
                            <div style={{ height: '4px', width: '60px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${score}%`, background: color }}></div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: `${color}18`, color, border: `1px solid ${color}30` }}>{level}</span>
                        </td>
                        <td style={{ padding: '14px 16px', fontSize: '12px', color: '#64748b' }}>{Array.isArray(r.factors) ? r.factors.join(', ') : r.riskFactors || '—'}</td>
                        <td style={{ padding: '14px 16px', fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>
                          {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : r.calculatedAt ? new Date(r.calculatedAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9', marginBottom: '16px' }}>Top Risk Identities</div>
            {topRiskUsers.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#475569', textAlign: 'center', padding: '20px 0' }}>No risk profiles available</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {topRiskUsers.map((u: any, i: number) => {
                  const score = u.score ?? u.riskScore ?? 0;
                  const color = score > 80 ? '#ef4444' : score > 60 ? '#f97316' : '#eab308';
                  return (
                    <div key={u.id ?? i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: 'white', background: i === 0 ? '#ef4444' : i === 1 ? '#f97316' : i === 2 ? '#eab308' : '#475569', flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{u.userId || u.email || '—'}</div>
                        <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${score}%`, background: color }}></div>
                        </div>
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color, fontFamily: 'monospace', flexShrink: 0 }}>{score}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.08))', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#818cf8', marginBottom: '10px' }}>⬡ Risk Intelligence</div>
            <p style={{ fontSize: '13px', color: '#c7d2fe', lineHeight: 1.6 }}>
              {events.length > 0
                ? `${critical} critical and ${high} high-risk events require attention. Review top risk identities and trigger remediation workflows.`
                : 'No active risk events. Connect identity sources and run scans to enable continuous risk monitoring.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
