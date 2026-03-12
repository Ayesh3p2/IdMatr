'use client';
import { useState } from 'react';

const THREATS = [
  {
    id: 'T-2026-089', severity: 'Critical', status: 'Active', type: 'Account Takeover Attempt',
    mitre: 'T1078', tactic: 'Initial Access', target: 'sarah.chen@corp.com',
    source: 'Okta SIEM Integration', confidence: 97,
    desc: 'Credential stuffing attack detected — 847 failed attempts followed by successful login from TOR exit node (185.220.101.0/24). MFA was bypassed via SIM swapping.',
    indicators: ['TOR exit node login', 'SIM swap alert from carrier', 'New device fingerprint', 'Unusual login time (3:42 AM)'],
    timeline: '2026-03-12 10:38', playbook: 'ATO-001',
  },
  {
    id: 'T-2026-088', severity: 'Critical', status: 'Investigating', type: 'Privilege Escalation',
    mitre: 'T1068', tactic: 'Privilege Escalation', target: 'john.doe@corp.com',
    source: 'Azure AD Activity Logs', confidence: 94,
    desc: 'User escalated privileges to Global Admin without going through approval workflow. Self-assigned admin role at 10:42 AM. Triggered by anomalous role assignment API call.',
    indicators: ['Direct role assignment API', 'No workflow approval', 'Outside working hours', 'Admin escalation from non-admin'],
    timeline: '2026-03-12 10:42', playbook: 'PRIV-003',
  },
  {
    id: 'T-2026-087', severity: 'High', status: 'Active', type: 'Lateral Movement',
    mitre: 'T1021', tactic: 'Lateral Movement', target: 'SA-PROD-DB01',
    source: 'Network Flow Analysis', confidence: 82,
    desc: 'Service account SA-PROD-DB01 accessing multiple systems beyond its defined scope. Lateral movement pattern detected across 6 servers in 30 minutes.',
    indicators: ['Cross-subnet access', 'New server connections', 'Service account used interactively', 'Off-hours activity'],
    timeline: '2026-03-12 08:12', playbook: 'LAT-002',
  },
  {
    id: 'T-2026-086', severity: 'High', status: 'Contained', type: 'Data Exfiltration via Identity',
    mitre: 'T1567', tactic: 'Exfiltration', target: 'emily.r@corp.com',
    source: 'CASB Integration', confidence: 78,
    desc: 'Large-volume upload of Salesforce customer records to personal Dropbox detected. 2.3 GB of CRM data uploaded over 4 hours using valid credentials.',
    indicators: ['Large data upload', 'Personal cloud storage', 'CRM data classification', 'Business hours — but unusual volume'],
    timeline: '2026-03-12 08:54', playbook: 'EXFIL-001',
  },
];

const MITRE_COVERAGE = [
  { tactic: 'Initial Access', id: 'TA0001', covered: 8, total: 12, pct: 67 },
  { tactic: 'Execution', id: 'TA0002', covered: 4, total: 10, pct: 40 },
  { tactic: 'Persistence', id: 'TA0003', covered: 11, total: 15, pct: 73 },
  { tactic: 'Privilege Escalation', id: 'TA0004', covered: 9, total: 11, pct: 82 },
  { tactic: 'Defense Evasion', id: 'TA0005', covered: 6, total: 14, pct: 43 },
  { tactic: 'Credential Access', id: 'TA0006', covered: 12, total: 14, pct: 86 },
  { tactic: 'Lateral Movement', id: 'TA0008', covered: 7, total: 9, pct: 78 },
  { tactic: 'Exfiltration', id: 'TA0010', covered: 5, total: 9, pct: 56 },
];

const DETECTION_SOURCES = [
  { name: 'Azure AD / Entra ID', events: 14823, threats: 24, coverage: 94 },
  { name: 'Okta SIEM Integration', events: 8291, threats: 18, coverage: 89 },
  { name: 'AWS CloudTrail', events: 6640, threats: 12, coverage: 76 },
  { name: 'Google Workspace', events: 5188, threats: 8, coverage: 82 },
  { name: 'Network Flow / CASB', events: 3241, threats: 6, coverage: 61 },
  { name: 'Endpoint (EDR)', events: 2109, threats: 4, coverage: 55 },
];

