'use client';

import { useState, useEffect } from 'react';
import { changePassword, isAuthenticated, logout } from '@/lib/api';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If not authenticated at all, go to login
    if (!isAuthenticated()) {
      window.location.href = '/login';
    }
  }, []);

  function validatePassword(pwd: string): string | null {
    if (pwd.length < 12) return 'Password must be at least 12 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(pwd)) return 'Password must contain at least one number';
    if (!/[^A-Za-z0-9]/.test(pwd)) return 'Password must contain at least one special character';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from your current password');
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        setSuccess(true);
        // Redirect to dashboard after 2 seconds
        setTimeout(() => { window.location.href = '/'; }, 2000);
      } else {
        setError(result.message || 'Password change failed');
      }
    } catch (err: any) {
      setError(err?.message?.includes('401') || err?.message?.includes('incorrect')
        ? 'Current password is incorrect'
        : err?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    background: '#0F1629',
    border: '1px solid #1E3A5F',
    borderRadius: '8px',
    color: '#FFFFFF',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#94A3B8',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F1629',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '460px', padding: '0 24px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/logo-teal.svg" alt="IDMatr" style={{ height: '60px', width: 'auto', marginBottom: '8px' }} />
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
          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              marginBottom: '16px',
            }}>
              <span style={{ fontSize: '16px' }}>🔒</span>
              <span style={{ color: '#F59E0B', fontSize: '13px', fontWeight: 600 }}>
                Password Change Required
              </span>
            </div>
            <h1 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 700, marginBottom: '6px', marginTop: 0 }}>
              Set your password
            </h1>
            <p style={{ color: '#64748B', fontSize: '14px', marginBottom: 0, marginTop: 0 }}>
              You're using a temporary password. Please set a permanent password to continue.
            </p>
          </div>

          {success ? (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
              <div style={{ color: '#10B981', fontWeight: 700, marginBottom: '4px' }}>Password changed!</div>
              <div style={{ color: '#64748B', fontSize: '13px' }}>Redirecting to dashboard…</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Current Password */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Current (Temporary) Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your temporary password"
                  style={inputStyle}
                />
              </div>

              {/* New Password */}
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Min. 12 chars, uppercase, number, symbol"
                  style={inputStyle}
                />
              </div>

              {/* Confirm Password */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                  style={inputStyle}
                />
              </div>

              {/* Password requirements hint */}
              <div style={{
                background: 'rgba(30, 58, 95, 0.4)',
                borderRadius: '6px',
                padding: '10px 12px',
                marginBottom: '20px',
                fontSize: '12px',
                color: '#64748B',
                lineHeight: '1.6',
              }}>
                Password must be at least 12 characters and include uppercase, lowercase, number, and special character.
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
                  marginBottom: '12px',
                }}
              >
                {loading ? 'Saving…' : 'Set New Password'}
              </button>

              {/* Sign out link */}
              <button
                type="button"
                onClick={() => logout()}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'transparent',
                  color: '#64748B',
                  border: '1px solid #1E3A5F',
                  borderRadius: '8px',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Sign out and use a different account
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#334155', fontSize: '12px', marginTop: '20px' }}>
          IDMatr v1.0 — Enterprise Identity Security Platform
        </p>
      </div>
    </div>
  );
}
