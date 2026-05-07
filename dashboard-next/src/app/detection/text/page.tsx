"use client";

import { useState } from "react";

type TextAnalyzeResult = {
  text: string;
  is_spam: boolean;
  is_phishing: boolean;
  is_scam: boolean;
  category: "A" | "safe";
  risk: "low" | "medium" | "high" | "critical";
  score: number;
  reasons: string[];
  features: Record<string, number | boolean | string>;
};

const EXAMPLES = [
  {
    label: "Benign Email",
    text: "Hi team, please find attached the meeting notes from yesterday's call. Let me know if you have any questions. Best regards, Sarah",
  },
  {
    label: "Phishing (Category A)",
    text: "URGENT: Your account has been suspended. Click here immediately to verify your identity and restore access: http://secure-verify-bank.xyz/login",
  },
  {
    label: "Spam (Category A)",
    text: "CONGRATULATIONS! You've been selected as our lucky winner! Claim your FREE prize now! Limited time offer! Call 1-800-555-SPAM today!",
  },
  {
    label: "SMS Scam (Category A)",
    text: "Your package delivery failed. Update your address and pay the £1.50 redelivery fee at: delivery-reconfirm.co/track?id=82749",
  },
];

export default function TextDetectionPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<TextAnalyzeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/text/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json() as TextAnalyzeResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Text / Email Detection</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Category A — Spam · Phishing · Scam detection via NLP feature heuristics
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
            <div className="text-sm font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
              Load Example
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => { setText(ex.text); setResult(null); }}
                  className="text-xs px-2.5 py-1 rounded"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <div
            className="rounded-lg p-4 space-y-3"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <label className="text-sm font-semibold block" style={{ color: "var(--muted-foreground)" }}>
              Message / Email Text
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste email, SMS, or message text here…"
              rows={8}
              className="w-full rounded px-3 py-2 text-sm leading-relaxed"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {text.length} chars · {text.trim().split(/\s+/).filter(Boolean).length} words
              </span>
              <button
                onClick={analyze}
                disabled={busy || !text.trim()}
                className="px-4 py-2 rounded text-sm font-medium disabled:opacity-50"
                style={{ background: "#8b5cf6", color: "white" }}
              >
                {busy ? "Analyzing…" : "Analyze Text"}
              </button>
            </div>
            {error && <div className="text-sm" style={{ color: "var(--color-critical)" }}>{error}</div>}
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Verdict */}
              <div
                className="rounded-lg p-4 space-y-3"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-lg">
                      {result.category === "A" ? "THREAT DETECTED" : "SAFE"}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      Category {result.category}{result.category === "A" ? " — Text/Email Threat" : " — No threat detected"}
                    </div>
                  </div>
                  <span
                    className={`text-sm font-bold px-3 py-1.5 rounded ${
                      result.risk === "critical" ? "badge-critical" :
                      result.risk === "high" ? "badge-high" :
                      result.risk === "medium" ? "badge-medium" : "badge-low"
                    }`}
                  >
                    {result.risk.toUpperCase()}
                  </span>
                </div>

                {/* Score bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "var(--muted-foreground)" }}>Threat Score</span>
                    <span className="font-mono" style={{ color: result.score >= 0.7 ? "var(--color-critical)" : "var(--color-safe)" }}>
                      {result.score.toFixed(4)}
                    </span>
                  </div>
                  <div className="threat-bar">
                    <div
                      className="threat-bar-fill"
                      style={{
                        width: `${Math.min(100, result.score * 100)}%`,
                        background: result.score >= 0.7 ? "var(--color-critical)" : result.score >= 0.4 ? "var(--color-medium)" : "var(--color-safe)",
                      }}
                    />
                  </div>
                </div>

                {/* Sub-types */}
                <div className="flex gap-3 text-xs">
                  {[
                    { label: "SPAM", flag: result.is_spam },
                    { label: "PHISHING", flag: result.is_phishing },
                    { label: "SCAM", flag: result.is_scam },
                  ].map((t) => (
                    <span
                      key={t.label}
                      className={`px-2 py-0.5 rounded font-medium ${t.flag ? "badge-critical" : "badge-info"}`}
                    >
                      {t.flag ? "✓" : "✗"} {t.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Reasons */}
              {result.reasons.length > 0 && (
                <div
                  className="rounded-lg p-4"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div className="text-sm font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
                    Detection Reasons
                  </div>
                  <ul className="space-y-1.5">
                    {result.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span style={{ color: "var(--color-high)" }}>▶</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Feature breakdown */}
              {Object.keys(result.features).length > 0 && (
                <div
                  className="rounded-lg p-4"
                  style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                >
                  <div className="text-sm font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>
                    Extracted Features
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(result.features).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span style={{ color: "var(--muted-foreground)" }}>{k}</span>
                        <span className="font-mono">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              className="rounded-lg p-6 space-y-3"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <div className="text-sm font-medium">Category A — Text Threat Detector</div>
              <div className="space-y-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                <p>Analyzes text messages, emails, and SMS content for malicious intent using rule-based NLP features.</p>
                <div className="space-y-1">
                  <div className="font-medium" style={{ color: "var(--foreground)" }}>Features analyzed:</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Urgent/threatening language patterns</li>
                    <li>Financial lure keywords (prize, winner, claim)</li>
                    <li>Suspicious URL patterns embedded in text</li>
                    <li>Credential harvesting indicators</li>
                    <li>Grammar/spelling anomalies</li>
                    <li>Social engineering tactics</li>
                    <li>Brand impersonation signals</li>
                  </ul>
                </div>
                <p>
                  <span className="font-medium" style={{ color: "var(--foreground)" }}>Datasets: </span>
                  SpamAssassin easy_ham · SMS Spam Collection · Kaggle Spam Dataset
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
