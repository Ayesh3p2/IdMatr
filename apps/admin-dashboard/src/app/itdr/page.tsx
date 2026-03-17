'use client';
import { useState, useEffect } from 'react';
import { getThreats, respondToThreat } from '@/lib/api';

export default function ITDRPage() {
  const [threats, setThreats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('threats');
  const [responding, setResponding] = useState<string | null>(null);

  const loadThreats = () => {
    setLoading(true);
    getThreats()
      .then(data => { setThreats(Array.isArray(data) ? data : []); setError(null); })
      .catch(err => setError(err?.message || 'Failed to load threats'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadThreats();
  }, []);

  const handleRespond = async (threatId: string, action: string) => {
    setResponding(threatId);
    try {
      await respondToThreat(threatId, action);
      loadThreats();
    } catch (err: any) {
      alert(`Response failed: ${err?.message}`);
    } finally {
      setResponding(null);
    }
  };

  const sevStyle = (s: string) => ({
    Critical: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', dot: '#ef4444', text: '#f87171', badge: 'rgba(239,68,68,0.15)' },
    High: { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', dot: '#f97316', text: '#fb923c', badge: 'rgba(249,115,22,0.15)' },
    Medium: { bg: 'rgba(234,179,8,0.07)', border: 'rgba(234,179,8,0.2)', dot: '#eab308', text: '#facc15', badge: 'rgba(234,179,8,0.12)' },
  } as Record<string, any>)[s] || { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', dot: '#6366f1', text: '#818cf8', badge: 'rgba(99,102,241,0.15)' };

  const statusColor = (s: string) => ({ Active: '#ef4444', active: '#ef4444', Investigating: '#f97316', investigating: '#f97316', Contained: '#22c55e', contained: '#22c55e', Resolved: '#4ade80', resolved: '#4ade80' } as Record<string,string>)[s] || '#94a3b8';

  const active = threats.filter(t => t.status === 'Active' || t.status === 'active').length;
  const investigating = threats.filter(t => t.status === 'Investigating' || t.status === 'investigating').length;
  const contained = threats.filter(t => t.status === 'Contained' || t.status === 'contained').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Identity Threat Detection & Response</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Real-time threat hunting, anomaly detection, and automated response across all identity surfaces</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ fontSize: '11px', color: '#4ade80', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', padding: '6px 14px', borderRadius: '999px', fontWeight: '600' }}>● Detection Active</div>
          <button style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>⚡ Run Hunt</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Active Threats', value: loading ? '…' : active.toString(), color: '#ef4444', sub: 'Require immediate action' },
          { label: 'Under Investigation', value: loading ? '…' : investigating.toString(), color: '#f97316', sub: 'SOC investigating' },
          { label: 'Contained', value: loading ? '…' : contained.toString(), color: '#06b6d4', sub: 'Awaiting remediation' },
          { label: 'Total Threats', value: loading ? '…' : threats.length.toString(), color: '#6366f1', sub: 'All time' },
          { label: 'Resolved', value: loading ? '…' : threats.filter(t => t.status === 'Resolved' || t.status === 'resolved').length.toString(), color: '#22c55e', sub: 'Successfully remediated' },
        ].map(s => (
          <div key={s.label} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.06)' }}>
        {[['threats', 'Active Threats'], ['resolved', 'Resolved']].map(([val, lbl]) => (
          <button key={val} onClick={() => setActiveTab(val)}
            style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: 'none', background: activeTab === val ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === val ? '#818cf8' : '#64748b' }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⟳</div>Loading threats…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '16px', color: '#f87171' }}>⚠ {error}</div>}

      {!loading && threats.length === 0 && (
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🛡</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No threats detected</div>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
            Threats are automatically detected when anomalous identity behavior is observed. Connect detection sources to begin monitoring.
          </p>
        </div>
      )}

      {!loading && threats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: selected !== null ? '1fr 360px' : '1fr', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {threats
              .filter(t => activeTab === 'threats'
                ? t.status !== 'Resolved' && t.status !== 'resolved'
                : t.status === 'Resolved' || t.status === 'resolved')
              .map((threat: any, i: number) => {
                const sev = threat.severity || 'Medium';
                const s = sevStyle(sev);
                const isSelected = selected === i;
                const indicators: string[] = Array.isArray(threat.indicators) ? threat.indicators : (threat.indicators ? [threat.indicators] : []);
                return (
                  <div key={threat.id ?? i} onClick={() => setSelected(isSelected ? null : i)}
                    style={{ background: s.bg, border: `1px solid ${isSelected ? s.dot : s.border}`, borderRadius: '12px', padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: isSelected ? `0 0 20px ${s.dot}20` : 'none' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.dot, boxShadow: `0 0 8px ${s.dot}80`, flexShrink: 0, marginTop: '5px' }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: s.text }}>{threat.type || threat.threatType || 'Threat'}</span>
                          <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '3px', background: s.badge, color: s.text, border: `1px solid ${s.border}`, letterSpacing: '0.05em' }}>{sev}</span>
                          {threat.mitreId && <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '3px', background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)', fontFamily: 'monospace' }}>MITRE {threat.mitreId}</span>}
                          <span style={{ fontSize: '11px', color: '#475569', marginLeft: 'auto', fontFamily: 'monospace' }}>{threat.detectedAt ? new Date(threat.detectedAt).toLocaleString() : '—'}</span>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: statusColor(threat.status), background: `${statusColor(threat.status)}18`, border: `1px solid ${statusColor(threat.status)}35`, padding: '2px 8px', borderRadius: '999px', textTransform: 'capitalize' }}>{threat.status}</span>
                        </div>
                        {threat.targetId && <div style={{ fontSize: '11px', color: s.text, fontFamily: 'monospace', fontWeight: '600', marginBottom: '6px' }}>{threat.targetId}</div>}
                        <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>{threat.description || 'Threat detected'}</div>
                        {threat.confidence && <div style={{ marginTop: '8px', fontSize: '11px', color: '#475569' }}>Confidence: <span style={{ color: s.text, fontWeight: '700' }}>{threat.confidence}%</span></div>}
                      </div>
                      {(threat.status === 'Active' || threat.status === 'active') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                          <button
                            disabled={responding === threat.id}
                            onClick={e => { e.stopPropagation(); handleRespond(threat.id, 'contain'); }}
                            style={{ fontSize: '11px', fontWeight: '600', color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap', opacity: responding === threat.id ? 0.5 : 1 }}>
                            {responding === threat.id ? '…' : 'Contain →'}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleRespond(threat.id, 'investigate'); }}
                            style={{ fontSize: '11px', fontWeight: '600', color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Investigate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {selected !== null && threats[selected] && (
            <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '20px', height: 'fit-content', position: 'sticky', top: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9', marginBottom: '4px' }}>{threats[selected].type || 'Threat Details'}</div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#818cf8', marginBottom: '16px' }}>{threats[selected].id || '—'}</div>

              {Array.isArray(threats[selected].indicators) && threats[selected].indicators.length > 0 && (
                <>
                  <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>Indicators of Compromise</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                    {threats[selected].indicators.map((ioc: string, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '6px' }}>
                        <span style={{ color: '#ef4444', fontSize: '10px' }}>⬡</span>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{ioc}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>Recommended Response</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                {['Suspend user account immediately', 'Revoke all active sessions', 'Reset credentials and enforce MFA re-enrollment', 'Notify security team and affected managers', 'Preserve evidence for forensic analysis'].map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#6366f1', width: '18px', flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>{step}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => handleRespond(threats[selected].id, 'contain')}
                  disabled={responding === threats[selected].id}
                  style={{ width: '100%', background: '#ef4444', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', opacity: responding ? 0.7 : 1 }}>
                  {responding ? '⟳ Processing…' : '⚡ Execute Response Playbook'}
                </button>
                <button
                  onClick={() => handleRespond(threats[selected].id, 'investigate')}
                  style={{ width: '100%', background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', padding: '9px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                  Mark as Investigating
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
