"use client";

import { useState } from "react";

type NetworkAnalyzeResult = {
  input: Record<string, string | number>;
  gnn_score: number;
  transformer_score: number;
  fusion_score: number;
  risk: "low" | "medium" | "high" | "critical";
  categories: string[];
  subcategories: string[];
  features_used: string[];
};

const EXAMPLE_FLOWS = [
  {
    label: "Benign HTTP Traffic",
    values: {
      protocol: "tcp", service: "http", src_bytes: 215, dst_bytes: 45076, duration: 0,
      count: 6, srv_count: 6, flag: "SF",
    },
  },
  {
    label: "Port Scan (Category C)",
    values: {
      protocol: "tcp", service: "private", src_bytes: 0, dst_bytes: 0, duration: 0,
      count: 511, srv_count: 3, flag: "REJ",
    },
  },
  {
    label: "Botnet C2 Beacon (Category E)",
    values: {
      protocol: "tcp", service: "http", src_bytes: 128, dst_bytes: 146, duration: 0,
      count: 289, srv_count: 289, flag: "SF",
    },
  },
  {
    label: "Data Exfiltration (Category F)",
    values: {
      protocol: "tcp", service: "smtp", src_bytes: 8000, dst_bytes: 60000, duration: 2,
      count: 5, srv_count: 5, flag: "SF",
    },
  },
];

const FIELD_HINTS: Record<string, string> = {
  protocol: "tcp / udp / icmp",
  service: "http / smtp / ftp / ssh / private / etc.",
  src_bytes: "Bytes from source to dest",
  dst_bytes: "Bytes from dest to source",
  duration: "Connection duration (seconds)",
  count: "# connections to same host in past 2s",
  srv_count: "# connections to same service in past 2s",
  flag: "SF / REJ / RSTO / S0 / etc.",
};

function RiskBadge({ risk }: { risk: NetworkAnalyzeResult["risk"] }) {
  const styles: Record<string, string> = {
    critical: "badge-critical",
    high: "badge-high",
    medium: "badge-medium",
    low: "badge-low",
  };
  return (
    <span className={`${styles[risk]} text-sm font-bold px-3 py-1 rounded`}>
      {risk.toUpperCase()} RISK
      <span className="ml-2 text-xs font-normal">threat detected</span>
    </span>
  );
}

