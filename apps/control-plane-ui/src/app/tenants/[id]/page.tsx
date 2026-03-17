'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  isAuthenticated, getTenant, suspendTenant, activateTenant, offboardTenant,
  updateIntegration, syncIntegration, createApiKey, revokeApiKey,
  updateTenantSettings, getTenantHealth,
} from '@/lib/api';

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#22c55e', SUSPENDED: '#ef4444', TRIAL: '#f59e0b', PENDING: '#6b7280', OFFBOARDED: '#374151',
};
const INT_STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#22c55e', ERROR: '#ef4444', PENDING: '#6b7280', DISABLED: '#374151', RATE_LIMITED: '#f59e0b',
};
const PROVIDER_LABELS: Record<string, { name: string; icon: string }> = {
  GOOGLE_WORKSPACE: { name: 'Google Workspace', icon: '🔵' },
  MICROSOFT_365:    { name: 'Microsoft 365',    icon: '🟦' },
  SLACK:            { name: 'Slack',            icon: '🟣' },
  GITHUB:           { name: 'GitHub',           icon: '⚫' },
  OKTA:             { name: 'Okta',             icon: '🔷' },
  AZURE_AD:         { name: 'Azure AD',         icon: '🔵' },
  AWS_IAM:          { name: 'AWS IAM',          icon: '🟠' },
};

type Tab = 'overview' | 'integrations' | 'api-keys' | 'settings' | 'health';

