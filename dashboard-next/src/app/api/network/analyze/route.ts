import { NextRequest, NextResponse } from "next/server";

type NetworkInput = {
  protocol: string;
  service: string;
  src_bytes: number;
  dst_bytes: number;
  duration: number;
  count: number;
  srv_count: number;
  flag: string;
};

// High-risk services from KDD Cup analysis (GNN detected as malicious)
const HIGH_RISK_SERVICES = new Set([
  "telnet", "finger", "ftp_data", "smtp", "domain_u", "gopher",
  "private", "rje", "rsh", "rlogin", "rexec", "exec", "login",
  "shell", "imap4", "nnsp", "nntp", "pm_dump",
]);

const MEDIUM_RISK_SERVICES = new Set([
  "ftp", "ssh", "pop_3", "auth", "bgsql", "mtp", "link",
  "netbios_ns", "netbios_ssn", "klogin", "kshell",
]);

// KDD flags indicating attacks
const ATTACK_FLAGS = new Set(["S0", "REJ", "RSTO", "RSTR", "SH", "OTH", "SF+REJ"]);

function computeGnnScore(input: NetworkInput): number {
  let score = 0;
  const svc = input.service.toLowerCase();
  const flag = input.flag.toUpperCase();

  // Service risk
  if (HIGH_RISK_SERVICES.has(svc)) score += 0.55;
  else if (MEDIUM_RISK_SERVICES.has(svc)) score += 0.25;

  // Attack flag indicators
  if (ATTACK_FLAGS.has(flag)) score += 0.15;

  // Port scan: high count, 0 bytes
  if (input.count > 200 && input.src_bytes === 0) score += 0.3;
  else if (input.count > 100) score += 0.15;

  // Beacon pattern: repeated same-service with small payload
  if (input.srv_count > 100 && input.src_bytes > 0 && input.src_bytes < 300) score += 0.25;

  // Exfil pattern: high src_bytes
  if (input.src_bytes > 50000) score += 0.2;

  // Normal established connection dampens score
  if (flag === "SF" && input.dst_bytes > 10000) score -= 0.15;

  return Math.max(0, Math.min(1, score));
}

function computeTransformerScore(input: NetworkInput): number {
  let score = 0;
  const svc = input.service.toLowerCase();
  const protocol = input.protocol.toLowerCase();
  const flag = input.flag.toUpperCase();

  // dst_bytes: key exfil indicator
  if (input.dst_bytes > 0 && input.src_bytes > 0) {
    const ratio = input.src_bytes / (input.dst_bytes + 1);
    if (ratio > 50) score += 0.3; // exfil: lots outbound, little response
    else if (ratio >= 0.25 && ratio <= 4) score -= 0.05; // normal bidirectional
  }

  // Count-based scanning
  if (input.count > 300 && flag === "REJ") score += 0.55;
  else if (input.count > 150) score += 0.25;

  // Protocol weighting
  if (protocol === "tcp") score += 0.05;
  if (protocol === "icmp" && input.count > 200) score += 0.3;

  // Duration
  if (input.duration === 0 && input.src_bytes === 0) score += 0.1;
  if (input.duration > 100 && input.src_bytes > 1000) score -= 0.05; // long legit connection

  // Service-specific
  if (HIGH_RISK_SERVICES.has(svc)) score += 0.2;

  return Math.max(0, Math.min(1, score));
}

function mapToCategories(input: NetworkInput, fusionScore: number): { categories: string[]; subcategories: string[] } {
  const categories: string[] = [];
  const subcategories: string[] = [];

  if (fusionScore < 0.3) return { categories: [], subcategories: [] };

  const svc = input.service.toLowerCase();
  const protocol = input.protocol.toLowerCase();
  const flag = input.flag.toUpperCase();

  // Category C: Network-based attacks
  if (input.count > 100 && ["REJ", "S0"].includes(flag)) {
    categories.push("C — Network Attacks");
    subcategories.push("Port scanning");
  }
  if (input.count > 200 && input.src_bytes === 0) {
    if (!categories.includes("C — Network Attacks")) categories.push("C — Network Attacks");
    subcategories.push("Service enumeration");
  }
  if (protocol === "icmp" && input.count > 100) {
    if (!categories.includes("C — Network Attacks")) categories.push("C — Network Attacks");
    subcategories.push("ICMP reconnaissance");
  }
  if (flag === "S0" && !["http", "https"].includes(svc)) {
    if (!categories.includes("C — Network Attacks")) categories.push("C — Network Attacks");
    subcategories.push("SSH/RDP brute force");
  }

  // Category D: Lateral movement
  if (["netbios_ns", "netbios_ssn"].includes(svc)) {
    categories.push("D — Lateral Movement");
    subcategories.push("NetBIOS lateral movement");
  }

  // Category E: Botnets/C2
  if (input.srv_count > 100 && input.src_bytes > 0 && input.src_bytes < 500) {
    categories.push("E — Botnet/C2");
    subcategories.push("HTTP beaconing");
  }
  if (svc === "domain_u" && input.count > 50) {
    if (!categories.includes("E — Botnet/C2")) categories.push("E — Botnet/C2");
    subcategories.push("DNS tunneling");
  }

  // Category F: Exfiltration
  if (svc === "smtp" && input.src_bytes > 5000) {
    categories.push("F — Data Exfiltration");
    subcategories.push("SMTP data exfiltration");
  }
  if (svc === "ftp_data" && (input.src_bytes > 10000 || input.dst_bytes > 10000)) {
    categories.push("F — Data Exfiltration");
    subcategories.push("FTP data transfer");
  }

  // Category G: Malware behavior
  if (input.duration === 0 && input.srv_count > 50 && input.src_bytes < 200) {
    categories.push("G — Malware Behavior");
    subcategories.push("Malware beaconing");
  }

  return { categories, subcategories };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as NetworkInput;

  const gnn_score = computeGnnScore(body);
  const transformer_score = computeTransformerScore(body);
  const fusion_score = transformer_score * 0.7 + gnn_score * 0.3;

  const { categories, subcategories } = mapToCategories(body, fusion_score);

  const risk =
    fusion_score >= 0.75
      ? "critical"
      : fusion_score >= 0.5
      ? "high"
      : fusion_score >= 0.3
      ? "medium"
      : "low";

  const features_used: string[] = [];
  if (gnn_score > 0.1) features_used.push("service", "attack_rate_proxy");
  if (body.count > 50) features_used.push("count");
  if (body.srv_count > 50) features_used.push("srv_count");
  if (body.src_bytes > 0) features_used.push("src_bytes");
  if (body.dst_bytes > 0) features_used.push("dst_bytes");
  if (body.flag !== "SF") features_used.push("flag");
  if (body.duration > 0) features_used.push("duration");
  features_used.push("protocol");

  return NextResponse.json({
    input: body,
    gnn_score,
    transformer_score,
    fusion_score,
    risk,
    categories,
    subcategories,
    features_used: [...new Set(features_used)],
  });
}
