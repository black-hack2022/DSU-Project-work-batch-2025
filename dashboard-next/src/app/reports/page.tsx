"use client";

import { useState } from "react";
import Link from "next/link";

type ReportFormat = "csv" | "json" | "html";
type ReportType = "alerts" | "metrics" | "eh-detections" | "full";

const REPORT_CONFIGS: Array<{
  id: ReportType;
  title: string;
  desc: string;
  formats: ReportFormat[];
  size: string;
}> = [
  {
    id: "alerts",
    title: "Alert Export",
    desc: "All detected alerts from GNN, FT-Transformer, and Autoencoder sources with severity, scores, and metadata.",
    formats: ["csv", "json"],
    size: "~500KB",
  },
  {
    id: "metrics",
    title: "Model Performance Report",
    desc: "AUC, Accuracy, Precision, Recall, F1 metrics for all three AI models plus threshold analysis.",
    formats: ["json", "html"],
    size: "~20KB",
  },
  {
    id: "eh-detections",
    title: "E–H Category Detections",
    desc: "Detailed breakdown of botnets/C2 (E), exfiltration (F), malware behavior (G), and multi-stage/unknown (H) detections.",
    formats: ["html", "json"],
    size: "~150KB",
  },
  {
    id: "full",
    title: "Full Intelligence Report",
    desc: "Complete system report: all categories A–H, model metrics, X-TIS explanations, threat intelligence summary.",
    formats: ["html"],
    size: "~2MB",
  },
];

const EXISTING_ARTIFACTS = [
  { file: "gnn_service_detections.csv", desc: "GNN service-level threat detections", size: "16KB" },
  { file: "transformer_flow_detections.csv", desc: "FT-Transformer per-flow detections", size: "varies" },
  { file: "unsw_ae_test_scored.csv", desc: "Autoencoder anomaly scores on UNSW-NB15 test set", size: "varies" },
  { file: "metrics.json", desc: "Consolidated model performance metrics", size: "~4KB" },
  { file: "detections_e-botnets-command-and-control-c2.html", desc: "Category E HTML report", size: "~80KB" },
  { file: "detections_f-data-exfiltration-attacks.html", desc: "Category F HTML report", size: "~60KB" },
  { file: "detections_g-malware-behavioral-attacks.html", desc: "Category G HTML report", size: "~70KB" },
  { file: "detections_h-multi-stage-unknown-attacks.html", desc: "Category H HTML report", size: "~55KB" },
];

export default function ReportsPage() {
  const [generating, setGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Set<string>>(new Set());

  function generate(id: string, format: ReportFormat) {
    const key = `${id}-${format}`;
    setGenerating(key);
    setTimeout(() => {
      setGenerating(null);
      setGenerated((prev) => new Set([...prev, key]));
    }, 1500);
  }

  return (
    <div className="p-5 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Reports &amp; Exports</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Generate and download threat intelligence reports in CSV, JSON, and HTML formats
        </p>
      </div>

      {/* Generate reports */}
      <div>
        <div className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted-foreground)" }}>
          Generate Reports
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REPORT_CONFIGS.map((r) => (
            <div
              key={r.id}
              className="rounded-lg p-4 space-y-3"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div>
                <div className="font-semibold text-sm">{r.title}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{r.desc}</div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Est. size: {r.size}</span>
                <div className="flex gap-2">
                  {r.formats.map((fmt) => {
                    const key = `${r.id}-${fmt}`;
                    const isDone = generated.has(key);
                    const isBusy = generating === key;
                    return (
                      <button
                        key={fmt}
                        onClick={() => generate(r.id, fmt)}
                        disabled={isBusy}
                        className="text-xs px-2.5 py-1 rounded transition-all disabled:opacity-50"
                        style={
                          isDone
                            ? { background: "rgba(34,197,94,0.15)", color: "#86efac", border: "1px solid rgba(34,197,94,0.3)" }
                            : { background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--foreground)" }
                        }
                      >
                        {isBusy ? "…" : isDone ? "✓ " : ""}{fmt.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generate Python report */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="font-semibold text-sm mb-2">Generate Full Report via Python</div>
        <p className="text-xs mb-3" style={{ color: "var(--muted-foreground)" }}>
          Run the master report generator script to create all artifacts: metrics.json,
          E–H detection HTML pages, GNN/Transformer/Autoencoder CSV exports.
        </p>
        <div
          className="rounded p-3 font-mono text-sm"
          style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--border)", color: "#86efac" }}
        >
          <div style={{ color: "var(--muted-foreground)" }}># From the project root (d:\majoproj)</div>
          <div>python generate_project_report.py</div>
          <div className="mt-2" style={{ color: "var(--muted-foreground)" }}># With custom output directory</div>
          <div>python generate_project_report.py --output report_assets/generated_report</div>
        </div>
      </div>

      {/* Existing artifacts */}
      <div>
        <div className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--muted-foreground)" }}>
          Available Artifact Files
        </div>
        <div
          className="rounded-lg overflow-auto"
          style={{ border: "1px solid var(--border)" }}
        >
          <table className="min-w-full text-sm">
            <thead style={{ background: "rgba(255,255,255,0.03)" }}>
              <tr>
                {["File", "Description", "Size", "Action"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EXISTING_ARTIFACTS.map((a, i) => (
                <tr key={a.file} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  <td className="px-4 py-2.5 font-mono text-xs">{a.file}</td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{a.desc}</td>
                  <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>{a.size}</td>
                  <td className="px-4 py-2.5">
                    {a.file.endsWith(".html") ? (
                      <Link
                        href="/detections"
                        className="text-xs"
                        style={{ color: "#3b82f6" }}
                      >
                        View →
                      </Link>
                    ) : a.file === "metrics.json" ? (
                      <Link
                        href="/metrics"
                        className="text-xs"
                        style={{ color: "#3b82f6" }}
                      >
                        View →
                      </Link>
                    ) : (
                      <Link href="/alerts" className="text-xs" style={{ color: "#3b82f6" }}>
                        In Alerts →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Module reports */}
      <div
        className="rounded-lg p-4 space-y-2"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="font-semibold text-sm">Module-Level HTML Reports (A–D)</div>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Single-file standalone HTML reports for each detector module are available in the{" "}
          <span className="font-mono">module_reports/</span> directory.
        </p>
        <Link href="/module-reports" className="text-xs block" style={{ color: "#3b82f6" }}>
          Browse Module Reports →
        </Link>
      </div>
    </div>
  );
}
