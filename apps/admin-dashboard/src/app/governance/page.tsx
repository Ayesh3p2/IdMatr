'use client';
import { useState } from 'react';

const WORKFLOWS = [
  { id: 'W-1042', type: 'Access Request', requester: 'Emily Rodriguez', email: 'emily.r@corp.com', target: 'AWS Production (Admin)', status: 'Pending', sla: '4h left', approver: 'John Doe', priority: 'High', age: '2d' },
  { id: 'W-1041', type: 'Privileged Access', requester: 'Carlos Mendes', email: 'carlos.m@corp.com', target: 'GitHub Enterprise Admin', status: 'Pending', sla: '1h left', approver: 'Jane Smith', priority: 'Critical', age: '3d' },
  { id: 'W-1040', type: 'Role Change', requester: 'Alice Brown', email: 'alice.b@corp.com', target: 'Finance Approver → Finance Admin', status: 'Under Review', sla: '6h left', approver: 'Security Team', priority: 'High', age: '1d' },
  { id: 'W-1039', type: 'Certification', requester: 'System', email: 'system@idmatr.internal', target: 'Q1 2026 Access Certification', status: 'In Progress', sla: '5d left', approver: 'All Managers', priority: 'Medium', age: '14d' },
  { id: 'W-1038', type: 'Access Revocation', requester: 'HR System', email: 'hr@idmatr.internal', target: 'Mike Rodriguez — All Access', status: 'Approved', sla: 'Completed', approver: 'Auto-approved', priority: 'High', age: '1d' },
  { id: 'W-1037', type: 'Access Request', requester: 'Bob Johnson', email: 'bob.j@corp.com', target: 'Salesforce Admin Panel', status: 'Rejected', sla: 'N/A', approver: 'Jane Smith', priority: 'Low', age: '4d' },
];

const CERTIFICATION_CAMPAIGNS = [
  { id: 'C-2026-Q1', name: 'Q1 2026 Access Certification', status: 'Active', progress: 68, total: 1248, reviewed: 849, deadline: 'Mar 31, 2026', owner: 'Security Team' },
  { id: 'C-PRIV-2026', name: 'Privileged Account Review', status: 'Active', progress: 42, total: 89, reviewed: 37, deadline: 'Mar 15, 2026', owner: 'IAM Team' },
  { id: 'C-SaaS-Q1', name: 'SaaS Application Access Review', status: 'Scheduled', progress: 0, total: 284, reviewed: 0, deadline: 'Apr 15, 2026', owner: 'IT Team' },
];

const JML_EVENTS = [
  { type: 'Joiner', user: 'Alex Thompson', dept: 'Engineering', date: 'Mar 10', status: 'Provisioned', apps: 8 },
  { type: 'Mover', user: 'Lisa Park', dept: 'Finance → Legal', date: 'Mar 9', status: 'In Progress', apps: 12 },
  { type: 'Leaver', user: 'Mike Rodriguez', dept: 'Sales', date: 'Mar 8', status: 'Deprovisioned', apps: 0 },
  { type: 'Leaver', user: 'Tom Wilson', dept: 'Engineering', date: 'Mar 7', status: 'Pending', apps: 14 },
  { type: 'Joiner', user: 'Sara Kim', dept: 'Marketing', date: 'Mar 11', status: 'Scheduled', apps: 0 },
];

