'use client';
import { useState, useEffect } from 'react';
import { isAuthenticated, createTenant } from '@/lib/api';

const PLANS = ['starter', 'pro', 'enterprise'];
const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'];
const FRAMEWORKS = ['soc2', 'iso27001', 'nist', 'hipaa', 'gdpr', 'pci-dss'];

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em' }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2d3147',
  background: '#0f1117', color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};

export default function NewTenantPage() {
  const [form, setForm] = useState({
    name: '', slug: '', domain: '', adminEmail: '', plan: 'starter', region: 'us-east-1', frameworks: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isAuthenticated()) window.location.href = '/login';
  }, []);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleNameChange = (v: string) => {
    set('name', v);
    if (!form.slug || form.slug === autoSlug(form.name)) set('slug', autoSlug(v));
  };

  const toggleFramework = (fw: string) => {
    set('frameworks', form.frameworks.includes(fw)
      ? form.frameworks.filter(f => f !== fw)
      : [...form.frameworks, fw]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug) return setError('Name and slug are required');
    setLoading(true);
    setError('');
    try {
      const tenant = await createTenant(form);
      window.location.href = `/tenants/${tenant.id}`;
    } catch (err: any) {
      setError(err?.message || 'Failed to create tenant');
    } finally {
      setLoading(false);
    }
  };

  const S = {
    page: { padding: '32px 40px', color: '#e2e8f0', maxWidth: 720 } as React.CSSProperties,
    card: { background: '#13151f', border: '1px solid #1e2030', borderRadius: 12, padding: '28px 32px', marginBottom: 24 } as React.CSSProperties,
    sectionTitle: { color: '#94a3b8', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 20, textTransform: 'uppercase' as const },
  };

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 28 }}>
        <a href="/tenants" style={{ color: '#64748b', textDecoration: 'none', fontSize: 13 }}>← Tenants</a>
        <h1 style={{ margin: '8px 0 4px', fontSize: 22, fontWeight: 700 }}>Onboard New Tenant</h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
          Create a new tenant workspace in the IdMatr platform
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28 }}>
        {['Organization', 'Configuration', 'Compliance'].map((s, i) => {
          const active = step === i + 1;
          const done = step > i + 1;
          return (
            <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, flex: 1,
                paddingBottom: 12, borderBottom: `2px solid ${active || done ? '#6366f1' : '#1e2030'}`,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active || done ? '#6366f1' : '#1e2030',
                  color: active || done ? '#fff' : '#374151',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 13, color: active ? '#e2e8f0' : '#64748b', fontWeight: active ? 600 : 400 }}>{s}</span>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{
            padding: '12px 16px', marginBottom: 20, borderRadius: 8,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444', fontSize: 13,
          }}>{error}</div>
        )}

        {step === 1 && (
          <div style={S.card}>
            <div style={S.sectionTitle}>Organization Details</div>
            <Field label="ORGANIZATION NAME" required>
              <input style={inputStyle} value={form.name} onChange={e => handleNameChange(e.target.value)}
                placeholder="Acme Corporation" required />
            </Field>
            <Field label="TENANT SLUG" required>
              <input style={inputStyle} value={form.slug} onChange={e => set('slug', e.target.value)}
                placeholder="acme-corp" pattern="[a-z0-9-]+" />
              <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>
                Lowercase letters, numbers, hyphens only. This becomes the tenant identifier.
              </div>
            </Field>
            <Field label="PRIMARY DOMAIN">
              <input style={inputStyle} value={form.domain} onChange={e => set('domain', e.target.value)}
                placeholder="acme.com" type="text" />
            </Field>
            <Field label="ADMIN EMAIL" required>
              <input style={inputStyle} value={form.adminEmail} onChange={e => set('adminEmail', e.target.value)}
                placeholder="admin@acme.com" type="email" required />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div style={S.card}>
            <div style={S.sectionTitle}>Subscription & Infrastructure</div>
            <Field label="PLAN" required>
              <div style={{ display: 'flex', gap: 10 }}>
                {PLANS.map(p => (
                  <button key={p} type="button" onClick={() => set('plan', p)} style={{
                    flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', border: '2px solid',
                    borderColor: form.plan === p ? '#6366f1' : '#1e2030',
                    background: form.plan === p ? 'rgba(99,102,241,0.1)' : '#0f1117',
                    color: form.plan === p ? '#818cf8' : '#64748b',
                    textTransform: 'capitalize', fontWeight: 600, fontSize: 13,
                  }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>
                      {p === 'starter' ? '🌱' : p === 'pro' ? '⚡' : '🏢'}
                    </div>
                    {p}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="DATA REGION" required>
              <select
                style={{ ...inputStyle, appearance: 'none' }}
                value={form.region} onChange={e => set('region', e.target.value)}
              >
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>
        )}

        {step === 3 && (
          <div style={S.card}>
            <div style={S.sectionTitle}>Compliance Frameworks</div>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20, marginTop: 0 }}>
              Select the compliance frameworks this tenant needs to track. These can be changed later.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {FRAMEWORKS.map(fw => {
                const active = form.frameworks.includes(fw);
                return (
                  <button key={fw} type="button" onClick={() => toggleFramework(fw)} style={{
                    padding: '14px 12px', borderRadius: 10, cursor: 'pointer', border: '2px solid',
                    borderColor: active ? '#6366f1' : '#1e2030',
                    background: active ? 'rgba(99,102,241,0.08)' : '#0f1117',
                    color: active ? '#818cf8' : '#64748b', fontWeight: 600, fontSize: 13,
                    textTransform: 'uppercase',
                  }}>
                    {fw}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <button type="button" onClick={() => setStep(s => s - 1)}
            style={{
              padding: '10px 20px', borderRadius: 8, border: '1px solid #2d3147',
              background: 'transparent', color: '#94a3b8', fontSize: 13, cursor: step === 1 ? 'not-allowed' : 'pointer',
              opacity: step === 1 ? 0.4 : 1,
            }} disabled={step === 1}>
            ← Back
          </button>

          {step < 3 ? (
            <button type="button" onClick={() => {
              if (step === 1 && (!form.name || !form.slug || !form.adminEmail)) return setError('Name, slug, and admin email are required');
              setError('');
              setStep(s => s + 1);
            }} style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Continue →
            </button>
          ) : (
            <button type="submit" disabled={loading} style={{
              padding: '10px 28px', borderRadius: 8, border: 'none',
              background: loading ? '#4338ca' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? 'Creating…' : '✓ Create Tenant'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
