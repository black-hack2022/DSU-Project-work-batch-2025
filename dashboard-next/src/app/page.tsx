import path from "path";
import Link from "next/link";
import { resolveArtifactBases } from "@/lib/artifactPaths";
import { readJsonFile } from "@/lib/fsRead";
import { loadAlerts } from "@/lib/alerts";
import type { MetricsJson } from "@/lib/types";

const CATEGORY_INFO = [
  { key: "A", label: "Text / Email", sub: "Spam · Phishing · Scam", color: "#8b5cf6" },
  { key: "B", label: "URLs / Web", sub: "Malicious URLs · Drive-by · Redirect", color: "#06b6d4" },
  { key: "C", label: "Network Attacks", sub: "Port Scan · Brute-Force · SSH · RDP", color: "#ef4444" },
  { key: "D", label: "Lateral Movement", sub: "SMB · Pass-Hash · East-West Pivot", color: "#f97316" },
  { key: "E", label: "Botnets / C2", sub: "IRC · HTTP Beacon · DNS Tunnel · DGA", color: "#eab308" },
  { key: "F", label: "Data Exfiltration", sub: "SMTP · DNS · HTTP POST Leak", color: "#ec4899" },
  { key: "G", label: "Malware Behavior", sub: "Beacon · Backdoor · Persistence", color: "#10b981" },
  { key: "H", label: "Multi-Stage / 0-Day", sub: "APT · Slow-and-Low · Unknown", color: "#3b82f6" },
];

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-1"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="text-xs uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </div>
      <div className="text-2xl font-bold font-mono" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{sub}</div>}
    </div>
  );
}

