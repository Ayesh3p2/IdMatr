'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  getAllSettings, updateSettings, getSettingsApiKeys,
  createSettingsApiKey, revokeSettingsApiKey, rotateSettingsApiKey,
  getSettingsIntegrations, updateSettingsIntegration,
} from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = 'general' | 'idp' | 'security' | 'risk' | 'notifications' | 'api';

interface ApiKey {
  id: string; name: string; keyPrefix: string; keyDisplay: string;
  scopes: string[]; isActive: boolean; expiresAt: string | null;
  lastUsedAt: string | null; createdAt: string;
}

interface Integration {
  provider: string; enabled: boolean; configured: boolean;
  status: string; lastSyncAt: string | null;
}

// ── Defaults (used while loading or on error) ─────────────────────────────────
const D_GENERAL = { orgName: '', adminEmail: '', timezone: 'UTC', sessionTimeoutMinutes: 60, demoMode: false, autoDiscovery: true, aiRiskAnalysis: true, realtimeAlerts: true, auditEverything: false, maintenanceMode: false };
const D_SECURITY = { mfaForAll: false, mfaForPrivileged: true, ssoRequired: false, passwordlessAuth: false, ipAllowlist: false, maxRolesPerUser: 10, accessReviewFrequencyDays: 90, orphanedAccountGracePeriodDays: 30, privilegedSessionDurationHours: 8, failedLoginLockoutThreshold: 5 };
const D_RISK = { criticalThreshold: 80, highThreshold: 60, mediumThreshold: 40, lowThreshold: 20, autoDisableAboveCritical: false, autoRevokeOrphanedDays: 90, autoEscalateToSiem: false, triggerReviewOnRiskIncrease: true, autoBlockImpossibleTravel: false };
const D_NOTIF = { smtpHost: '', smtpPort: 587, smtpUsername: '', smtpPasswordSet: false, fromAddress: '', slackWebhookUrl: '', alertRules: { criticalThreat: { email: true, slack: true }, highRiskIdentity: { email: true, slack: false }, shadowItApp: { email: true, slack: false }, certificationDue: { email: true, slack: false }, approvalPending: { email: true, slack: false }, weeklyDigest: { email: false, slack: false } } };

// ── Helper components ─────────────────────────────────────────────────────────
function ToggleSwitch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer', background: on ? 'rgba(99,102,241,0.7)' : 'rgba(100,116,139,0.3)', position: 'relative', transition: 'background 0.2s', flexShrink: 0, boxShadow: on ? '0 0 10px rgba(99,102,241,0.4)' : 'none' }}>
      <div style={{ position: 'absolute', top: '3px', left: on ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
    </button>
  );
}

