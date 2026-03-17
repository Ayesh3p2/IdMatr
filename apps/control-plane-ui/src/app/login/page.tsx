'use client';
import { useState, useEffect } from 'react';
import { login, isAuthenticated } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) window.location.href = '/';
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, totpCode || undefined);
      window.location.href = '/';
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const S = {
    page: {
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f1117 0%, #13151f 50%, #0f1117 100%)',
    } as React.CSSProperties,
    card: {
      width: 400, padding: '40px 36px', background: '#13151f',
      border: '1px solid #1e2030', borderRadius: 16,
      boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
    } as React.CSSProperties,
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontWeight: 800, color: '#fff',
          }}>⌘</div>
          <h1 style={{ margin: 0, color: '#e2e8f0', fontSize: 22, fontWeight: 700 }}>IdMatr Control Plane</h1>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>Operator access only</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              padding: '10px 14px', marginBottom: 16, borderRadius: 8,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444', fontSize: 13,
            }}>{error}</div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>
              OPERATOR EMAIL
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="admin@idmatr.io"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
                background: '#0f1117', border: '1px solid #2d3147', color: '#e2e8f0',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>
              PASSWORD
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••••••"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
                background: '#0f1117', border: '1px solid #2d3147', color: '#e2e8f0',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>
              MFA CODE
            </label>
            <input
              type="text" value={totpCode} onChange={e => setTotpCode(e.target.value)}
              placeholder="123456"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
                background: '#0f1117', border: '1px solid #2d3147', color: '#e2e8f0',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '11px', borderRadius: 8, border: 'none',
              background: loading ? '#4338ca' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in to Control Plane'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, color: '#374151', fontSize: 11 }}>
          IdMatr v1.0 · Control Plane · Restricted Access
        </p>
      </div>
    </div>
  );
}
