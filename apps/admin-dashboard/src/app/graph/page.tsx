'use client';
import { useState, useEffect } from 'react';
import { getToxicCombinations, getAttackPaths } from '@/lib/api';

export default function GraphPage() {
  const [toxicCombos, setToxicCombos] = useState<any[]>([]);
  const [attackPaths, setAttackPaths] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('toxic');

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([getToxicCombinations(), getAttackPaths()])
      .then(([tcRes, apRes]) => {
        if (tcRes.status === 'fulfilled') setToxicCombos(Array.isArray(tcRes.value) ? tcRes.value : []);
        if (apRes.status === 'fulfilled') setAttackPaths(Array.isArray(apRes.value) ? apRes.value : []);
        if (tcRes.status === 'rejected' && apRes.status === 'rejected') setError('Failed to load graph data');
      })
      .finally(() => setLoading(false));
  }, []);

  const sevColor = (s: string) => ({ Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e' } as Record<string,string>)[s] || '#94a3b8';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Identity Graph & Attack Paths</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Toxic permission combinations, lateral movement paths, and identity relationship graph</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#4ade80', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', padding: '6px 14px', borderRadius: '999px', fontWeight: '600' }}>● Graph Engine Active</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Toxic Combinations', value: loading ? '…' : toxicCombos.length.toString(), color: '#ef4444', sub: 'SoD violations' },
          { label: 'Attack Paths', value: loading ? '…' : attackPaths.length.toString(), color: '#f97316', sub: 'To critical assets' },
          { label: 'Critical Paths', value: loading ? '…' : attackPaths.filter(p => p.severity === 'Critical').length.toString(), color: '#8b5cf6', sub: 'Immediate risk' },
          { label: 'Unique Users', value: loading ? '…' : new Set([...toxicCombos.flatMap(tc => tc.users || []), ...attackPaths.map(ap => ap.sourceUser || ap.userId || '')].filter(Boolean)).size.toString(), color: '#6366f1', sub: 'Affected identities' },
        ].map(s => (
          <div key={s.label} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.06)' }}>
        {[['toxic', 'Toxic Combinations'], ['paths', 'Attack Paths']].map(([val, lbl]) => (
          <button key={val} onClick={() => setActiveTab(val)}
            style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: 'none', background: activeTab === val ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === val ? '#818cf8' : '#64748b' }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '80px', color: '#475569' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⟳</div>Querying identity graph…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '16px', color: '#f87171', marginBottom: '16px' }}>⚠ {error}</div>}

      {!loading && activeTab === 'toxic' && (
        toxicCombos.length === 0 ? (
          <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No toxic combinations detected</div>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
              Toxic permission combinations (SoD violations) are detected by querying the identity graph.
              Connect Neo4j and populate identity data to enable this analysis.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {toxicCombos.map((tc: any, i: number) => {
              const sev = tc.severity || (tc.riskScore > 80 ? 'Critical' : tc.riskScore > 60 ? 'High' : 'Medium');
              const color = sevColor(sev);
              return (
                <div key={tc.id ?? i} style={{ background: `${color}08`, border: `1px solid ${color}25`, borderRadius: '12px', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}80`, flexShrink: 0, marginTop: '5px' }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color }}>{tc.title || tc.type || `Toxic Combination ${i + 1}`}</span>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '3px', background: `${color}15`, color, border: `1px solid ${color}30`, letterSpacing: '0.05em' }}>{sev}</span>
                        {tc.mitreRef && <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '3px', background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)', fontFamily: 'monospace' }}>{tc.mitreRef}</span>}
                      </div>
                      {tc.description && <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '8px' }}>{tc.description}</div>}
                      {Array.isArray(tc.users) && tc.users.length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>Affected users:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {tc.users.map((u: string, j: number) => (
                              <span key={j} style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>{u}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(tc.permissions) && tc.permissions.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '11px', color: '#475569', marginBottom: '4px' }}>Permission conflict:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {tc.permissions.map((p: string, j: number) => (
                              <span key={j} style={{ fontSize: '11px', color: color, background: `${color}10`, border: `1px solid ${color}25`, padding: '2px 8px', borderRadius: '4px' }}>{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      {tc.riskScore && <div style={{ fontSize: '22px', fontWeight: '800', color, fontFamily: 'monospace' }}>{tc.riskScore}</div>}
                      <button style={{ fontSize: '11px', fontWeight: '600', color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Remediate →</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {!loading && activeTab === 'paths' && (
        attackPaths.length === 0 ? (
          <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🛡</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No attack paths found</div>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
              Attack path analysis uses Neo4j shortest-path algorithms to find identity-based paths to critical assets.
              Populate the identity graph to enable this analysis.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {attackPaths.map((path: any, i: number) => {
              const sev = path.severity || (path.hops <= 2 ? 'Critical' : path.hops <= 4 ? 'High' : 'Medium');
              const color = sevColor(sev);
              const steps: string[] = Array.isArray(path.path) ? path.path : (path.nodes || []);
              return (
                <div key={path.id ?? i} style={{ background: `${color}08`, border: `1px solid ${color}25`, borderRadius: '12px', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}80`, flexShrink: 0, marginTop: '5px' }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color }}>{path.title || `Attack Path to ${path.target || 'Critical Asset'}`}</span>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '3px', background: `${color}15`, color, border: `1px solid ${color}30` }}>{sev}</span>
                        {path.hops && <span style={{ fontSize: '11px', color: '#475569' }}>{path.hops} hops</span>}
                      </div>
                      {steps.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                          {steps.map((step: string, j: number) => (
                            <span key={j} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '3px 9px', borderRadius: '4px', fontFamily: 'monospace' }}>{step}</span>
                              {j < steps.length - 1 && <span style={{ fontSize: '12px', color: color }}>→</span>}
                            </span>
                          ))}
                        </div>
                      )}
                      {path.description && <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, marginTop: '8px' }}>{path.description}</div>}
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      {path.risk && <div style={{ fontSize: '22px', fontWeight: '800', color, fontFamily: 'monospace' }}>{path.risk}</div>}
                      <button style={{ fontSize: '11px', fontWeight: '600', color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Break Path →</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
