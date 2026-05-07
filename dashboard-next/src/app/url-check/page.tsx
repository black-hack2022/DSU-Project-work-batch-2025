"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { UrlCheckResult } from "@/lib/types";

const EXAMPLES = [
  { label: "Safe", url: "https://www.google.com" },
  { label: "Phishing", url: "http://secure-verify-paypal.xyz/login?update=account" },
  { label: "Suspicious", url: "http://192.168.1.1/update.php?token=abc123" },
  { label: "Shortener", url: "https://bit.ly/3xAb12T" },
];

export default function UrlCheckPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<UrlCheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ url: string; result: UrlCheckResult }>>([]);

  const riskColor = useMemo(() => {
    if (!result) return null;
    if (!result.isValidUrl) return "#64748b";
    if (result.risk === "high") return "var(--color-critical)";
    if (result.risk === "medium") return "var(--color-medium)";
    return "var(--color-safe)";
  }, [result]);

  async function onCheck(checkUrl?: string) {
    const target = checkUrl ?? url;
    if (!target.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/url/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = (await resp.json()) as UrlCheckResult;
      setResult(data);
      if (data.isValidUrl) {
        setHistory((prev) => [{ url: target, result: data }, ...prev.slice(0, 9)]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">URL / Web Threat Check</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Category B — Malicious URL scanner · Offline lexical + heuristic scoring
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
            <div className="text-sm font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>Quick Examples</div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.url}
                  onClick={() => { setUrl(ex.url); setResult(null); }}
                  className="text-xs px-2.5 py-1 rounded"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* URL input */}
          <div
            className="rounded-lg p-4 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <label className="text-sm font-semibold block" style={{ color: "var(--muted-foreground)" }}>
              URL to Analyze
            </label>
            <div className="flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onCheck()}
                placeholder="https://example.com"
                className="flex-1 rounded px-3 py-2 text-sm font-mono"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <button
                onClick={() => onCheck()}
                disabled={busy || !url.trim()}
                className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                style={{ background: "#06b6d4", color: "white" }}
              >
                {busy ? "…" : "Scan"}
              </button>
            </div>

            {error && <div className="text-sm" style={{ color: "var(--color-critical)" }}>{error}</div>}
          </div>

          {/* Rules info */}
          <div
            className="rounded-lg p-4"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="text-sm font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>Detection Rules (Category B)</div>
            <div className="space-y-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
              {[
                ["URL shorteners / redirect hops", "bit.ly, tinyurl, etc."],
                ["IP-based hostname", "Direct IP instead of domain"],
                ["Suspicious TLD", ".xyz, .top, .click, .pw, .tk"],
                ["Excessive subdomain depth", "> 3 levels deep"],
                ["Punycode / IDN homoglyph", "xn-- prefix or lookalike chars"],
                ["Brand spoofing", "paypal, amazon, google in suspicious domain"],
                ["Credential keywords", "login, verify, password, account in path"],
                ["Dangerous file extensions", ".exe, .scr, .php, .aspx in path"],
                ["Long URL path", "excessive path length > 150 chars"],
              ].map(([rule, note]) => (
                <div key={rule} className="flex gap-2">
                  <span style={{ color: "var(--color-medium)" }}>▸</span>
                  <span>
                    <span style={{ color: "var(--foreground)" }}>{rule}</span>
                    {note && <span className="ml-1 opacity-60">— {note}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Main verdict */}
              <div
                className="rounded-lg p-5 space-y-4"
                style={{
                  background: "var(--card)",
                  border: `1px solid ${riskColor}44`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-lg">
                      {!result.isValidUrl
                        ? "INVALID URL"
                        : result.risk === "high"
                        ? "MALICIOUS URL DETECTED"
                        : result.risk === "medium"
                        ? "SUSPICIOUS URL"
                        : "URL APPEARS SAFE"}
                    </div>
                    <div className="font-mono text-xs mt-1 break-all" style={{ color: "var(--muted-foreground)" }}>
                      {result.url}
                    </div>
                  </div>
                  <span
                    className="shrink-0 text-sm font-bold px-3 py-1.5 rounded"
                    style={{
                      background: `${riskColor}22`,
                      color: riskColor ?? "var(--foreground)",
                      border: `1px solid ${riskColor}44`,
                    }}
                  >
                    {result.isValidUrl ? result.risk.toUpperCase() : "INVALID"}
                  </span>
                </div>

                {/* Score bar */}
                {result.isValidUrl && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span style={{ color: "var(--muted-foreground)" }}>Threat Score</span>
                      <span className="font-mono" style={{ color: riskColor ?? "var(--foreground)" }}>
                        {result.score.toFixed(4)} / 1.000
                      </span>
                    </div>
                    <div className="threat-bar">
                      <div
                        className="threat-bar-fill"
                        style={{
                          width: `${result.score * 100}%`,
                          background: riskColor ?? "#3b82f6",
                        }}
                      />
                    </div>
                    {/* Threshold markers */}
                    <div className="flex justify-between text-xs" style={{ color: "var(--muted-foreground)" }}>
                      <span>0.0 safe</span>
                      <span>0.35 medium</span>
                      <span>0.65 high</span>
                    </div>
                  </div>
                )}

                {/* Category */}
                {result.isValidUrl && (
                  <div className="flex gap-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded font-medium"
                      style={
                        result.risk !== "low"
                          ? { background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }
                          : { background: "rgba(34,197,94,0.15)", color: "#86efac", border: "1px solid rgba(34,197,94,0.3)" }
                      }
                    >
                      {result.risk !== "low" ? "Category B — Malicious URL" : "Category B — Safe"}
                    </span>
                  </div>
                )}
              </div>

              {/* Reasons */}
              {result.reasons.length > 0 && (
                <div
                  className="rounded-lg p-4"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div className="text-sm font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
                    {result.risk !== "low" ? "Threat Indicators" : "Analysis Results"}
                  </div>
                  <ul className="space-y-1.5">
                    {result.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span style={{ color: result.risk !== "low" ? "var(--color-high)" : "var(--color-safe)" }}>
                          {result.risk !== "low" ? "▶" : "✓"}
                        </span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>

                  {result.risk === "high" && (
                    <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                      <div className="text-xs font-medium mb-1">Recommended Actions</div>
                      <ul className="text-xs space-y-1" style={{ color: "var(--muted-foreground)" }}>
                        <li>• Do not click this URL</li>
                        <li>• Block in web proxy / DNS filter</li>
                        <li>• Report to threat intelligence feeds</li>
                        <li>• Check for similar domains in your environment</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {result.isValidUrl && result.risk !== "high" && (
                <div className="text-sm">
                  Open via safe interstitial:{" "}
                  <Link
                    className="underline"
                    href={`/external-warning?to=${encodeURIComponent(result.url)}`}
                    style={{ color: "#3b82f6" }}
                  >
                    /external-warning →
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div
              className="rounded-lg p-6 space-y-3"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="text-sm font-medium">Category B — URL Threat Detector</div>
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                <p>Offline lexical scoring — no external network calls. Detects:</p>
                <ul className="list-disc pl-4 mt-2 space-y-0.5">
                  <li>URL shorteners and redirect chains</li>
                  <li>IP-based URLs</li>
                  <li>Suspicious TLDs</li>
                  <li>Brand impersonation / punycode</li>
                  <li>Credential-harvesting patterns</li>
                  <li>Drive-by download indicators</li>
                </ul>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div
              className="rounded-lg p-4"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="text-sm font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>Recent Checks</div>
              <div className="space-y-2">
                {history.slice(0, 5).map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                    onClick={() => { setUrl(h.url); setResult(h.result); }}
                  >
                    <span
                      className="shrink-0 h-2 w-2 rounded-full"
                      style={{
                        background:
                          h.result.risk === "high" ? "var(--color-critical)" :
                          h.result.risk === "medium" ? "var(--color-medium)" : "var(--color-safe)",
                      }}
                    />
                    <span className="font-mono text-xs truncate flex-1" style={{ color: "var(--muted-foreground)" }}>
                      {h.url}
                    </span>
                    <span
                      className="text-xs shrink-0 font-mono"
                      style={{
                        color:
                          h.result.risk === "high" ? "var(--color-critical)" :
                          h.result.risk === "medium" ? "var(--color-medium)" : "var(--color-safe)",
                      }}
                    >
                      {h.result.score.toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
