'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  isOperatorAuthenticated, createTenant, SUPPORTED_FRAMEWORKS,
  FRAMEWORK_DESCRIPTIONS, CreateTenantResult,
} from '@/lib/operator-api';

// ── Wizard step definitions ────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Organization',  icon: '🏢', desc: 'Basic tenant information' },
  { id: 2, label: 'Compliance',    icon: '📋', desc: 'Required: select frameworks' },
  { id: 3, label: 'Administrator', icon: '👤', desc: 'Required: super-admin email' },
  { id: 4, label: 'Review',        icon: '✓',  desc: 'Confirm and create' },
];

const PLAN_OPTIONS = [
  { value: 'starter',    label: 'Starter',    desc: 'Up to 100 identities, basic discovery' },
  { value: 'pro',        label: 'Pro',         desc: 'Up to 1,000 identities, advanced risk' },
  { value: 'enterprise', label: 'Enterprise',  desc: 'Unlimited identities, full platform' },
];

const REGION_OPTIONS = [
  { value: 'us-east-1',    label: 'US East (N. Virginia)' },
  { value: 'us-west-2',    label: 'US West (Oregon)' },
  { value: 'eu-west-1',    label: 'EU West (Ireland)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
];

// ── Shared input styles ────────────────────────────────────────────────────────
const INP: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#0F1629',
  border: '1px solid #1E3A5F', borderRadius: '8px', color: '#FFF',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box',
};
const INP_ERR: React.CSSProperties = { ...INP, border: '1px solid rgba(239,68,68,0.6)' };
const LBL: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px',
};
const ERR: React.CSSProperties = {
  fontSize: '11px', color: '#ef4444', marginTop: '4px',
};

