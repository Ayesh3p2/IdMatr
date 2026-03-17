'use client';

import { useState, useEffect } from 'react';
import { operatorLogin, isOperatorAuthenticated } from '@/lib/operator-api';

export default function OperatorLoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (isOperatorAuthenticated()) {
      window.location.href = '/operator';
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await operatorLogin(email, password, totpCode || undefined);
      window.location.href = '/operator';
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: '#0F1629',
    border: '1px solid #1E3A5F', borderRadius: '8px', color: '#FFF',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 600, color: '#94A3B8',
    marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#060b16', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '440px', padding: '0 24px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/logo-teal.svg" alt="IDMatr" style={{ height: '56px', width: 'auto', marginBottom: '8px' }} />
          <div style={{ fontSize: '10px', color: '#334155', letterSpacing: '3px', textTransform: 'uppercase' }}>
            Operator Control Plane
          </div>
        </div>

        <div style={{ background: '#1A2340', borderRadius: '12px', border: '1px solid #1E3A5F', padding: '36px' }}>
          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', padding: '6px 12px', marginBottom: '14px' }}>
              <span style={{ fontSize: '14px' }}>🛡️</span>
              <span style={{ color: '#818cf8', fontSize: '12px', fontWeight: 600 }}>Platform Administrator</span>
            </div>
            <h1 style={{ color: '#FFF', fontSize: '20px', fontWeight: 700, margin: '0 0 6px' }}>Operator Login</h1>
            <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>Control plane access for platform operators only.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={lbl}>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" placeholder="admin@idmatr.io" style={inp} />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={lbl}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete="current-password" placeholder="Operator password" style={inp} />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={lbl}>MFA Code</label>
              <input type="text" value={totpCode} onChange={e => setTotpCode(e.target.value)}
                autoComplete="one-time-code" inputMode="numeric" placeholder="123456" style={inp} />
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', color: '#EF4444', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: loading ? '#3730a3' : '#4f46e5', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Signing in…' : 'Sign in to Control Plane'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: '#1E293B', fontSize: '11px', marginTop: '20px' }}>
          IDMatr Control Plane · Operator access only
        </p>
      </div>
    </div>
  );
}
