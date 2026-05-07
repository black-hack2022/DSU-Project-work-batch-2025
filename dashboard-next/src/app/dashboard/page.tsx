import path from "path";
import Link from "next/link";
import { resolveArtifactBases } from "@/lib/artifactPaths";
import { readJsonFile } from "@/lib/fsRead";
import { loadAlerts } from "@/lib/alerts";
import type { MetricsJson } from "@/lib/types";

type CatDef = {
  key: string;
  label: string;
  color: string;
  model: string;
  subcategories: string[];
  detailHref?: string;
};

const CATEGORIES: CatDef[] = [
  {
    key: "A",
    label: "Text / Email Threats",
    color: "#8b5cf6",
    model: "Heuristic · NLP features",
    subcategories: ["Spam email", "Phishing email", "SMS scam", "Social engineering"],
    detailHref: "/detection/text",
  },
  {
    key: "B",
    label: "Malicious URLs / Web",
    color: "#06b6d4",
    model: "Heuristic scoring · HTML analysis",
    subcategories: [
      "URL shorteners / redirects",
      "IP-based hosts",
      "Suspicious TLDs",
      "Brand spoofing / Punycode",
      "Drive-by download",
      "Password harvesting",
    ],
    detailHref: "/url-check",
  },
  {
    key: "C",
    label: "Network-Based Attacks",
    color: "#ef4444",
    model: "Network heuristics",
    subcategories: [
      "Port scanning",
      "Service enumeration",
      "ICMP reconnaissance",
      "Brute-force login",
      "Credential stuffing",
      "SSH attacks",
      "RDP attacks",
    ],
    detailHref: "/detection/network",
  },
  {
    key: "D",
    label: "Lateral Movement",
    color: "#f97316",
    model: "Network heuristics",
    subcategories: [
      "SMB lateral movement",
      "NetBIOS attacks",
      "Pass-the-Hash",
      "Pass-the-Ticket",
      "Internal pivoting",
      "East–West traffic abuse",
    ],
    detailHref: "/detection/network",
  },
  {
    key: "E",
    label: "Botnets / C2",
    color: "#eab308",
    model: "GNN + FT-Transformer + Taxonomy",
    subcategories: [
      "IRC-based botnets",
      "HTTP/HTTPS beaconing",
      "DNS tunneling",
      "P2P botnets",
      "Fast-flux domains",
      "DGA traffic",
    ],
    detailHref: "/detections?cat=E",
  },
  {
    key: "F",
    label: "Data Exfiltration",
    color: "#ec4899",
    model: "GNN + FT-Transformer + Taxonomy",
    subcategories: [
      "SMTP/IMAP exfiltration",
      "DNS-based exfiltration",
      "HTTP POST leakage",
    ],
    detailHref: "/detections?cat=F",
  },
  {
    key: "G",
    label: "Malware Behavior",
    color: "#10b981",
    model: "GNN + FT-Transformer + Taxonomy",
    subcategories: [
      "Malware beaconing",
      "Backdoor communication",
      "Botnet behavior",
      "Persistence behavior",
      "Memory dump behavior",
    ],
    detailHref: "/detections?cat=G",
  },
  {
    key: "H",
    label: "Multi-Stage / Unknown",
    color: "#3b82f6",
    model: "GNN + Autoencoder + Taxonomy",
    subcategories: [
      "Multi-stage attack chains",
      "Slow-and-low attacks",
      "Coordinated campaigns",
      "Unknown / zero-day patterns",
      "Structural anomalies",
      "Temporal anomalies",
    ],
    detailHref: "/detections?cat=H",
  },
];

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="threat-bar w-full mt-2">
      <div
        className="threat-bar-fill"
        style={{ width: `${Math.min(100, pct)}%`, background: color }}
      />
    </div>
  );
}

