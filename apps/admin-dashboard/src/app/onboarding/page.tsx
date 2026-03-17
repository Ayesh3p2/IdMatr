'use client';

import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { completeOnboarding } from '@/lib/api';

function OnboardingForm() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('This onboarding link is invalid or missing its token.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await completeOnboarding(token, password);
      window.location.href = '/';
    } catch (err: any) {
      setError(err?.message || 'Unable to complete onboarding.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0F1629', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '460px', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/logo-teal.svg" alt="IDMatr" style={{ height: '72px', width: 'auto', marginBottom: '8px' }} />
          <div style={{ fontSize: '11px', color: '#64748B', letterSpacing: '3px', textTransform: 'uppercase' }}>
            Secure Tenant Onboarding
          </div>
        </div>

        <div style={{ background: '#1A2340', borderRadius: '12px', border: '1px solid #1E3A5F', padding: '40px 36px' }}>
          <h1 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 700, marginBottom: '8px', marginTop: 0 }}>
            Set your password
          </h1>
          <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '28px', marginTop: 0 }}>
            This onboarding link can only be used once and expires after 15 minutes.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: '#0F1629',
                  border: '1px solid #1E3A5F',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: '#0F1629',
                  border: '1px solid #1E3A5F',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', color: '#EF4444', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? '#0D6E65' : '#0D9488',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Completing onboarding…' : 'Complete onboarding'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: '#0F1629', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#64748B' }}>Loading...</div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OnboardingForm />
    </Suspense>
  );
}