export default function ITDRPage() {
  const [selected, setSelected] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('threats');

  const sevStyle = (s: string) => ({
    Critical: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', dot: '#ef4444', text: '#f87171', badge: 'rgba(239,68,68,0.15)' },
    High: { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', dot: '#f97316', text: '#fb923c', badge: 'rgba(249,115,22,0.15)' },
    Medium: { bg: 'rgba(234,179,8,0.07)', border: 'rgba(234,179,8,0.2)', dot: '#eab308', text: '#facc15', badge: 'rgba(234,179,8,0.12)' },
  } as Record<string, { bg: string; border: string; dot: string; text: string; badge: string }>)[s] || { bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', dot: '#6366f1', text: '#818cf8', badge: 'rgba(99,102,241,0.15)' };

  const statusColor = (s: string) => ({ Active: '#ef4444', Investigating: '#f97316', Contained: '#22c55e', Resolved: '#4ade80' } as Record<string,string>)[s] || '#94a3b8';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            Identity Threat Detection & Response
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Real-time threat hunting, anomaly detection, and automated response across all identity surfaces
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ fontSize: '11px', color: '#4ade80', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', padding: '6px 14px', borderRadius: '999px', fontWeight: '600' }}>● Detection Active</div>
          <button style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>⚡ Run Hunt</button>
        </div>
      </div>

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Active Threats', value: '2', color: '#ef4444', sub: 'Require immediate action' },
          { label: 'Under Investigation', value: '1', color: '#f97316', sub: 'SOC investigating' },
          { label: 'Contained (24h)', value: '1', color: '#06b6d4', sub: 'Awaiting remediation' },
          { label: 'Detection Sources', value: '6', color: '#6366f1', sub: 'Integrated data sources' },
          { label: 'MITRE Coverage', value: '68%', color: '#22c55e', sub: 'ATT&CK for Identity' },
        ].map(s => (
          <div key={s.label} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.06)' }}>
        {[['threats', 'Active Threats'], ['mitre', 'MITRE Coverage'], ['sources', 'Detection Sources']].map(([val, lbl]) => (
          <button key={val} onClick={() => setActiveTab(val)}
            style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: 'none', background: activeTab === val ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === val ? '#818cf8' : '#64748b', transition: 'all 0.2s' }}>
            {lbl}
          </button>
        ))}
      </div>

      {activeTab === 'threats' && (
        <div style={{ display: 'grid', gridTemplateColumns: selected !== null ? '1fr 360px' : '1fr', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {THREATS.map((threat, i) => {
              const s = sevStyle(threat.severity);
              const isSelected = selected === i;
              return (
                <div key={threat.id} onClick={() => setSelected(isSelected ? null : i)}
                  style={{ background: s.bg, border: `1px solid ${isSelected ? s.dot : s.border}`, borderRadius: '12px', padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: isSelected ? `0 0 20px ${s.dot}20` : 'none' }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.dot, boxShadow: `0 0 8px ${s.dot}80`, flexShrink: 0, marginTop: '5px' }}></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: s.text }}>{threat.type}</span>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '3px', background: s.badge, color: s.text, border: `1px solid ${s.border}`, letterSpacing: '0.05em' }}>{threat.severity}</span>
                        <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '3px', background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)', fontFamily: 'monospace' }}>MITRE {threat.mitre}</span>
                        <span style={{ fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '3px', background: 'rgba(6,182,212,0.1)', color: '#22d3ee', border: '1px solid rgba(6,182,212,0.2)' }}>{threat.tactic}</span>
                        <span style={{ fontSize: '11px', color: '#475569', marginLeft: 'auto', fontFamily: 'monospace' }}>{threat.timeline}</span>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: statusColor(threat.status), background: `${statusColor(threat.status)}18`, border: `1px solid ${statusColor(threat.status)}35`, padding: '2px 8px', borderRadius: '999px' }}>{threat.status}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: s.text, fontFamily: 'monospace', fontWeight: '600', marginBottom: '6px' }}>{threat.target}</div>
                      <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>{threat.desc}</div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#475569' }}>Confidence: <span style={{ color: s.text, fontWeight: '700' }}>{threat.confidence}%</span></span>
                        <span style={{ fontSize: '11px', color: '#475569' }}>Source: <span style={{ color: '#94a3b8' }}>{threat.source}</span></span>
                        <span style={{ fontSize: '11px', color: '#475569' }}>Playbook: <span style={{ color: '#818cf8', fontFamily: 'monospace' }}>{threat.playbook}</span></span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                      <button style={{ fontSize: '11px', fontWeight: '600', color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>Respond →</button>
                      <button style={{ fontSize: '11px', fontWeight: '600', color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>Timeline</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selected !== null && (
            <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '20px', height: 'fit-content', position: 'sticky', top: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9', marginBottom: '4px' }}>{THREATS[selected].type}</div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#818cf8', marginBottom: '16px' }}>{THREATS[selected].id}</div>

              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>Indicators of Compromise</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                {THREATS[selected].indicators.map((ioc, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '6px' }}>
                    <span style={{ color: '#ef4444', fontSize: '10px' }}>⬡</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{ioc}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>Recommended Response</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                {['Suspend user account immediately', 'Revoke all active sessions', 'Reset credentials and enforce MFA re-enrollment', 'Notify security team and affected managers', 'Preserve evidence for forensic analysis'].map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#6366f1', width: '18px', flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 }}>{step}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button style={{ width: '100%', background: '#ef4444', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                  ⚡ Execute Response Playbook
                </button>
                <button style={{ width: '100%', background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', padding: '9px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                  Create Incident Ticket
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'mitre' && (
        <div>
          <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '22px', marginBottom: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', marginBottom: '4px' }}>MITRE ATT&CK Coverage for Identity</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>Detection coverage across identity-relevant ATT&CK tactics</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {MITRE_COVERAGE.map(tactic => (
                <div key={tactic.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#818cf8', fontWeight: '700' }}>{tactic.id}</span>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: tactic.pct >= 75 ? '#4ade80' : tactic.pct >= 50 ? '#eab308' : '#f87171' }}>{tactic.pct}%</span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>{tactic.tactic}</div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${tactic.pct}%`, background: tactic.pct >= 75 ? '#22c55e' : tactic.pct >= 50 ? '#eab308' : '#ef4444', borderRadius: '2px' }}></div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px' }}>{tactic.covered}/{tactic.total} techniques</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sources' && (
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Detection Source', 'Events (24h)', 'Threats Detected', 'Coverage Score', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 18px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DETECTION_SOURCES.map((src, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '14px 18px', fontSize: '13px', fontWeight: '600', color: '#f1f5f9' }}>{src.name}</td>
                  <td style={{ padding: '14px 18px', fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>{src.events.toLocaleString()}</td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: src.threats > 20 ? '#f87171' : src.threats > 10 ? '#fb923c' : '#4ade80' }}>{src.threats}</span>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ height: '6px', width: '100px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${src.coverage}%`, background: src.coverage >= 80 ? '#22c55e' : src.coverage >= 60 ? '#eab308' : '#ef4444' }}></div>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: src.coverage >= 80 ? '#4ade80' : src.coverage >= 60 ? '#facc15' : '#f87171' }}>{src.coverage}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '999px', background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>Connected</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
