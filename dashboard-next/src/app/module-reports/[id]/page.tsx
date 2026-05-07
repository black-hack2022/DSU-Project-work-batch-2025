import path from "path";
import fs from "fs/promises";
import Link from "next/link";
import { resolveArtifactBases } from "@/lib/artifactPaths";

export default async function ModuleReportViewPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const bases = resolveArtifactBases();

  const htmlPath = path.join(bases.moduleReportsDir, id, "report.html");
  let htmlExists = false;
  try { await fs.access(htmlPath); htmlExists = true; } catch { /* not found */ }

  const iframeSrc = htmlExists ? `/api/report/module_reports/${id}/report.html` : null;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Module Report: {id}</h1>
          <div className="text-xs font-mono mt-0.5" style={{ color: "var(--muted-foreground)" }}>{htmlPath}</div>
        </div>
        <Link className="text-sm" href="/module-reports" style={{ color: "#3b82f6" }}>
          ← All Reports
        </Link>
      </div>

      {!iframeSrc ? (
        <div
          className="rounded-lg p-5 space-y-2"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="font-medium">report.html not found</div>
          <div className="text-sm font-mono" style={{ color: "var(--muted-foreground)" }}>{htmlPath}</div>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <iframe title={id} className="w-full" style={{ height: "85vh", background: "#fff" }} src={iframeSrc} />
        </div>
      )}
    </div>
  );
}
