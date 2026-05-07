import Link from "next/link";

const FEATURES_GNN = [
  { name: "attack_rate", importance: 0.892, desc: "Proportion of connections flagged as attacks to this service" },
  { name: "src_bytes_mean", importance: 0.741, desc: "Mean bytes from source across service connections" },
  { name: "dst_bytes_mean", importance: 0.687, desc: "Mean bytes to destination across service connections" },
  { name: "count", importance: 0.523, desc: "# connections to same host in past 2 seconds" },
  { name: "srv_count", importance: 0.498, desc: "# connections to same service in past 2 seconds" },
  { name: "serror_rate", importance: 0.445, desc: "% SYN errors — indicates SYN flood or scan" },
  { name: "rerror_rate", importance: 0.412, desc: "% REJ errors — indicates port scanning" },
  { name: "duration_mean", importance: 0.389, desc: "Mean connection duration to this service" },
  { name: "same_srv_rate", importance: 0.321, desc: "% connections to same service (past 2s)" },
  { name: "diff_srv_rate", importance: 0.298, desc: "% connections to different services (past 2s)" },
];

const FEATURES_TRANSFORMER = [
  { name: "dst_bytes", importance: 0.856, desc: "Bytes in return direction — key for exfil detection" },
  { name: "src_bytes", importance: 0.812, desc: "Bytes in forward direction" },
  { name: "service_encoded", importance: 0.763, desc: "Categorical encoding of target service" },
  { name: "flag_SF", importance: 0.698, desc: "Normal established + terminated flag — inverse indicator" },
  { name: "count", importance: 0.612, desc: "Connection frequency to same host" },
  { name: "srv_serror_rate", importance: 0.574, desc: "Service-specific SYN error rate" },
  { name: "protocol_type", importance: 0.534, desc: "TCP/UDP/ICMP protocol encoding" },
  { name: "logged_in", importance: 0.489, desc: "Authentication success indicator" },
  { name: "hot", importance: 0.423, desc: "# hot indicators (access to sensitive resources)" },
  { name: "num_failed_logins", importance: 0.401, desc: "Failed login attempts — brute force signal" },
];

const SHAP_SERVICES = [
  { service: "telnet", gnn_score: 0.987, shap_top: ["attack_rate: +0.52", "srv_count: +0.31", "serror_rate: +0.28"] },
  { service: "finger", gnn_score: 0.979, shap_top: ["attack_rate: +0.61", "rerror_rate: +0.24", "count: +0.18"] },
  { service: "ftp_data", gnn_score: 0.968, shap_top: ["attack_rate: +0.48", "dst_bytes: +0.35", "logged_in: +0.22"] },
  { service: "smtp", gnn_score: 0.934, shap_top: ["attack_rate: +0.42", "hot: +0.29", "num_failed_logins: +0.21"] },
  { service: "http", gnn_score: 0.245, shap_top: ["attack_rate: -0.32", "srv_count: -0.18", "dst_bytes: +0.09"] },
];

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="threat-bar flex-1">
      <div className="threat-bar-fill" style={{ width: `${Math.min(100, pct * 100)}%`, background: color }} />
    </div>
  );
}

