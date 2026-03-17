'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCurrentUser, isAuthenticated, logout } from '@/lib/api';

const navSections = [
  {
    label: 'Command Center',
    items: [
      { href: '/',           label: 'Executive Dashboard', icon: '⬡' },
      { href: '/analytics',  label: 'Identity Analytics',  icon: '◈' },
    ]
  },
  {
    label: 'Identity & Access',
    items: [
      { href: '/identities',  label: 'Identities',     icon: '◉' },
      { href: '/applications',label: 'Applications',   icon: '⬡' },
      { href: '/graph',       label: 'Identity Graph',  icon: '◈' },
    ]
  },
  {
    label: 'Security Intelligence',
    items: [
      { href: '/risk',    label: 'Risk Engine',      icon: '◈' },
      { href: '/itdr',    label: 'ITDR',             icon: '⬡' },
      { href: '/posture', label: 'Security Posture', icon: '◉' },
    ]
  },
  {
    label: 'Governance',
    items: [
      { href: '/governance', label: 'Access Governance', icon: '◈' },
      { href: '/compliance', label: 'Compliance',        icon: '◉' },
      { href: '/audit',      label: 'Audit Trail',       icon: '⬡' },
    ]
  },
  {
    label: 'Administration',
    items: [
      { href: '/status',   label: 'Platform Status', icon: '◈' },
      { href: '/settings', label: 'Settings',        icon: '◉' },
    ]
  }
];

// Pages that render without the shell (no sidebar, no auth check)
// Operator portal has its own auth flow — exclude entirely from tenant shell
const PUBLIC_PATHS = ['/login', '/onboarding'];
const OPERATOR_PREFIX = '/operator';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname) || pathname.startsWith(OPERATOR_PREFIX);

  const [user, setUser]       = useState<{ email: string; initials: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (isPublic) { setAuthReady(true); return; }

    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }

    getCurrentUser().then((currentUser) => {
      const email = currentUser.email || 'admin';
      const parts = email.split('@')[0].split(/[.\-_]/);
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : email.slice(0, 2).toUpperCase();
      setUser({ email, initials });
      setAuthReady(true);
    }).catch(() => {
      setUser({ email: 'admin', initials: 'A' });
      setAuthReady(true);
    });
  }, [pathname, isPublic, router]);

  // On login page — render children fullscreen, no shell
  if (isPublic) {
    return <>{children}</>;
  }

  // Waiting for auth check — blank to avoid flash
  if (!authReady) {
    return (
      <div style={{ height: '100vh', background: '#060b16', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '13px', color: '#475569' }}>Loading…</div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'block' }}>
            <img
              src="/logo-teal.svg"
              alt="IDMatr"
              style={{ height: '52px', width: 'auto', display: 'block' }}
            />
          </Link>
          <div style={{ fontSize: '9px', fontWeight: '600', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#334155', marginTop: '6px' }}>
            Identity Security Platform
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: '16px' }}>
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="nav-section">{section.label}</div>
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href}
                    className="nav-item"
                    style={isActive ? { background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRight: '2px solid #6366f1' } : undefined}>
                    <span style={{ fontSize: '15px', lineHeight: 1 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom user area */}
        <div style={{ padding: '12px 12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: 'white', flexShrink: 0 }}>
              {user?.initials ?? 'A'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9' }}>Admin</div>
              <div style={{ fontSize: '10px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email ?? '…'}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{ fontSize: '13px', color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', lineHeight: 1 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
              onMouseLeave={e => (e.currentTarget.style.color = '#475569')}>
              ⏻
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}