export default async function CommandCenter() {
  const bases = resolveArtifactBases();
  const metricsPath = path.join(bases.generatedReportDir, "metrics.json");
  const metrics = await readJsonFile<MetricsJson>(metricsPath);
  const alerts = await loadAlerts(bases.generatedReportDir);

  const critCount = alerts.filter((a) => a.severity === "critical").length;
  const highCount = alerts.filter((a) => a.severity === "high").length;
  const totalAlerts = alerts.length;

  const ehTotals = (metrics?.eh_categories as Record<string, Record<string, number>> | null)?.totals ?? null;
  const ehTotal = ehTotals
    ? Object.values(ehTotals).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0)
    : null;

  const gnnEval = (metrics?.gnn as Record<string, Record<string, number>> | null)?.eval_noleak ??
    (metrics?.gnn as Record<string, Record<string, number>> | null)?.eval ?? null;
  const gnnF1 = (gnnEval as Record<string, number> | null)?.f1 ?? null;
  const gnnAuc = (gnnEval as Record<string, number> | null)?.roc_auc ?? null;

  const recentAlerts = alerts.slice(0, 8);

  return (
    <div className="p-5 space-y-6">
      {/* Hero */}
      <div
        className="rounded-lg p-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #070c18 0%, #0d1a2e 50%, #0a1226 100%)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="pulse-live h-2 w-2 rounded-full"
              style={{ background: "var(--color-live)" }}
            />
            <span className="text-xs font-mono tracking-widest uppercase" style={{ color: "var(--color-live)" }}>
              Security Operations Center — IS-HAITI CTI
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Hybrid AI Threat Intelligence
          </h1>
          <p className="mt-1.5 text-sm max-w-2xl" style={{ color: "var(--muted-foreground)" }}>
            Real-time detection across Categories A–H using GNN service intelligence, FT-Transformer flow scoring,
            MLP Autoencoder anomaly detection, and X-TIS explainability. 125K+ network flows analyzed.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded text-sm font-medium"
              style={{ background: "#3b82f6", color: "white" }}
            >
              Threat Dashboard →
            </Link>
            <Link
              href="/alerts"
              className="px-4 py-2 rounded text-sm font-medium"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              Live Alerts {totalAlerts > 0 && `(${totalAlerts})`}
            </Link>
            <Link
              href="/detection/network"
              className="px-4 py-2 rounded text-sm font-medium"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              Run Detection
            </Link>
          </div>
        </div>
        {/* Background grid decoration */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, #3b82f6 0, #3b82f6 1px, transparent 0, transparent 50%), repeating-linear-gradient(90deg, #3b82f6 0, #3b82f6 1px, transparent 0, transparent 50%)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Alerts"
          value={totalAlerts > 0 ? totalAlerts.toLocaleString() : "—"}
          sub="GNN + FT + AE sources"
          color="var(--foreground)"
        />
        <StatCard
          label="Critical"
          value={critCount > 0 ? critCount.toLocaleString() : "0"}
          sub="Score ≥ 0.95"
          color="var(--color-critical)"
        />
        <StatCard
          label="High Severity"
          value={highCount > 0 ? highCount.toLocaleString() : "0"}
          sub="Score ≥ 0.70"
          color="var(--color-high)"
        />
        <StatCard
          label="Categories E–H"
          value={ehTotal !== null ? ehTotal.toLocaleString() : "—"}
          sub="C2, Exfil, Malware, APT"
          color="var(--color-medium)"
        />
      </div>

      {/* Model performance + Recent alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Model status */}
        <div
          className="rounded-lg p-4 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="text-sm font-semibold tracking-wide uppercase" style={{ color: "var(--muted-foreground)" }}>
            AI Models
          </div>

          {/* GNN */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-gnn)" }} />
                <span className="font-medium">GNN (SimpleGCN)</span>
              </div>
              <span className="font-mono text-xs" style={{ color: "var(--color-gnn)" }}>
                {gnnF1 !== null ? `F1: ${gnnF1.toFixed(3)}` : "ACTIVE"}
              </span>
            </div>
            <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Service-level graph · {gnnAuc !== null ? `AUC ${gnnAuc.toFixed(3)}` : "Bipartite network"} · KDD Cup
            </div>
          </div>

          <div className="h-px" style={{ background: "var(--border)" }} />

          {/* Transformer */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-transformer)" }} />
                <span className="font-medium">FT-Transformer</span>
              </div>
              <span className="font-mono text-xs" style={{ color: "var(--color-transformer)" }}>ACTIVE</span>
            </div>
            <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Flow-level · 4-layer · 8 heads · d=192 · KDD+UNSW
            </div>
          </div>

          <div className="h-px" style={{ background: "var(--border)" }} />

          {/* Autoencoder */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-autoencoder)" }} />
                <span className="font-medium">MLP Autoencoder</span>
              </div>
              <span className="font-mono text-xs" style={{ color: "var(--color-autoencoder)" }}>ACTIVE</span>
            </div>
            <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Unsupervised · 256→128→32→128→256 · UNSW-NB15
            </div>
          </div>

          <div className="h-px" style={{ background: "var(--border)" }} />

          {/* Heuristics */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-safe)" }} />
                <span className="font-medium">Rule-Based Detectors</span>
              </div>
              <span className="font-mono text-xs" style={{ color: "var(--color-safe)" }}>ACTIVE</span>
            </div>
            <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Text (A) · URL (B) · Network (C/D) · E-H taxonomy
            </div>
          </div>
        </div>

        {/* Recent alerts */}
        <div
          className="lg:col-span-2 rounded-lg p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold tracking-wide uppercase" style={{ color: "var(--muted-foreground)" }}>
              Recent Alerts
            </div>
            <Link href="/alerts" className="text-xs" style={{ color: "#3b82f6" }}>
              View all →
            </Link>
          </div>

          {recentAlerts.length === 0 ? (
            <div className="text-sm py-4 text-center" style={{ color: "var(--muted-foreground)" }}>
              No alerts found. Generate reports to populate this feed.
            </div>
          ) : (
            <div className="space-y-2">
              {recentAlerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 px-3 py-2 rounded text-sm"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                >
                  <span
                    className={`shrink-0 text-xs font-medium px-1.5 py-0.5 rounded ${
                      a.severity === "critical" ? "badge-critical" :
                      a.severity === "high" ? "badge-high" :
                      a.severity === "medium" ? "badge-medium" : "badge-low"
                    }`}
                  >
                    {a.severity.toUpperCase()}
                  </span>
                  <span className="font-mono text-xs shrink-0" style={{ color: "var(--muted-foreground)" }}>
                    {a.source}
                  </span>
                  <span className="truncate" style={{ color: "var(--foreground)" }}>{a.title}</span>
                  {a.score !== null && (
                    <span className="shrink-0 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {a.score.toFixed(3)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Categories A-H grid */}
      <div>
        <div className="text-sm font-semibold tracking-wide uppercase mb-3" style={{ color: "var(--muted-foreground)" }}>
          Attack Categories A–H
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATEGORY_INFO.map((cat) => (
            <Link
              key={cat.key}
              href={`/dashboard#cat-${cat.key}`}
              className="rounded-lg p-4 group transition-all"
              style={{
                background: "var(--card)",
                border: `1px solid var(--border)`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="h-7 w-7 rounded flex items-center justify-center text-xs font-bold"
                  style={{ background: `${cat.color}22`, color: cat.color, border: `1px solid ${cat.color}44` }}
                >
                  {cat.key}
                </span>
                {ehTotals && ehTotals[`eh_${cat.key}`] !== undefined && (
                  <span className="font-mono text-sm font-bold" style={{ color: cat.color }}>
                    {ehTotals[`eh_${cat.key}`]}
                  </span>
                )}
              </div>
              <div className="text-sm font-medium">{cat.label}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{cat.sub}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/detection/network", label: "Network Analysis", desc: "GNN + FT-Transformer flow scoring" },
          { href: "/detection/text", label: "Text Analysis", desc: "Spam · Phishing · Scam detector" },
          { href: "/url-check", label: "URL Check", desc: "Category B malicious URL scanner" },
          { href: "/detection/anomaly", label: "Anomaly Scan", desc: "Autoencoder zero-day detection" },
          { href: "/explainability", label: "X-TIS Explain", desc: "Feature attribution & SHAP" },
          { href: "/threat-intel", label: "Threat Intel", desc: "Top IPs, ports, domains" },
          { href: "/reports", label: "Reports", desc: "CSV · JSON · HTML export" },
          { href: "/simulation", label: "Simulate Attack", desc: "A–H attack chain walkthrough" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg p-3 transition-all"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="text-sm font-medium">{item.label}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{item.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
