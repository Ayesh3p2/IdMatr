'use client';

import { useState, useEffect } from 'react';

const KPI_DATA = [
  {
    label: 'Total Identities',
    value: '14,832',
    trend: '+124 this week',
    trendType: 'neutral',
    sub: '1,247 privileged • 89 service accounts',
    color: 'indigo',
    icon: '◉'
  },
  {
    label: 'High-Risk Identities',
    value: '347',
    trend: '↑ 23 from yesterday',
    trendType: 'down',
    sub: '12 critical • 68 need immediate review',
    color: 'danger',
    icon: '⬡'
  },
  {
    label: 'Shadow IT Apps',
    value: '23',
    trend: '↑ 3 newly detected',
    trendType: 'down',
    sub: '8 with sensitive data access',
    color: 'warn',
    icon: '◈'
  },
  {
    label: 'Pending Certifications',
    value: '156',
    trend: '24 overdue',
    trendType: 'down',
    sub: 'Q1 2026 campaign: 68% complete',
    color: 'cyan',
    icon: '◉'
  },
  {
    label: 'Identity Risk Score',
    value: '72/100',
    trend: '↓ 4 pts improved',
    trendType: 'up',
    sub: 'Elevated — action required',
    color: 'warn',
    icon: '◈'
  },
  {
    label: 'Active Threats',
    value: '3',
    trend: '2 under investigation',
    trendType: 'down',
    sub: 'ITDR: 1 critical • 2 high severity',
    color: 'danger',
    icon: '⬡'
  },
  {
    label: 'Discovered Apps',
    value: '284',
    trend: '+12 from last scan',
    trendType: 'neutral',
    sub: '261 managed • 23 shadow IT',
    color: 'indigo',
    icon: '◉'
  },
  {
    label: 'Access Violations',
    value: '48',
    trend: '↑ 7 new violations',
    trendType: 'down',
    sub: 'Policy engine: 6 critical policies',
    color: 'danger',
    icon: '◈'
  }
];

const CRITICAL_ALERTS = [
  {
    id: 1, severity: 'critical', type: 'Privilege Escalation',
    desc: 'john.doe@corp.com gained Global Admin on Azure AD without approval workflow',
    time: '2 min ago', action: 'Investigate'
  },
  {
    id: 2, severity: 'critical', type: 'Impossible Travel',
    desc: 'sarah.chen@corp.com authenticated from New York and Moscow within 45 minutes',
    time: '8 min ago', action: 'Block User'
  },
  {
    id: 3, severity: 'high', type: 'Toxic Permission Combination',
    desc: '3 users in Finance have both "Approve Payments" and "Create Vendors" — SoD violation',
    time: '23 min ago', action: 'Review'
  },
  {
    id: 4, severity: 'high', type: 'Shadow IT Detected',
    desc: '31 employees using unmanaged Notion workspace with sensitive financial docs',
    time: '1h ago', action: 'Remediate'
  },
  {
    id: 5, severity: 'medium', type: 'Dormant Privileged Account',
    desc: 'Service account SA-PROD-DB01 has not been used in 94 days but retains DB Admin role',
    time: '3h ago', action: 'Disable'
  },
];

const RISK_TREND = [45, 52, 48, 61, 58, 72, 69, 75, 70, 74, 71, 72];
const RISK_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

