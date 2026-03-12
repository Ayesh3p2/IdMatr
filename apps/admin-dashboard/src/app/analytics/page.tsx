'use client';

const RISK_TRENDS = [42, 48, 44, 57, 53, 68, 65, 71, 67, 72, 69, 72];
const ACCESS_TRENDS = [320, 340, 380, 420, 445, 489, 510, 540, 580, 610, 650, 688];
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

const TOP_RISKY_APPS = [
  { name: 'AWS Production', risk: 82, users: 89 },
  { name: 'GitHub Enterprise', risk: 68, users: 487 },
  { name: 'Dropbox Personal', risk: 84, users: 47 },
  { name: 'ChatGPT Plus', risk: 76, users: 234 },
  { name: 'Notion', risk: 71, users: 156 },
];

const DEPT_RISK = [
  { dept: 'Engineering', avg: 71, high: 12, total: 147 },
  { dept: 'Finance', avg: 64, high: 8, total: 45 },
  { dept: 'IT/Infra', avg: 69, high: 10, total: 23 },
  { dept: 'HR', avg: 55, high: 4, total: 38 },
  { dept: 'Sales', avg: 42, high: 3, total: 89 },
  { dept: 'Legal', avg: 38, high: 1, total: 12 },
];

const ACCESS_PATTERNS = [
  { label: 'Over-Provisioned', value: 34, pct: 72, color: '#ef4444' },
  { label: 'Appropriately Provisioned', value: 156, pct: 28, color: '#22c55e' },
  { label: 'Under-Provisioned', value: 12, pct: 8, color: '#6366f1' },
];

function LineChart({ data, color, h = 120 }: { data: number[], color: string, h?: number }) {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const w = 500;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 12) - 6}`).join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`g${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#g${color.replace('#','')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => (
        <circle key={i} cx={(i / (data.length - 1)) * w} cy={h - ((v - min) / range) * (h - 12) - 6}
          r="4" fill={color} stroke="#0d1426" strokeWidth="2" />
      ))}
    </svg>
  );
}

function BarChart({ data }: { data: { name: string, risk: number, users: number }[] }) {
  const maxRisk = Math.max(...data.map(d => d.risk));
  const w = 500, h = 160, barW = 60, gap = (w - data.length * barW) / (data.length + 1);
  const riskColor = (r: number) => r > 75 ? '#ef4444' : r > 60 ? '#f97316' : '#eab308';
  return (
    <svg width="100%" height={h + 40} viewBox={`0 0 ${w} ${h + 40}`} preserveAspectRatio="none">
      {data.map((d, i) => {
        const x = gap + i * (barW + gap);
        const barH = (d.risk / maxRisk) * h;
        const y = h - barH;
        const c = riskColor(d.risk);
        return (
          <g key={d.name}>
            <rect x={x} y={y} width={barW} height={barH} rx="4" fill={c} opacity="0.8" style={{ filter: `drop-shadow(0 0 6px ${c}50)` }} />
            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fill={c} fontSize="13" fontWeight="800">{d.risk}</text>
            <text x={x + barW / 2} y={h + 15} textAnchor="middle" fill="#475569" fontSize="10">{d.name.slice(0, 8)}</text>
            <text x={x + barW / 2} y={h + 28} textAnchor="middle" fill="#374151" fontSize="9">{d.users}u</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function AnalyticsPage() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Identity Analytics</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>AI-driven insights across identity risk, access patterns, and privilege distribution</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {['1M', '3M', '6M', '12M'].map(p => (
            <button key={p} style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid rgba(99,102,241,0.25)', background: p === '12M' ? 'rgba(99,102,241,0.15)' : 'transparent', color: p === '12M' ? '#818cf8' : '#64748b' }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Avg Identity Risk', value: '72', trend: '↑ +4.2 pts', color: '#f97316', sub: 'Elevated — target: 45' },
          { label: 'Over-Provisioned Users', value: '34%', trend: '3.2x excess access', color: '#ef4444', sub: 'Engineering dept highest' },
          { label: 'MFA Adoption', value: '94%', trend: '↑ +2% from last month', color: '#22c55e', sub: 'Target: 100%' },
          { label: 'Stale Permissions', value: '1,284', trend: '334 critical risk', color: '#eab308', sub: 'Not used in 90+ days' },
        ].map(s => (
          <div key={s.label} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#f1f5f9' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: s.color, fontWeight: '600', marginTop: '4px' }}>{s.trend}</div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '22px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>Identity Risk Score Trend</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>12-month average across all identities</div>
          <LineChart data={RISK_TRENDS} color="#f97316" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
            {MONTHS.map((m) => <span key={m} style={{ fontSize: '10px', color: '#374151' }}>{m}</span>)}
          </div>
        </div>

        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '22px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>Application Access Growth</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Total access grants over 12 months</div>
          <LineChart data={ACCESS_TRENDS} color="#6366f1" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
            {MONTHS.map((m) => <span key={m} style={{ fontSize: '10px', color: '#374151' }}>{m}</span>)}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        {/* Top risky apps */}
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '22px', gridColumn: 'span 2' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>Top Risk Applications</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>Risk score by application</div>
          <BarChart data={TOP_RISKY_APPS} />
        </div>

        {/* Access provisioning distribution */}
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '22px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>Access Provisioning</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Distribution across all identities</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {ACCESS_PATTERNS.map(p => (
              <div key={p.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>{p.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: p.color }}>{p.pct}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.pct}%`, background: p.color, borderRadius: '3px', boxShadow: `0 0 6px ${p.color}50` }}></div>
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>{p.value}% of users</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Department Risk Table */}
      <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '14px', fontWeight: '600', color: '#f1f5f9' }}>Department Risk Analysis</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              {['Department', 'Avg Risk Score', 'High-Risk Users', 'Total Users', 'Risk Level', 'Trend'].map(h => (
                <th key={h} style={{ padding: '11px 18px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEPT_RISK.map(dept => {
              const rc = dept.avg > 65 ? '#ef4444' : dept.avg > 50 ? '#f97316' : '#22c55e';
              const rl = dept.avg > 65 ? 'High' : dept.avg > 50 ? 'Medium' : 'Low';
              return (
                <tr key={dept.dept} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '13px 18px', fontSize: '13px', fontWeight: '600', color: '#f1f5f9' }}>{dept.dept}</td>
                  <td style={{ padding: '13px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: rc, fontFamily: 'monospace' }}>{dept.avg}</span>
                      <div style={{ height: '4px', width: '60px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${dept.avg}%`, background: rc }}></div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 18px', fontSize: '14px', fontWeight: '700', color: '#f87171' }}>{dept.high}</td>
                  <td style={{ padding: '13px 18px', fontSize: '14px', color: '#94a3b8' }}>{dept.total}</td>
                  <td style={{ padding: '13px 18px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', background: `${rc}15`, color: rc, border: `1px solid ${rc}30` }}>{rl}</span>
                  </td>
                  <td style={{ padding: '13px 18px', fontSize: '13px', fontWeight: '700', color: dept.avg > 65 ? '#f87171' : '#4ade80' }}>{dept.avg > 65 ? '↑ Increasing' : '↓ Improving'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
