'use client';
import { useState } from 'react';

const COMPLIANCE_FRAMEWORKS = [
  {
    id: 'soc2', name: 'SOC 2 Type II', standard: 'AICPA', score: 87, status: 'Compliant',
    controls: 64, passing: 56, failing: 4, inProgress: 4,
    areas: [
      { name: 'Logical Access Controls', score: 91 },
      { name: 'User Authentication', score: 88 },
      { name: 'Authorization & Provisioning', score: 85 },
      { name: 'Access Reviews', score: 78 },
      { name: 'Privileged Access', score: 82 },
    ],
    nextAudit: 'Jun 2026',
  },
  {
    id: 'iso27001', name: 'ISO 27001:2022', standard: 'ISO/IEC', score: 79, status: 'Partial',
    controls: 93, passing: 74, failing: 12, inProgress: 7,
    areas: [
      { name: 'Access Control (A.9)', score: 82 },
      { name: 'Identity Management', score: 76 },
      { name: 'Cryptography', score: 91 },
      { name: 'Supplier Relationships', score: 68 },
      { name: 'Incident Management', score: 79 },
    ],
    nextAudit: 'Sep 2026',
  },
  {
    id: 'nist', name: 'NIST CSF 2.0', standard: 'NIST', score: 73, status: 'Partial',
    controls: 108, passing: 79, failing: 18, inProgress: 11,
    areas: [
      { name: 'Identify', score: 84 },
      { name: 'Protect', score: 77 },
      { name: 'Detect', score: 71 },
      { name: 'Respond', score: 68 },
      { name: 'Recover', score: 61 },
    ],
    nextAudit: 'Dec 2026',
  },
];

const POLICY_VIOLATIONS = [
  { id: 'PV-042', policy: 'Least Privilege Policy', violation: 'Engineering team has 3.2x over-provisioned access', severity: 'High', affected: 47, status: 'Open' },
  { id: 'PV-041', policy: 'MFA Enforcement Policy', violation: '156 users authenticating without MFA on corporate apps', severity: 'Critical', affected: 156, status: 'Open' },
  { id: 'PV-040', policy: 'Access Review Policy', violation: 'Q4 2025 certification campaign not completed (68% done)', severity: 'Medium', affected: 399, status: 'In Progress' },
  { id: 'PV-039', policy: 'Segregation of Duties', violation: '3 Finance users with conflicting Approve + Create permissions', severity: 'Critical', affected: 3, status: 'Open' },
  { id: 'PV-038', policy: 'Offboarding Policy', violation: 'Tom Wilson: 4 days since termination, 14 apps still active', severity: 'High', affected: 1, status: 'Open' },
];

export default function CompliancePage() {
  const [activeFramework, setActiveFramework] = useState('soc2');
  const fw = COMPLIANCE_FRAMEWORKS.find(f => f.id === activeFramework) || COMPLIANCE_FRAMEWORKS[0];

  const scoreColor = (s: number) => s >= 85 ? '#22c55e' : s >= 70 ? '#eab308' : '#ef4444';
  const sevColor = (s: string) => ({ Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e' } as Record<string,string>)[s] || '#94a3b8';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Compliance & Certifications</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Identity compliance posture across SOC 2, ISO 27001, NIST CSF, and policy enforcement</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>↓ Compliance Report</button>
        </div>
      </div>

      {/* Framework overview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {COMPLIANCE_FRAMEWORKS.map(f => (
          <div key={f.id} onClick={() => setActiveFramework(f.id)}
            style={{ background: '#111827', border: `1px solid ${activeFramework === f.id ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.15)'}`, borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeFramework === f.id ? '0 0 20px rgba(99,102,241,0.1)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>{f.name}</div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{f.standard} • Next audit: {f.nextAudit}</div>
              </div>
              <svg width="60" height="60" viewBox="0 0 60 60">
                <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
                <circle cx="30" cy="30" r="24" fill="none" stroke={scoreColor(f.score)} strokeWidth="5"
                  strokeDasharray={`${(f.score / 100) * 150.8} 150.8`} strokeDashoffset="37.7" strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 4px ${scoreColor(f.score)}60)` }} />
                <text x="30" y="34" textAnchor="middle" fill="#f1f5f9" fontSize="14" fontWeight="800">{f.score}</text>
              </svg>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
              <span style={{ color: '#4ade80' }}>✓ {f.passing} passing</span>
              <span style={{ color: '#f87171' }}>✗ {f.failing} failing</span>
              <span style={{ color: '#eab308' }}>⟳ {f.inProgress} pending</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Framework Detail */}
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '22px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>{fw.name} — Control Areas</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>{fw.controls} controls total across {fw.areas.length} domains</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {fw.areas.map(area => (
              <div key={area.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>{area.name}</span>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: scoreColor(area.score) }}>{area.score}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${area.score}%`, background: scoreColor(area.score), borderRadius: '3px', boxShadow: `0 0 6px ${scoreColor(area.score)}50` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance Trend SVG */}
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '22px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>Overall Compliance Trend</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>6-month rolling score across all frameworks</div>
          <svg width="100%" height="180" viewBox="0 0 400 180" preserveAspectRatio="none">
            <defs>
              <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[60, 70, 80, 90].map(v => (
              <line key={v} x1="0" y1={180 - v * 1.8} x2="400" y2={180 - v * 1.8} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            ))}
            {[65, 68, 71, 74, 77, 80].map((v, i) => {
              const x = i * 80;
              const y = 180 - v * 1.8;
              return (
                <g key={i}>
                  {i > 0 && (
                    <line x1={(i-1)*80} y1={180 - [65, 68, 71, 74, 77, 80][i-1] * 1.8} x2={x} y2={y}
                      stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
                  )}
                  <circle cx={x} cy={y} r="5" fill="#22c55e" stroke="#111827" strokeWidth="2" />
                </g>
              );
            })}
            {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((m, i) => (
              <text key={m} x={i * 80} y="178" textAnchor="middle" fill="#475569" fontSize="10">{m}</text>
            ))}
          </svg>
          <div style={{ display: 'flex', gap: '20px', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div><div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase' }}>Oct 2025</div><div style={{ fontSize: '18px', fontWeight: '700', color: '#f87171' }}>65%</div></div>
            <div><div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase' }}>Current</div><div style={{ fontSize: '18px', fontWeight: '700', color: '#4ade80' }}>80%</div></div>
            <div><div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase' }}>Target</div><div style={{ fontSize: '18px', fontWeight: '700', color: '#818cf8' }}>90%</div></div>
          </div>
        </div>
      </div>

      {/* Policy Violations */}
      <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9' }}>Active Policy Violations</div>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '3px 10px', borderRadius: '999px', border: '1px solid rgba(239,68,68,0.25)' }}>6 Open</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              {['ID', 'Policy', 'Violation', 'Severity', 'Affected', 'Status', 'Action'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {POLICY_VIOLATIONS.map(v => (
              <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '12px 16px', fontSize: '11px', fontFamily: 'monospace', color: '#818cf8', fontWeight: '700' }}>{v.id}</td>
                <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>{v.policy}</td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b', maxWidth: '240px' }}>{v.violation}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: sevColor(v.severity) }}></div>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: sevColor(v.severity) }}>{v.severity}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#94a3b8', textAlign: 'center' }}>{v.affected}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', background: v.status === 'Open' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)', color: v.status === 'Open' ? '#f87171' : '#facc15', border: `1px solid ${v.status === 'Open' ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)'}` }}>{v.status}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button style={{ fontSize: '11px', fontWeight: '600', color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}>Remediate</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
