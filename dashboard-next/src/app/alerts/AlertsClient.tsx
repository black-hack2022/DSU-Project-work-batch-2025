"use client";

import { useState, useMemo } from "react";
import type { AlertItem } from "@/lib/alerts";

type FilterSeverity = "all" | "critical" | "high" | "medium" | "low";
type FilterSource = "all" | "gnn" | "transformer" | "autoencoder";

function FilterBtn({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2.5 py-1 rounded transition-all"
      style={
        active
          ? { background: color ?? "rgba(59,130,246,0.2)", color: color ? "#fff" : "#93c5fd", border: `1px solid ${color ?? "rgba(59,130,246,0.4)"}` }
          : { background: "rgba(255,255,255,0.04)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }
      }
    >
      {children}
    </button>
  );
}

function badge(sev: AlertItem["severity"]) {
  const base = "text-xs font-medium px-1.5 py-0.5 rounded";
  if (sev === "critical") return `${base} badge-critical`;
  if (sev === "high") return `${base} badge-high`;
  if (sev === "medium") return `${base} badge-medium`;
  return `${base} badge-low`;
}

export default function AlertsClient({ alerts, totalCount }: { alerts: AlertItem[]; totalCount: number }) {
  const [filterSev, setFilterSev] = useState<FilterSeverity>("all");
  const [filterSrc, setFilterSrc] = useState<FilterSource>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (filterSev !== "all" && a.severity !== filterSev) return false;
      if (filterSrc !== "all" && a.source !== filterSrc) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          a.source.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [alerts, filterSev, filterSrc, search]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const counts = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    high: alerts.filter((a) => a.severity === "high").length,
    medium: alerts.filter((a) => a.severity === "medium").length,
    low: alerts.filter((a) => a.severity === "low").length,
  };

  return (
    <div className="space-y-4">
      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        <span className="badge-critical text-xs font-medium px-2 py-1 rounded">
          {counts.critical} Critical
        </span>
        <span className="badge-high text-xs font-medium px-2 py-1 rounded">
          {counts.high} High
        </span>
        <span className="badge-medium text-xs font-medium px-2 py-1 rounded">
          {counts.medium} Medium
        </span>
        <span className="badge-low text-xs font-medium px-2 py-1 rounded">
          {counts.low} Low
        </span>
        <span className="badge-info text-xs font-medium px-2 py-1 rounded">
          {totalCount} Total loaded
        </span>
      </div>

      {/* Filters */}
      <div
        className="rounded-lg p-3 flex flex-wrap gap-3 items-center"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search alerts…"
          className="rounded px-3 py-1.5 text-sm w-48"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        />

        {/* Severity */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Severity:</span>
          <FilterBtn active={filterSev === "all"} onClick={() => { setFilterSev("all"); setPage(0); }}>All</FilterBtn>
          <FilterBtn active={filterSev === "critical"} onClick={() => { setFilterSev("critical"); setPage(0); }} color="rgba(239,68,68,0.7)">Critical</FilterBtn>
          <FilterBtn active={filterSev === "high"} onClick={() => { setFilterSev("high"); setPage(0); }} color="rgba(249,115,22,0.7)">High</FilterBtn>
          <FilterBtn active={filterSev === "medium"} onClick={() => { setFilterSev("medium"); setPage(0); }} color="rgba(234,179,8,0.7)">Medium</FilterBtn>
          <FilterBtn active={filterSev === "low"} onClick={() => { setFilterSev("low"); setPage(0); }} color="rgba(59,130,246,0.7)">Low</FilterBtn>
        </div>

        {/* Source */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Source:</span>
          <FilterBtn active={filterSrc === "all"} onClick={() => { setFilterSrc("all"); setPage(0); }}>All</FilterBtn>
          <FilterBtn active={filterSrc === "gnn"} onClick={() => { setFilterSrc("gnn"); setPage(0); }}>GNN</FilterBtn>
          <FilterBtn active={filterSrc === "transformer"} onClick={() => { setFilterSrc("transformer"); setPage(0); }}>Transformer</FilterBtn>
          <FilterBtn active={filterSrc === "autoencoder"} onClick={() => { setFilterSrc("autoencoder"); setPage(0); }}>Autoencoder</FilterBtn>
        </div>

        <span className="text-xs ml-auto" style={{ color: "var(--muted-foreground)" }}>
          {filtered.length} of {alerts.length} shown
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div
          className="rounded-lg p-8 text-center"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            No alerts match the current filters.
          </div>
        </div>
      ) : (
        <div className="rounded-lg overflow-auto" style={{ border: "1px solid var(--border)" }}>
          <table className="min-w-full w-full text-sm">
            <thead style={{ background: "rgba(255,255,255,0.03)" }}>
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>Severity</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>Source</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>Category</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>Description</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>Score</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((a, idx) => (
                <tr
                  key={a.id}
                  style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}
                >
                  <td className="px-3 py-2.5">
                    <span className={badge(a.severity)}>{a.severity.toUpperCase()}</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {a.source}
                  </td>
                  <td className="px-3 py-2.5 text-xs">{a.category}</td>
                  <td className="px-3 py-2.5 max-w-xs truncate text-sm">{a.title}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">
                    {a.score !== null ? (
                      <span
                        style={{
                          color:
                            a.score >= 0.95
                              ? "var(--color-critical)"
                              : a.score >= 0.7
                              ? "var(--color-high)"
                              : a.score >= 0.5
                              ? "var(--color-medium)"
                              : "var(--color-low)",
                        }}
                      >
                        {a.score.toFixed(3)}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted-foreground)" }}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-xs badge-info px-1.5 py-0.5 rounded">OPEN</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs" style={{ color: "var(--muted-foreground)" }}>
          <span>Page {page + 1} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