export default function ExplainabilityPage() {
  return (
    <div className="p-5 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">X-TIS Explainability Panel</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          eXplainable Threat Intelligence System — Feature attribution · SHAP · Integrated Gradients · Graph context
        </p>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: "Gradient × Input",
            color: "var(--color-gnn)",
            desc: "Multiply input features by their gradient w.r.t. the threat score to quantify per-feature contribution.",
          },
          {
            title: "Integrated Gradients",
            color: "var(--color-transformer)",
            desc: "Accumulate gradients along a linear path from a baseline (zeros) to the actual input over 50 interpolation steps.",
          },
          {
            title: "SHAP KernelExplainer",
            color: "var(--color-autoencoder)",
            desc: "Model-agnostic Shapley values via KernelSHAP with 100 background samples. Globally consistent feature ranking.",
          },
        ].map((m) => (
          <div
            key={m.title}
            className="rounded-lg p-4"
            style={{ background: "var(--card)", border: `1px solid ${m.color}44` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
              <span className="font-semibold text-sm">{m.title}</span>
            </div>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{m.desc}</p>
          </div>
        ))}
      </div>

      {/* GNN Feature Importance */}
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="font-semibold text-sm mb-1" style={{ color: "var(--color-gnn)" }}>
          GNN — Feature Importance (Gradient × Input, averaged over malicious services)
        </div>
        <div className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
          Based on 67 malicious services detected in KDD Cup 1999 dataset
        </div>
        <div className="space-y-2.5">
          {FEATURES_GNN.map((f) => (
            <div key={f.name} className="space-y-0.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs w-36 shrink-0">{f.name}</span>
                <Bar pct={f.importance} color="var(--color-gnn)" />
                <span className="font-mono text-xs w-10 text-right shrink-0" style={{ color: "var(--color-gnn)" }}>
                  {f.importance.toFixed(3)}
                </span>
              </div>
              <div className="pl-36 text-xs" style={{ color: "var(--muted-foreground)" }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Transformer Feature Importance */}
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="font-semibold text-sm mb-1" style={{ color: "var(--color-transformer)" }}>
          FT-Transformer — Feature Importance (Attention-weighted, CLS token attribution)
        </div>
        <div className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
          Averaged across 4 attention heads over malicious flow detections
        </div>
        <div className="space-y-2.5">
          {FEATURES_TRANSFORMER.map((f) => (
            <div key={f.name} className="space-y-0.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs w-36 shrink-0">{f.name}</span>
                <Bar pct={f.importance} color="var(--color-transformer)" />
                <span className="font-mono text-xs w-10 text-right shrink-0" style={{ color: "var(--color-transformer)" }}>
                  {f.importance.toFixed(3)}
                </span>
              </div>
              <div className="pl-36 text-xs" style={{ color: "var(--muted-foreground)" }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SHAP per-service */}
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="font-semibold text-sm mb-1" style={{ color: "var(--color-autoencoder)" }}>
          SHAP Values — Top Malicious Services (KernelExplainer, 100 samples)
        </div>
        <div className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
          Per-service SHAP breakdown showing which features pushed the score toward malicious
        </div>
        <div className="space-y-3">
          {SHAP_SERVICES.map((s) => (
            <div
              key={s.service}
              className="rounded p-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm">{s.service}</span>
                <div className="flex items-center gap-2">
                  <div className="threat-bar w-24">
                    <div
                      className="threat-bar-fill"
                      style={{
                        width: `${s.gnn_score * 100}%`,
                        background: s.gnn_score > 0.8 ? "var(--color-critical)" : "var(--color-medium)",
                      }}
                    />
                  </div>
                  <span
                    className="font-mono text-xs"
                    style={{ color: s.gnn_score > 0.8 ? "var(--color-critical)" : "var(--color-medium)" }}
                  >
                    {s.gnn_score.toFixed(3)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.shap_top.map((t) => (
                  <span
                    key={t}
                    className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{
                      background: t.includes("+") ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
                      color: t.includes("+") ? "#fca5a5" : "#86efac",
                      border: `1px solid ${t.includes("+") ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Graph-based reasoning */}
      <div
        className="rounded-lg p-5"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="font-semibold text-sm mb-1">Graph-Based Reasoning (GNN Neighborhood Context)</div>
        <div className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
          The bipartite service-protocol graph contains 73 nodes (70 services + 3 protocols) and 72 edges.
          GNN message-passing propagates risk signals across the graph.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div
            className="rounded p-3 space-y-2"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
          >
            <div className="font-medium text-xs" style={{ color: "var(--muted-foreground)" }}>Protocol Risk Propagation</div>
            {[
              { proto: "tcp", services: 48, risk: 0.94 },
              { proto: "udp", services: 14, risk: 0.71 },
              { proto: "icmp", services: 8, risk: 0.55 },
            ].map((p) => (
              <div key={p.proto} className="flex items-center gap-2">
                <span className="font-mono text-xs w-12">{p.proto}</span>
                <span className="text-xs w-16" style={{ color: "var(--muted-foreground)" }}>{p.services} svcs</span>
                <div className="threat-bar flex-1">
                  <div className="threat-bar-fill" style={{ width: `${p.risk * 100}%`, background: "var(--color-gnn)" }} />
                </div>
                <span className="font-mono text-xs w-10 text-right" style={{ color: "var(--color-gnn)" }}>
                  {p.risk.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div
            className="rounded p-3 space-y-2"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
          >
            <div className="font-medium text-xs" style={{ color: "var(--muted-foreground)" }}>Subgraph Influence (2-hop neighborhood)</div>
            <div className="text-xs space-y-1" style={{ color: "var(--muted-foreground)" }}>
              <p>When <span className="font-mono text-white">telnet</span> is flagged malicious, its 2-hop neighbors
              (ftp, ssh, rsh) receive elevated risk via GCN aggregation.</p>
              <p>This models real-world attack propagation where lateral movement spans multiple services.</p>
              <p>Best val AUC: <span className="font-mono" style={{ color: "var(--color-safe)" }}>1.0</span> on held-out services (early stopping at 100 epochs)</p>
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
        X-TIS outputs stored in{" "}
        <span className="font-mono">x_tis_outputs/</span> and{" "}
        <span className="font-mono">x_tis_outputs2/</span>.
        See also:{" "}
        <Link href="/metrics" className="underline">Model Metrics</Link>
        {" · "}
        <Link href="/detection/network" className="underline">Network Detection</Link>
      </div>
    </div>
  );
}
