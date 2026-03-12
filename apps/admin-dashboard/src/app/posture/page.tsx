'use client';

const POSTURE_DOMAINS = [
  {
    domain: 'Least Privilege Enforcement',
    score: 62, trend: 'down', icon: '⬡',
    findings: [
      { title: 'Over-provisioned Engineers', count: 47, severity: 'High', detail: '3.2x excess access on average' },
      { title: 'Admin Sprawl', count: 127, severity: 'High', detail: 'Unnecessary admin accounts' },
      { title: 'Stale Permissions', count: 334, severity: 'Medium', detail: 'Unused >90 days' },
    ]
  },
  {
    domain: 'MFA Coverage',
    score: 94, trend: 'up', icon: '◉',
    findings: [
      { title: 'Users without MFA', count: 156, severity: 'High', detail: 'On corporate applications' },
      { title: 'Weak MFA Methods', count: 89, severity: 'Medium', detail: 'SMS-only, no TOTP/FIDO2' },
    ]
  },
  {
    domain: 'Privileged Access Management',
    score: 71, trend: 'neutral', icon: '◈',
    findings: [
      { title: 'Unmanaged PAM Accounts', count: 23, severity: 'Critical', detail: 'No credential vault' },
      { title: 'Dormant Privileged Accounts', count: 12, severity: 'High', detail: 'Inactive >30 days' },
      { title: 'Missing Session Recording', count: 8, severity: 'Medium', detail: 'Admin sessions unrecorded' },
    ]
  },
  {
    domain: 'Identity Governance',
    score: 68, trend: 'up', icon: '⬡',
    findings: [
      { title: 'Orphaned Accounts', count: 45, severity: 'High', detail: 'No active owner' },
      { title: 'Incomplete Access Reviews', count: 399, severity: 'High', detail: 'Q1 2026 certification pending' },
      { title: 'SoD Violations', count: 12, severity: 'Critical', detail: 'Finance department conflicts' },
    ]
  },
  {
    domain: 'Service Account Security',
    score: 55, trend: 'down', icon: '◈',
    findings: [
      { title: 'Accounts Without Rotation', count: 34, severity: 'Critical', detail: 'Credentials never rotated' },
      { title: 'Interactive Logins Detected', count: 7, severity: 'High', detail: 'Service accounts used by humans' },
      { title: 'Excessive Permissions', count: 18, severity: 'High', detail: 'Beyond defined scope' },
    ]
  },
  {
    domain: 'Shadow IT Governance',
    score: 43, trend: 'down', icon: '◉',
    findings: [
      { title: 'Unmanaged Applications', count: 23, severity: 'High', detail: 'No SSO, no review' },
      { title: 'AI Tool Usage', count: 234, severity: 'High', detail: 'Unsanctioned AI with data' },
      { title: 'Personal Cloud Storage', count: 52, severity: 'Medium', detail: 'Dropbox, GDrive personal' },
    ]
  },
];

const OVERALL_SCORE = 66;

function ScoreRing({ score, size = 140 }: { score: number, size?: number }) {
  const c = size / 2, r = c - 12, circumference = 2 * Math.PI * r;
  const pct = score / 100;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
      <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${pct * circumference} ${circumference}`}
        strokeDashoffset={circumference * 0.25} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 10px ${color}60)` }} />
      <text x={c} y={c - 6} textAnchor="middle" fill="#f1f5f9" fontSize={size > 100 ? '28' : '18'} fontWeight="800">{score}</text>
      <text x={c} y={c + 12} textAnchor="middle" fill="#64748b" fontSize="12">/100</text>
    </svg>
  );
}

const trendIcon = (t: string) => t === 'up' ? { icon: '↑', color: '#4ade80' } : t === 'down' ? { icon: '↓', color: '#f87171' } : { icon: '→', color: '#94a3b8' };
const scoreColor = (s: number) => s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : '#ef4444';
const sevColor = (s: string) => ({ Critical: '#ef4444', High: '#f97316', Medium: '#eab308' } as Record<string,string>)[s] || '#94a3b8';

export default function PosturePage() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Identity Security Posture</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>ISPM — Continuous identity security posture monitoring and remediation intelligence</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>↓ Posture Report</button>
          <button style={{ background: '#6366f1', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>◎ Refresh Scan</button>
        </div>
      </div>

      {/* Overall posture */}
      <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.05))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '16px', padding: '28px', marginBottom: '24px', display: 'flex', gap: '40px', alignItems: 'center' }}>
        <div>
          <ScoreRing score={OVERALL_SCORE} size={140} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6366f1', marginBottom: '8px' }}>Overall Identity Security Posture Score</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#eab308', marginBottom: '12px' }}>Needs Improvement — Score: 66/100</div>
          <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '16px' }}>
            Your organization's identity security posture is below the recommended threshold of 80. Key areas requiring immediate attention: Service Account Security (55), Shadow IT Governance (43), and Least Privilege Enforcement (62).
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={{ background: '#6366f1', color: 'white', border: 'none', padding: '9px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Generate Remediation Plan</button>
            <button style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', padding: '9px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Schedule Review</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', flexShrink: 0 }}>
          {[['Total Findings', '876', '#f87171'], ['Critical', '4', '#ef4444'], ['High Risk', '22', '#f97316'], ['Improving', '2/6', '#4ade80']].map(([l, v, c]) => (
            <div key={l} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', fontWeight: '800', color: c as string }}>{v}</div>
              <div style={{ fontSize: '10px', color: '#475569', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Domain cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {POSTURE_DOMAINS.map(domain => {
          const trend = trendIcon(domain.trend);
          const sc = scoreColor(domain.score);
          return (
            <div key={domain.domain} style={{ background: '#111827', border: `1px solid ${domain.score < 60 ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.15)'}`, borderRadius: '12px', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px', color: '#6366f1' }}>{domain.icon}</span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>{domain.domain}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: trend.color }}>{trend.icon}</span>
                    <div style={{ position: 'relative', width: '50px', height: '50px' }}>
                      <svg width="50" height="50" viewBox="0 0 50 50">
                        <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
                        <circle cx="25" cy="25" r="20" fill="none" stroke={sc} strokeWidth="5"
                          strokeDasharray={`${(domain.score / 100) * 125.6} 125.6`}
                          strokeDashoffset="31.4" strokeLinecap="round" />
                        <text x="25" y="29" textAnchor="middle" fill="#f1f5f9" fontSize="11" fontWeight="800">{domain.score}</text>
                      </svg>
                    </div>
                  </div>
                </div>
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${domain.score}%`, background: sc }}></div>
                </div>
              </div>
              {/* Findings */}
              <div style={{ padding: '12px' }}>
                {domain.findings.map((finding, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 6px', borderBottom: i < domain.findings.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: sevColor(finding.severity), flexShrink: 0, marginTop: '5px', boxShadow: finding.severity === 'Critical' ? `0 0 6px ${sevColor(finding.severity)}` : 'none' }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>{finding.title}</span>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: sevColor(finding.severity) }}>{finding.count}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{finding.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Footer */}
              <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'flex-end' }}>
                <button style={{ fontSize: '11px', fontWeight: '600', color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer' }}>Remediate All →</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
