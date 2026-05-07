import path from "path";
import fs from "fs/promises";
import Link from "next/link";
import { resolveArtifactBases } from "@/lib/artifactPaths";
import type { CategoryKey } from "@/lib/types";

const DEFAULT_CAT: CategoryKey = "E";

const CAT_LABELS: Partial<Record<CategoryKey, { label: string; color: string; file: string | null }>> = {
  E: { label: "Botnets / C2", color: "#eab308", file: "detections_e-botnets-command-and-control-c2.html" },
  F: { label: "Data Exfiltration", color: "#ec4899", file: "detections_f-data-exfiltration-attacks.html" },
  G: { label: "Malware Behavior", color: "#10b981", file: "detections_g-malware-behavioral-attacks.html" },
  H: { label: "Multi-Stage / Unknown", color: "#3b82f6", file: "detections_h-multi-stage-unknown-attacks.html" },
};

export default async function DetectionsPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const catRaw = searchParams.cat;
  const cat = (Array.isArray(catRaw) ? catRaw[0] : catRaw) as CategoryKey | undefined;
  const selected = (cat ?? DEFAULT_CAT) as CategoryKey;

  const bases = resolveArtifactBases();

  const catInfo = CAT_LABELS[selected];
  const htmlPath = catInfo?.file ? path.join(bases.generatedReportDir, catInfo.file) : null;

  // Check existence without reading content — we serve via API route so relative image paths work
  let htmlExists = false;
  if (htmlPath) {
    try { await fs.access(htmlPath); htmlExists = true; } catch { /* not found */ }
  }
  const iframeSrc = htmlExists && catInfo?.file ? `/api/report/generated_report/${catInfo.file}` : null;

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">E–H Category Detections</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          GNN + FT-Transformer based detection reports for Categories E–H
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex flex-wrap gap-2">
        {(["E", "F", "G", "H"] as CategoryKey[]).map((k) => {
          const info = CAT_LABELS[k];
          if (!info) return null;
          const isActive = k === selected;
          return (
            <Link
              key={k}
              href={`/detections?cat=${k}`}
              className="px-3 py-1.5 rounded text-sm font-medium transition-all"
              style={
                isActive
                  ? { background: `${info.color}22`, color: info.color, border: `1px solid ${info.color}44` }
                  : { background: "rgba(255,255,255,0.04)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }
              }
            >
              {k} — {info.label}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      {!htmlPath ? (
        <div
          className="rounded-lg p-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          Unsupported category.
        </div>
      ) : !iframeSrc ? (
        <div
          className="rounded-lg p-5 space-y-2"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="font-medium">Detection HTML Not Found</div>
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Expected: <span className="font-mono">{htmlPath}</span>
          </div>
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Run <span className="font-mono">python generate_project_report.py</span> to generate detection reports.
          </div>
        </div>
      ) : (
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <iframe
            title={`Cat ${selected} detections`}
            className="w-full"
            style={{ height: "80vh", background: "#fff" }}
            src={iframeSrc}
          />
        </div>
      )}
    </div>
  );
}
