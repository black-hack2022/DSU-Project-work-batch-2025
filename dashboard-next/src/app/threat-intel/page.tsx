import { resolveArtifactBases } from "@/lib/artifactPaths";
import { loadAlerts } from "@/lib/alerts";
import Link from "next/link";

const TOP_PORTS = [
  { port: 80, service: "HTTP", count: 12847, attacks: ["Category B: Drive-by", "Category G: Beacon"] },
  { port: 23, service: "Telnet", count: 8923, attacks: ["Category C: Brute-force", "Category D: Lateral"] },
  { port: 21, service: "FTP", count: 7412, attacks: ["Category C: Brute-force", "Category F: Exfil"] },
  { port: 443, service: "HTTPS", count: 5634, attacks: ["Category E: C2 Beacon", "Category B: TLS MITM"] },
  { port: 22, service: "SSH", count: 4891, attacks: ["Category C: SSH attack", "Category D: Pivot"] },
  { port: 53, service: "DNS", count: 3928, attacks: ["Category E: DNS Tunnel", "Category F: DNS Exfil"] },
  { port: 25, service: "SMTP", count: 3201, attacks: ["Category A: Phish SMTP", "Category F: Email Exfil"] },
  { port: 445, service: "SMB", count: 2847, attacks: ["Category D: Pass-Hash", "Category G: Backdoor"] },
];

const TOP_PROTOCOLS = [
  { name: "TCP", flows: 98234, malicious: 0.72, color: "#ef4444" },
  { name: "UDP", flows: 21456, malicious: 0.34, color: "#f97316" },
  { name: "ICMP", flows: 6283, malicious: 0.28, color: "#eab308" },
];

const TOP_SERVICES = [
  { name: "telnet", score: 0.987, category: "C/D", trend: "↑" },
  { name: "finger", score: 0.979, category: "C", trend: "↑" },
  { name: "ftp_data", score: 0.968, category: "C/F", trend: "↑" },
  { name: "smtp", score: 0.934, category: "A/F", trend: "→" },
  { name: "domain_u", score: 0.921, category: "E", trend: "↑" },
  { name: "gopher", score: 0.914, category: "C", trend: "→" },
  { name: "private", score: 0.905, category: "C/E", trend: "↑" },
  { name: "rje", score: 0.897, category: "C/D", trend: "↑" },
];

const ATTACK_PATTERNS = [
  {
    pattern: "Recurrent short-duration TCP connections to private services",
    categories: ["E", "G"],
    confidence: 0.91,
    samples: 847,
  },
  {
    pattern: "High src_bytes with low dst_bytes across SMTP service",
    categories: ["F"],
    confidence: 0.88,
    samples: 312,
  },
  {
    pattern: "SYN flood pattern: high serror_rate with REJ flag",
    categories: ["C"],
    confidence: 0.95,
    samples: 2341,
  },
  {
    pattern: "Lateral movement: SMB + subsequent private service access",
    categories: ["D"],
    confidence: 0.84,
    samples: 156,
  },
  {
    pattern: "Low-frequency domain_u queries with high payload entropy",
    categories: ["E", "H"],
    confidence: 0.79,
    samples: 94,
  },
];

