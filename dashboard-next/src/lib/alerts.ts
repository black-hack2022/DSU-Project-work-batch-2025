import path from "path";
import fs from "fs/promises";
import { readCsvObjects } from "@/lib/csv";

export type AlertItem = {
  id: string;
  source: "gnn" | "transformer" | "autoencoder";
  category: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  score: number | null;
  details: Record<string, string>;
};

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function severityFromScore(score: number): AlertItem["severity"] {
  if (score >= 0.95) return "critical";
  if (score >= 0.7) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

export async function loadAlerts(generatedReportDir: string): Promise<AlertItem[]> {
  const items: AlertItem[] = [];

  // 1) GNN service detections
  const gnnPath = path.join(generatedReportDir, "gnn_service_detections.csv");
  if (await exists(gnnPath)) {
    const rows = await readCsvObjects(gnnPath, 2000);
    for (const r of rows) {
      const service = r.service ?? r.node ?? r.name ?? "(service)";
      const scoreRaw = r.threat_score ?? r.score ?? r.prob ?? "";
      const scoreNum = Number(scoreRaw);
      const score = Number.isFinite(scoreNum) ? clamp01(scoreNum) : null;
      const sev = score !== null ? severityFromScore(score) : "low";

      items.push({
        id: `gnn:${service}`,
        source: "gnn",
        category: "E–H",
        title: `Service: ${service}`,
        severity: sev,
        score,
        details: r,
      });
    }
  }

  // 2) Transformer flow detections
  const tPath = path.join(generatedReportDir, "transformer_flow_detections.csv");
  if (await exists(tPath)) {
    const rows = await readCsvObjects(tPath, 2000);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const scoreRaw = r.combined_risk ?? r.risk_score ?? r.score ?? r.prob ?? "";
      const scoreNum = Number(scoreRaw);
      const score = Number.isFinite(scoreNum) ? clamp01(scoreNum) : null;
      const sev = score !== null ? severityFromScore(score) : "low";
      const label = r.pred_attack ?? r.pred_label ?? r.prediction ?? r.pred ?? "";
      const service = r.service ?? "";
      const category = r.category_group ?? "Flow";
      const reason = r.reason ?? "";

      items.push({
        id: `transformer:${i}`,
        source: "transformer",
        category,
        title: `${category}${service ? ` (${service})` : ""}${reason ? `: ${reason}` : label ? `: ${label}` : ""}`,
        severity: sev,
        score,
        details: r,
      });
    }
  }

  // 3) Autoencoder scored rows (if present)
  // Note: this file can be large; we cap rows.
  const aePath = path.join(generatedReportDir, "unsw_ae_test_scored.csv");
  if (await exists(aePath)) {
    const rows = await readCsvObjects(aePath, 1500);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const scoreRaw = r.anomaly_score ?? r.score ?? r.recon_mse ?? "";
      const scoreNum = Number(scoreRaw);
      const score = Number.isFinite(scoreNum) ? clamp01(scoreNum) : null;
      const flag = r.is_anomaly ?? r.anomaly ?? r.flag ?? "";
      const isFlagged = flag === "1" || flag === "True" || flag === "true";
      let sev = score !== null ? severityFromScore(score) : "low";
      if (isFlagged && (sev === "low")) sev = "medium";

      items.push({
        id: `autoencoder:${i}`,
        source: "autoencoder",
        category: "Anomaly",
        title: `Anomaly score${flag ? ` (flag=${flag})` : ""}`,
        severity: sev,
        score,
        details: r,
      });
    }
  }

  // Sort: critical→low, then score desc
  const order: Record<AlertItem["severity"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  items.sort((a, b) => {
    const oa = order[a.severity];
    const ob = order[b.severity];
    if (oa !== ob) return oa - ob;
    const sa = a.score ?? -1;
    const sb = b.score ?? -1;
    return sb - sa;
  });

  return items;
}
