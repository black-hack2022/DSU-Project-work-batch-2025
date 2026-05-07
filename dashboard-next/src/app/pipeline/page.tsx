"use client";

import { useEffect, useState, useCallback } from "react";

type FileStatus = {
  exists: boolean;
  mtime: string | null;
  size: number | null;
};

type StatusResponse = {
  checked_at: string;
  repo_root: string;
  artifacts: Record<string, FileStatus>;
  steps_ready: Record<string, boolean>;
};

type RunResult = {
  success?: boolean;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  error?: string;
};

const STEPS = [
  {
    id: "step1_capture",
    number: "01",
    title: "Network Capture",
    subtitle: "Capture raw packets via tshark",
    description:
      "Intercept live traffic on a network interface with tshark. The pcap file feeds every downstream step.",
    triggerable: false,
    tag: "Manual",
    commands: [
      {
        label: "Start capture (60 s)",
        cmd: "python security_stack/pcap_capture.py --interface eth0 --duration 60 --out capture.pcap",
      },
      {
        label: "Verify tshark",
        cmd: "tshark --version",
      },
    ],
    artifacts: [],
  },
  {
    id: "step2_flows",
    number: "02",
    title: "Flow Extraction",
    subtitle: "Zeek · Suricata · CICFlowMeter",
    description:
      "Parse the pcap through one or all three sensors to produce normalised flow records. Each sensor adds a different feature set; build_flows.py merges them.",
    triggerable: false,
    tag: "Manual",
    commands: [
      {
        label: "CICFlowMeter (80+ features)",
        cmd: "python security_stack/cicflowmeter.py --pcap capture.pcap --out flows_cicflow.csv",
      },
      {
        label: "Zeek (conn + dns + http + ssl logs)",
        cmd: "zeek -r capture.pcap && python security_stack/parsers/zeek.py",
      },
      {
        label: "Suricata (eve.json)",
        cmd: "suricata -r capture.pcap -l suricata_logs/ && python security_stack/parsers/suricata.py",
      },
    ],
    artifacts: ["build_flows_script", "cicflowmeter_script", "pcap_capture_script"],
  },
  {
    id: "step3_gnn_inputs",
    number: "03",
    title: "Build Unified Flows",
    subtitle: "Merge sensor outputs → unified schema",
    description:
      "Concatenates Zeek / Suricata / CICFlowMeter records into a single flow table with 17 canonical columns (sensor, src_ip, dst_ip, protocol_type, service, duration, src_bytes, dst_bytes …).",
    triggerable: false,
    tag: "Manual",
    commands: [
      {
        label: "Run build_flows",
        cmd: "python security_stack/build_flows.py",
      },
    ],
    artifacts: ["build_flows_script", "service_stats"],
  },
  {
    id: "step4_detect_eh",
    number: "04",
    title: "Build GNN Inputs",
    subtitle: "Construct service-protocol bipartite graph",
    description:
      "Reads the unified flows to build a 73-node service–protocol graph (service_protocol_graph.gpickle) and aggregate statistics (service_stats.csv). These are the exact inputs the GNN was trained on.",
    triggerable: false,
    tag: "Manual",
    commands: [
      {
        label: "Build graph + stats",
        cmd: "python security_stack/build_gnn_inputs.py",
      },
    ],
    artifacts: ["build_gnn_inputs_script", "service_graph", "kdd_csv"],
  },
  {
    id: "step5_models",
    number: "05",
    title: "E–H Threat Detection",
    subtitle: "Apply taxonomy: Botnets · Exfil · Malware · Unknown",
    description:
      "Applies the categorise_flow_e_to_h() ruleset row-by-row to tag each flow with up to 5 E–H columns. Output feeds the Transformer and Autoencoder for final scoring.",
    triggerable: false,
    tag: "Manual",
    commands: [
      {
        label: "Detect E–H categories",
        cmd: "python security_stack/detect_eh.py",
      },
    ],
    artifacts: ["detect_eh_script"],
  },
  {
    id: "step6_detections",
    number: "06",
    title: "Model Inference",
    subtitle: "GNN + FT-Transformer + Autoencoder",
    description:
      "Runs all three trained models: SimpleGCN on the service graph (AUC 0.973), FT-Transformer on flow-level features (AUC 0.9998), and MLP Autoencoder on UNSW-NB15 normal baseline (AUC 0.865). Outputs scored CSVs in report_assets/generated_report/.",
    triggerable: false,
    tag: "Manual",
    commands: [
      {
        label: "GNN inference",
        cmd: "python run_gnn_pytorch.py",
      },
      {
        label: "Transformer inference (from transformer_tabular/)",
        cmd: "cd transformer_tabular && python predict.py --model runs/kdd/best_model.pt --data ../kdd_preprocessed.csv",
      },
    ],
    artifacts: ["gnn_model", "transformer_model", "autoencoder_model", "gnn_detections", "transformer_detections", "ae_scored"],
  },
  {
    id: "step7_report",
    number: "07",
    title: "Generate Report",
    subtitle: "HTML reports · Metrics JSON · Visualisations",
    description:
      "Runs generate_project_report.py to produce all HTML category reports, metrics.json with AUC/F1/precision/recall, and PNG visualisations used by the dashboard.",
    triggerable: true,
    tag: "Trigger",
    commands: [
      {
        label: "Generate full report",
        cmd: "python generate_project_report.py",
      },
    ],
    artifacts: ["report_generator", "metrics_json", "gnn_detections", "transformer_detections"],
  },
];

