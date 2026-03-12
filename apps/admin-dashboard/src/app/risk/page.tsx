'use client';
import { useState } from 'react';

const RISK_EVENTS = [
  { id: 1, type: 'Privilege Escalation', severity: 'Critical', user: 'john.doe@corp.com', description: 'User escalated to Global Admin on Azure AD without approval workflow — policy violation', time: '2m ago', status: 'Active', score: 95, mitre: 'TA0004' },
  { id: 2, type: 'Impossible Travel', severity: 'Critical', user: 'sarah.chen@corp.com', description: 'Authentication from New York and Moscow within 45 min — impossible based on travel time', time: '8m ago', status: 'Investigating', score: 91, mitre: 'TA0001' },
  { id: 3, type: 'Toxic Permission Combination', severity: 'High', user: '3 users in Finance', description: 'SoD violation: "Approve Payments" + "Create Vendors" — high fraud risk combination', time: '23m ago', status: 'Active', score: 78, mitre: 'TA0006' },
  { id: 4, type: 'Dormant Privileged Account', severity: 'High', user: 'SA-PROD-DB01', description: 'Service account with DB Admin role unused for 94 days — potential backdoor risk', time: '3h ago', status: 'Active', score: 74, mitre: 'TA0003' },
  { id: 5, type: 'Shadow IT with Data Exfil Risk', severity: 'High', user: '234 employees', description: 'ChatGPT Plus being used to process internal documents — data classification violation', time: '1h ago', status: 'Active', score: 71, mitre: 'TA0010' },
  { id: 6, type: 'Orphaned Admin Account', severity: 'Medium', user: 'mike.r@corp.com', description: 'User offboarded 15 days ago — admin access on GitHub and AWS still active', time: '6h ago', status: 'Active', score: 65, mitre: 'TA0003' },
  { id: 7, type: 'Excessive Login Failures', severity: 'Medium', user: 'alice.brown@corp.com', description: '47 failed authentication attempts in 10 minutes from unknown device', time: '4h ago', status: 'Resolved', score: 55, mitre: 'TA0001' },
];

const RISK_CATEGORIES = [
  { label: 'Privilege Abuse', count: 247, pct: 72, color: '#ef4444' },
  { label: 'Dormant Accounts', count: 89, pct: 26, color: '#f97316' },
  { label: 'SoD Violations', count: 12, pct: 4, color: '#eab308' },
  { label: 'Shadow IT', count: 23, pct: 7, color: '#8b5cf6' },
  { label: 'Orphaned Access', count: 45, pct: 13, color: '#06b6d4' },
  { label: 'No MFA', count: 156, pct: 46, color: '#f59e0b' },
];

const TOP_RISK_USERS = [
  { name: 'john.doe@corp.com', score: 89, events: 4 },
  { name: 'sarah.chen@corp.com', score: 76, events: 2 },
  { name: 'SA-PROD-DB01', score: 71, events: 3 },
  { name: 'alice.brown@corp.com', score: 65, events: 3 },
  { name: 'mike.r@corp.com', score: 61, events: 1 },
];

