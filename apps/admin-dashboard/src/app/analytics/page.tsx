'use client';
import { useState, useEffect } from 'react';
import { getRiskTrends, getIdentitySummary, getAppIntelligence } from '@/lib/api';

export default function AnalyticsPage() {
  const [trends, setTrends] = useState<any[]>([]);
  const [identitySummary, setIdentitySummary] = useState<any>(null);
  const [appIntel, setAppIntel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('risk');

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([getRiskTrends(), getIdentitySummary(), getAppIntelligence()])
      .then(([tRes, iRes, aRes]) => {
        if (tRes.status === 'fulfilled') setTrends(Array.isArray(tRes.value) ? tRes.value : []);
        if (iRes.status === 'fulfilled') setIdentitySummary(iRes.value);
        if (aRes.status === 'fulfilled') setAppIntel(aRes.value);
        if (tRes.status === 'rejected' && iRes.status === 'rejected' && aRes.status === 'rejected') setError('Failed to load analytics');
      })
      .finally(() => setLoading(false));
  }, []);

  const maxTrend = Math.max(...trends.map(t => t.avgScore ?? t.score ?? t.value ?? 0), 1);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Identity Analytics</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Risk trends, identity distribution, and application intelligence</p>
        </div>
        <button style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>↓ Export Report</button>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.06)' }}>
        {[['risk', 'Risk Trends'], ['identity', 'Identity Summary'], ['apps', 'App Intelligence']].map(([val, lbl]) => (
          <button key={val} onClick={() => setActiveTab(val)}
            style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: 'none', background: activeTab === val ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === val ? '#818cf8' : '#64748b' }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '80px', color: '#475569' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⟳</div>Loading analytics…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '16px', color: '#f87171', marginBottom: '16px' }}>⚠ {error}</div>}

      {!loading && activeTab === 'risk' && (
        <div>
          {trends.length === 0 ? (
            <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📈</div>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No trend data yet</div>
              <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>Risk trend data accumulates over time as risk events are generated and scored.</p>
            </div>
          ) : (
            <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '20px' }}>Risk Score Trend</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '180px' }}>
                {trends.map((t: any, i: number) => {
                  const val = t.avgScore ?? t.score ?? t.value ?? 0;
                  const h = Math.round((val / maxTrend) * 160);
                  const color = val > 70 ? '#ef4444' : val > 50 ? '#f97316' : val > 30 ? '#eab308' : '#22c55e';
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color }}>{val}</span>
                      <div style={{ width: '100%', height: `${h}px`, background: color, borderRadius: '4px 4px 0 0', opacity: 0.8, boxShadow: `0 0 8px ${color}40`, minHeight: '4px' }}></div>
                      <span style={{ fontSize: '9px', color: '#475569', textAlign: 'center', lineHeight: 1.2 }}>{t.month ?? t.period ?? t.label ?? `M${i+1}`}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '24px' }}>
                {[
                  { label: 'Peak Score', value: Math.max(...trends.map(t => t.avgScore ?? t.score ?? 0)).toString() },
                  { label: 'Current Score', value: (trends[trends.length - 1]?.avgScore ?? trends[trends.length - 1]?.score ?? 0).toString() },
                  { label: 'Data Points', value: trends.length.toString() },
                ].map(s => (
                  <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: '#475569', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#f1f5f9' }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'identity' && (
        !identitySummary ? (
          <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>👤</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No identity data yet</div>
            <p style={{ fontSize: '13px', color: '#64748b' }}>Connect identity sources and run a scan to see identity analytics.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {Object.entries(identitySummary).filter(([k]) => typeof identitySummary[k] === 'number' || typeof identitySummary[k] === 'string').map(([key, val]: [string, any]) => (
              <div key={key} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                <div style={{ fontSize: '28px', fontWeight: '800', color: '#f1f5f9' }}>{typeof val === 'number' ? val.toLocaleString() : val}</div>
              </div>
            ))}
          </div>
        )
      )}

      {!loading && activeTab === 'apps' && (
        !appIntel ? (
          <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔍</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No app intelligence data</div>
            <p style={{ fontSize: '13px', color: '#64748b' }}>Run a discovery scan to populate application intelligence.</p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
              {[
                { label: 'Total Apps', value: appIntel.total ?? '—', color: '#6366f1' },
                { label: 'Managed', value: appIntel.managed ?? '—', color: '#22c55e' },
                { label: 'Shadow IT', value: appIntel.shadowIT ?? '—', color: '#f97316' },
                { label: 'Active Connectors', value: appIntel.activeConnectors ?? '—', color: '#8b5cf6' },
              ].map(s => (
                <div key={s.label} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
                  <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>{s.label}</div>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: '#f1f5f9' }}>{s.value?.toLocaleString?.() ?? s.value}</div>
                </div>
              ))}
            </div>
            {appIntel.lastScan && (
              <div style={{ fontSize: '12px', color: '#475569', textAlign: 'right' }}>Last scan: {new Date(appIntel.lastScan).toLocaleString()}</div>
            )}
          </div>
        )
      )}
    </div>
  );
}