export default async function DashboardPage() {
  const bases = resolveArtifactBases();
  const metricsPath = path.join(bases.generatedReportDir, "metrics.json");
  const metrics = await readJsonFile<MetricsJson>(metricsPath);
  const alerts = await loadAlerts(bases.generatedReportDir);

  const ehTotals = (metrics?.eh_categories as Record<string, Record<string, number>> | null)?.totals ?? null;
  const totalAlerts = alerts.length;

  const bySeverity = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    high: alerts.filter((a) => a.severity === "high").length,
    medium: alerts.filter((a) => a.severity === "medium").length,
    low: alerts.filter((a) => a.severity === "low").length,
  };

  const bySource = {
    gnn: alerts.filter((a) => a.source === "gnn").length,
    transformer: alerts.filter((a) => a.source === "transformer").length,
    autoencoder: alerts.filter((a) => a.source === "autoencoder").length,
  };

  return (
    <div className="p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">A–H Threat Dashboard</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Unified view across all 8 attack categories and detection models
          </p>
        </div>
        <Link
          href="/alerts"
          className="text-xs px-3 py-1.5 rounded"
          style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)" }}
        >
          View All Alerts →
        </Link>
      </div>

      {/* Severity overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Critical", count: bySeverity.critical, color: "var(--color-critical)", pct: totalAlerts > 0 ? (bySeverity.critical / totalAlerts) * 100 : 0 },
          { label: "High", count: bySeverity.high, color: "var(--color-high)", pct: totalAlerts > 0 ? (bySeverity.high / totalAlerts) * 100 : 0 },
          { label: "Medium", count: bySeverity.medium, color: "var(--color-medium)", pct: totalAlerts > 0 ? (bySeverity.medium / totalAlerts) * 100 : 0 },
          { label: "Low", count: bySeverity.low, color: "var(--color-low)", pct: totalAlerts > 0 ? (bySeverity.low / totalAlerts) * 100 : 0 },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg p-4"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="text-xs uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
              {s.label}
            </div>
            <div className="text-2xl font-bold font-mono mt-1" style={{ color: s.color }}>
              {s.count}
            </div>
            <MiniBar pct={s.pct} color={s.color} />
            <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
              {s.pct.toFixed(1)}% of total
            </div>
          </div>
        ))}
      </div>

      {/* Source breakdown */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted-foreground)" }}>
          Detection Source Breakdown
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "GNN", count: bySource.gnn, color: "var(--color-gnn)", desc: "Service-level graph" },
            { label: "FT-Transformer", count: bySource.transformer, color: "var(--color-transformer)", desc: "Flow-level scoring" },
            { label: "Autoencoder", count: bySource.autoencoder, color: "var(--color-autoencoder)", desc: "Anomaly scoring" },
          ].map((s) => (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              <div className="text-2xl font-bold font-mono" style={{ color: s.color }}>
                {s.count}
              </div>
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{s.desc}</div>
              <MiniBar
                pct={totalAlerts > 0 ? (s.count / totalAlerts) * 100 : 0}
                color={s.color}
              />
            </div>
          ))}
        </div>
      </div>

      {/* A-H category grid */}
      <div>
        <div className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted-foreground)" }}>
          Category Detail
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CATEGORIES.map((cat) => {
            const ehCount = ehTotals?.[`eh_${cat.key}`];
            return (
              <div
                key={cat.key}
                id={`cat-${cat.key}`}
                className="rounded-lg p-4"
                style={{
                  background: "var(--card)",
                  border: `1px solid ${cat.color}33`,
                }}
              >
                {/* Category header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-8 w-8 rounded flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        background: `${cat.color}22`,
                        color: cat.color,
                        border: `1px solid ${cat.color}44`,
                      }}
                    >
                      {cat.key}
                    </span>
                    <div>
                      <div className="font-semibold text-sm">{cat.label}</div>
                      <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {cat.model}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {ehCount !== undefined ? (
                      <span className="font-mono font-bold text-lg" style={{ color: cat.color }}>
                        {ehCount}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>—</span>
                    )}
                    {cat.detailHref && (
                      <div>
                        <Link href={cat.detailHref} className="text-xs" style={{ color: "#3b82f6" }}>
                          Details →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Subcategories */}
                <div className="flex flex-wrap gap-1.5">
                  {cat.subcategories.map((sub) => (
                    <span
                      key={sub}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: `${cat.color}11`,
                        color: cat.color,
                        border: `1px solid ${cat.color}33`,
                      }}
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer note */}
      <div
        className="rounded-lg p-4 text-xs"
        style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
      >
        <strong style={{ color: "var(--foreground)" }}>Data sources:</strong> KDD Cup 1999 (125,973 flows) · UNSW-NB15 · SpamAssassin · Kaggle Spam · SMS Spam Collection ·
        Artifacts resolved from: <span className="font-mono">{bases.generatedReportDir}</span>
      </div>
    </div>
  );
}
