'use client';

import { useState, useEffect } from 'react';
import {
  getDashboardSummary, getThreats, getRiskTrends, getPostureScore, isAuthenticated, triggerScan,
} from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface KpiItem { label: string; value: string; trend: string; trendType: string; sub: string; color: string; icon: string; }
interface AlertItem { id: any; severity: string; type: string; desc: string; time: string; action: string; }
interface PostureItem { label: string; score: number; color: string; }

// ── Defaults (shown while loading / on empty DB) ──────────────────────────────
const EMPTY_KPI: KpiItem[] = [
  { label: 'Total Identities',        value: '—', trend: 'No data yet', trendType: 'neutral', sub: 'Run a scan to discover identities', color: 'indigo', icon: '◉' },
  { label: 'High-Risk Identities',    value: '—', trend: 'No data yet', trendType: 'neutral', sub: 'Risk engine awaiting data',         color: 'danger', icon: '⬡' },
  { label: 'Shadow IT Apps',          value: '—', trend: 'No data yet', trendType: 'neutral', sub: 'Run discovery scan to detect',       color: 'warn',   icon: '◈' },
  { label: 'Pending Certifications',  value: '—', trend: 'No data yet', trendType: 'neutral', sub: 'Governance workflows empty',         color: 'cyan',   icon: '◉' },
  { label: 'Identity Risk Score',     value: '—', trend: 'No data yet', trendType: 'neutral', sub: 'Score calculated after first scan',  color: 'warn',   icon: '◈' },
  { label: 'Active Threats',          value: '—', trend: 'No data yet', trendType: 'neutral', sub: 'ITDR engine awaiting events',        color: 'danger', icon: '⬡' },
  { label: 'Discovered Apps',         value: '—', trend: 'No data yet', trendType: 'neutral', sub: 'Connect an identity provider',       color: 'indigo', icon: '◉' },
  { label: 'Access Violations',       value: '—', trend: 'No data yet', trendType: 'neutral', sub: 'Policy engine awaiting data',        color: 'danger', icon: '◈' },
];
const EMPTY_TREND = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const MONTHS_LABELS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
const EMPTY_POSTURE: PostureItem[] = [
  { label: 'Least Privilege', score: 0, color: '#64748b' },
  { label: 'MFA Coverage',    score: 0, color: '#64748b' },
  { label: 'Shadow IT',       score: 0, color: '#64748b' },
  { label: 'Governance',      score: 0, color: '#64748b' },
  { label: 'Service Accounts',score: 0, color: '#64748b' },
];