function RiskHeatmap() {
  const cells = [
    { label: 'Excessive Privilege', count: 247, pct: 0.72 },
    { label: 'Dormant Accounts', count: 89, pct: 0.26 },
    { label: 'Shadow IT', count: 23, pct: 0.07 },
    { label: 'SoD Violations', count: 12, pct: 0.04 },
    { label: 'Orphaned Accounts', count: 45, pct: 0.13 },
    { label: 'Weak MFA', count: 156, pct: 0.46 },
    { label: 'Stale Permissions', count: 334, pct: 0.98 },
    { label: 'Privilege Escalation', count: 7, pct: 0.02 },
  ];

  function heatColor(pct: number) {
    if (pct > 0.7) return '#ef4444';
    if (pct > 0.4) return '#f97316';
    if (pct > 0.2) return '#eab308';
    return '#22c55e';
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '4px' }}>
      {cells.map(c => (
        <div key={c.label} className="heat-cell" style={{
          background: `${heatColor(c.pct)}18`,
          border: `1px solid ${heatColor(c.pct)}40`,
          borderRadius: '8px', padding: '12px 10px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '20px', fontWeight: '800', color: heatColor(c.pct) }}>{c.count}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px', lineHeight: 1.3 }}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}

const POSTURE_ITEMS = [
  { label: 'Least Privilege', score: 62, color: '#f97316' },
  { label: 'MFA Coverage', score: 84, color: '#22c55e' },
  { label: 'SoD Compliance', score: 71, color: '#eab308' },
  { label: 'Access Reviews', score: 68, color: '#eab308' },
  { label: 'Orphan Cleanup', score: 45, color: '#ef4444' },
  { label: 'PAM Coverage', score: 79, color: '#22c55e' },
];

export default function ExecutiveDashboard() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 200); }, []);

  const severityStyle = (s: string) => {
    const m: Record<string, {bg: string, border: string, dot: string, label: string}> = {
      critical: { bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.25)', dot: '#ef4444', label: '#f87171' },
      high: { bg: 'rgba(249,115,22,0.07)', border: 'rgba(249,115,22,0.2)', dot: '#f97316', label: '#fb923c' },
      medium: { bg: 'rgba(234,179,8,0.07)', border: 'rgba(234,179,8,0.2)', dot: '#eab308', label: '#facc15' },
    };
    return m[s] || m.medium;
  };

  const cardTopColor: Record<string, string> = {
    indigo: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
    danger: 'linear-gradient(90deg, #ef4444, #f97316)',
    warn: 'linear-gradient(90deg, #f97316, #eab308)',
    cyan: 'linear-gradient(90deg, #06b6d4, #3b82f6)',
  };

  return (
    <div style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.4s' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>
              Executive Security Dashboard
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
              Real-time identity security intelligence • Last updated: just now
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: '#4ade80', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', padding: '5px 12px', borderRadius: '999px', fontWeight: '600' }}>
              ● LIVE
            </div>
            <button className="btn btn-secondary" style={{ fontSize: '12px' }}>Export Report</button>
            <button className="btn btn-primary" style={{ fontSize: '12px' }}>+ Scan Now</button>
          </div>
        </div>

        {/* Critical banner */}
        <div style={{ marginTop: '16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px rgba(239,68,68,0.8)', flexShrink: 0 }}></div>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#f87171' }}>3 Critical threats require immediate attention</span>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>— Privilege escalation detected on 2 admin accounts, impossible travel alert for 1 user</span>
          <button className="btn btn-danger" style={{ marginLeft: 'auto', fontSize: '11px', padding: '5px 12px' }}>View Threats</button>
        </div>
      </div>

      {/* KPI Grid — 8 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {KPI_DATA.map((kpi, i) => (
          <div key={i} className="stat-card" style={{ '--card-color': cardTopColor[kpi.color] } as React.CSSProperties}>
            <div style={{ height: '2px', background: cardTopColor[kpi.color], borderRadius: '2px 2px 0 0', position: 'absolute', top: 0, left: 0, right: 0 }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: '11px', fontWeight: '600', marginTop: '6px', color: kpi.trendType === 'up' ? '#4ade80' : kpi.trendType === 'down' ? '#f87171' : '#94a3b8' }}>
              {kpi.trend}
            </div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Main content area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px', marginBottom: '20px' }}>
        {/* Risk Trend */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9' }}>Identity Risk Score Trend</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>12-month rolling average</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['1M', '3M', '6M', '12M'].map(p => (
                <button key={p} className="filter-chip" style={{ fontSize: '11px', padding: '3px 8px' }}>{p}</button>
              ))}
            </div>
          </div>
          {/* Full-width chart */}
          <svg width="100%" height="140" viewBox="0 0 700 140" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="riskLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
            {/* Grid lines */}
            {[25, 50, 75, 100].map(v => (
              <line key={v} x1="0" y1={140 - v * 1.2} x2="700" y2={140 - v * 1.2}
                stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            ))}
            {/* Area */}
            <polygon
              points={`0,140 ${RISK_TREND.map((v, i) => `${i * 63.6},${140 - v * 1.2}`).join(' ')} 700,140`}
              fill="url(#riskGrad)"
            />
            {/* Line */}
            <polyline
              points={RISK_TREND.map((v, i) => `${i * 63.6},${140 - v * 1.2}`).join(' ')}
              fill="none" stroke="url(#riskLine)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
            />
            {/* Data points */}
            {RISK_TREND.map((v, i) => (
              <circle key={i} cx={i * 63.6} cy={140 - v * 1.2} r="4" fill="#6366f1"
                stroke="#080d1a" strokeWidth="2"
                style={{ filter: i === RISK_TREND.length - 1 ? 'drop-shadow(0 0 6px #6366f1)' : 'none' }} />
            ))}
            {/* Month labels */}
            {RISK_MONTHS.map((m, i) => (
              <text key={m} x={i * 63.6} y="138" textAnchor="middle" fill="#475569" fontSize="10">{m}</text>
            ))}
          </svg>
          <div style={{ display: 'flex', gap: '20px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div><div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current</div><div style={{ fontSize: '18px', fontWeight: '700', color: '#f97316' }}>72</div></div>
            <div><div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Peak</div><div style={{ fontSize: '18px', fontWeight: '700', color: '#ef4444' }}>75</div></div>
            <div><div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Target</div><div style={{ fontSize: '18px', fontWeight: '700', color: '#4ade80' }}>45</div></div>
            <div style={{ marginLeft: 'auto' }}>
              <div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Trend</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#f87171' }}>↑ Elevated</div>
            </div>
          </div>
        </div>

        {/* Security Posture */}
        <div className="card">
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>Security Posture Score</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>ISPM — Identity Security Posture</div>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <svg width="120" height="120" viewBox="0 0 120 120" style={{ display: 'block', margin: '0 auto' }}>
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="url(#postureGrad)" strokeWidth="10"
                strokeDasharray={`${0.71 * 314} 314`}
                strokeDashoffset="78.5" strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 8px rgba(234,179,8,0.5))' }} />
              <defs>
                <linearGradient id="postureGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#eab308" />
                </linearGradient>
              </defs>
              <text x="60" y="55" textAnchor="middle" fill="#f1f5f9" fontSize="26" fontWeight="800">71</text>
              <text x="60" y="72" textAnchor="middle" fill="#94a3b8" fontSize="11">/100</text>
            </svg>
            <div style={{ fontSize: '12px', color: '#eab308', fontWeight: '600', marginTop: '6px' }}>Needs Improvement</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {POSTURE_ITEMS.map(item => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>{item.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: item.color }}>{item.score}%</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${item.score}%`, background: item.color, borderRadius: '2px', boxShadow: `0 0 6px ${item.color}60` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Critical Alerts */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9' }}>Active Security Alerts</div>
            <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }}>View All →</button>
          </div>
          <div style={{ padding: '12px' }}>
            {CRITICAL_ALERTS.map(alert => {
              const s = severityStyle(alert.severity);
              return (
                <div key={alert.id} style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '8px', background: s.bg, border: `1px solid ${s.border}`, marginBottom: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.dot, boxShadow: `0 0 8px ${s.dot}`, flexShrink: 0, marginTop: '5px' }}></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: s.label }}>{alert.type}</span>
                      <span style={{ fontSize: '10px', color: '#475569', marginLeft: 'auto' }}>{alert.time}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>{alert.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Risk Heatmap */}
        <div className="card">
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>Identity Risk Heatmap</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Risk findings by category</div>
          <RiskHeatmap />
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {[['#ef4444', 'Critical (>70%)'], ['#f97316', 'High (40-70%)'], ['#eab308', 'Medium (20-40%)'], ['#22c55e', 'Low (<20%)']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: c as string }}></div>
                <span style={{ fontSize: '10px', color: '#64748b' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