export default function NetworkDetectionPage() {
  const [fields, setFields] = useState({
    protocol: "tcp",
    service: "http",
    src_bytes: 215,
    dst_bytes: 45076,
    duration: 0,
    count: 6,
    srv_count: 6,
    flag: "SF",
  });
  const [result, setResult] = useState<NetworkAnalyzeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadExample(idx: number) {
    const ex = EXAMPLE_FLOWS[idx];
    setFields(ex.values as typeof fields);
    setResult(null);
  }

  async function runAnalysis() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/network/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json() as NetworkAnalyzeResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const gnnPct = result ? Math.min(100, result.gnn_score * 100) : 0;
  const ftPct = result ? Math.min(100, result.transformer_score * 100) : 0;
  const fusionPct = result ? Math.min(100, result.fusion_score * 100) : 0;

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Network Detection</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          GNN (SimpleGCN) + FT-Transformer fusion · Categories C–H · KDD Cup 1999 features
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Input Form */}
        <div className="space-y-4">
          {/* Examples */}
          <div
            className="rounded-lg p-4"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="text-sm font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
              Load Example
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_FLOWS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => loadExample(i)}
                  className="text-xs px-2.5 py-1 rounded transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Flow fields */}
          <div
            className="rounded-lg p-4 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="text-sm font-semibold" style={{ color: "var(--muted-foreground)" }}>
              Network Flow Features (KDD-style)
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(fields) as Array<keyof typeof fields>).map((key) => (
                <div key={key}>
                  <label className="text-xs mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                    {key}
                    {FIELD_HINTS[key] && (
                      <span className="ml-1 opacity-60">({FIELD_HINTS[key]})</span>
                    )}
                  </label>
                  <input
                    type={typeof fields[key] === "number" ? "number" : "text"}
                    value={fields[key]}
                    onChange={(e) =>
                      setFields((prev) => ({
                        ...prev,
                        [key]: typeof prev[key] === "number" ? Number(e.target.value) : e.target.value,
                      }))
                    }
                    className="w-full rounded px-2.5 py-1.5 text-sm font-mono"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={runAnalysis}
              disabled={busy}
              className="w-full py-2 rounded text-sm font-medium transition-all disabled:opacity-50"
              style={{ background: "#3b82f6", color: "white" }}
            >
              {busy ? "Analyzing…" : "Run Detection (GNN + Transformer Fusion)"}
            </button>

            {error && (
              <div className="text-sm" style={{ color: "var(--color-critical)" }}>{error}</div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Risk badge */}
              <div
                className="rounded-lg p-4 space-y-3"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <RiskBadge risk={result.risk} />

                {/* Score bars */}
                <div className="space-y-3 mt-3">
                  {[
                    { label: "GNN Score", val: result.gnn_score, pct: gnnPct, color: "var(--color-gnn)" },
                    { label: "FT-Transformer", val: result.transformer_score, pct: ftPct, color: "var(--color-transformer)" },
                    { label: "Fusion (70/30)", val: result.fusion_score, pct: fusionPct, color: "#3b82f6" },
                  ].map((s) => (
                    <div key={s.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span style={{ color: "var(--muted-foreground)" }}>{s.label}</span>
                        <span className="font-mono" style={{ color: s.color }}>{s.val.toFixed(4)}</span>
                      </div>
                      <div className="threat-bar">
                        <div className="threat-bar-fill" style={{ width: `${s.pct}%`, background: s.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Categories detected */}
              {result.categories.length > 0 && (
                <div
                  className="rounded-lg p-4"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div className="text-sm font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
                    Detected Categories
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.categories.map((c) => (
                      <span key={c} className="badge-critical text-xs px-2 py-0.5 rounded">{c}</span>
                    ))}
                  </div>
                  {result.subcategories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {result.subcategories.map((s) => (
                        <span key={s} className="badge-high text-xs px-2 py-0.5 rounded">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Features used */}
              <div
                className="rounded-lg p-4"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <div className="text-sm font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
                  Features Contributing to Detection
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.features_used.map((f) => (
                    <span
                      key={f}
                      className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{ background: "rgba(139,92,246,0.15)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.3)" }}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div
              className="rounded-lg p-6 space-y-3"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="text-sm font-medium">Detection System Ready</div>
              <div className="space-y-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                <p>
                  <strong style={{ color: "var(--foreground)" }}>GNN (SimpleGCN)</strong> — Service-protocol bipartite graph,
                  2-layer GCN, binary classification (benign / malicious) at service level.
                </p>
                <p>
                  <strong style={{ color: "var(--foreground)" }}>FT-Transformer</strong> — Flow-level tabular transformer,
                  Feature Tokenizer + 4 attention blocks, per-flow probability scoring.
                </p>
                <p>
                  <strong style={{ color: "var(--foreground)" }}>Fusion (70/30)</strong> — Combines transformer flow
                  probability (70%) + GNN service risk (30%) for final threat score.
                </p>
                <p>
                  <strong style={{ color: "var(--foreground)" }}>Categories detected</strong> — C (Network), D (Lateral),
                  E (Botnet/C2), F (Exfil), G (Malware), H (Multi-stage)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Architecture info */}
      <div
        className="rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div>
          <div className="font-medium mb-1" style={{ color: "var(--color-gnn)" }}>GNN Architecture</div>
          <div style={{ color: "var(--muted-foreground)" }}>
            Input (14 features) → Linear(14→16) → GraphConv → ReLU →
            Linear(16→2) → GraphConv → Softmax
          </div>
        </div>
        <div>
          <div className="font-medium mb-1" style={{ color: "var(--color-transformer)" }}>FT-Transformer Architecture</div>
          <div style={{ color: "var(--muted-foreground)" }}>
            Numeric tokenizer (x·W+b) → CLS token prepend →
            4× [MultiHead(8h) + FFN(GELU)] → CLS → binary output
          </div>
        </div>
        <div>
          <div className="font-medium mb-1" style={{ color: "#3b82f6" }}>Dataset Info</div>
          <div style={{ color: "var(--muted-foreground)" }}>
            KDD Cup 1999: 125,973 connections · 41 features · 22 attack types ·
            5 main categories
          </div>
        </div>
      </div>
    </div>
  );
}
