import path from "path";
import fs from "fs";

export type ArtifactBases = {
  baseDir: string;
  generatedReportDir: string;
  moduleReportsDir: string;
};

function exists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/**
 * Resolve where report artifacts live.
 * Priority:
 * 1) DASHBOARD_ARTIFACTS_BASE (explicit)
 * 2) deliverables/final_bundle/report_assets (if present)
 * 3) report_assets (repo root)
 */
export function resolveArtifactBases(): ArtifactBases {
  const repoRoot = path.resolve(process.cwd(), "..");

  const envBase = process.env.DASHBOARD_ARTIFACTS_BASE;
  if (envBase) {
    const baseDir = path.resolve(envBase);
    return {
      baseDir,
      generatedReportDir: path.join(baseDir, "generated_report"),
      moduleReportsDir: path.join(baseDir, "module_reports"),
    };
  }

  const deliverablesBase = path.join(
    repoRoot,
    "deliverables",
    "final_bundle",
    "report_assets"
  );
  if (exists(deliverablesBase)) {
    return {
      baseDir: deliverablesBase,
      generatedReportDir: path.join(deliverablesBase, "generated_report"),
      moduleReportsDir: path.join(deliverablesBase, "module_reports"),
    };
  }

  const repoReportAssets = path.join(repoRoot, "report_assets");
  return {
    baseDir: repoReportAssets,
    generatedReportDir: path.join(repoReportAssets, "generated_report"),
    moduleReportsDir: path.join(repoReportAssets, "module_reports"),
  };
}
