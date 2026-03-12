'use client';
import { useState } from 'react';

const GRAPH_NODES = [
  { id: 'u1', type: 'user', label: 'John Doe', risk: 89, x: 250, y: 180 },
  { id: 'u2', type: 'user', label: 'Sarah Chen', risk: 76, x: 120, y: 300 },
  { id: 'u3', type: 'user', label: 'Alice Brown', risk: 65, x: 380, y: 300 },
  { id: 'sa1', type: 'service', label: 'SA-PROD-DB01', risk: 71, x: 250, y: 420 },
  { id: 'r1', type: 'role', label: 'Global Admin', risk: 90, x: 500, y: 160 },
  { id: 'r2', type: 'role', label: 'Finance Approver', risk: 55, x: 60, y: 420 },
  { id: 'r3', type: 'role', label: 'DB Admin', risk: 80, x: 440, y: 420 },
  { id: 'a1', type: 'app', label: 'Azure AD', x: 620, y: 250, risk: 70 },
  { id: 'a2', type: 'app', label: 'AWS Prod', x: 620, y: 380, risk: 82 },
  { id: 'a3', type: 'app', label: 'Salesforce', x: 60, y: 520, risk: 44 },
];

const GRAPH_EDGES = [
  { from: 'u1', to: 'r1', type: 'has_role', critical: true },
  { from: 'u1', to: 'r3', type: 'has_role', critical: true },
  { from: 'u2', to: 'r2', type: 'has_role', critical: false },
  { from: 'u3', to: 'r2', type: 'has_role', critical: false },
  { from: 'sa1', to: 'r3', type: 'has_role', critical: true },
  { from: 'r1', to: 'a1', type: 'accesses', critical: true },
  { from: 'r1', to: 'a2', type: 'accesses', critical: true },
  { from: 'r3', to: 'a2', type: 'accesses', critical: true },
  { from: 'r2', to: 'a3', type: 'accesses', critical: false },
];

const TOXIC_COMBINATIONS = [
  { user: 'Sarah Chen + Alice Brown', perms: 'Approve Payments + Create Vendors', risk: 'Critical', desc: 'Segregation of Duties violation in Finance' },
  { user: 'John Doe', perms: 'Self-Approve + Admin + Audit Disable', risk: 'Critical', desc: 'Can approve own requests and suppress audit logs' },
  { user: 'SA-PROD-DB01', perms: 'DB Admin + Backup Access + No Rotation', risk: 'High', desc: 'Service account with excessive DB access, no credential rotation' },
];

const ATTACK_PATHS = [
  { from: 'John Doe', path: '→ Global Admin → Azure AD → All Users → AWS Production', risk: 'Critical', hops: 4 },
  { from: 'SA-PROD-DB01', path: '→ DB Admin → Production DB → PII Data', risk: 'High', hops: 3 },
];

function getNode(id: string) { return GRAPH_NODES.find(n => n.id === id); }

