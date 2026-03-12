'use client';
import { useState } from 'react';

type Tab = 'general' | 'idp' | 'security' | 'risk' | 'notifications' | 'api';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general',       label: 'General' },
    { id: 'idp',           label: 'Identity Providers' },
    { id: 'security',      label: 'Security Policies' },
    { id: 'risk',          label: 'Risk Thresholds' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'api',           label: 'API Keys' },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.02em', margin: 0 }}>
            Platform Settings
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '6px 0 0' }}>
            Configure identity providers, security policies, risk thresholds, and integrations
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          style={{ fontSize: '13px', minWidth: '120px' }}
        >
          {saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Tab Nav */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
            background: tab === t.id ? 'rgba(99,102,241,0.2)' : 'transparent',
            color: tab === t.id ? '#a5b4fc' : '#64748b',
            transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {tab === 'general' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="stat-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#e2e8f0', marginBottom: '20px' }}>Organization</div>
            {[
              { label: 'Organization Name', value: 'Acme Corporation', type: 'text' },
              { label: 'Admin Email', value: 'admin@idmatr.com', type: 'email' },
              { label: 'Time Zone', value: 'UTC', type: 'select', opts: ['UTC', 'US/Eastern', 'US/Pacific', 'Europe/London', 'Asia/Tokyo'] },
              { label: 'Session Timeout (minutes)', value: '60', type: 'number' },
            ].map(field => (
              <div key={field.label} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{field.label}</label>
                {field.type === 'select' ? (
                  <select defaultValue={field.value} style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: '#e2e8f0', fontSize: '13px' }}>
                    {field.opts?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={field.type} defaultValue={field.value} style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: '#e2e8f0', fontSize: '13px', boxSizing: 'border-box' }} />
                )}
              </div>
            ))}
          </div>
          <div className="stat-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#e2e8f0', marginBottom: '20px' }}>Platform Mode</div>
            {[
              { label: 'Demo Mode', desc: 'Use realistic mock data when no real data exists', enabled: true },
              { label: 'Auto-Discovery', desc: 'Automatically scan for new applications weekly', enabled: true },
              { label: 'AI Risk Analysis', desc: 'Enable machine learning risk scoring', enabled: true },
              { label: 'Real-time Alerts', desc: 'Push critical threat alerts to dashboard', enabled: true },
              { label: 'Audit Everything', desc: 'Log all read operations (high volume)', enabled: false },
              { label: 'Maintenance Mode', desc: 'Disable external access for maintenance', enabled: false },
            ].map(toggle => (
              <div key={toggle.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{toggle.label}</div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{toggle.desc}</div>
                </div>
                <ToggleSwitch defaultOn={toggle.enabled} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Identity Providers */}
      {tab === 'idp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            { name: 'Microsoft Azure AD / Entra ID', icon: '⬡', color: '#0078d4', connected: true, users: 12840, apps: 187 },
            { name: 'Google Workspace', icon: '◉', color: '#4285f4', connected: false, users: 0, apps: 0 },
            { name: 'Okta', icon: '◈', color: '#007dc1', connected: false, users: 0, apps: 0 },
            { name: 'GitHub Enterprise', icon: '⬡', color: '#6e40c9', connected: true, users: 247, apps: 34 },
            { name: 'Slack', icon: '◉', color: '#4a154b', connected: true, users: 1840, apps: 1 },
            { name: 'LDAP / Active Directory', icon: '◈', color: '#475569', connected: false, users: 0, apps: 0 },
          ].map(idp => (
            <div key={idp.name} className="stat-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: idp.color + '22', border: `1px solid ${idp.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                {idp.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#e2e8f0' }}>{idp.name}</div>
                {idp.connected ? (
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                    {idp.users.toLocaleString()} users · {idp.apps} applications synced
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>Not connected — click Configure to set up</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {idp.connected && (
                  <span style={{ fontSize: '11px', color: '#4ade80', background: 'rgba(34,197,94,0.1)', padding: '3px 10px', borderRadius: '12px', fontWeight: '600' }}>CONNECTED</span>
                )}
                <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '7px 16px' }}>
                  {idp.connected ? 'Manage' : 'Configure'}
                </button>
                {idp.connected && (
                  <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '7px 16px' }}>
                    Sync Now
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Security Policies */}
      {tab === 'security' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="stat-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#e2e8f0', marginBottom: '20px' }}>Authentication Policies</div>
            {[
              { label: 'Require MFA for all users', desc: 'Enforce multi-factor authentication', enabled: true },
              { label: 'Require MFA for privileged', desc: 'Admin and privileged accounts only', enabled: true },
              { label: 'SSO Required', desc: 'Block local password authentication', enabled: false },
              { label: 'Passwordless Auth', desc: 'Enable FIDO2/passkey authentication', enabled: false },
              { label: 'IP Allowlist', desc: 'Restrict login to approved IP ranges', enabled: false },
            ].map(policy => (
              <div key={policy.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{policy.label}</div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{policy.desc}</div>
                </div>
                <ToggleSwitch defaultOn={policy.enabled} />
              </div>
            ))}
          </div>
          <div className="stat-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#e2e8f0', marginBottom: '20px' }}>Access Control</div>
            {[
              { label: 'Max Roles per User', value: '10' },
              { label: 'Access Review Frequency (days)', value: '90' },
              { label: 'Orphaned Account Grace Period (days)', value: '30' },
              { label: 'Privileged Session Duration (hours)', value: '8' },
              { label: 'Failed Login Lockout Threshold', value: '5' },
            ].map(field => (
              <div key={field.label} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{field.label}</label>
                <input type="number" defaultValue={field.value} style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: '#e2e8f0', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Thresholds */}
      {tab === 'risk' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="stat-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#e2e8f0', marginBottom: '20px' }}>Risk Score Thresholds</div>
            {[
              { label: 'Critical Risk Threshold', value: '80', color: '#ef4444' },
              { label: 'High Risk Threshold', value: '60', color: '#f97316' },
              { label: 'Medium Risk Threshold', value: '40', color: '#fbbf24' },
              { label: 'Low Risk Threshold', value: '20', color: '#4ade80' },
            ].map(t => (
              <div key={t.label} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <span>{t.label}</span>
                  <span style={{ color: t.color }}>{t.value}/100</span>
                </label>
                <input type="range" min="0" max="100" defaultValue={t.value} style={{ width: '100%', accentColor: t.color }} />
              </div>
            ))}
          </div>
          <div className="stat-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#e2e8f0', marginBottom: '20px' }}>Automated Response</div>
            {[
              { label: 'Auto-disable accounts above critical threshold', enabled: true },
              { label: 'Auto-revoke access for dormant accounts (90d)', enabled: true },
              { label: 'Auto-escalate privilege violations to SIEM', enabled: false },
              { label: 'Trigger access review when risk increases >20pts', enabled: true },
              { label: 'Auto-block impossible travel logins', enabled: false },
            ].map(policy => (
              <div key={policy.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ fontSize: '13px', color: '#cbd5e1', paddingRight: '16px' }}>{policy.label}</div>
                <ToggleSwitch defaultOn={policy.enabled} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications */}
      {tab === 'notifications' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="stat-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#e2e8f0', marginBottom: '20px' }}>Email Configuration</div>
            {[
              { label: 'SMTP Host', value: 'smtp.mailtrap.io', type: 'text' },
              { label: 'SMTP Port', value: '587', type: 'number' },
              { label: 'SMTP Username', value: '', type: 'text' },
              { label: 'SMTP Password', value: '', type: 'password' },
              { label: 'From Address', value: 'noreply@idmatr.com', type: 'email' },
            ].map(field => (
              <div key={field.label} style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{field.label}</label>
                <input type={field.type} defaultValue={field.value} placeholder={field.type === 'password' ? '••••••••' : ''} style={{ width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: '#e2e8f0', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
            ))}
            <button className="btn btn-secondary" style={{ fontSize: '12px', marginTop: '8px' }}>Test Connection</button>
          </div>
          <div className="stat-card" style={{ padding: '24px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#e2e8f0', marginBottom: '20px' }}>Alert Rules</div>
            {[
              { label: 'Critical threat detected', channel: 'Email + Slack', enabled: true },
              { label: 'High-risk identity found', channel: 'Email', enabled: true },
              { label: 'Shadow IT app discovered', channel: 'Email', enabled: true },
              { label: 'Access certification due', channel: 'Email', enabled: true },
              { label: 'Approval workflow pending', channel: 'Email', enabled: true },
              { label: 'Weekly security digest', channel: 'Email', enabled: false },
            ].map(rule => (
              <div key={rule.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{rule.label}</div>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{rule.channel}</div>
                </div>
                <ToggleSwitch defaultOn={rule.enabled} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Keys */}
      {tab === 'api' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="stat-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#e2e8f0' }}>API Keys</div>
              <button className="btn btn-primary" style={{ fontSize: '12px', padding: '8px 16px' }}>+ Generate New Key</button>
            </div>
            {[
              { name: 'Production Integration', key: 'idm_prod_••••••••••••••••3f9a', scopes: 'read:identities, read:risk', created: '2026-01-15', lastUsed: '2 hours ago', status: 'active' },
              { name: 'SIEM Integration (Splunk)', key: 'idm_siem_••••••••••••••••7b2c', scopes: 'read:audit, read:risk', created: '2026-02-01', lastUsed: '10 minutes ago', status: 'active' },
              { name: 'CI/CD Pipeline', key: 'idm_cicd_••••••••••••••••1d4e', scopes: 'read:compliance', created: '2026-02-20', lastUsed: '1 day ago', status: 'active' },
              { name: 'Legacy System (deprecated)', key: 'idm_lgcy_••••••••••••••••5a8f', scopes: 'read:identities', created: '2025-11-01', lastUsed: '45 days ago', status: 'inactive' },
            ].map(key => (
              <div key={key.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{key.name}</span>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', fontWeight: '600',
                      background: key.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
                      color: key.status === 'active' ? '#4ade80' : '#64748b',
                    }}>{key.status.toUpperCase()}</span>
                  </div>
                  <code style={{ display: 'block', fontSize: '12px', color: '#6366f1', fontFamily: 'monospace', margin: '4px 0' }}>{key.key}</code>
                  <div style={{ fontSize: '11px', color: '#475569' }}>
                    Scopes: {key.scopes} · Created: {key.created} · Last used: {key.lastUsed}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                  <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '6px 12px' }}>Rotate</button>
                  <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '6px 12px', color: '#f87171' }}>Revoke</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ defaultOn }: { defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      onClick={() => setOn(v => !v)}
      style={{
        width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer',
        background: on ? 'rgba(99,102,241,0.7)' : 'rgba(100,116,139,0.3)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        boxShadow: on ? '0 0 10px rgba(99,102,241,0.4)' : 'none',
      }}
    >
      <div style={{
        position: 'absolute', top: '3px', left: on ? '21px' : '3px',
        width: '16px', height: '16px', borderRadius: '50%',
        background: 'white', transition: 'left 0.2s',
      }} />
    </button>
  );
}
