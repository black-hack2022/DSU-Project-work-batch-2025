"use client";

import { useState } from "react";

type AnomalyResult = {
  recon_mse: number;
  threshold: number;
  is_anomaly: boolean;
  anomaly_score: number; // normalized 0-1
  risk: "low" | "medium" | "high" | "critical";
  top_anomalous_features: Array<{ feature: string; contribution: number }>;
  possible_categories: string[];
};

const UNSW_FEATURES = [
  "dur", "proto", "service", "state", "spkts", "dpkts",
  "sbytes", "dbytes", "rate", "sload", "dload", "sloss", "dloss",
  "sinpkt", "dinpkt", "sjit", "djit", "swin", "stcpb", "dtcpb",
  "dwin", "tcprtt", "synack", "ackdat", "smean", "dmean", "trans_depth",
];

const EXAMPLE_FLOWS: Array<{ label: string; values: Record<string, number> }> = [
  {
    label: "Normal HTTP",
    values: { dur: 0.121, spkts: 6, dpkts: 5, sbytes: 491, dbytes: 1020, rate: 89.3, sload: 32456, dload: 67890, sloss: 0, dloss: 0, sinpkt: 0.024, dinpkt: 0.024, sjit: 0, djit: 0, swin: 255, dwin: 255, tcprtt: 0.002, synack: 0.001, ackdat: 0.001 },
  },
  {
    label: "DNS Tunneling (Cat H)",
    values: { dur: 0.0, spkts: 1, dpkts: 1, sbytes: 512, dbytes: 512, rate: 0, sload: 0, dload: 0, sloss: 0, dloss: 0, sinpkt: 0, dinpkt: 0, sjit: 0, djit: 0, swin: 0, dwin: 0, tcprtt: 0, synack: 0, ackdat: 0 },
  },
  {
    label: "Exfil burst (Cat F)",
    values: { dur: 2.4, spkts: 85, dpkts: 3, sbytes: 89340, dbytes: 620, rate: 294.2, sload: 297800, dload: 2066, sloss: 0, dloss: 0, sinpkt: 0.028, dinpkt: 0.8, sjit: 0.001, djit: 0.3, swin: 255, dwin: 62, tcprtt: 0.015, synack: 0.001, ackdat: 0.014 },
  },
];

