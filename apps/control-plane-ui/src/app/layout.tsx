import type { Metadata } from 'next';
import { CPShell } from './CPShell';

export const metadata: Metadata = {
  title: 'IdMatr Control Plane',
  description: 'Multi-tenant operator control panel for IdMatr Identity Security Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.tailwindcss.com" />
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0f1117' }}>
        <CPShell>{children}</CPShell>
      </body>
    </html>
  );
}