export default function NewTenantWizard() {
  const [step, setStep]           = useState(1);
  const [submitting, setSubmit]   = useState(false);
  const [result, setResult]       = useState<CreateTenantResult | null>(null);
  const [apiError, setApiError]   = useState('');

  // Step 1 — Organization
  const [name, setName]       = useState('');
  const [domain, setDomain]   = useState('');
  const [plan, setPlan]       = useState('enterprise');
  const [region, setRegion]   = useState('us-east-1');
  const [nameErr, setNameErr] = useState('');

  // Step 2 — Compliance
  const [frameworks, setFw]   = useState<string[]>([]);
  const [fwErr, setFwErr]     = useState('');

  // Step 3 — Admin
  const [email, setEmail]     = useState('');
  const [emailErr, setEmlErr] = useState('');

  useEffect(() => {
    if (!isOperatorAuthenticated()) {
      window.location.href = '/operator/login';
    }
  }, []);

  // ── Validation per step ────────────────────────────────────────────────────
  function validateStep1(): boolean {
    if (!name.trim()) { setNameErr('Tenant name is required'); return false; }
    if (name.trim().length < 2) { setNameErr('Name must be at least 2 characters'); return false; }
    setNameErr('');
    return true;
  }

  function validateStep2(): boolean {
    if (frameworks.length === 0) {
      setFwErr('Select at least one compliance framework to continue');
      return false;
    }
    setFwErr('');
    return true;
  }

  function validateStep3(): boolean {
    if (!email.trim()) { setEmlErr('Admin email is required'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmlErr('Enter a valid email address');
      return false;
    }
    setEmlErr('');
    return true;
  }

  function nextStep() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    setStep(s => Math.min(s + 1, 4));
  }

  function toggleFw(fw: string) {
    setFwErr('');
    setFw(prev => prev.includes(fw) ? prev.filter(f => f !== fw) : [...prev, fw]);
  }

  async function handleCreate() {
    if (!validateStep1() || !validateStep2() || !validateStep3()) return;
    setSubmit(true);
    setApiError('');
    try {
      const res = await createTenant({
        name: name.trim(),
        adminEmail: email.trim().toLowerCase(),
        frameworks,
        domain: domain.trim() || undefined,
        plan,
        region,
      });
      setResult(res);
    } catch (e: any) {
      setApiError(e.message || 'Failed to create tenant');
    } finally {
      setSubmit(false);
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (result) {
    return (
      <div style={{ minHeight: '100vh', background: '#060b16', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: '600px', width: '90%', padding: '20px' }}>
          <div style={{ background: '#0d1424', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '12px', padding: '40px' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '52px', marginBottom: '12px' }}>🎉</div>
              <h2 style={{ color: '#10b981', margin: '0 0 8px', fontSize: '22px', fontWeight: 700 }}>Tenant Created Successfully</h2>
              <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>Onboarding email sent to the super-admin.</p>
            </div>

            {/* Tenant details */}
            <div style={{ background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {[
                  ['Tenant Name', result.name],
                  ['Slug', result.slug],
                  ['Plan', result.plan?.toUpperCase()],
                  ['Status', result.status],
                  ['Region', result.region],
                  ['ID', result.id?.slice(0, 16) + '…'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>{label}</div>
                    <div style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 600 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Credentials */}
            {result.adminCreated && result.onboardingUrl && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
                  🔐 Onboarding Link — Share Securely
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>Admin Email</div>
                  <div style={{ fontSize: '14px', color: '#f1f5f9', fontFamily: 'monospace' }}>{result.adminEmail}</div>
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '3px' }}>One-time Onboarding Link</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#fbbf24', background: 'rgba(245,158,11,0.1)', padding: '10px 16px', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.3)', wordBreak: 'break-all' }}>
                    {result.onboardingUrl}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
                  ⚠️ This link expires in 15 minutes and is invalid after first use.
                </div>
              </div>
            )}

            {/* Frameworks */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Compliance Frameworks</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {result.settings?.frameworks?.map(f => (
                  <span key={f} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: '20px', padding: '3px 12px', fontSize: '12px', fontWeight: 700 }}>{f}</span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Link href="/operator" style={{ background: '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}>
                ← Back to Dashboard
              </Link>
              <button onClick={() => { setResult(null); setStep(1); setName(''); setDomain(''); setFw([]); setEmail(''); }}
                style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#94a3b8', borderRadius: '8px', padding: '11px 24px', fontSize: '14px', cursor: 'pointer' }}>
                Create Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Wizard UI ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#060b16', fontFamily: 'system-ui, sans-serif', color: '#e2e8f0' }}>
      {/* Top bar */}
      <div style={{ background: '#0a1225', borderBottom: '1px solid #1e3a5f', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <img src="/logo-teal.svg" alt="IDMatr" style={{ height: '34px' }} />
        <div style={{ height: '18px', width: '1px', background: '#1e3a5f' }} />
        <Link href="/operator" style={{ color: '#475569', fontSize: '13px', textDecoration: 'none' }}>← Dashboard</Link>
        <span style={{ color: '#1e3a5f' }}>/</span>
        <span style={{ color: '#f1f5f9', fontSize: '13px', fontWeight: 600 }}>New Tenant Onboarding</span>
      </div>

      <div style={{ maxWidth: '780px', margin: '40px auto', padding: '0 24px' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
          {STEPS.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700,
                    background: done ? '#0d9488' : active ? '#1e3a5f' : 'transparent',
                    border: done ? '2px solid #0d9488' : active ? '2px solid #0d9488' : '2px solid #1e3a5f',
                    color: done ? '#fff' : active ? '#0d9488' : '#334155',
                    transition: 'all 0.2s',
                  }}>
                    {done ? '✓' : s.icon}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: active ? 700 : 400, color: active ? '#0d9488' : done ? '#10b981' : '#475569', marginTop: '5px', textAlign: 'center' }}>{s.label}</div>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: '2px', background: done ? '#0d9488' : '#1e3a5f', margin: '0 4px', marginBottom: '18px', transition: 'background 0.2s' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content card */}
        <div style={{ background: '#0d1424', border: '1px solid #1e3a5f', borderRadius: '12px', padding: '36px' }}>

          {/* ── STEP 1: Organization ── */}
          {step === 1 && (
            <div>
              <h2 style={{ color: '#f1f5f9', margin: '0 0 6px', fontSize: '20px', fontWeight: 700 }}>🏢 Organization Details</h2>
              <p style={{ color: '#475569', margin: '0 0 28px', fontSize: '13px' }}>Enter the basic information about the new tenant organization.</p>

              <div style={{ marginBottom: '20px' }}>
                <label style={LBL}>Tenant Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input value={name} onChange={e => { setName(e.target.value); setNameErr(''); }}
                  placeholder="Acme Corporation" style={nameErr ? INP_ERR : INP} />
                {nameErr && <div style={ERR}>⚠ {nameErr}</div>}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={LBL}>Primary Domain <span style={{ color: '#475569' }}>(optional)</span></label>
                <input value={domain} onChange={e => setDomain(e.target.value)}
                  placeholder="acme.com" style={INP} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={LBL}>Billing Plan</label>
                  <select value={plan} onChange={e => setPlan(e.target.value)} style={{ ...INP, cursor: 'pointer' }}>
                    {PLAN_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>
                    {PLAN_OPTIONS.find(p => p.value === plan)?.desc}
                  </div>
                </div>
                <div>
                  <label style={LBL}>Deployment Region</label>
                  <select value={region} onChange={e => setRegion(e.target.value)} style={{ ...INP, cursor: 'pointer' }}>
                    {REGION_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Compliance ── */}
          {step === 2 && (
            <div>
              <h2 style={{ color: '#f1f5f9', margin: '0 0 6px', fontSize: '20px', fontWeight: 700 }}>📋 Compliance Frameworks</h2>
              <p style={{ color: '#475569', margin: '0 0 6px', fontSize: '13px' }}>
                Select all applicable compliance frameworks for <strong style={{ color: '#f1f5f9' }}>{name}</strong>.
              </p>
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '6px', padding: '8px 12px', marginBottom: '24px', fontSize: '12px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ⚠️ At least one framework is required to proceed.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
                {SUPPORTED_FRAMEWORKS.map(fw => {
                  const selected = frameworks.includes(fw);
                  return (
                    <button key={fw} onClick={() => toggleFw(fw)}
                      style={{
                        background: selected ? 'rgba(99,102,241,0.15)' : 'rgba(15,22,41,0.6)',
                        border: selected ? '2px solid #6366f1' : '2px solid #1e3a5f',
                        borderRadius: '10px', padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.15s',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '4px', border: '2px solid',
                          borderColor: selected ? '#6366f1' : '#1e3a5f',
                          background: selected ? '#6366f1' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.15s',
                        }}>
                          {selected && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: selected ? '#818cf8' : '#94a3b8' }}>{fw}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', paddingLeft: '30px' }}>
                        {FRAMEWORK_DESCRIPTIONS[fw]}
                      </div>
                    </button>
                  );
                })}
              </div>
              {fwErr && <div style={{ ...ERR, marginTop: '8px', fontSize: '13px' }}>⚠ {fwErr}</div>}
              {frameworks.length > 0 && (
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#10b981' }}>
                  ✓ {frameworks.length} framework{frameworks.length > 1 ? 's' : ''} selected: {frameworks.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Administrator ── */}
          {step === 3 && (
            <div>
              <h2 style={{ color: '#f1f5f9', margin: '0 0 6px', fontSize: '20px', fontWeight: 700 }}>👤 Tenant Administrator</h2>
              <p style={{ color: '#475569', margin: '0 0 24px', fontSize: '13px' }}>
                A tenant administrator account will be provisioned and a welcome email with a secure onboarding link sent.
              </p>

              <div style={{ background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)', borderRadius: '8px', padding: '14px 16px', marginBottom: '24px', fontSize: '12px', color: '#64748b' }}>
                <div style={{ color: '#2dd4bf', fontWeight: 700, marginBottom: '6px', fontSize: '13px' }}>🔐 What happens next</div>
                <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: '1.8' }}>
                  <li>A one-time onboarding link will be generated and shown on the next screen</li>
                  <li>A welcome email is sent with a secure onboarding link</li>
                  <li>The admin must set their password before first sign-in</li>
                  <li>Tenant becomes <strong style={{ color: '#f59e0b' }}>ACTIVE</strong> after onboarding completes</li>
                </ul>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={LBL}>Admin Email Address <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="email" value={email} onChange={e => { setEmail(e.target.value); setEmlErr(''); }}
                  placeholder="admin@acme.com" autoComplete="off" style={emailErr ? INP_ERR : INP} />
                {emailErr && <div style={ERR}>⚠ {emailErr}</div>}
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '5px' }}>
                  Login credentials will be sent to this address.
                </div>
              </div>

              <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', padding: '10px 14px', fontSize: '12px', color: '#fbbf24' }}>
                ⚠️ The admin role is <strong>tenant_admin</strong> — full access to {name}'s environment.
              </div>
            </div>
          )}

          {/* ── STEP 4: Review ── */}
          {step === 4 && (
            <div>
              <h2 style={{ color: '#f1f5f9', margin: '0 0 6px', fontSize: '20px', fontWeight: 700 }}>✓ Review & Create</h2>
              <p style={{ color: '#475569', margin: '0 0 24px', fontSize: '13px' }}>Confirm all details before creating the tenant.</p>

              {[
                { label: '🏢 Organization', items: [
                  ['Name', name], ['Domain', domain || '—'], ['Plan', plan.toUpperCase()], ['Region', region],
                ]},
                { label: '📋 Compliance', items: [
                  ['Frameworks', frameworks.join(', ')],
                ]},
                { label: '👤 Administrator', items: [
                  ['Admin Email', email],
                  ['Role', 'tenant_admin'],
                  ['Onboarding', 'One-time onboarding link (15 minutes)'],
                ]},
                { label: '📊 Initial Status', items: [
                  ['Tenant Status', 'PENDING → ACTIVE (after onboarding)'],
                  ['Welcome Email', 'Will be sent automatically'],
                ]},
              ].map(section => (
                <div key={section.label} style={{ background: 'rgba(15,22,41,0.6)', border: '1px solid #1e3a5f', borderRadius: '8px', padding: '16px 20px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{section.label}</div>
                  {section.items.map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: '16px', marginBottom: '6px', fontSize: '13px' }}>
                      <span style={{ color: '#64748b', minWidth: '140px' }}>{k}</span>
                      <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              ))}

              {apiError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#ef4444', fontSize: '13px' }}>
                  ✗ {apiError}
                </div>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #1e3a5f' }}>
            <button onClick={() => step === 1 ? window.location.href = '/operator' : setStep(s => s - 1)}
              style={{ background: 'transparent', border: '1px solid #1e3a5f', color: '#64748b', borderRadius: '8px', padding: '10px 22px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              {step === 1 ? '← Cancel' : '← Back'}
            </button>

            {step < 4 ? (
              <button onClick={nextStep}
                disabled={
                  (step === 2 && frameworks.length === 0) ||
                  (step === 3 && !email.trim())
                }
                style={{
                  background: (step === 2 && frameworks.length === 0) || (step === 3 && !email.trim()) ? '#0d4038' : '#0d9488',
                  color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 700,
                  cursor: (step === 2 && frameworks.length === 0) || (step === 3 && !email.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (step === 2 && frameworks.length === 0) || (step === 3 && !email.trim()) ? 0.6 : 1,
                }}>
                Next: {STEPS[step]?.label} →
              </button>
            ) : (
              <button onClick={handleCreate} disabled={submitting}
                style={{ background: submitting ? '#0d4038' : '#0d9488', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 28px', fontSize: '13px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? '⏳ Creating…' : '🚀 Create Tenant'}
              </button>
            )}
          </div>
        </div>

        {/* Step progress text */}
        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#334155' }}>
          Step {step} of {STEPS.length} — {STEPS[step - 1]?.desc}
          {step === 2 && frameworks.length === 0 && (
            <span style={{ color: '#f59e0b', marginLeft: '8px' }}>⚠ Compliance selection required</span>
          )}
          {step === 3 && !email.trim() && (
            <span style={{ color: '#f59e0b', marginLeft: '8px' }}>⚠ Admin email required</span>
          )}
        </div>
      </div>
    </div>
  );
}