export default function RiskPage() {
  const [activeTab, setActiveTab] = useState('events');

  const sevStyle = (s: string) => ({
    Critical: { dot: '#ef4444', bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.2)', text: '#f87171', badge: 'rgba(239,68,68,0.15)' },
    High: { dot: '#f97316', bg: 'rgba(249,115,22,0.07)', border: 'rgba(249,115,22,0.2)', text: '#fb923c', badge: 'rgba(249,115,22,0.15)' },
    Medium: { dot: '#eab308', bg: 'rgba(234,179,8,0.07)', border: 'rgba(234,179,8,0.2)', text: '#facc15', badge: 'rgba(234,179,8,0.12)' },
  } as Record<string, {dot:string,bg:string,border:string,text:string,badge:string}>)[s] || { dot: '#6366f1', bg: 'rgba(99,102,241,0.07)', border: 'rgba(99,102,241,0.2)', text: '#818cf8', badge: 'rgba(99,102,241,0.12)' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            Identity Risk & Threat Intelligence
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            AI-powered risk detection, scoring, and threat hunting across all identities
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            ⚡ Run Risk Scan
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Avg Risk Score', value: '72', color: '#f97316', trend: '↑ 4pts' },
          { label: 'Critical Events', value: '2', color: '#ef4444', trend: 'Active now' },
          { label: 'High Events', value: '5', color: '#f97316', trend: '3 new today' },
          { label: 'Users Above 70', value: '347', color: '#eab308', trend: '+23 this week' },
          { label: 'Resolved (7d)', value: '89', color: '#22c55e', trend: '↓ improving' },
        ].map(s => (
          <div key={s.label} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{s.trend}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
        {/* Left - Events */}
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[['events', 'Risk Events'], ['timeline', 'MITRE Timeline']].map(([val, lbl]) => (
              <button key={val} onClick={() => setActiveTab(val)}
                style={{ padding: '7px 16px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: 'none', background: activeTab === val ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === val ? '#818cf8' : '#64748b', transition: 'all 0.2s' }}>
                {lbl}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {RISK_EVENTS.map(event => {
              const s = sevStyle(event.severity);
              return (
                <div key={event.id} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '10px', padding: '16px 18px', transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.dot, boxShadow: `0 0 8px ${s.dot}80`, flexShrink: 0, marginTop: '4px' }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: s.text }}>{event.type}</span>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '3px', background: s.badge, color: s.text, border: `1px solid ${s.border}`, letterSpacing: '0.05em' }}>{event.severity.toUpperCase()}</span>
                        <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '3px', background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)', fontFamily: 'monospace' }}>MITRE {event.mitre}</span>
                        <span style={{ fontSize: '11px', color: '#475569', marginLeft: 'auto' }}>{event.time}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', marginBottom: '4px', fontFamily: 'monospace' }}>{event.user}</div>
                      <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>{event.description}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: s.text, fontFamily: 'monospace' }}>{event.score}</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {event.status === 'Active' && (
                          <button style={{ fontSize: '11px', fontWeight: '600', color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}>Remediate</button>
                        )}
                        <button style={{ fontSize: '11px', fontWeight: '600', color: '#818cf8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}>Investigate</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Risk Distribution */}
          <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>Risk Distribution</div>
            <div style={{ fontSize: '11px', color: '#475569', marginBottom: '16px' }}>By category breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {RISK_CATEGORIES.map(cat => (
                <div key={cat.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{cat.label}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: cat.color }}>{cat.pct}%</span>
                      <span style={{ fontSize: '11px', color: '#475569' }}>({cat.count})</span>
                    </div>
                  </div>
                  <div style={{ height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${cat.pct}%`, background: cat.color, borderRadius: '3px', boxShadow: `0 0 6px ${cat.color}60` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Risk Users */}
          <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9', marginBottom: '16px' }}>Top Risk Identities</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {TOP_RISK_USERS.map((u, i) => (
                <div key={u.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: 'white', background: i === 0 ? '#ef4444' : i === 1 ? '#f97316' : i === 2 ? '#eab308' : '#475569', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{u.name}</div>
                    <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', marginTop: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${u.score}%`, background: u.score > 80 ? '#ef4444' : u.score > 60 ? '#f97316' : '#eab308' }}></div>
                    </div>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: u.score > 80 ? '#f87171' : u.score > 60 ? '#fb923c' : '#facc15', fontFamily: 'monospace', flexShrink: 0 }}>{u.score}</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insight */}
          <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.08))', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#818cf8', marginBottom: '10px' }}>⬡ AI Risk Insight</div>
            <p style={{ fontSize: '13px', color: '#c7d2fe', lineHeight: 1.6 }}>
              Engineering team has <strong style={{ color: '#f1f5f9' }}>3.2x more access</strong> than required. 15 admin accounts lack MFA. Reducing privilege exposure would lower org risk score by an estimated <strong style={{ color: '#4ade80' }}>18 points</strong>.
            </p>
            <button style={{ marginTop: '12px', fontSize: '11px', fontWeight: '600', color: '#818cf8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
              Generate Remediation Plan →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