export default function AnomalyDetectionPage() {
  const [inputValues, setInputValues] = useState<Record<string, number>>(
    EXAMPLE_FLOWS[0].values
  );
  const [result, setResult] = useState<AnomalyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runDetection() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/anomaly/score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(inputValues),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json() as AnomalyResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const maxContrib = result
    ? Math.max(...result.top_anomalous_features.map((f) => f.contribution))
    : 1;

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Anomaly Detection</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          MLP Autoencoder — Unsupervised zero-day detection · Trained on UNSW-NB15 normal traffic
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Input */}
        <div className="space-y-4">
          {/* Examples */}
          <div
            className="rounded-lg p-4"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="text-sm font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
              Load Example Flow
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_FLOWS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => { setInputValues(ex.values); setResult(null); }}
                  className="text-xs px-2.5 py-1 rounded"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Feature inputs */}
          <div
            className="rounded-lg p-4 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="text-sm font-semibold" style={{ color: "var(--muted-foreground)" }}>
              UNSW-NB15 Flow Features
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
              {UNSW_FEATURES.filter((f) => inputValues[f] !== undefined).map((feat) => (
                <div key={feat}>
                  <label className="text-xs mb-0.5 block font-mono" style={{ color: "var(--muted-foreground)" }}>
                    {feat}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={inputValues[feat] ?? 0}
                    onChange={(e) =>
                      setInputValues((prev) => ({ ...prev, [feat]: Number(e.target.value) }))
                    }
                    className="w-full rounded px-2 py-1 text-xs font-mono"
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
              onClick={runDetection}
              disabled={busy}
              className="w-full py-2 rounded text-sm font-medium disabled:opacity-50"
              style={{ background: "var(--color-autoencoder)", color: "#000" }}
            >
              {busy ? "Scoring…" : "Run Autoencoder Anomaly Score"}
            </button>

            {error && <div className="text-sm" style={{ color: "var(--color-critical)" }}>{error}</div>}
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Verdict */}
              <div
                className="rounded-lg p-4 space-y-3"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-lg">
                      {result.is_anomaly ? "ANOMALY DETECTED" : "NORMAL FLOW"}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      Reconstruction MSE: <span className="font-mono">{result.recon_mse.toFixed(6)}</span>
                      {" · "}
                      Threshold: <span className="font-mono">{result.threshold.toFixed(6)}</span>
                    </div>
                  </div>
                  <span className={`text-sm font-bold px-3 py-1.5 rounded ${result.is_anomaly ? "badge-critical" : "badge-safe"}`}>
                    {result.risk.toUpperCase()}
                  </span>
                </div>

                {/* Anomaly score bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "var(--muted-foreground)" }}>Anomaly Score (normalized)</span>
                    <span className="font-mono" style={{ color: result.is_anomaly ? "var(--color-critical)" : "var(--color-safe)" }}>
                      {result.anomaly_score.toFixed(4)}
                    </span>
                  </div>
                  <div className="threat-bar">
                    <div
                      className="threat-bar-fill"
                      style={{
                        width: `${Math.min(100, result.anomaly_score * 100)}%`,
                        background: result.is_anomaly ? "var(--color-critical)" : "var(--color-safe)",
                      }}
                    />
                  </div>
                </div>

                {/* Threshold line indicator */}
                <div className="relative pt-2">
                  <div className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
                    MSE vs Threshold
                  </div>
                  <div className="h-6 rounded relative overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full absolute left-0 top-0 transition-all"
                      style={{
                        width: `${Math.min(100, (result.recon_mse / (result.threshold * 3)) * 100)}%`,
                        background: result.is_anomaly ? "rgba(239,68,68,0.6)" : "rgba(34,197,94,0.6)",
                      }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5"
                      style={{
                        left: `${Math.min(100, (result.threshold / (result.threshold * 3)) * 100)}%`,
                        background: "#facc15",
                      }}
                    />
                    <div className="absolute text-xs right-1 top-1" style={{ color: "var(--muted-foreground)" }}>
                      threshold ──
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature contributions */}
              {result.top_anomalous_features.length > 0 && (
                <div
                  className="rounded-lg p-4"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div className="text-sm font-semibold mb-3" style={{ color: "var(--muted-foreground)" }}>
                    Top Anomalous Features
                  </div>
                  <div className="space-y-2">
                    {result.top_anomalous_features.map((f) => (
                      <div key={f.feature} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-mono">{f.feature}</span>
                          <span style={{ color: "var(--color-autoencoder)" }}>
                            {f.contribution.toFixed(4)}
                          </span>
                        </div>
                        <div className="threat-bar">
                          <div
                            className="threat-bar-fill"
                            style={{
                              width: `${(f.contribution / maxContrib) * 100}%`,
                              background: "var(--color-autoencoder)",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Possible categories */}
              {result.possible_categories.length > 0 && (
                <div
                  className="rounded-lg p-4"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div className="text-sm font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
                    Possible Attack Categories
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.possible_categories.map((c) => (
                      <span key={c} className="badge-high text-xs px-2 py-0.5 rounded">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              className="rounded-lg p-6 space-y-3"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="text-sm font-medium">MLP Autoencoder — Zero-Day Detection</div>
              <div className="space-y-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                <p>
                  <strong style={{ color: "var(--foreground)" }}>Architecture:</strong>{" "}
                  Input → 256 → 128 → 32 (bottleneck) → 128 → 256 → Output.
                  Linear + ReLU + optional Dropout at each layer.
                </p>
                <p>
                  <strong style={{ color: "var(--foreground)" }}>Detection method:</strong>{" "}
                  Reconstruction MSE. Trained on normal traffic only.
                  Anomalies produce high reconstruction error — flagged when MSE exceeds threshold.
                </p>
                <p>
                  <strong style={{ color: "var(--foreground)" }}>Threshold selection:</strong>{" "}
                  p99.5 percentile on training set reconstruction errors,
                  also evaluated with mean+3σ method.
                </p>
                <p>
                  <strong style={{ color: "var(--foreground)" }}>Dataset:</strong>{" "}
                  UNSW-NB15 (normal traffic subset). 49 raw features after preprocessing.
                </p>
                <p>
                  <strong style={{ color: "var(--foreground)" }}>Detects:</strong>{" "}
                  Zero-day attacks, unknown patterns, structural anomalies (Category H),
                  slow-and-low attacks, previously unseen behaviors.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
