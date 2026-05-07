import Link from "next/link";
import { resolveArtifactBases } from "@/lib/artifactPaths";
import { listModuleReports } from "@/lib/moduleReports";

export default async function ModuleReportsPage() {
  const bases = resolveArtifactBases();
  const items = await listModuleReports(bases.moduleReportsDir);

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Module Reports (A–D)</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Single-file HTML detector reports · Source: <span className="font-mono">{bases.moduleReportsDir}</span>
        </p>
      </div>

      {items.length === 0 ? (
        <div
          className="rounded-lg p-6 space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="font-medium">No Module Reports Found</div>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Run the report generator script to produce module reports, or set the{" "}
            <span className="font-mono">DASHBOARD_ARTIFACTS_BASE</span> environment variable.
          </p>
          <div
            className="rounded p-3 font-mono text-sm"
            style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--border)", color: "#86efac" }}
          >
            python generate_project_report.py
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((it) => (
            <Link
              key={it.id}
              className="rounded-lg p-4 transition-all"
              href={`/module-reports/${encodeURIComponent(it.id)}`}
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="font-medium text-sm">{it.title}</div>
              <div className="text-xs mt-0.5 font-mono" style={{ color: "var(--muted-foreground)" }}>{it.id}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
