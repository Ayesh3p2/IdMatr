'use client';

import { useState, useEffect } from 'react';
import { login, isAuthenticated } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      window.location.href = '/';
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password, tenantSlug || undefined, totpCode || undefined);
      // If this is a first-time login with a temporary password, redirect to change-password
      if (result.forcePasswordChange) {
        window.location.href = '/change-password';
      } else {
        window.location.href = '/';
      }
    } catch (err: any) {
      setError(err?.message?.includes('401') || err?.message?.includes('Invalid')
        ? 'Invalid email or password'
        : 'Connection failed — make sure the API gateway is running');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F1629',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: '0 24px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img
            src="/logo-teal.svg"
            alt="IDMatr"
            style={{ height: '72px', width: 'auto', marginBottom: '8px' }}
          />
          <div style={{ fontSize: '11px', color: '#64748B', letterSpacing: '3px', textTransform: 'uppercase' }}>
            Identity Security Platform
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#1A2340',
          borderRadius: '12px',
          border: '1px solid #1E3A5F',
          padding: '40px 36px',
        }}>
          <h1 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 700, marginBottom: '8px', marginTop: 0 }}>
            Sign in
          </h1>
          <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '28px', marginTop: 0 }}>
            Enter your administrator credentials
          </p>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="admin@example.com"
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

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Tenant Slug
              </label>
              <input
                type="text"
                value={tenantSlug}
                onChange={e => setTenantSlug(e.target.value)}
                autoComplete="organization"
                placeholder="acme-corp"
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

            {/* Password */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
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
                MFA Code
              </label>
              <input
                type="text"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
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

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '20px',
                color: '#EF4444',
                fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
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
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#334155', fontSize: '12px', marginTop: '20px' }}>
          IDMatr v1.0 — Enterprise Identity Security Platform
        </p>
      </div>
    </div>
  );
}
