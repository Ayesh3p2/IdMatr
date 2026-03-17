'use client';
import { useState, useEffect } from 'react';
import { getPostureScore } from '@/lib/api';

export default function PosturePage() {
  const [posture, setPosture] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getPostureScore()
      .then(data => { setPosture(data); setError(null); })
      .catch(err => setError(err?.message || 'Failed to load posture data'))
      .finally(() => setLoading(false));
  }, []);

  const score = posture?.overall ?? posture?.score ?? posture?.overallScore ?? 0;
  const scoreColor = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  const scoreLabel = score >= 80 ? 'Strong' : score >= 60 ? 'Moderate' : 'Poor';
  const dimensions: any[] = posture?.dimensions ?? posture?.items ?? posture?.components ?? [];

  const dimColor = (s: number) => s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : '#ef4444';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Identity Security Posture</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Comprehensive security posture assessment across all identity dimensions</p>
        </div>
        <button style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>↓ Posture Report</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '80px', color: '#475569' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⟳</div>Loading posture score…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '16px', color: '#f87171', marginBottom: '16px' }}>⚠ {error}</div>}

      {!loading && !posture && !error && (
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '80px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No posture data yet</div>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
            Posture scores are calculated from your identity inventory, risk data, and compliance status.
            Connect identity sources to get started.
          </p>
        </div>
      )}

      {!loading && posture && (
        <div>
          {/* Overall Score */}
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', marginBottom: '24px' }}>
            <div style={{ background: '#111827', border: `1px solid ${scoreColor}30`, borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: scoreColor }}></div>
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569', marginBottom: '20px' }}>Overall Posture Score</div>
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="65" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="14"/>
                <circle cx="80" cy="80" r="65" fill="none" stroke={scoreColor} strokeWidth="14" strokeDasharray={`${(score / 100) * 408} 408`} strokeLinecap="round" transform="rotate(-90 80 80)" style={{ filter: `drop-shadow(0 0 8px ${scoreColor}60)` }}/>
                <text x="80" y="76" textAnchor="middle" fill={scoreColor} fontSize="36" fontWeight="800" fontFamily="monospace">{score}</text>
                <text x="80" y="96" textAnchor="middle" fill="#475569" fontSize="12" fontWeight="700">{scoreLabel}</text>
              </svg>
              {posture.trend && (
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>Trend: <span style={{ color: posture.trend > 0 ? '#4ade80' : '#f87171', fontWeight: '700' }}>{posture.trend > 0 ? '↑' : '↓'} {Math.abs(posture.trend)}pts</span></div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
              {[
                { label: 'Identities Scored', value: posture.totalIdentities ?? posture.identityCount ?? '—', color: '#6366f1' },
                { label: 'Applications', value: posture.totalApplications ?? posture.appCount ?? '—', color: '#8b5cf6' },
                { label: 'Risk Events', value: posture.activeRiskEvents ?? posture.riskEvents ?? '—', color: '#ef4444' },
                { label: 'Policy Violations', value: posture.policyViolations ?? posture.violations ?? '—', color: '#f97316' },
              ].map(s => (
                <div key={s.label} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
                  <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>{s.label}</div>
                  <div style={{ fontSize: '26px', fontWeight: '800', color: '#f1f5f9' }}>{s.value?.toLocaleString?.() ?? s.value ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Dimensions */}
          {dimensions.length > 0 && (
            <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '20px' }}>Posture Dimensions</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {dimensions.map((dim: any, i: number) => {
                  const dimScore = dim.score ?? dim.value ?? 0;
                  const color = dimColor(dimScore);
                  return (
                    <div key={dim.label || dim.name || i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '20px' }}>{dim.icon || '🔐'}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9' }}>{dim.label || dim.name}</span>
                          <span style={{ fontSize: '14px', fontWeight: '800', color, fontFamily: 'monospace' }}>{dimScore}</span>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${dimScore}%`, background: color, borderRadius: '2px', boxShadow: `0 0 6px ${color}50` }}></div>
                        </div>
                        {dim.detail && <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px' }}>{dim.detail}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {posture.recommendations && posture.recommendations.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9', marginBottom: '12px' }}>⬡ Recommendations</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {posture.recommendations.slice(0, 5).map((rec: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#6366f1', flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