export default function GovernancePage() {
  const [activeTab, setActiveTab] = useState('workflows');

  const statusStyle = (s: string) => {
    const m: Record<string, { bg: string; color: string; border: string }> = {
      'Pending': { bg: 'rgba(99,102,241,0.12)', color: '#818cf8', border: 'rgba(99,102,241,0.3)' },
      'Under Review': { bg: 'rgba(234,179,8,0.12)', color: '#facc15', border: 'rgba(234,179,8,0.3)' },
      'In Progress': { bg: 'rgba(6,182,212,0.12)', color: '#22d3ee', border: 'rgba(6,182,212,0.25)' },
      'Approved': { bg: 'rgba(34,197,94,0.12)', color: '#4ade80', border: 'rgba(34,197,94,0.25)' },
      'Rejected': { bg: 'rgba(239,68,68,0.12)', color: '#f87171', border: 'rgba(239,68,68,0.25)' },
    };
    return m[s] || { bg: 'rgba(99,102,241,0.1)', color: '#818cf8', border: 'rgba(99,102,241,0.2)' };
  };

  const priorityColor = (p: string) => ({ Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e' } as Record<string,string>)[p] || '#94a3b8';

  const jmlColor = (t: string) => ({ Joiner: '#22c55e', Mover: '#06b6d4', Leaver: '#f97316' } as Record<string,string>)[t] || '#94a3b8';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            Access Governance
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Approval workflows, certification campaigns, and identity lifecycle management
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            + New Campaign
          </button>
          <button style={{ background: '#6366f1', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: 'none' }}>
            + Access Request
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Pending Approvals', value: '12', sub: '8 near SLA deadline', color: '#6366f1', alert: true },
          { label: 'Campaign Progress', value: '68%', sub: 'Q1 2026 Certification', color: '#06b6d4' },
          { label: 'SLA Breaches', value: '3', sub: 'Require escalation now', color: '#ef4444', alert: true },
          { label: 'Policy Health', value: '94/100', sub: '6 active violations', color: '#22c55e' },
        ].map(s => (
          <div key={s.label} style={{ background: '#111827', border: `1px solid ${s.alert ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.15)'}`, borderRadius: '12px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: s.alert ? '#f87171' : '#f1f5f9' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.06)' }}>
        {[['workflows','Approval Workflows'], ['campaigns','Certification Campaigns'], ['jml','Identity Lifecycle (JML)']].map(([val, lbl]) => (
          <button key={val} onClick={() => setActiveTab(val)}
            style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: 'none', background: activeTab === val ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === val ? '#818cf8' : '#64748b', transition: 'all 0.2s' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Workflows Tab */}
      {activeTab === 'workflows' && (
        <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9' }}>Active Workflows</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['All', 'Pending', 'Under Review', 'Approved'].map(f => (
                <button key={f} style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>{f}</button>
              ))}
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['ID', 'Type', 'Requester', 'Target Resource', 'Priority', 'Status', 'SLA', 'Approver', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WORKFLOWS.map(w => {
                const s = statusStyle(w.status);
                return (
                  <tr key={w.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '13px 16px', fontSize: '11px', fontFamily: 'monospace', color: '#6366f1', fontWeight: '700' }}>{w.id}</td>
                    <td style={{ padding: '13px 16px', fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>{w.type}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9' }}>{w.requester}</div>
                      <div style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace' }}>{w.email}</div>
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '12px', color: '#94a3b8', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.target}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: priorityColor(w.priority) }}></div>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: priorityColor(w.priority) }}>{w.priority}</span>
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '999px', background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{w.status}</span>
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '12px', fontFamily: 'monospace', color: w.sla.includes('h left') && parseInt(w.sla) <= 4 ? '#f87171' : '#94a3b8', fontWeight: '600' }}>{w.sla}</td>
                    <td style={{ padding: '13px 16px', fontSize: '12px', color: '#64748b' }}>{w.approver}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {w.status === 'Pending' && (
                          <>
                            <button style={{ fontSize: '11px', fontWeight: '600', color: '#4ade80', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', padding: '3px 8px', borderRadius: '5px', cursor: 'pointer' }}>✓ Approve</button>
                            <button style={{ fontSize: '11px', fontWeight: '600', color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '3px 8px', borderRadius: '5px', cursor: 'pointer' }}>✗ Deny</button>
                          </>
                        )}
                        <button style={{ fontSize: '11px', fontWeight: '600', color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', padding: '3px 8px', borderRadius: '5px', cursor: 'pointer' }}>Details</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Campaigns Tab */}
      {activeTab === 'campaigns' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {CERTIFICATION_CAMPAIGNS.map(c => (
            <div key={c.id} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9' }}>{c.name}</h3>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', background: c.status === 'Active' ? 'rgba(34,197,94,0.12)' : 'rgba(99,102,241,0.12)', color: c.status === 'Active' ? '#4ade80' : '#818cf8', border: `1px solid ${c.status === 'Active' ? 'rgba(34,197,94,0.25)' : 'rgba(99,102,241,0.25)'}` }}>{c.status}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569' }}>ID: <span style={{ fontFamily: 'monospace', color: '#818cf8' }}>{c.id}</span> • Owner: {c.owner} • Deadline: {c.deadline}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '28px', fontWeight: '800', color: c.progress > 60 ? '#4ade80' : c.progress > 30 ? '#eab308' : '#f87171' }}>{c.progress}%</div>
                  <div style={{ fontSize: '11px', color: '#475569' }}>{c.reviewed.toLocaleString()} / {c.total.toLocaleString()} reviewed</div>
                </div>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                <div style={{ height: '100%', width: `${c.progress}%`, background: c.progress > 60 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : c.progress > 30 ? 'linear-gradient(90deg,#eab308,#fbbf24)' : 'linear-gradient(90deg,#ef4444,#f97316)', borderRadius: '4px', boxShadow: `0 0 8px ${c.progress > 60 ? '#22c55e' : c.progress > 30 ? '#eab308' : '#ef4444'}60` }}></div>
              </div>
              {c.status === 'Active' && (
                <button style={{ fontSize: '12px', fontWeight: '600', color: '#818cf8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', padding: '7px 16px', borderRadius: '7px', cursor: 'pointer' }}>
                  Continue Review →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* JML Tab */}
      {activeTab === 'jml' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
            {[['Joiners', '3', '#22c55e', 'Joined this week'], ['Movers', '2', '#06b6d4', 'Role changes pending'], ['Leavers', '2', '#f97316', '1 incomplete offboard']].map(([t, v, c, s]) => (
              <div key={t} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ height: '2px', background: c as string, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
                <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '6px' }}>Identity {t}</div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: c as string }}>{v}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{s}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Event Type', 'User', 'Department', 'Date', 'Provisioning Status', 'Active Apps'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {JML_EVENTS.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={el => (el.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                    onMouseLeave={el => (el.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '999px', background: `${jmlColor(e.type)}18`, color: jmlColor(e.type), border: `1px solid ${jmlColor(e.type)}35` }}>{e.type}</span>
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '13px', fontWeight: '600', color: '#f1f5f9' }}>{e.user}</td>
                    <td style={{ padding: '13px 16px', fontSize: '12px', color: '#94a3b8' }}>{e.dept}</td>
                    <td style={{ padding: '13px 16px', fontSize: '12px', fontFamily: 'monospace', color: '#475569' }}>{e.date}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: e.status === 'Deprovisioned' || e.status === 'Provisioned' ? '#4ade80' : e.status === 'Pending' ? '#f87171' : '#eab308' }}>{e.status}</span>
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '14px', fontWeight: '700', color: '#94a3b8' }}>{e.apps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
