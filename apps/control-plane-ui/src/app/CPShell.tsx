'use client';
import { usePathname } from 'next/navigation';
import { logout } from '@/lib/api';

const PUBLIC = ['/login'];

const NAV = [
  { href: '/',           label: 'Platform Health', icon: '◎' },
  { href: '/tenants',    label: 'Tenants',         icon: '⊞' },
  { href: '/audit',      label: 'Audit Log',       icon: '≡' },
];

export function CPShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (PUBLIC.includes(path)) return <>{children}</>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f1117' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: '#13151f', borderRight: '1px solid #1e2030',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1e2030' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: '#fff',
            }}>⌘</div>
            <div>
              <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>IdMatr</div>
              <div style={{ color: '#6366f1', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em' }}>CONTROL PLANE</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {NAV.map(item => {
            const active = item.href === '/' ? path === '/' : path.startsWith(item.href);
            return (
              <a key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 7, marginBottom: 2,
                color: active ? '#e2e8f0' : '#64748b',
                background: active ? '#1e2030' : 'transparent',
                textDecoration: 'none', fontSize: 13, fontWeight: active ? 600 : 400,
                borderLeft: active ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: 12, borderTop: '1px solid #1e2030' }}>
          <a href="/login" onClick={(event) => { event.preventDefault(); logout(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 6, color: '#ef4444',
              textDecoration: 'none', fontSize: 12, fontWeight: 500,
              background: 'rgba(239,68,68,0.08)',
            }}>
            ⎋ Sign out
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