export default function TenantDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [tenant, setTenant] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [actionLoading, setActionLoading] = useState('');

  // API Key creation state
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyResult, setNewKeyResult] = useState<any>(null);
  const [showNewKey, setShowNewKey] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isAuthenticated()) { window.location.href = '/login'; return; }
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [t, h] = await Promise.allSettled([getTenant(id), getTenantHealth(id)]);
    if (t.status === 'fulfilled') setTenant(t.value);
    if (h.status === 'fulfilled') setHealth(h.value);
    setLoading(false);
  };

  const doAction = async (action: () => Promise<any>, key: string) => {
    setActionLoading(key);
    try { await action(); await load(); } finally { setActionLoading(''); }
  };

  const handleCreateKey = async () => {
    if (!newKeyName) return;
    setActionLoading('create-key');
    try {
      const key = await createApiKey(id, { name: newKeyName, scopes: ['read:identities', 'read:applications'] });
      setNewKeyResult(key);
      setShowNewKey(true);
      setNewKeyName('');
      await load();
    } finally { setActionLoading(''); }
  };

  const S = {
    page: { padding: '32px 40px', color: '#e2e8f0' } as React.CSSProperties,
    card: { background: '#13151f', border: '1px solid #1e2030', borderRadius: 12, padding: '20px 24px', marginBottom: 20 } as React.CSSProperties,
    sectionTitle: { color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 14 },
    th: { textAlign: 'left' as const, color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', paddingBottom: 10 },
    td: { padding: '12px 0', borderTop: '1px solid #1e2030', fontSize: 13 },
    btn: (color: string, bg: string): React.CSSProperties => ({
      padding: '7px 14px', borderRadius: 7, border: `1px solid ${bg}`,
      background: `${bg}12`, color, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    }),
    tab: (active: boolean): React.CSSProperties => ({
      padding: '8px 16px', borderRadius: 7, fontSize: 13, fontWeight: active ? 600 : 400,
      background: active ? '#1e2030' : 'transparent', color: active ? '#e2e8f0' : '#64748b',
      border: 'none', cursor: 'pointer', borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
    }),
  };

  if (loading) return <div style={{ ...S.page, color: '#64748b' }}>Loading tenant…</div>;
  if (!tenant) return <div style={{ ...S.page, color: '#ef4444' }}>Tenant not found</div>;

  const statusColor = STATUS_COLOR[tenant.status] || '#6b7280';

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <a href="/tenants" style={{ color: '#64748b', textDecoration: 'none', fontSize: 13 }}>← Tenants</a>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{tenant.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
              <code style={{ color: '#64748b', fontSize: 12, background: '#1e2030', padding: '2px 8px', borderRadius: 4 }}>{tenant.slug}</code>
              {tenant.domain && <span style={{ color: '#64748b', fontSize: 13 }}>· {tenant.domain}</span>}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 100,
                fontSize: 11, fontWeight: 700, background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}25`,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor }} />
                {tenant.status}
              </span>
              <span style={{
                padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: 'rgba(99,102,241,0.1)', color: '#818cf8', textTransform: 'capitalize',
              }}>{tenant.plan}</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            {tenant.status === 'ACTIVE' && (
              <button onClick={() => doAction(() => suspendTenant(id, 'Operator-initiated'), 'suspend')}
                disabled={!!actionLoading} style={S.btn('#ef4444', '#ef4444')}>
                {actionLoading === 'suspend' ? '…' : '⊘ Suspend'}
              </button>
            )}
            {tenant.status === 'SUSPENDED' && (
              <button onClick={() => doAction(() => activateTenant(tenant.id), 'activate')}
                disabled={!!actionLoading} style={S.btn('#22c55e', '#22c55e')}>
                {actionLoading === 'activate' ? '…' : '▶ Activate'}
              </button>
            )}
            {tenant.status !== 'OFFBOARDED' && (
              <button onClick={() => {
                if (window.confirm(`Offboard "${tenant.name}"? This action sets the tenant to OFFBOARDED status.`))
                  doAction(() => offboardTenant(tenant.id), 'offboard');
              }} disabled={!!actionLoading} style={S.btn('#6b7280', '#6b7280')}>
                Offboard
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid #1e2030' }}>
        {(['overview', 'integrations', 'api-keys', 'settings', 'health'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={S.tab(tab === t)}>
            {t === 'api-keys' ? 'API Keys' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={S.card}>
            <div style={S.sectionTitle}>Tenant Details</div>
            {[
              ['Tenant ID', <code style={{ fontSize: 11, color: '#818cf8' }}>{tenant.id}</code>],
              ['Slug', tenant.slug],
              ['Domain', tenant.domain || '—'],
              ['Plan', <span style={{ textTransform: 'capitalize' }}>{tenant.plan}</span>],
              ['Region', tenant.region],
              ['Created', new Date(tenant.createdAt).toLocaleString()],
              ['Updated', new Date(tenant.updatedAt).toLocaleString()],
              ...(tenant.suspendReason ? [['Suspend Reason', <span style={{ color: '#ef4444' }}>{tenant.suspendReason}</span>]] : []),
            ].map(([k, v]: any) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #1e2030', fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>{k}</span>
                <span style={{ color: '#e2e8f0', textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>

          <div>
            <div style={S.card}>
              <div style={S.sectionTitle}>Integration Status</div>
              {(tenant.integrations || []).map((i: any) => {
                const p = PROVIDER_LABELS[i.provider];
                const c = INT_STATUS_COLOR[i.status] || '#6b7280';
                return (
                  <div key={i.provider} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1e2030' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#94a3b8' }}>
                      {p?.icon} {p?.name || i.provider}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100,
                      background: `${c}15`, color: c, border: `1px solid ${c}25`,
                    }}>{i.status}</span>
                  </div>
                );
              })}
            </div>
            <div style={S.card}>
              <div style={S.sectionTitle}>Settings Summary</div>
              {tenant.settings && [
                ['SSO Enforced', tenant.settings.ssoEnforced ? '✓ Yes' : '✗ No'],
                ['Discovery', tenant.settings.discoveryEnabled ? '✓ Enabled' : '✗ Disabled'],
                ['Risk Threshold', `${tenant.settings.riskScoreThreshold}/100`],
                ['ITDR', tenant.settings.itdrEnabled ? '✓ Enabled' : '✗ Disabled'],
                ['Frameworks', (tenant.settings.frameworks || []).join(', ') || '—'],
              ].map(([k, v]: any) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1e2030', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>{k}</span>
                  <span style={{ color: '#e2e8f0' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── INTEGRATIONS TAB ─────────────────────────────────────────────────── */}
      {tab === 'integrations' && (
        <div>
          {(tenant.integrations || []).map((i: any) => {
            const p = PROVIDER_LABELS[i.provider];
            const enabled = i.enabled;
            const c = INT_STATUS_COLOR[i.status] || '#6b7280';
            return (
              <div key={i.provider} style={{ ...S.card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>{p?.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{p?.name || i.provider}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100,
                          background: `${c}15`, color: c, border: `1px solid ${c}25`,
                        }}>{i.status}</span>
                        {i.lastSyncAt && (
                          <span style={{ color: '#64748b', fontSize: 11 }}>
                            Last sync: {new Date(i.lastSyncAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 11, color: '#64748b' }}>
                    <span>{i.syncCount} syncs</span>
                    {i.errorCount > 0 && <span style={{ color: '#ef4444' }}>· {i.errorCount} errors</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => doAction(() => syncIntegration(tenant.id, i.provider), `sync-${i.provider}`)}
                    disabled={!enabled || !!actionLoading}
                    style={{ ...S.btn('#818cf8', '#6366f1'), opacity: enabled ? 1 : 0.4 }}>
                    {actionLoading === `sync-${i.provider}` ? '…' : '↻ Sync'}
                  </button>
                  <button
                    onClick={() => doAction(() => updateIntegration(tenant.id, i.provider, { enabled: !enabled }), `toggle-${i.provider}`)}
                    disabled={!!actionLoading}
                    style={enabled ? S.btn('#ef4444', '#ef4444') : S.btn('#22c55e', '#22c55e')}>
                    {actionLoading === `toggle-${i.provider}` ? '…' : enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── API KEYS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'api-keys' && (
        <div>
          {/* Create new key */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Create API Key</div>
            {newKeyResult && showNewKey && (
              <div style={{
                padding: '14px 16px', marginBottom: 16, borderRadius: 8,
                background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
              }}>
                <div style={{ color: '#22c55e', fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
                  ✓ API key created — copy it now, it won't be shown again
                </div>
                <code style={{
                  display: 'block', padding: '10px 12px', background: '#0f1117', borderRadius: 6,
                  color: '#e2e8f0', fontSize: 12, wordBreak: 'break-all', border: '1px solid #1e2030',
                }}>{newKeyResult.key}</code>
                <button onClick={() => { navigator.clipboard.writeText(newKeyResult.key); }}
                  style={{ ...S.btn('#818cf8', '#6366f1'), marginTop: 8 }}>Copy</button>
                <button onClick={() => { setShowNewKey(false); setNewKeyResult(null); }}
                  style={{ ...S.btn('#64748b', '#374151'), marginTop: 8, marginLeft: 8 }}>Dismiss</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                placeholder="Key name, e.g. 'Agent Key #1'"
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #2d3147',
                  background: '#0f1117', color: '#e2e8f0', fontSize: 13, outline: 'none',
                }} />
              <button onClick={handleCreateKey} disabled={!newKeyName || !!actionLoading}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                {actionLoading === 'create-key' ? '…' : '+ Generate'}
              </button>
            </div>
          </div>

          {/* Existing keys */}
          <div style={S.card}>
            <div style={S.sectionTitle}>Active API Keys</div>
            {(tenant.apiKeys || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b', fontSize: 13 }}>
                No API keys yet. Create one above.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['NAME', 'PREFIX', 'SCOPES', 'EXPIRES', 'LAST USED', ''].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(tenant.apiKeys || []).map((k: any) => (
                    <tr key={k.id}>
                      <td style={S.td}><span style={{ fontWeight: 600 }}>{k.name}</span></td>
                      <td style={S.td}><code style={{ color: '#818cf8', fontSize: 11 }}>{k.keyPrefix}…</code></td>
                      <td style={S.td}><span style={{ color: '#64748b', fontSize: 11 }}>{(k.scopes || []).join(', ')}</span></td>
                      <td style={S.td}><span style={{ color: '#64748b', fontSize: 12 }}>{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Never'}</span></td>
                      <td style={S.td}><span style={{ color: '#64748b', fontSize: 12 }}>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '—'}</span></td>
                      <td style={S.td}>
                        <button onClick={() => {
                          if (window.confirm('Revoke this API key?'))
                            doAction(() => revokeApiKey(tenant.id, k.id), `revoke-${k.id}`);
                        }} style={S.btn('#ef4444', '#ef4444')}>Revoke</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── SETTINGS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'settings' && tenant.settings && (
        <TenantSettingsForm tenantId={tenant.id} settings={tenant.settings} onSave={load} />
      )}

      {/* ── HEALTH TAB ───────────────────────────────────────────────────────── */}
      {tab === 'health' && (
        <div>
          {health?.latest ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
                {[
                  ['Users', health.latest.userCount],
                  ['Applications', health.latest.appCount],
                  ['Risk Events', health.latest.riskEventCount],
                  ['API Calls', health.latest.apiCallCount],
                  ['Audit Logs', health.latest.auditLogCount],
                  ['Discovery Jobs', health.latest.discoveryJobCount],
                  ['Errors', health.latest.errorCount],
                  ['Avg Risk Score', health.latest.avgRiskScore?.toFixed(1) || '0.0'],
                ].map(([label, value]) => (
                  <div key={label} style={{ ...S.card, marginBottom: 0 }}>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', marginBottom: 6 }}>
                      {String(label).toUpperCase()}
                    </div>
                    <div style={{ color: '#e2e8f0', fontSize: 26, fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={S.card}>
                <div style={S.sectionTitle}>Health History (Last 24 Records)</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                    <thead>
                      <tr>
                        {['RECORDED AT', 'STATUS', 'USERS', 'APPS', 'RISK EVENTS', 'ERRORS'].map(h => (
                          <th key={h} style={S.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(health.history || []).map((m: any) => (
                        <tr key={m.id}>
                          <td style={S.td}><span style={{ fontSize: 12, color: '#64748b' }}>{new Date(m.recordedAt).toLocaleString()}</span></td>
                          <td style={S.td}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: m.status === 'healthy' ? '#22c55e' : '#ef4444' }}>
                              {m.status}
                            </span>
                          </td>
                          <td style={S.td}>{m.userCount}</td>
                          <td style={S.td}>{m.appCount}</td>
                          <td style={S.td}>{m.riskEventCount}</td>
                          <td style={S.td}><span style={{ color: m.errorCount > 0 ? '#ef4444' : '#64748b' }}>{m.errorCount}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 24px', background: '#13151f', border: '1px dashed #1e2030', borderRadius: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
              <div style={{ color: '#94a3b8', fontWeight: 600 }}>No health metrics yet</div>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>
                Health metrics are collected automatically once the tenant is active
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TenantSettingsForm({ tenantId, settings, onSave }: { tenantId: string; settings: any; onSave: () => void }) {
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateTenantSettings(tenantId, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSave();
    } finally { setSaving(false); }
  };

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #2d3147',
    background: '#0f1117', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };

  const FRAMEWORKS = ['soc2', 'iso27001', 'nist', 'hipaa', 'gdpr', 'pci-dss'];

  return (
    <div>
      {[
        {
          title: 'Identity Provider',
          fields: [
            { label: 'IDP TYPE', key: 'idpType', type: 'select', opts: ['none', 'google', 'azure', 'okta', 'saml'] },
            { label: 'IDP DOMAIN', key: 'idpDomain', type: 'text', placeholder: 'company.com' },
            { label: 'IDP CLIENT ID', key: 'idpClientId', type: 'text', placeholder: 'client-id' },
            { label: 'ENFORCE SSO', key: 'ssoEnforced', type: 'toggle' },
          ],
        },
        {
          title: 'Risk Configuration',
          fields: [
            { label: 'RISK SCORE THRESHOLD', key: 'riskScoreThreshold', type: 'number', min: 0, max: 100 },
            { label: 'AUTO REMEDIATION', key: 'riskAutoRemediation', type: 'toggle' },
          ],
        },
        {
          title: 'Discovery',
          fields: [
            { label: 'DISCOVERY ENABLED', key: 'discoveryEnabled', type: 'toggle' },
            { label: 'DISCOVERY SCHEDULE (cron)', key: 'discoverySchedule', type: 'text', placeholder: '0 2 * * *' },
          ],
        },
        {
          title: 'Features',
          fields: [
            { label: 'ITDR ENABLED', key: 'itdrEnabled', type: 'toggle' },
            { label: 'IDENTITY GRAPH', key: 'graphEnabled', type: 'toggle' },
            { label: 'AI INSIGHTS', key: 'aiInsightsEnabled', type: 'toggle' },
          ],
        },
      ].map(section => (
        <div key={section.title} style={{ background: '#13151f', border: '1px solid #1e2030', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
          <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
            {section.title}
          </div>
          {section.fields.map((f: any) => (
            <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1e2030' }}>
              <label style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em' }}>{f.label}</label>
              {f.type === 'toggle' ? (
                <button type="button" onClick={() => set(f.key, !form[f.key])} style={{
                  width: 44, height: 24, borderRadius: 100, border: 'none', cursor: 'pointer', position: 'relative',
                  background: form[f.key] ? '#6366f1' : '#374151', transition: 'background 0.2s',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: form[f.key] ? 22 : 2, width: 20, height: 20,
                    borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                  }} />
                </button>
              ) : f.type === 'select' ? (
                <select value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                  style={{ ...inputSt, width: 'auto', minWidth: 160 }}>
                  {f.opts.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={f.type || 'text'}
                  value={form[f.key] || ''} onChange={e => set(f.key, f.type === 'number' ? parseInt(e.target.value) : e.target.value)}
                  placeholder={f.placeholder} min={f.min} max={f.max}
                  style={{ ...inputSt, width: 'auto', minWidth: 200 }}
                />
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Frameworks */}
      <div style={{ background: '#13151f', border: '1px solid #1e2030', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
        <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
          Compliance Frameworks
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FRAMEWORKS.map(fw => {
            const active = (form.frameworks || []).includes(fw);
            return (
              <button key={fw} type="button" onClick={() => set('frameworks', active ? form.frameworks.filter((f: string) => f !== fw) : [...(form.frameworks || []), fw])}
                style={{
                  padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12,
                  border: `2px solid ${active ? '#6366f1' : '#1e2030'}`,
                  background: active ? 'rgba(99,102,241,0.1)' : '#0f1117',
                  color: active ? '#818cf8' : '#64748b', textTransform: 'uppercase',
                }}>{fw}</button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={handleSave} disabled={saving} style={{
          padding: '10px 24px', borderRadius: 8, border: 'none',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontSize: 14,
          fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
        }}>
          {saving ? 'Saving…' : '✓ Save Settings'}
        </button>
        {saved && <span style={{ color: '#22c55e', fontSize: 13 }}>✓ Settings saved</span>}
      </div>
    </div>
  );
}
