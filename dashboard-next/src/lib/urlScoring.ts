import type { UrlCheckResult } from "@/lib/types";

function safeUrlParse(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

const SUSPICIOUS_TLDS = new Set([
  "zip",
  "mov",
  "top",
  "xyz",
  "gq",
  "tk",
  "cf",
  "ml",
  "ga",
]);

export function scoreUrl(rawUrl: string): UrlCheckResult {
  const trimmed = (rawUrl ?? "").trim();
  const parsed = safeUrlParse(trimmed);
  if (!parsed) {
    return {
      url: trimmed,
      isValidUrl: false,
      risk: "high",
      score: 1,
      reasons: ["Invalid or unsupported URL (must be http/https)."],
    };
  }

  const reasons: string[] = [];
  let score = 0;

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const full = (host + pathname + parsed.search).toLowerCase();

  // Heuristics (safe, local-only). These are not a replacement for the full url_threats module.
  if (host.split(".").length >= 4) {
    score += 0.12;
    reasons.push("High subdomain depth.");
  }

  if (/\d/.test(host)) {
    score += 0.08;
    reasons.push("Hostname contains digits.");
  }

  if (host.includes("--")) {
    score += 0.08;
    reasons.push("Punycode-like or suspicious hostname pattern ('--').");
  }

  if (full.includes("@")) {
    score += 0.25;
    reasons.push("Contains '@' which can hide the true destination.");
  }

  if (/(login|verify|secure|account|update|bank|wallet|invoice|payment)/.test(full)) {
    score += 0.2;
    reasons.push("Contains credential/finance lure keywords.");
  }

  if (/(\.exe|\.scr|\.zip|\.rar|\.7z|\.iso|\.dmg)/.test(full)) {
    score += 0.25;
    reasons.push("Points to a potentially dangerous file type.");
  }

  const tld = host.split(".").pop() ?? "";
  if (SUSPICIOUS_TLDS.has(tld)) {
    score += 0.18;
    reasons.push(`Suspicious TLD: .${tld}`);
  }

  if (pathname.length > 80) {
    score += 0.08;
    reasons.push("Long path (often used in phishing URLs).");
  }

  score = Math.max(0, Math.min(1, score));

  let risk: UrlCheckResult["risk"] = "low";
  if (score >= 0.6) risk = "high";
  else if (score >= 0.3) risk = "medium";

  if (reasons.length === 0) reasons.push("No obvious lexical red flags detected.");

  return {
    url: trimmed,
    isValidUrl: true,
    risk,
    score,
    reasons,
  };
}