const ARTIFACT_LABELS: Record<string, string> = {
  gnn_model: "GNN model (.pt)",
  transformer_model: "Transformer model (.pt)",
  autoencoder_model: "Autoencoder model (.pt)",
  kdd_csv: "KDD preprocessed CSV",
  service_graph: "Service graph (.gpickle)",
  service_stats: "Service stats CSV",
  build_flows_script: "build_flows.py",
  build_gnn_inputs_script: "build_gnn_inputs.py",
  detect_eh_script: "detect_eh.py",
  pcap_capture_script: "pcap_capture.py",
  cicflowmeter_script: "cicflowmeter.py",
  gnn_detections: "gnn_service_detections.csv",
  transformer_detections: "transformer_flow_detections.csv",
  ae_scored: "unsw_ae_test_scored.csv",
  metrics_json: "metrics.json",
  report_generator: "generate_project_report.py",
};

function fmtSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <button
      onClick={copy}
      className="px-2 py-0.5 text-xs rounded border transition-all"
      style={{
        borderColor: copied ? "var(--color-low)" : "var(--border)",
        color: copied ? "var(--color-low)" : "var(--muted-foreground)",
        background: "transparent",
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

function StatusDot({ ready }: { ready: boolean | null }) {
  if (ready === null)
    return <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#334155" }} />;
  return (
    <span
      className="w-2.5 h-2.5 rounded-full inline-block"
      style={{ background: ready ? "var(--color-low)" : "#f59e0b" }}
    />
  );
}

export default function PipelinePage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/pipeline/status");
      const data = await r.json();
      setStatus(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const runReport = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const r = await fetch("/api/pipeline/run-report", { method: "POST" });
      const data = await r.json();
      setRunResult(data);
      // Refresh status after run
      await fetchStatus();
    } catch (e) {
      setRunResult({ error: String(e) });
    } finally {
      setRunning(false);
    }
  };

  const stepsReady = status?.steps_ready ?? {};
  const artifacts = status?.artifacts ?? {};

  const readyCount = Object.values(stepsReady).filter(Boolean).length;
  const totalSteps = STEPS.length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          IS-HAITI Pipeline Runner
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          End-to-end sequence to run IS-HAITI on a real network — from packet capture to model report.
        </p>
      </div>

      {/* Status bar */}
      <div
        className="rounded-lg border p-4 flex flex-wrap gap-4 items-center justify-between"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="flex items-center gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--muted-foreground)" }}>
              Steps ready
            </div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--color-low)" }}>
              {loading ? "…" : `${readyCount} / ${totalSteps}`}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--muted-foreground)" }}>
              Last checked
            </div>
            <div className="text-sm font-mono" style={{ color: "var(--foreground)" }}>
              {loading ? "…" : status ? fmtDate(status.checked_at) : "—"}
            </div>
          </div>
          {status && (
            <div>
              <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--muted-foreground)" }}>
                Repo root
              </div>
              <div className="text-xs font-mono truncate max-w-xs" style={{ color: "var(--muted-foreground)" }}>
                {status.repo_root}
              </div>
            </div>
          )}
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="px-4 py-2 rounded border text-sm font-medium transition-all"
          style={{
            borderColor: "var(--border)",
            color: loading ? "var(--muted-foreground)" : "var(--foreground)",
            background: "transparent",
          }}
        >
          {loading ? "Checking…" : "↻ Refresh Status"}
        </button>
      </div>

      {error && (
        <div className="rounded border p-3 text-sm" style={{ borderColor: "var(--color-critical)", color: "var(--color-critical)" }}>
          Error: {error}
        </div>
      )}

      {/* Pipeline steps */}
      <div className="space-y-4">
        {STEPS.map((step, idx) => {
          const ready = stepsReady[step.id] ?? null;
          const isLast = idx === STEPS.length - 1;

          return (
            <div key={step.id} className="relative">
              {/* Connector line */}
              {!isLast && (
                <div
                  className="absolute left-[1.85rem] top-full w-px h-4 z-10"
                  style={{ background: "var(--border)" }}
                />
              )}

              <div
                className="rounded-lg border p-5"
                style={{
                  borderColor: ready ? "rgba(34,197,94,0.25)" : "var(--border)",
                  background: "var(--card)",
                }}
              >
                <div className="flex gap-4">
                  {/* Step number + dot */}
                  <div className="flex-none flex flex-col items-center gap-2 pt-0.5">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border"
                      style={{
                        borderColor: ready ? "rgba(34,197,94,0.4)" : "var(--border)",
                        color: ready ? "var(--color-low)" : "var(--muted-foreground)",
                        background: ready ? "rgba(34,197,94,0.07)" : "transparent",
                      }}
                    >
                      {step.number}
                    </div>
                    <StatusDot ready={ready} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start gap-2 mb-1">
                      <h3 className="text-base font-semibold leading-none" style={{ color: "var(--foreground)" }}>
                        {step.title}
                      </h3>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full border font-medium"
                        style={{
                          borderColor:
                            step.tag === "Trigger"
                              ? "rgba(59,130,246,0.5)"
                              : "var(--border)",
                          color:
                            step.tag === "Trigger"
                              ? "#60a5fa"
                              : "var(--muted-foreground)",
                        }}
                      >
                        {step.tag}
                      </span>
                    </div>
                    <div className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>
                      {step.subtitle}
                    </div>
                    <p className="text-sm mb-4 leading-relaxed" style={{ color: "var(--foreground)", opacity: 0.75 }}>
                      {step.description}
                    </p>

                    {/* Commands */}
                    <div className="space-y-2 mb-4">
                      {step.commands.map((c, ci) => (
                        <div key={ci}>
                          <div className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
                            {c.label}
                          </div>
                          <div
                            className="flex items-center gap-2 rounded px-3 py-2 font-mono text-xs"
                            style={{ background: "#0d1117", border: "1px solid var(--border)" }}
                          >
                            <span className="flex-1 break-all" style={{ color: "#7dd3fc" }}>
                              {c.cmd}
                            </span>
                            <CopyButton text={c.cmd} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Artifact status chips */}
                    {step.artifacts.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {step.artifacts.map((artKey) => {
                          const art = artifacts[artKey];
                          const artExists = art?.exists ?? false;
                          return (
                            <div
                              key={artKey}
                              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border"
                              style={{
                                borderColor: artExists ? "rgba(34,197,94,0.3)" : "rgba(100,116,139,0.3)",
                                color: artExists ? "var(--color-low)" : "var(--muted-foreground)",
                                background: artExists ? "rgba(34,197,94,0.05)" : "transparent",
                              }}
                            >
                              <span>{artExists ? "✓" : "○"}</span>
                              <span>{ARTIFACT_LABELS[artKey] ?? artKey}</span>
                              {artExists && art?.size !== null && (
                                <span style={{ opacity: 0.6 }}>{fmtSize(art.size)}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Trigger button */}
                    {step.triggerable && (
                      <div className="space-y-3">
                        <button
                          onClick={runReport}
                          disabled={running}
                          className="px-5 py-2 rounded border text-sm font-semibold transition-all"
                          style={{
                            borderColor: running ? "var(--border)" : "rgba(59,130,246,0.6)",
                            color: running ? "var(--muted-foreground)" : "#60a5fa",
                            background: running ? "transparent" : "rgba(59,130,246,0.07)",
                            cursor: running ? "not-allowed" : "pointer",
                          }}
                        >
                          {running ? "⏳ Running… (may take 60–120 s)" : "▶  Run Report Generator"}
                        </button>

                        {runResult && (
                          <div
                            className="rounded border p-3 text-xs font-mono space-y-2"
                            style={{
                              borderColor: runResult.success ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.4)",
                              background: "rgba(0,0,0,0.3)",
                            }}
                          >
                            <div
                              className="font-semibold text-sm"
                              style={{ color: runResult.success ? "var(--color-low)" : "var(--color-critical)" }}
                            >
                              {runResult.error
                                ? `Error: ${runResult.error}`
                                : runResult.success
                                ? "✓ Report generated successfully"
                                : `✗ Exited with code ${runResult.exit_code}`}
                            </div>
                            {runResult.stdout && (
                              <div>
                                <div className="mb-1" style={{ color: "var(--muted-foreground)" }}>stdout:</div>
                                <pre
                                  className="whitespace-pre-wrap break-all"
                                  style={{ color: "#94a3b8", maxHeight: "200px", overflowY: "auto" }}
                                >
                                  {runResult.stdout}
                                </pre>
                              </div>
                            )}
                            {runResult.stderr && (
                              <div>
                                <div className="mb-1" style={{ color: "var(--muted-foreground)" }}>stderr:</div>
                                <pre
                                  className="whitespace-pre-wrap break-all"
                                  style={{ color: "#f87171", maxHeight: "120px", overflowY: "auto" }}
                                >
                                  {runResult.stderr}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Artifact inventory */}
      <div
        className="rounded-lg border p-5"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted-foreground)" }}>
          Artifact Inventory
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                <th className="text-left pb-2 pr-4">Artifact</th>
                <th className="text-left pb-2 pr-4">Status</th>
                <th className="text-left pb-2 pr-4">Size</th>
                <th className="text-left pb-2">Last Modified</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ARTIFACT_LABELS).map(([key, label]) => {
                const art = artifacts[key];
                return (
                  <tr key={key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td className="py-1.5 pr-4 font-mono" style={{ color: "var(--foreground)" }}>
                      {label}
                    </td>
                    <td className="py-1.5 pr-4">
                      <span
                        style={{
                          color: art?.exists ? "var(--color-low)" : "#f59e0b",
                        }}
                      >
                        {art ? (art.exists ? "✓ found" : "○ missing") : "—"}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4 font-mono" style={{ color: "var(--muted-foreground)" }}>
                      {art?.exists ? fmtSize(art.size) : "—"}
                    </td>
                    <td className="py-1.5 font-mono" style={{ color: "var(--muted-foreground)" }}>
                      {art?.exists ? fmtDate(art.mtime) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
