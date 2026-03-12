import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "IDMatr | Identity Security Platform",
  description: "Next-generation enterprise identity security — IGA, IAM, ISPM, ITDR",
};

const navSections = [
  {
    label: "Command Center",
    items: [
      { href: "/", label: "Executive Dashboard", icon: "⬡", desc: "Global security posture" },
      { href: "/analytics", label: "Identity Analytics", icon: "◈", desc: "AI-driven insights" },
    ]
  },
  {
    label: "Identity & Access",
    items: [
      { href: "/identities", label: "Identities", icon: "◉", desc: "User intelligence" },
      { href: "/applications", label: "Applications", icon: "⬡", desc: "App discovery & access" },
      { href: "/graph", label: "Identity Graph", icon: "◈", desc: "Relationship map" },
    ]
  },
  {
    label: "Security Intelligence",
    items: [
      { href: "/risk", label: "Risk Engine", icon: "◈", desc: "Risk scoring & events" },
      { href: "/itdr", label: "ITDR", icon: "⬡", desc: "Threat detection & response" },
      { href: "/posture", label: "Security Posture", icon: "◉", desc: "ISPM metrics" },
    ]
  },
  {
    label: "Governance",
    items: [
      { href: "/governance", label: "Access Governance", icon: "◈", desc: "Workflows & reviews" },
      { href: "/compliance", label: "Compliance", icon: "◉", desc: "Certifications & audits" },
      { href: "/audit", label: "Audit Trail", icon: "⬡", desc: "Activity logs" },
    ]
  },
  {
    label: "Administration",
    items: [
      { href: "/health", label: "System Health", icon: "◈", desc: "Services & uptime" },
      { href: "/settings", label: "Settings", icon: "◉", desc: "Platform configuration" },
    ]
  }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          {/* Sidebar */}
          <aside className="sidebar">
            {/* Logo */}
            <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(99,102,241,0.12)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <div style={{
                  width: '32px', height: '32px',
                  background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                  borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: '800', color: 'white',
                  boxShadow: '0 0 20px rgba(99,102,241,0.4)'
                }}>I</div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#f1f5f9', letterSpacing: '-0.02em' }}>IDMatr</div>
                </div>
              </div>
              <div style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569', marginTop: '2px' }}>
                Identity Security Platform
              </div>
            </div>

            {/* Security Status Bar */}
            <div style={{ margin: '12px 12px 4px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.8)', animation: 'blink 2s infinite' }}></div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#f87171' }}>3 CRITICAL ALERTS</span>
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Active threats require attention</div>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: '16px' }}>
              {navSections.map((section) => (
                <div key={section.label}>
                  <div className="nav-section">{section.label}</div>
                  {section.items.map((item) => (
                    <Link key={item.href} href={item.href} className="nav-item">
                      <span style={{ fontSize: '15px', lineHeight: 1 }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </nav>

            {/* Bottom user area */}
            <div style={{ padding: '12px 12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: 'white' }}>A</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9' }}>Admin</div>
                  <div style={{ fontSize: '10px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>admin@idmatr.com</div>
                </div>
                <div style={{ fontSize: '10px', fontWeight: '600', color: '#4ade80', background: 'rgba(34,197,94,0.1)', padding: '2px 6px', borderRadius: '4px' }}>LIVE</div>
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
      </body>
    </html>
  );
}
