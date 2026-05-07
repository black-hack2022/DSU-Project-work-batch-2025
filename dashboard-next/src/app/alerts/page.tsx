import Link from "next/link";
import { resolveArtifactBases } from "@/lib/artifactPaths";
import { loadAlerts } from "@/lib/alerts";
import AlertsClient from "./AlertsClient";

export default async function AlertsPage() {
  const bases = resolveArtifactBases();
  const alerts = await loadAlerts(bases.generatedReportDir);

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Live Alerts</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Unified incident feed — GNN · FT-Transformer · Autoencoder
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/reports"
            className="text-xs px-3 py-1.5 rounded"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
          >
            Export →
          </Link>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div
          className="rounded-lg p-8 text-center space-y-3"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="text-lg font-semibold">No Alerts Found</div>
          <p className="text-sm max-w-md mx-auto" style={{ color: "var(--muted-foreground)" }}>
            No detection CSV files were found in the artifacts directory.
            Run the report generator to populate this feed.
          </p>
          <div className="text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
            Looking in: {bases.generatedReportDir}
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {["gnn_service_detections.csv", "transformer_flow_detections.csv", "unsw_ae_test_scored.csv"].map((f) => (
              <span
                key={f}
                className="text-xs font-mono px-2 py-1 rounded"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
              >
                {f}
              </span>
            ))}
          </div>
          <div className="pt-2">
            <Link
              href="/detection/network"
              className="text-xs px-4 py-2 rounded"
              style={{ background: "#3b82f6", color: "white" }}
            >
              Run Network Detection
            </Link>
          </div>
        </div>
      ) : (
        <AlertsClient alerts={alerts} totalCount={alerts.length} />
      )}

      {/* Footer note */}
      <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
        Deep dives:{" "}
        <Link href="/detections" className="underline">E–H Detections</Link>
        {" · "}
        <Link href="/module-reports" className="underline">A–D Module Reports</Link>
        {" · "}
        <Link href="/explainability" className="underline">X-TIS Explainability</Link>
      </div>
    </div>
  );
}
