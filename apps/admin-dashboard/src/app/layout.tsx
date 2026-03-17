import type { Metadata } from "next";
import "./globals.css";
import ClientShell from "./ClientShell";

export const metadata: Metadata = {
  title: "IDMatr | Identity Security Platform",
  description: "Next-generation enterprise identity security — IGA, IAM, ISPM, ITDR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