export default function GraphPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'graph' | 'toxic' | 'paths'>('graph');

  const nodeColor = (type: string, risk: number) => {
    if (type === 'app') return { fill: '#0e7490', stroke: '#06b6d4', glow: '#06b6d4' };
    if (type === 'role') return { fill: risk > 70 ? '#7f1d1d' : '#713f12', stroke: risk > 70 ? '#ef4444' : '#f97316', glow: risk > 70 ? '#ef4444' : '#f97316' };
    if (type === 'service') return { fill: '#312e81', stroke: '#8b5cf6', glow: '#8b5cf6' };
    return risk > 80 ? { fill: '#7f1d1d', stroke: '#ef4444', glow: '#ef4444' } : risk > 60 ? { fill: '#78350f', stroke: '#f97316', glow: '#f97316' } : { fill: '#1e3a5f', stroke: '#6366f1', glow: '#6366f1' };
  };

  const selectedNode = selected ? GRAPH_NODES.find(n => n.id === selected) : null;
  const connectedEdges = selected ? GRAPH_EDGES.filter(e => e.from === selected || e.to === selected) : [];
  const connectedNodes = connectedEdges.map(e => e.from === selected ? e.to : e.from);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            Identity Graph & Attack Paths
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Visualize identity relationships, detect toxic access, and identify attack paths
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            ⚠ Toxic Combinations: 3
          </button>
        </div>
      </div>

      {/* View tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.06)' }}>
        {[['graph', 'Identity Graph'], ['toxic', 'Toxic Permissions'], ['paths', 'Attack Paths']].map(([val, lbl]) => (
          <button key={val} onClick={() => setView(val as 'graph' | 'toxic' | 'paths')}
            style={{ padding: '7px 18px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: 'none', background: view === val ? 'rgba(99,102,241,0.2)' : 'transparent', color: view === val ? '#818cf8' : '#64748b', transition: 'all 0.2s' }}>
            {lbl}
          </button>
        ))}
      </div>

      {view === 'graph' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
          {/* SVG Graph */}
          <div style={{ background: '#0d1426', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
            {/* Graph header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>Identity Relationship Graph</span>
              <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#475569' }}>
                {[['#6366f1', 'User'], ['#8b5cf6', 'Service Acct'], ['#ef4444', 'High-Risk Role'], ['#06b6d4', 'Application']].map(([c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }}></div>
                    <span>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            <svg width="100%" height="500" viewBox="0 0 700 540" style={{ display: 'block' }}>
              <defs>
                <filter id="glow-red">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-blue">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <marker id="arrow-critical" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" />
                </marker>
                <marker id="arrow-normal" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#475569" />
                </marker>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(99,102,241,0.05)" strokeWidth="1"/>
                </pattern>
              </defs>

              {/* Background grid */}
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Edges */}
              {GRAPH_EDGES.map((edge, i) => {
                const from = getNode(edge.from);
                const to = getNode(edge.to);
                if (!from || !to) return null;
                const isHighlighted = !selected || edge.from === selected || edge.to === selected;
                return (
                  <g key={i}>
                    <line
                      x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                      stroke={edge.critical ? '#ef444460' : '#47556940'}
                      strokeWidth={edge.critical ? '2' : '1'}
                      strokeDasharray={edge.critical ? '0' : '4 4'}
                      opacity={isHighlighted ? 1 : 0.2}
                      markerEnd={`url(#arrow-${edge.critical ? 'critical' : 'normal'})`}
                    />
                    {edge.critical && (
                      <line
                        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                        stroke="#ef444420" strokeWidth="8" opacity={isHighlighted ? 0.5 : 0.1}
                      />
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {GRAPH_NODES.map(node => {
                const c = nodeColor(node.type, node.risk);
                const isSelected = selected === node.id;
                const isConnected = connectedNodes.includes(node.id);
                const opacity = !selected || isSelected || isConnected ? 1 : 0.3;

                return (
                  <g key={node.id} onClick={() => setSelected(selected === node.id ? null : node.id)} style={{ cursor: 'pointer' }}>
                    {/* Glow ring for selected */}
                    {isSelected && (
                      <circle cx={node.x} cy={node.y} r="28" fill="none" stroke={c.glow} strokeWidth="2" opacity="0.5" />
                    )}
                    {/* Node circle */}
                    <circle
                      cx={node.x} cy={node.y} r={node.type === 'role' ? '18' : node.type === 'app' ? '20' : '22'}
                      fill={c.fill} stroke={c.stroke} strokeWidth={isSelected ? '3' : '2'}
                      opacity={opacity}
                      filter={node.risk > 70 ? 'url(#glow-red)' : 'url(#glow-blue)'}
                    />
                    {/* Label */}
                    <text x={node.x} y={node.y + 36} textAnchor="middle" fill={opacity < 1 ? '#47556970' : '#94a3b8'} fontSize="10" fontWeight="600">
                      {node.label.length > 12 ? node.label.slice(0, 12) + '…' : node.label}
                    </text>
                    {/* Risk badge for high risk */}
                    {node.risk > 70 && (
                      <text x={node.x} y={node.y + 5} textAnchor="middle" fill="white" fontSize="11" fontWeight="800">{node.risk}</text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Right panel - node details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {selectedNode ? (
              <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9', marginBottom: '4px' }}>{selectedNode.label}</div>
                <div style={{ fontSize: '11px', color: '#475569', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{selectedNode.type}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Risk Score</span>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: selectedNode.risk > 70 ? '#f87171' : '#f97316', fontFamily: 'monospace' }}>{selectedNode.risk}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Connections</span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#94a3b8' }}>{connectedEdges.length}</span>
                  </div>
                </div>
                <div style={{ marginTop: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Connected Nodes</div>
                  {connectedEdges.map((edge, i) => {
                    const otherId = edge.from === selected ? edge.to : edge.from;
                    const other = getNode(otherId);
                    return other ? (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: edge.critical ? '#ef4444' : '#475569', flexShrink: 0 }}></div>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{other.label}</span>
                        <span style={{ fontSize: '10px', color: '#475569', marginLeft: 'auto' }}>{edge.type.replace('_', ' ')}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            ) : (
              <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9', marginBottom: '8px' }}>Graph Guide</div>
                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>Click any node to explore its connections and risk details.</div>
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[['Solid red lines', 'Critical access paths'], ['Dashed lines', 'Standard access'], ['Red nodes', 'High-risk identities'], ['Numbers', 'Risk scores (0-100)']].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                      <span style={{ color: '#818cf8', fontWeight: '600', minWidth: '120px' }}>{k}</span>
                      <span style={{ color: '#475569' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div style={{ background: '#111827', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#f1f5f9', marginBottom: '14px' }}>Graph Statistics</div>
              {[['Total Nodes', '10'], ['Critical Paths', '4'], ['Toxic Combos', '3'], ['Orphaned Nodes', '0'], ['Avg Connections', '2.4']].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{l}</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#94a3b8' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'toxic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>⚠</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#f87171' }}>3 Toxic Permission Combinations Detected</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>These combinations violate Segregation of Duties (SoD) policies and require immediate remediation</div>
            </div>
          </div>
          {TOXIC_COMBINATIONS.map((tc, i) => (
            <div key={i} style={{ background: '#111827', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9', marginBottom: '4px' }}>{tc.user}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>{tc.desc}</div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '999px', background: tc.risk === 'Critical' ? 'rgba(239,68,68,0.12)' : 'rgba(249,115,22,0.12)', color: tc.risk === 'Critical' ? '#f87171' : '#fb923c', border: `1px solid ${tc.risk === 'Critical' ? 'rgba(239,68,68,0.25)' : 'rgba(249,115,22,0.25)'}` }}>{tc.risk}</span>
              </div>
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', fontFamily: 'monospace', fontSize: '12px', color: '#f87171' }}>
                {tc.perms}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{ fontSize: '12px', fontWeight: '600', color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '6px 14px', borderRadius: '7px', cursor: 'pointer' }}>Remediate Now</button>
                <button style={{ fontSize: '12px', fontWeight: '600', color: '#818cf8', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', padding: '6px 14px', borderRadius: '7px', cursor: 'pointer' }}>Add Exception</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'paths' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '14px 18px' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#f87171' }}>Attack Path Analysis</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Identified privilege escalation paths that could enable lateral movement</div>
          </div>
          {ATTACK_PATHS.map((path, i) => (
            <div key={i} style={{ background: '#111827', border: `1px solid ${path.risk === 'Critical' ? 'rgba(239,68,68,0.25)' : 'rgba(249,115,22,0.2)'}`, borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#f1f5f9' }}>{path.from}</span>
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', background: path.risk === 'Critical' ? 'rgba(239,68,68,0.12)' : 'rgba(249,115,22,0.12)', color: path.risk === 'Critical' ? '#f87171' : '#fb923c', border: `1px solid ${path.risk === 'Critical' ? 'rgba(239,68,68,0.25)' : 'rgba(249,115,22,0.25)'}` }}>{path.risk}</span>
                <span style={{ fontSize: '11px', color: '#475569', marginLeft: 'auto' }}>{path.hops} hops</span>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#94a3b8', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '12px 16px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#f87171', fontWeight: '700' }}>{path.from}</span>
                <span style={{ color: '#475569' }}>{path.path}</span>
              </div>
              <button style={{ fontSize: '12px', fontWeight: '600', color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '6px 14px', borderRadius: '7px', cursor: 'pointer' }}>Block Path</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