function FieldInput({ label, value, onChange, type = 'text', opts }: { label: string; value: string | number; onChange: (v: any) => void; type?: string; opts?: string[] }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {opts ? (
        <select value={String(value)} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: '#e2e8f0', fontSize: '13px' }}>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={type === 'password' ? '' : String(value)} placeholder={type === 'password' ? (value ? '••••••••' : 'Not set') : ''} onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: '#e2e8f0', fontSize: '13px', boxSizing: 'border-box' }} />
      )}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="stat-card" style={{ padding: '24px' }}>
      <div style={{ fontSize: '15px', fontWeight: '700', color: '#e2e8f0', marginBottom: '20px' }}>{title}</div>
      {children}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
      {[0, 1].map(i => (
        <div key={i} className="stat-card" style={{ padding: '24px', minHeight: '320px' }}>
          <div style={{ height: '18px', width: '40%', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', marginBottom: '24px', animation: 'pulse 1.5s infinite' }} />
          {[0, 1, 2, 3].map(j => (
            <div key={j} style={{ height: '48px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', marginBottom: '12px', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ── Integration provider metadata ─────────────────────────────────────────────
const IDP_META: Record<string, { label: string; icon: string; color: string }> = {
  GOOGLE_WORKSPACE: { label: 'Google Workspace',           icon: '◉', color: '#4285f4' },
  MICROSOFT_365:    { label: 'Microsoft 365 / Entra ID',  icon: '⬡', color: '#0078d4' },
  OKTA:             { label: 'Okta',                       icon: '◈', color: '#007dc1' },
  GITHUB:           { label: 'GitHub',                     icon: '⬡', color: '#6e40c9' },
  GITHUB_ENTERPRISE:{ label: 'GitHub Enterprise',          icon: '⬡', color: '#6e40c9' },
  SLACK:            { label: 'Slack',                      icon: '◉', color: '#4a154b' },
  AZURE_AD:         { label: 'Azure Active Directory',     icon: '⬡', color: '#0078d4' },
  AWS_IAM:          { label: 'AWS IAM',                    icon: '◈', color: '#ff9900' },
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Settings state per section
  const [general, setGeneral] = useState({ ...D_GENERAL });
  const [security, setSecurity] = useState({ ...D_SECURITY });
  const [risk, setRisk] = useState({ ...D_RISK });
  const [notifications, setNotifications] = useState<any>({ ...D_NOTIF });
  const [smtpPassword, setSmtpPassword] = useState(''); // separate — never round-trips
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null); // shown once after creation
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState('read:identities');
  const [keyActionMsg, setKeyActionMsg] = useState<string | null>(null);

  // Load all settings on mount
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [allSettings, keys, idps] = await Promise.all([
        getAllSettings(),
        getSettingsApiKeys(),
        getSettingsIntegrations(),
      ]);
      setGeneral({ ...D_GENERAL, ...(allSettings.general || {}) });
      setSecurity({ ...D_SECURITY, ...(allSettings.security || {}) });
      setRisk({ ...D_RISK, ...(allSettings.risk || {}) });
      setNotifications({ ...D_NOTIF, ...(allSettings.notifications || {}), smtpPassword: undefined });
      setApiKeys(Array.isArray(keys) ? keys : []);
      setIntegrations(Array.isArray(idps) ? idps : []);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  // Per-tab save
  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      if (tab === 'general')       await updateSettings('general', general);
      if (tab === 'security')      await updateSettings('security', security);
      if (tab === 'risk')          await updateSettings('risk', risk);
      if (tab === 'notifications') {
        const payload = { ...notifications };
        if (smtpPassword) payload.smtpPassword = smtpPassword;
        await updateSettings('notifications', payload);
        setSmtpPassword('');
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general',       label: 'General' },
    { id: 'idp',           label: 'Identity Providers' },
    { id: 'security',      label: 'Security Policies' },
    { id: 'risk',          label: 'Risk Thresholds' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'api',           label: 'API Keys' },
  ];
  const readOnlyTab = tab === 'idp' || tab === 'api';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.02em', margin: 0 }}>Platform Settings</h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '6px 0 0' }}>Configure identity providers, security policies, risk thresholds, and integrations</p>
        </div>
        {!readOnlyTab && (
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading} style={{ fontSize: '13px', minWidth: '130px' }}>
            {saving ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? '✕ Error' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Load error banner */}
      {loadError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#f87171', fontSize: '13px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span>⚠</span> {loadError}
          <button onClick={loadSettings} style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px' }}>Retry</button>
        </div>
      )}

      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: tab === t.id ? 'rgba(99,102,241,0.2)' : 'transparent', color: tab === t.id ? '#a5b4fc' : '#64748b', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && <Skeleton />}

      {/* ── General ─────────────────────────────────────────────────────────── */}
      {!loading && tab === 'general' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <SectionCard title="Organization">
            <FieldInput label="Organization Name" value={general.orgName} onChange={v => setGeneral(g => ({ ...g, orgName: v }))} />
            <FieldInput label="Admin Email" value={general.adminEmail} onChange={v => setGeneral(g => ({ ...g, adminEmail: v }))} type="email" />
            <FieldInput label="Time Zone" value={general.timezone} onChange={v => setGeneral(g => ({ ...g, timezone: v }))} opts={['UTC', 'US/Eastern', 'US/Pacific', 'Europe/London', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney']} />
            <FieldInput label="Session Timeout (minutes)" value={general.sessionTimeoutMinutes} onChange={v => setGeneral(g => ({ ...g, sessionTimeoutMinutes: Number(v) }))} type="number" />
          </SectionCard>
          <SectionCard title="Platform Mode">
            {([
              { key: 'demoMode',         label: 'Demo Mode',          desc: 'Use realistic mock data when no real data exists' },
              { key: 'autoDiscovery',    label: 'Auto-Discovery',      desc: 'Automatically scan for new applications weekly' },
              { key: 'aiRiskAnalysis',   label: 'AI Risk Analysis',    desc: 'Enable machine learning risk scoring' },
              { key: 'realtimeAlerts',   label: 'Real-time Alerts',    desc: 'Push critical threat alerts to dashboard' },
              { key: 'auditEverything',  label: 'Audit Everything',    desc: 'Log all read operations (high volume)' },
              { key: 'maintenanceMode',  label: 'Maintenance Mode',    desc: 'Disable external access for maintenance' },
            ] as const).map(({ key, label, desc }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{desc}</div>
                </div>
                <ToggleSwitch on={!!(general as any)[key]} onChange={v => setGeneral(g => ({ ...g, [key]: v }))} />
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {/* ── Identity Providers ──────────────────────────────────────────────── */}
      {!loading && tab === 'idp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {integrations.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#64748b', fontSize: '14px' }}>
              No integration data available. Configure integrations via the API.
            </div>
          )}
          {integrations.map(idp => {
            const meta = IDP_META[idp.provider] || { label: idp.provider, icon: '◈', color: '#475569' };
            return (
              <div key={idp.provider} className="stat-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: meta.color + '22', border: `1px solid ${meta.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#e2e8f0' }}>{meta.label}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                    {idp.lastSyncAt ? `Last synced: ${new Date(idp.lastSyncAt).toLocaleDateString()}` : idp.configured ? 'Configured, not yet synced' : 'Not configured — click Configure to set up'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {idp.enabled && <span style={{ fontSize: '11px', color: '#4ade80', background: 'rgba(34,197,94,0.1)', padding: '3px 10px', borderRadius: '12px', fontWeight: '600' }}>CONNECTED</span>}
                  {idp.status === 'ERROR' && <span style={{ fontSize: '11px', color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '3px 10px', borderRadius: '12px', fontWeight: '600' }}>ERROR</span>}
                  <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '7px 16px' }}>
                    {idp.enabled ? 'Manage' : 'Configure'}
                  </button>
                  {idp.enabled && (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', padding: '7px 16px' }}
                      onClick={() => updateSettingsIntegration(idp.provider, { enabled: !idp.enabled }).then(loadSettings)}
                    >
                      Disable
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Security Policies ───────────────────────────────────────────────── */}
      {!loading && tab === 'security' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <SectionCard title="Authentication Policies">
            {([
              { key: 'mfaForAll',       label: 'Require MFA for all users',   desc: 'Enforce multi-factor authentication' },
              { key: 'mfaForPrivileged',label: 'Require MFA for privileged',   desc: 'Admin and privileged accounts only' },
              { key: 'ssoRequired',     label: 'SSO Required',                 desc: 'Block local password authentication' },
              { key: 'passwordlessAuth',label: 'Passwordless Auth',            desc: 'Enable FIDO2/passkey authentication' },
              { key: 'ipAllowlist',     label: 'IP Allowlist',                 desc: 'Restrict login to approved IP ranges' },
            ] as const).map(({ key, label, desc }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{desc}</div>
                </div>
                <ToggleSwitch on={!!(security as any)[key]} onChange={v => setSecurity(s => ({ ...s, [key]: v }))} />
              </div>
            ))}
          </SectionCard>
          <SectionCard title="Access Control">
            {([
              { key: 'maxRolesPerUser',                  label: 'Max Roles per User' },
              { key: 'accessReviewFrequencyDays',        label: 'Access Review Frequency (days)' },
              { key: 'orphanedAccountGracePeriodDays',   label: 'Orphaned Account Grace Period (days)' },
              { key: 'privilegedSessionDurationHours',   label: 'Privileged Session Duration (hours)' },
              { key: 'failedLoginLockoutThreshold',      label: 'Failed Login Lockout Threshold' },
            ] as const).map(({ key, label }) => (
              <div key={key} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
                <input type="number" value={(security as any)[key]} onChange={e => setSecurity(s => ({ ...s, [key]: Number(e.target.value) }))} style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: '#e2e8f0', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {/* ── Risk Thresholds ─────────────────────────────────────────────────── */}
      {!loading && tab === 'risk' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <SectionCard title="Risk Score Thresholds">
            {([
              { key: 'criticalThreshold', label: 'Critical Risk Threshold', color: '#ef4444' },
              { key: 'highThreshold',     label: 'High Risk Threshold',     color: '#f97316' },
              { key: 'mediumThreshold',   label: 'Medium Risk Threshold',   color: '#fbbf24' },
              { key: 'lowThreshold',      label: 'Low Risk Threshold',      color: '#4ade80' },
            ] as const).map(({ key, label, color }) => (
              <div key={key} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <span>{label}</span>
                  <span style={{ color }}>{(risk as any)[key]}/100</span>
                </label>
                <input type="range" min="0" max="100" value={(risk as any)[key]} onChange={e => setRisk(r => ({ ...r, [key]: Number(e.target.value) }))} style={{ width: '100%', accentColor: color }} />
              </div>
            ))}
          </SectionCard>
          <SectionCard title="Automated Response">
            {([
              { key: 'autoDisableAboveCritical',    label: 'Auto-disable accounts above critical threshold' },
              { key: 'autoEscalateToSiem',          label: 'Auto-escalate privilege violations to SIEM' },
              { key: 'triggerReviewOnRiskIncrease', label: 'Trigger access review when risk increases >20pts' },
              { key: 'autoBlockImpossibleTravel',   label: 'Auto-block impossible travel logins' },
            ] as const).map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '13px', color: '#cbd5e1', paddingRight: '16px' }}>{label}</div>
                <ToggleSwitch on={!!(risk as any)[key]} onChange={v => setRisk(r => ({ ...r, [key]: v }))} />
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {/* ── Notifications ───────────────────────────────────────────────────── */}
      {!loading && tab === 'notifications' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <SectionCard title="Email Configuration">
            <FieldInput label="SMTP Host" value={notifications.smtpHost || ''} onChange={v => setNotifications((n: any) => ({ ...n, smtpHost: v }))} />
            <FieldInput label="SMTP Port" value={notifications.smtpPort || 587} onChange={v => setNotifications((n: any) => ({ ...n, smtpPort: Number(v) }))} type="number" />
            <FieldInput label="SMTP Username" value={notifications.smtpUsername || ''} onChange={v => setNotifications((n: any) => ({ ...n, smtpUsername: v }))} />
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SMTP Password</label>
              <input type="password" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} placeholder={notifications.smtpPasswordSet ? '••••••••  (leave blank to keep current)' : 'Enter SMTP password'} style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: '#e2e8f0', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <FieldInput label="From Address" value={notifications.fromAddress || ''} onChange={v => setNotifications((n: any) => ({ ...n, fromAddress: v }))} type="email" />
            <FieldInput label="Slack Webhook URL" value={notifications.slackWebhookUrl || ''} onChange={v => setNotifications((n: any) => ({ ...n, slackWebhookUrl: v }))} />
          </SectionCard>
          <SectionCard title="Alert Rules">
            {([
              { key: 'criticalThreat',   label: 'Critical threat detected',    channels: 'Email + Slack' },
              { key: 'highRiskIdentity', label: 'High-risk identity found',     channels: 'Email' },
              { key: 'shadowItApp',      label: 'Shadow IT app discovered',     channels: 'Email' },
              { key: 'certificationDue', label: 'Access certification due',     channels: 'Email' },
              { key: 'approvalPending',  label: 'Approval workflow pending',    channels: 'Email' },
              { key: 'weeklyDigest',     label: 'Weekly security digest',       channels: 'Email' },
            ] as const).map(({ key, label, channels }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{channels}</div>
                </div>
                <ToggleSwitch
                  on={!!(notifications?.alertRules?.[key]?.email)}
                  onChange={v => setNotifications((n: any) => ({ ...n, alertRules: { ...n.alertRules, [key]: { ...n.alertRules?.[key], email: v } } }))}
                />
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {/* ── API Keys ────────────────────────────────────────────────────────── */}
      {!loading && tab === 'api' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* New key revealed once */}
          {newKeyRaw && (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '16px 20px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#10b981', marginBottom: '8px' }}>✓ API Key Created — Copy it now, it won't be shown again</div>
              <code style={{ display: 'block', fontSize: '13px', color: '#a5b4fc', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: '6px', wordBreak: 'break-all', marginBottom: '10px' }}>{newKeyRaw}</code>
              <button onClick={() => setNewKeyRaw(null)} style={{ background: 'transparent', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontSize: '12px' }}>Dismiss</button>
            </div>
          )}

          {/* Key action feedback */}
          {keyActionMsg && (
            <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', color: '#a5b4fc' }}>{keyActionMsg}</div>
          )}

          <div className="stat-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#e2e8f0' }}>API Keys</div>
              <button className="btn btn-primary" style={{ fontSize: '12px', padding: '8px 16px' }} onClick={() => setShowNewKeyForm(v => !v)}>
                {showNewKeyForm ? '✕ Cancel' : '+ Generate New Key'}
              </button>
            </div>

            {/* New key form */}
            {showNewKeyForm && (
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 2 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Key Name</label>
                    <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="e.g. Production SIEM" style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e2e8f0', fontSize: '13px', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Scopes (comma-separated)</label>
                    <input value={newKeyScopes} onChange={e => setNewKeyScopes(e.target.value)} placeholder="read:identities, read:risk" style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#e2e8f0', fontSize: '13px', boxSizing: 'border-box' }} />
                  </div>
                  <button className="btn btn-primary" style={{ fontSize: '12px', padding: '8px 18px', flexShrink: 0, marginBottom: '1px' }} onClick={async () => {
                    if (!newKeyName.trim()) return;
                    const scopes = newKeyScopes.split(',').map(s => s.trim()).filter(Boolean);
                    try {
                      const result = await createSettingsApiKey(newKeyName, scopes);
                      setNewKeyRaw(result.key);
                      setNewKeyName('');
                      setNewKeyScopes('read:identities');
                      setShowNewKeyForm(false);
                      const keys = await getSettingsApiKeys();
                      setApiKeys(Array.isArray(keys) ? keys : []);
                    } catch (err: any) {
                      setKeyActionMsg(`Error: ${err?.message}`);
                      setTimeout(() => setKeyActionMsg(null), 4000);
                    }
                  }}>Create</button>
                </div>
              </div>
            )}

            {/* Key list */}
            {apiKeys.length === 0 && !showNewKeyForm && (
              <div style={{ textAlign: 'center', padding: '32px', color: '#64748b', fontSize: '13px' }}>No API keys yet. Generate one to integrate external systems.</div>
            )}
            {apiKeys.map(key => (
              <div key={key.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '8px', border: `1px solid ${key.isActive ? 'rgba(255,255,255,0.04)' : 'rgba(100,116,139,0.2)'}`, opacity: key.isActive ? 1 : 0.6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{key.name}</span>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: '600', background: key.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)', color: key.isActive ? '#4ade80' : '#64748b' }}>{key.isActive ? 'ACTIVE' : 'REVOKED'}</span>
                  </div>
                  <code style={{ display: 'block', fontSize: '12px', color: '#6366f1', fontFamily: 'monospace', margin: '4px 0' }}>{key.keyDisplay}</code>
                  <div style={{ fontSize: '11px', color: '#475569' }}>
                    Scopes: {key.scopes.join(', ')} · Created: {new Date(key.createdAt).toLocaleDateString()} · Last used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                  </div>
                </div>
                {key.isActive && (
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                    <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '6px 12px' }} onClick={async () => {
                      try {
                        const r = await rotateSettingsApiKey(key.id);
                        setNewKeyRaw(r.key);
                        const keys = await getSettingsApiKeys();
                        setApiKeys(Array.isArray(keys) ? keys : []);
                        setKeyActionMsg('Key rotated. Old key has been revoked.');
                        setTimeout(() => setKeyActionMsg(null), 4000);
                      } catch (err: any) { setKeyActionMsg(`Error: ${err?.message}`); setTimeout(() => setKeyActionMsg(null), 4000); }
                    }}>Rotate</button>
                    <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '6px 12px', color: '#f87171' }} onClick={async () => {
                      if (!confirm(`Revoke key "${key.name}"? This cannot be undone.`)) return;
                      try {
                        await revokeSettingsApiKey(key.id);
                        const keys = await getSettingsApiKeys();
                        setApiKeys(Array.isArray(keys) ? keys : []);
                        setKeyActionMsg(`Key "${key.name}" revoked.`);
                        setTimeout(() => setKeyActionMsg(null), 4000);
                      } catch (err: any) { setKeyActionMsg(`Error: ${err?.message}`); setTimeout(() => setKeyActionMsg(null), 4000); }
                    }}>Revoke</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
