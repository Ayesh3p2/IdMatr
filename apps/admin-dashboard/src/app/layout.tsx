import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IDMatr | Identity Intelligence Platform",
  description: "Enterprise-grade identity security platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50`}>
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 bg-slate-900 text-white flex-shrink-0">
            <div className="p-6">
              <h1 className="text-2xl font-bold text-blue-400">IDMatr</h1>
              <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">Identity Intelligence</p>
            </div>
            <nav className="mt-6 px-4 space-y-2">
              <Link href="/" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-slate-800">
                Dashboard
              </Link>
              <Link href="/identities" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-slate-800">
                Identities
              </Link>
              <Link href="/applications" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-slate-800">
                Applications
              </Link>
              <Link href="/risk" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-slate-800">
                Risk Engine
              </Link>
              <Link href="/governance" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-slate-800">
                Governance
              </Link>
              <Link href="/graph" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-slate-800">
                Identity Graph
              </Link>
              <Link href="/audit" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-slate-800">
                Audit Logs
              </Link>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
