import { NextRequest, NextResponse } from "next/server";

// Phishing/spam/scam patterns matching the Python text_threats detector
const URGENT_WORDS = ["urgent", "immediately", "suspended", "verify", "confirm", "action required", "account locked", "security alert"];
const PHISHING_PATTERNS = ["click here", "click now", "verify your", "update your", "log in to", "sign in to", /https?:\/\/[^\s]+\.(xyz|top|click|pw|tk|ml|ga|cf|gq)/i];
const PRIZE_WORDS = ["winner", "won", "prize", "reward", "free", "congratulations", "selected", "lucky", "claim"];
const SCAM_WORDS = ["limited time", "offer expires", "act now", "call now", "text back", "reply stop", "re: your package", "delivery failed", "customs fee", "redelivery"];
const FINANCIAL_WORDS = ["bank", "paypal", "wire transfer", "bitcoin", "gift card", "inheritance", "investment", "loan approved"];
const CREDENTIAL_WORDS = ["password", "username", "pin", "account number", "social security", "credit card", "ssn"];

function scoreText(text: string): {
  spam_score: number;
  phishing_score: number;
  scam_score: number;
  reasons: string[];
  features: Record<string, number | boolean | string>;
} {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);
  const reasons: string[] = [];
  let spam_score = 0;
  let phishing_score = 0;
  let scam_score = 0;

  const features: Record<string, number | boolean | string> = {};

  // Character features
  const upperCount = (text.match(/[A-Z]/g) ?? []).length;
  const upperRatio = text.length > 0 ? upperCount / text.length : 0;
  features["upper_ratio"] = parseFloat(upperRatio.toFixed(3));
  features["word_count"] = words.length;
  features["char_count"] = text.length;

  // Exclamation marks
  const exclamCount = (text.match(/!/g) ?? []).length;
  features["exclamation_count"] = exclamCount;
  if (exclamCount >= 3) {
    spam_score += 0.2;
    scam_score += 0.15;
    reasons.push(`High exclamation count (${exclamCount})`);
  }

  // ALL CAPS ratio
  if (upperRatio > 0.3) {
    spam_score += 0.15;
    reasons.push(`High uppercase ratio (${(upperRatio * 100).toFixed(0)}%)`);
  }

  // URLs in text
  const urlMatches = text.match(/https?:\/\/[^\s]+/g) ?? [];
  features["url_count"] = urlMatches.length;
  if (urlMatches.length > 0) {
    for (const url of urlMatches) {
      if (/\.(xyz|top|click|pw|tk|ml|ga|cf|gq|info)/i.test(url)) {
        phishing_score += 0.35;
        reasons.push(`Suspicious TLD in URL: ${url.substring(0, 50)}`);
      }
      if (/bit\.ly|tinyurl|goo\.gl|ow\.ly|t\.co/.test(url)) {
        phishing_score += 0.2;
        reasons.push("URL shortener detected");
      }
      if (/secure|verify|login|confirm|update|account/.test(url.toLowerCase())) {
        phishing_score += 0.25;
        reasons.push("Credential-harvesting URL pattern");
      }
    }
  }

  // Urgent language
  let urgentCount = 0;
  for (const word of URGENT_WORDS) {
    if (lower.includes(word)) {
      urgentCount++;
    }
  }
  features["urgent_word_count"] = urgentCount;
  if (urgentCount >= 2) {
    phishing_score += 0.3;
    reasons.push(`Multiple urgent language patterns (${urgentCount})`);
  } else if (urgentCount === 1) {
    phishing_score += 0.1;
  }

  // Prize/reward language (spam)
  let prizeCount = 0;
  for (const word of PRIZE_WORDS) {
    if (lower.includes(word)) prizeCount++;
  }
  features["prize_word_count"] = prizeCount;
  if (prizeCount >= 2) {
    spam_score += 0.35;
    reasons.push(`Prize/reward language (${prizeCount} keywords)`);
  }

  // Scam patterns
  let scamCount = 0;
  for (const word of SCAM_WORDS) {
    if (lower.includes(word)) scamCount++;
  }
  features["scam_pattern_count"] = scamCount;
  if (scamCount >= 2) {
    scam_score += 0.3;
    reasons.push(`Scam patterns detected (${scamCount})`);
  }

  // Credential harvesting
  let credCount = 0;
  for (const word of CREDENTIAL_WORDS) {
    if (lower.includes(word)) credCount++;
  }
  features["credential_word_count"] = credCount;
  if (credCount >= 2) {
    phishing_score += 0.25;
    reasons.push(`Credential-related keywords (${credCount})`);
  }

  // Financial words
  let finCount = 0;
  for (const word of FINANCIAL_WORDS) {
    if (lower.includes(word)) finCount++;
  }
  features["financial_word_count"] = finCount;
  if (finCount >= 2) {
    phishing_score += 0.2;
    scam_score += 0.15;
    reasons.push(`Financial keywords present (${finCount})`);
  }

  // Phishing click patterns
  let clickCount = 0;
  for (const pattern of PHISHING_PATTERNS) {
    if (typeof pattern === "string" && lower.includes(pattern)) clickCount++;
    else if (pattern instanceof RegExp && pattern.test(text)) clickCount++;
  }
  features["phishing_pattern_count"] = clickCount;
  if (clickCount >= 1) {
    phishing_score += 0.25;
    reasons.push(`Phishing action patterns (${clickCount})`);
  }

  // Short with heavy formatting = scam SMS
  if (text.length < 200 && exclamCount >= 1 && urlMatches.length > 0 && scamCount >= 1) {
    scam_score += 0.2;
    reasons.push("Short message with URL + urgency — SMS scam pattern");
  }

  return {
    spam_score: Math.min(1, spam_score),
    phishing_score: Math.min(1, phishing_score),
    scam_score: Math.min(1, scam_score),
    reasons,
    features,
  };
}

export async function POST(req: NextRequest) {
  const { text } = (await req.json()) as { text: string };

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text field required" }, { status: 400 });
  }

  const { spam_score, phishing_score, scam_score, reasons, features } = scoreText(text);

  const maxScore = Math.max(spam_score, phishing_score, scam_score);
  const is_spam = spam_score >= 0.4;
  const is_phishing = phishing_score >= 0.4;
  const is_scam = scam_score >= 0.4;
  const isThreat = is_spam || is_phishing || is_scam;

  const risk =
    maxScore >= 0.75
      ? "critical"
      : maxScore >= 0.5
      ? "high"
      : maxScore >= 0.3
      ? "medium"
      : "low";

  return NextResponse.json({
    text: text.substring(0, 200),
    is_spam,
    is_phishing,
    is_scam,
    category: isThreat ? "A" : "safe",
    risk,
    score: maxScore,
    reasons: isThreat ? reasons : ["No threat patterns detected"],
    features: {
      ...features,
      spam_score: parseFloat(spam_score.toFixed(4)),
      phishing_score: parseFloat(phishing_score.toFixed(4)),
      scam_score: parseFloat(scam_score.toFixed(4)),
    },
  });
}
