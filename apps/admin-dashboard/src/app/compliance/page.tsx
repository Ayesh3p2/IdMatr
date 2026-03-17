'use client';
import { useState, useEffect } from 'react';
import { getComplianceMetrics, getPolicyViolations } from '@/lib/api';

export default function CompliancePage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([getComplianceMetrics(), getPolicyViolations()])
      .then(([mRes, vRes]) => {
        if (mRes.status === 'fulfilled') setMetrics(mRes.value);
        if (vRes.status === 'fulfilled') setViolations(Array.isArray(vRes.value) ? vRes.value : []);
        if (mRes.status === 'rejected' && vRes.status === 'rejected') setError('Failed to load compliance data');
      })
      .finally(() => setLoading(false));
  }, []);

  const sevColor = (s: string) => ({ Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e' } as Record<string,string>)[s] || '#94a3b8';

  const frameworks = metrics?.frameworks || metrics?.complianceScores || [];
  const overallScore = metrics?.overallScore ?? metrics?.score ?? (frameworks.length > 0 ? Math.round(frameworks.reduce((s: number, f: any) => s + (f.score ?? 0), 0) / frameworks.length) : 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Compliance & Policy Management</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Regulatory compliance tracking, policy enforcement, and violation management</p>
        </div>
        <button style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>↓ Compliance Report</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Overall Score', value: loading ? '…' : `${overallScore}%`, color: overallScore >= 80 ? '#22c55e' : overallScore >= 60 ? '#eab308' : '#ef4444', sub: overallScore >= 80 ? 'Compliant' : overallScore >= 60 ? 'Partial' : 'Non-compliant' },
          { label: 'Policy Violations', value: loading ? '…' : violations.length.toString(), color: violations.length > 0 ? '#ef4444' : '#22c55e', sub: 'Active violations' },
          { label: 'Frameworks Tracked', value: loading ? '…' : (Array.isArray(frameworks) ? frameworks.length.toString() : '—'), color: '#6366f1', sub: 'SOC2, ISO27001, GDPR…' },
          { label: 'Controls Passed', value: loading ? '…' : (metrics?.controlsPassed ?? '—').toString(), color: '#22c55e', sub: 'Out of total controls' },
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
        {[['overview', 'Framework Overview'], ['violations', 'Policy Violations']].map(([val, lbl]) => (
          <button key={val} onClick={() => setActiveTab(val)}
            style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: 'none', background: activeTab === val ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === val ? '#818cf8' : '#64748b' }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⟳</div>Loading…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '16px', color: '#f87171', marginBottom: '16px' }}>⚠ {error}</div>}

      {!loading && activeTab === 'overview' && (
        <div>
          {(!frameworks || frameworks.length === 0) ? (
            <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📊</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No compliance data yet</div>
              <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>
                Compliance metrics are calculated from identity posture, policy violations, and audit findings.
                Connect data sources and run scans to populate compliance scores.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
              {(Array.isArray(frameworks) ? frameworks : Object.entries(frameworks).map(([k, v]: [string, any]) => ({ name: k, ...v }))).map((fw: any, i: number) => {
                const score = fw.score ?? fw.percentage ?? 0;
                const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
                return (
                  <div key={fw.name ?? i} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>{fw.name || fw.framework}</div>
                        {fw.description && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{fw.description}</div>}
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: '800', color, fontFamily: 'monospace' }}>{score}%</div>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
                      <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: '3px' }}></div>
                    </div>
                    {fw.controls && (
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Passed: <span style={{ color: '#4ade80', fontWeight: '700' }}>{fw.controls.passed ?? '—'}</span></span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Failed: <span style={{ color: '#f87171', fontWeight: '700' }}>{fw.controls.failed ?? '—'}</span></span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Total: <span style={{ color: '#94a3b8', fontWeight: '700' }}>{fw.controls.total ?? '—'}</span></span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'violations' && (
        violations.length === 0 ? (
          <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No policy violations</div>
            <p style={{ fontSize: '13px', color: '#64748b' }}>All identity access policies are currently being followed.</p>
          </div>
        ) : (
          <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Policy', 'Violator', 'Severity', 'Description', 'Detected', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {violations.map((v: any, i: number) => {
                  const sev = v.severity || 'Medium';
                  const status = v.status || 'Active';
                  return (
                    <tr key={v.id ?? i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '14px', fontSize: '12px', fontWeight: '600', color: '#f1f5f9' }}>{v.policyName || v.policy || v.type || '—'}</td>
                      <td style={{ padding: '14px', fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>{v.userId || v.violatorId || v.actor || '—'}</td>
                      <td style={{ padding: '14px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: `${sevColor(sev)}15`, color: sevColor(sev), border: `1px solid ${sevColor(sev)}30` }}>{sev}</span>
                      </td>
                      <td style={{ padding: '14px', fontSize: '12px', color: '#64748b', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.description || '—'}</td>
                      <td style={{ padding: '14px', fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>{v.detectedAt || v.createdAt ? new Date(v.detectedAt || v.createdAt).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '14px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '999px', background: status === 'Active' || status === 'active' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.1)', color: status === 'Active' || status === 'active' ? '#f87171' : '#4ade80', border: `1px solid ${status === 'Active' || status === 'active' ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.2)'}` }}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
