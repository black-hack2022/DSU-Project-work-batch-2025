import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NavSidebar from "@/components/NavSidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IS-HAITI | Cyber Threat Intelligence",
  description:
    "SOC-style cyber threat intelligence dashboard — GNN, Transformer, Anomaly Detection, X-TIS explainability, and A–H category coverage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        <div className="min-h-screen flex flex-col">
          {/* Top Header */}
          <header
            className="h-12 shrink-0 flex items-center justify-between px-4 z-30"
            style={{
              background: "var(--card)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-3">
              {/* Logo mark */}
              <div
                className="h-7 w-7 rounded flex items-center justify-center text-xs font-bold"
                style={{ background: "rgba(59,130,246,0.2)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.4)" }}
              >
                IS
              </div>
              <div>
                <span className="font-semibold text-sm tracking-wide">IS-HAITI</span>
                <span className="text-xs ml-2" style={{ color: "var(--muted-foreground)" }}>
                  Cyber Threat Intelligence Platform
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
              {/* Live indicator */}
              <span className="flex items-center gap-1.5">
                <span
                  className="pulse-live h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--color-live)" }}
                />
                <span style={{ color: "var(--color-live)" }}>LIVE</span>
              </span>

              {/* Model status */}
              <span className="hidden sm:flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-gnn)" }} />
                  GNN
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-transformer)" }} />
                  FT
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-autoencoder)" }} />
                  AE
                </span>
              </span>

              <span className="font-mono hidden md:block">v2.0 · Team 89</span>
            </div>
          </header>

          {/* Body */}
          <div className="flex flex-1 min-h-0">
            {/* Sidebar */}
            <div className="hidden md:block w-56 shrink-0 overflow-y-auto" style={{ background: "var(--card)" }}>
              <NavSidebar />
            </div>

            {/* Main content */}
            <main className="flex-1 min-w-0 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