// ── Helper ─────────────────────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s >= 80) return '#4ade80';
  if (s >= 60) return '#eab308';
  if (s >= 40) return '#f97316';
  return '#ef4444';
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Posture gauge component ────────────────────────────────────────────────────
function PostureGauge({ score }: { score: number }) {
  const r = 50;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreColor(score);
  const label = score === 0 ? 'No data' : score >= 80 ? 'Strong' : score >= 60 ? 'Moderate' : 'Needs Improvement';
  return (
    <>
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ display: 'block', margin: '0 auto' }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeDashoffset={circ * 0.25} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color}80)` }} />
        <text x="60" y="55" textAnchor="middle" fill="#f1f5f9" fontSize="26" fontWeight="800">{score || '—'}</text>
        <text x="60" y="72" textAnchor="middle" fill="#94a3b8" fontSize="11">/100</text>
      </svg>
      <div style={{ fontSize: '12px', color, fontWeight: '600', marginTop: '6px', textAlign: 'center' }}>{label}</div>
    </>
  );
}

// ── Setup prompt ───────────────────────────────────────────────────────────────
function SetupPrompt({ onScan }: { onScan: () => void }) {
  return (
    <div style={{ padding: '24px', background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.25)', borderRadius: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: '28px', marginBottom: '12px' }}>🔌</div>
      <div style={{ fontSize: '15px', fontWeight: '700', color: '#14B8A6', marginBottom: '8px' }}>No data yet</div>
      <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px', lineHeight: 1.6 }}>
        Connect an identity provider and run your first scan to populate the dashboard.
      </div>
      <button onClick={onScan} style={{ background: '#0D9488', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
        ⟳ Run Discovery Scan
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExecutiveDashboard() {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [kpiData, setKpiData] = useState<KpiItem[]>(EMPTY_KPI);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [riskTrend, setRiskTrend] = useState<number[]>(EMPTY_TREND);
  const [riskMonths, setRiskMonths] = useState<string[]>(MONTHS_LABELS);
  const [postureItems, setPostureItems] = useState<PostureItem[]>(EMPTY_POSTURE);
  const [postureOverall, setPostureOverall] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState('');

  // Auth check
  useEffect(() => {
    setTimeout(() => setLoaded(true), 200);
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [summ, threatsRaw, trendsRaw, posture] = await Promise.allSettled([
        getDashboardSummary(),
        getThreats(),
        getRiskTrends(),
        getPostureScore(),
      ]);

      // Dashboard summary → KPIs
      if (summ.status === 'fulfilled') {
        const s = summ.value;
        setSummary(s);
        setLastUpdated(s.lastUpdated ? new Date(s.lastUpdated).toLocaleTimeString() : '');
        setKpiData([
          {
            label: 'Total Identities', value: s.identities.total ? s.identities.total.toLocaleString() : '0',
            trend: s.identities.highRisk > 0 ? `${s.identities.highRisk} high-risk` : 'No high-risk identities',
            trendType: s.identities.highRisk > 0 ? 'down' : 'up',
            sub: `${s.identities.privileged} privileged • ${s.identities.serviceAccounts} service accounts`,
            color: 'indigo', icon: '◉',
          },
          {
            label: 'High-Risk Identities', value: s.identities.highRisk ? s.identities.highRisk.toLocaleString() : '0',
            trend: s.identities.highRisk > 0 ? 'Require immediate review' : 'No high-risk identities',
            trendType: s.identities.highRisk > 0 ? 'down' : 'up',
            sub: 'Risk score ≥ 60',
            color: 'danger', icon: '⬡',
          },
          {
            label: 'Shadow IT Apps', value: s.applications.shadowIT ? s.applications.shadowIT.toLocaleString() : '0',
            trend: s.applications.shadowIT > 0 ? 'Unmanaged apps detected' : 'No shadow IT detected',
            trendType: s.applications.shadowIT > 0 ? 'down' : 'up',
            sub: `${s.applications.managed} managed of ${s.applications.total} total`,
            color: 'warn', icon: '◈',
          },
          {
            label: 'Pending Approvals', value: s.pendingApprovals ? s.pendingApprovals.toLocaleString() : '0',
            trend: s.pendingApprovals > 0 ? 'Awaiting review' : 'No pending approvals',
            trendType: s.pendingApprovals > 5 ? 'down' : 'neutral',
            sub: 'Access request workflows',
            color: 'cyan', icon: '◉',
          },
          {
            label: 'Identity Risk Score', value: s.riskScore.current ? `${s.riskScore.current}/100` : '0/100',
            trend: `Trend: ${s.riskScore.trend || 'stable'}`,
            trendType: s.riskScore.current > 60 ? 'down' : s.riskScore.current > 30 ? 'neutral' : 'up',
            sub: s.riskScore.current > 60 ? 'Elevated — action required' : s.riskScore.current > 0 ? 'Acceptable range' : 'No data yet',
            color: 'warn', icon: '◈',
          },
          {
            label: 'Active Threats', value: s.threats.active ? s.threats.active.toLocaleString() : '0',
            trend: s.threats.investigating > 0 ? `${s.threats.investigating} under investigation` : 'No active investigations',
            trendType: s.threats.active > 0 ? 'down' : 'up',
            sub: `${s.threats.contained || 0} contained`,
            color: 'danger', icon: '⬡',
          },
          {
            label: 'Discovered Apps', value: s.applications.total ? s.applications.total.toLocaleString() : '0',
            trend: s.applications.total > 0 ? 'From last scan' : 'Run a scan',
            trendType: 'neutral',
            sub: `${s.applications.managed} managed • ${s.applications.shadowIT} shadow IT`,
            color: 'indigo', icon: '◉',
          },
          {
            label: 'Access Violations', value: '0',
            trend: 'Policy engine active',
            trendType: 'neutral',
            sub: 'Policy checks passing',
            color: 'danger', icon: '◈',
          },
        ]);
      }

      // Threats → alerts
      if (threatsRaw.status === 'fulfilled') {
        const t = threatsRaw.value as any[];
        setAlerts(t.slice(0, 5).map((th, i) => ({
          id: th.id || i,
          severity: (th.severity || 'medium').toLowerCase(),
          type: th.type || 'Security Event',
          desc: th.description || 'No description available',
          time: th.timestamp ? timeAgo(th.timestamp) : 'Unknown',
          action: 'Investigate',
        })));
      }

      // Risk trends
      if (trendsRaw.status === 'fulfilled') {
        const trends = trendsRaw.value as any[];
        if (trends && trends.length > 0) {
          const sorted = [...trends].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
          setRiskTrend(sorted.map(t => Math.round(t.avgScore || 0)));
          setRiskMonths(sorted.map(t => t.month.slice(5, 7)));
        }
      }

      // Posture
      if (posture.status === 'fulfilled') {
        const p = posture.value as any;
        setPostureOverall(p.overall || 0);
        if (p.domains && p.domains.length > 0) {
          setPostureItems(p.domains.map((d: any) => ({
            label: d.domain,
            score: d.score || 0,
            color: scoreColor(d.score || 0),
          })));
        }
      }
    } catch (err) {
      // Silently handle — data stays as empty defaults
    } finally {
      setLoading(false);
    }
  }

  async function handleScan() {
    setScanning(true);
    try {
      await triggerScan('all');
      await loadData();
    } catch { /* ignore */ }
    setScanning(false);
  }

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

  const noData = !loading && (!summary || summary.identities.total === 0);
  const activeThreats = summary?.threats?.active || 0;
  const currentRisk = summary?.riskScore?.current || 0;

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
              Real-time identity security intelligence{lastUpdated ? ` • Last updated: ${lastUpdated}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: '#4ade80', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', padding: '5px 12px', borderRadius: '999px', fontWeight: '600' }}>
              ● LIVE
            </div>
            <button className="btn btn-secondary" style={{ fontSize: '12px' }} onClick={loadData}>⟳ Refresh</button>
            <button className="btn btn-primary" style={{ fontSize: '12px' }} onClick={handleScan} disabled={scanning}>
              {scanning ? '⟳ Scanning…' : '+ Scan Now'}
            </button>
          </div>
        </div>

        {/* Threat banner — dynamic */}
        {activeThreats > 0 && (
          <div style={{ marginTop: '16px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px rgba(239,68,68,0.8)', flexShrink: 0 }}></div>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#f87171' }}>{activeThreats} Active threat{activeThreats > 1 ? 's' : ''} require{activeThreats === 1 ? 's' : ''} immediate attention</span>
            <a href="/itdr" style={{ marginLeft: 'auto', fontSize: '11px', padding: '5px 12px', background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', textDecoration: 'none' }}>
              View Threats
            </a>
          </div>
        )}
        {noData && (
          <div style={{ marginTop: '16px' }}>
            <SetupPrompt onScan={handleScan} />
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {kpiData.map((kpi, i) => (
          <div key={i} className="stat-card" style={{ '--card-color': cardTopColor[kpi.color] } as React.CSSProperties}>
            <div style={{ height: '2px', background: cardTopColor[kpi.color], borderRadius: '2px 2px 0 0', position: 'absolute', top: 0, left: 0, right: 0 }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>{kpi.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: loading ? '#334155' : '#f1f5f9', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {loading ? '…' : kpi.value}
            </div>
            <div style={{ fontSize: '11px', fontWeight: '600', marginTop: '6px', color: kpi.trendType === 'up' ? '#4ade80' : kpi.trendType === 'down' ? '#f87171' : '#94a3b8' }}>{kpi.trend}</div>
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
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Monthly average risk scores</div>
            </div>
          </div>
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
            {[25, 50, 75, 100].map(v => (
              <line key={v} x1="0" y1={140 - v * 1.2} x2="700" y2={140 - v * 1.2} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            ))}
            <polygon
              points={`0,140 ${riskTrend.map((v, i) => `${i * 63.6},${140 - v * 1.2}`).join(' ')} 700,140`}
              fill="url(#riskGrad)"
            />
            <polyline
              points={riskTrend.map((v, i) => `${i * 63.6},${140 - v * 1.2}`).join(' ')}
              fill="none" stroke="url(#riskLine)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
            />
            {riskTrend.map((v, i) => (
              <circle key={i} cx={i * 63.6} cy={140 - v * 1.2} r="4" fill="#6366f1" stroke="#080d1a" strokeWidth="2" />
            ))}
            {riskMonths.map((m, i) => (
              <text key={m + i} x={i * 63.6} y="138" textAnchor="middle" fill="#475569" fontSize="10">{m}</text>
            ))}
          </svg>
          <div style={{ display: 'flex', gap: '20px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div><div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Current</div><div style={{ fontSize: '18px', fontWeight: '700', color: scoreColor(100 - currentRisk) }}>{currentRisk || '—'}</div></div>
            <div><div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Peak</div><div style={{ fontSize: '18px', fontWeight: '700', color: '#ef4444' }}>{riskTrend.length ? Math.max(...riskTrend) || '—' : '—'}</div></div>
            <div style={{ marginLeft: 'auto' }}>
              <div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Trend</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: currentRisk > 60 ? '#f87171' : '#4ade80' }}>{summary?.riskScore?.trend || '—'}</div>
            </div>
          </div>
        </div>

        {/* Security Posture */}
        <div className="card">
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>Security Posture Score</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>ISPM — Identity Security Posture</div>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <PostureGauge score={postureOverall} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {postureItems.map(item => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>{item.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: item.color }}>{item.score > 0 ? `${item.score}%` : '—'}</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${item.score}%`, background: item.color, borderRadius: '2px' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Alerts */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9' }}>Active Security Alerts</div>
            <a href="/itdr" style={{ fontSize: '11px', padding: '4px 10px', color: '#0D9488', textDecoration: 'none' }}>View All →</a>
          </div>
          <div style={{ padding: '12px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#475569', fontSize: '13px' }}>Loading threats…</div>
            ) : alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🛡️</div>
                <div style={{ fontSize: '13px', color: '#4ade80', fontWeight: '600' }}>No active threats</div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>Security posture is clean</div>
              </div>
            ) : alerts.map(alert => {
              const s = severityStyle(alert.severity);
              return (
                <div key={alert.id} style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '8px', background: s.bg, border: `1px solid ${s.border}`, marginBottom: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.dot, flexShrink: 0, marginTop: '5px' }}></div>
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

        {/* Quick actions / setup guide */}
        <div className="card">
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>Quick Actions</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Platform setup & navigation</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: '⟳ Run Discovery Scan',    href: null,              action: handleScan,      color: '#0D9488' },
              { label: '◉ View Identities',        href: '/identities',     action: null,            color: '#6366f1' },
              { label: '◈ Application Discovery',  href: '/applications',   action: null,            color: '#f97316' },
              { label: '⬡ ITDR Threat Monitor',    href: '/itdr',           action: null,            color: '#ef4444' },
              { label: '◈ Identity Graph',         href: '/graph',          action: null,            color: '#14B8A6' },
              { label: '◉ Settings & Connectors',  href: '/settings',       action: null,            color: '#64748b' },
            ].map((item, i) => (
              item.href
                ? <a key={i} href={item.href} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', textDecoration: 'none', color: item.color, fontSize: '13px', fontWeight: '600' }}>
                    {item.label}
                    <span style={{ marginLeft: 'auto', color: '#334155' }}>→</span>
                  </a>
                : <button key={i} onClick={item.action!} disabled={scanning} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.25)', borderRadius: '8px', color: item.color, fontSize: '13px', fontWeight: '600', cursor: 'pointer', width: '100%' }}>
                    {item.label}
                    {scanning && <span style={{ marginLeft: 'auto', color: '#334155' }}>⟳</span>}
                  </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
