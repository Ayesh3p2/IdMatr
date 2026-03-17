'use client';
import { useState, useEffect } from 'react';
import { getWorkflows, updateWorkflow, getJMLEvents } from '@/lib/api';

export default function GovernancePage() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [jml, setJml] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('workflows');
  const [acting, setActing] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.allSettled([getWorkflows(), getJMLEvents()])
      .then(([wRes, jRes]) => {
        if (wRes.status === 'fulfilled') setWorkflows(Array.isArray(wRes.value) ? wRes.value : []);
        if (jRes.status === 'fulfilled') setJml(Array.isArray(jRes.value) ? jRes.value : []);
        if (wRes.status === 'rejected') setError(wRes.reason?.message || 'Failed to load governance data');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAction = async (id: string, action: string) => {
    setActing(id);
    try {
      await updateWorkflow(id, action);
      loadData();
    } catch (err: any) {
      alert(`Action failed: ${err?.message}`);
    } finally {
      setActing(null);
    }
  };

  const pending = workflows.filter(w => w.status === 'Pending' || w.status === 'pending').length;
  const inReview = workflows.filter(w => w.status === 'Under Review' || w.status === 'in_review').length;
  const approved = workflows.filter(w => w.status === 'Approved' || w.status === 'approved').length;

  const statusColor = (s: string) => {
    const map: Record<string, string> = { Pending: '#eab308', pending: '#eab308', 'Under Review': '#f97316', in_review: '#f97316', Approved: '#22c55e', approved: '#22c55e', Rejected: '#ef4444', rejected: '#ef4444', 'In Progress': '#6366f1', in_progress: '#6366f1' };
    return map[s] || '#94a3b8';
  };

  const priorityColor = (p: string) => ({ Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e' } as Record<string,string>)[p] || '#94a3b8';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>Identity Governance & Administration</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Access request workflows, certifications, and joiner-mover-leaver lifecycle management</p>
        </div>
        <button style={{ background: '#6366f1', color: 'white', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: 'none' }}>+ New Workflow</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Pending Approval', value: loading ? '…' : pending.toString(), color: '#eab308', sub: 'Awaiting action' },
          { label: 'Under Review', value: loading ? '…' : inReview.toString(), color: '#f97316', sub: 'In review process' },
          { label: 'Approved (Today)', value: loading ? '…' : approved.toString(), color: '#22c55e', sub: 'Access granted' },
          { label: 'JML Events', value: loading ? '…' : jml.length.toString(), color: '#6366f1', sub: 'Lifecycle events' },
        ].map(s => (
          <div key={s.label} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ height: '2px', background: s.color, position: 'absolute', top: 0, left: 0, right: 0 }}></div>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: '8px' }}>{s.label}</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#f1f5f9' }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.06)' }}>
        {[['workflows', 'Access Workflows'], ['jml', 'JML Events']].map(([val, lbl]) => (
          <button key={val} onClick={() => setActiveTab(val)}
            style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: 'none', background: activeTab === val ? 'rgba(99,102,241,0.2)' : 'transparent', color: activeTab === val ? '#818cf8' : '#64748b' }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⟳</div>Loading…</div>}
      {error && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '16px', color: '#f87171' }}>⚠ {error}</div>}

      {!loading && activeTab === 'workflows' && (
        workflows.length === 0 ? (
          <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No workflows yet</div>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>Access request workflows and certifications will appear here once created.</p>
          </div>
        ) : (
          <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['ID', 'Type', 'Requester', 'Target', 'Priority', 'Status', 'Age', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workflows.map((w: any, i: number) => {
                  const status = w.status || 'pending';
                  const priority = w.priority || 'Medium';
                  const isPending = status === 'Pending' || status === 'pending';
                  const createdAt = w.createdAt ? new Date(w.createdAt).toLocaleDateString() : '—';
                  return (
                    <tr key={w.id ?? i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '14px 14px', fontSize: '11px', fontFamily: 'monospace', color: '#818cf8' }}>{w.id}</td>
                      <td style={{ padding: '14px', fontSize: '12px', color: '#94a3b8', textTransform: 'capitalize' }}>{w.type || w.workflowType || '—'}</td>
                      <td style={{ padding: '14px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9' }}>{w.requesterEmail || w.requesterId || '—'}</div>
                      </td>
                      <td style={{ padding: '14px', fontSize: '12px', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {w.targetResource || w.appId || '—'}
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: `${priorityColor(priority)}15`, color: priorityColor(priority), border: `1px solid ${priorityColor(priority)}30`, textTransform: 'capitalize' }}>{priority}</span>
                      </td>
                      <td style={{ padding: '14px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '999px', background: `${statusColor(status)}15`, color: statusColor(status), border: `1px solid ${statusColor(status)}30`, textTransform: 'capitalize' }}>
                          {status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '14px', fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>{createdAt}</td>
                      <td style={{ padding: '14px' }}>
                        {isPending && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              disabled={acting === w.id}
                              onClick={() => handleAction(w.id, 'approve')}
                              style={{ fontSize: '11px', fontWeight: '600', color: '#4ade80', padding: '4px 10px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '6px', cursor: 'pointer', opacity: acting === w.id ? 0.5 : 1 }}>
                              ✓ Approve
                            </button>
                            <button
                              disabled={acting === w.id}
                              onClick={() => handleAction(w.id, 'reject')}
                              style={{ fontSize: '11px', fontWeight: '600', color: '#f87171', padding: '4px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', cursor: 'pointer', opacity: acting === w.id ? 0.5 : 1 }}>
                              ✗ Reject
                            </button>
                          </div>
                        )}
                        {!isPending && <span style={{ fontSize: '11px', color: '#475569' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {!loading && activeTab === 'jml' && (
        jml.length === 0 ? (
          <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>👥</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#f1f5f9', marginBottom: '8px' }}>No JML events yet</div>
            <p style={{ fontSize: '13px', color: '#64748b' }}>Joiner, Mover, and Leaver lifecycle events will appear here from connected HR systems.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {jml.map((event: any, i: number) => {
              const eventType = event.type || event.eventType || 'Unknown';
              const color = eventType === 'Joiner' || eventType === 'joiner' ? '#22c55e' : eventType === 'Mover' || eventType === 'mover' ? '#f97316' : '#ef4444';
              return (
                <div key={event.id ?? i} style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.12)', borderRadius: '10px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '4px', background: `${color}15`, color, border: `1px solid ${color}30`, textTransform: 'capitalize' }}>{eventType}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9' }}>{event.userName || event.userId || '—'}</div>
                    {event.department && <div style={{ fontSize: '11px', color: '#475569' }}>{event.department}</div>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>{event.createdAt ? new Date(event.createdAt).toLocaleDateString() : '—'}</div>
                  <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 9px', borderRadius: '999px', background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                    {event.status || 'Processed'}
                  </span>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