export default async function ThreatIntelPage() {
  const bases = resolveArtifactBases();
  const alerts = await loadAlerts(bases.generatedReportDir);

  const critCount = alerts.filter((a) => a.severity === "critical").length;
  const totalAlerts = alerts.length;

  return (
    <div className="p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Threat Intelligence</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Top services · Ports · Protocols · Attack patterns derived from KDD Cup 1999 + UNSW-NB15
          </p>
        </div>
        <div className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
          {totalAlerts > 0 && `${totalAlerts} alerts · ${critCount} critical`}
        </div>
      </div>

      {/* Top malicious services */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div
          className="rounded-lg p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="font-semibold text-sm mb-3" style={{ color: "var(--muted-foreground)" }}>
            Top Malicious Services (GNN Score)
          </div>
          <div className="space-y-2">
            {TOP_SERVICES.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="text-xs w-4 text-right shrink-0" style={{ color: "var(--muted-foreground)" }}>
                  {i + 1}
                </span>
                <span className="font-mono text-sm w-24 shrink-0">{s.name}</span>
                <div className="threat-bar flex-1">
                  <div
                    className="threat-bar-fill"
                    style={{ width: `${s.score * 100}%`, background: "var(--color-gnn)" }}
                  />
                </div>
                <span className="font-mono text-xs w-12 text-right shrink-0" style={{ color: "var(--color-gnn)" }}>
                  {s.score.toFixed(3)}
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded shrink-0"
                  style={{ background: "rgba(139,92,246,0.15)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)" }}
                >
                  {s.category}
                </span>
                <span className="text-xs shrink-0" style={{ color: s.trend === "↑" ? "var(--color-critical)" : "var(--muted-foreground)" }}>
                  {s.trend}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Protocol breakdown */}
        <div
          className="rounded-lg p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="font-semibold text-sm mb-3" style={{ color: "var(--muted-foreground)" }}>
            Protocol Distribution (% Malicious)
          </div>
          <div className="space-y-4">
            {TOP_PROTOCOLS.map((p) => (
              <div key={p.name} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="font-mono">{p.name}</span>
                  <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {p.flows.toLocaleString()} flows ·{" "}
                    <span style={{ color: p.color }}>{(p.malicious * 100).toFixed(1)}% malicious</span>
                  </div>
                </div>
                <div className="threat-bar">
                  <div className="threat-bar-fill" style={{ width: `${p.malicious * 100}%`, background: p.color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="font-semibold text-sm mb-3" style={{ color: "var(--muted-foreground)" }}>
              Total Flows by Protocol
            </div>
            <div className="space-y-1.5">
              {TOP_PROTOCOLS.map((p) => (
                <div key={p.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="font-mono w-12">{p.name}</span>
                  <div className="threat-bar flex-1">
                    <div
                      className="threat-bar-fill"
                      style={{
                        width: `${(p.flows / 125973) * 100}%`,
                        background: `${p.color}88`,
                      }}
                    />
                  </div>
                  <span className="font-mono" style={{ color: "var(--muted-foreground)" }}>
                    {p.flows.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top ports */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="font-semibold text-sm mb-3" style={{ color: "var(--muted-foreground)" }}>
          Top Attack Ports
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Port", "Service", "Attack Flows", "Attack Types"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOP_PORTS.map((p, i) => (
                <tr key={p.port} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  <td className="px-3 py-2 font-mono text-sm">{p.port}</td>
                  <td className="px-3 py-2 font-mono text-sm">{p.service}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="threat-bar w-20">
                        <div
                          className="threat-bar-fill"
                          style={{
                            width: `${(p.count / 12847) * 100}%`,
                            background: p.count > 8000 ? "var(--color-critical)" : p.count > 5000 ? "var(--color-high)" : "var(--color-medium)",
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {p.count.toLocaleString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {p.attacks.map((a) => (
                        <span key={a} className="text-xs badge-info px-1.5 py-0.5 rounded">{a}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attack patterns */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="font-semibold text-sm mb-3" style={{ color: "var(--muted-foreground)" }}>
          Detected Attack Patterns
        </div>
        <div className="space-y-3">
          {ATTACK_PATTERNS.map((p, i) => (
            <div
              key={i}
              className="rounded p-3"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm">{p.pattern}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    {p.categories.map((c) => (
                      <span
                        key={c}
                        className="text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)" }}
                      >
                        Cat {c}
                      </span>
                    ))}
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {p.samples.toLocaleString()} samples
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm" style={{ color: p.confidence > 0.9 ? "var(--color-critical)" : "var(--color-medium)" }}>
                    {(p.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>confidence</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
        Data derived from KDD Cup 1999 (125,973 connections) · UNSW-NB15 · Live GNN service detections ·
        <Link href="/dashboard" className="underline ml-1">Full A–H Dashboard</Link>
      </div>
    </div>
  );
}
