"use client";

import { useCallback, useState } from "react";

type ScenarioKey = "apt" | "botnet" | "exfil" | "scan" | "phishing";

type NetworkInputs = {
  protocol: string;
  service: string;
  src_bytes: number;
  dst_bytes: number;
  duration: number;
  count: number;
  srv_count: number;
  flag: string;
};

type Scenario = {
  key: ScenarioKey;
  name: string;
  badge: string;
  color: string;
  description: string;
  network: NetworkInputs;
  text: string;
  url: string;
  anomaly: Record<string, number>;
};

const SCENARIOS: Scenario[] = [
  {
    key: "apt",
    name: "APT Multi-Stage Intrusion",
    badge: "CAT H",
    color: "#ef4444",
    description: "Advanced persistent threat: phishing delivery, service abuse, and exfiltration over ftp_data with failed handshakes.",
    network: { protocol: "tcp", service: "ftp_data", src_bytes: 491520, dst_bytes: 0, duration: 2, count: 511, srv_count: 511, flag: "S0" },
    text: "URGENT: Your corporate VPN credentials were exposed. Verify immediately at http://corp-vpn-reset.ru/verify to avoid suspension.",
    url: "http://corp-vpn-reset.ru/verify?token=abc123&user=admin",
    anomaly: { dur: 2, sbytes: 491520, dbytes: 0, spkts: 512, dpkts: 0, rate: 9830.4, sload: 9830.4, dload: 0, sloss: 0, dloss: 511, sinpkt: 0, dinpkt: 0, sjit: 0, djit: 0, swin: 0, dwin: 0, tcprtt: 0, synack: 0, ackdat: 0 },
  },
  {
    key: "botnet",
    name: "Botnet C2 Beacon",
    badge: "CAT E",
    color: "#eab308",
    description: "Compromised host beaconing to command infrastructure with low payload repetition.",
    network: { protocol: "tcp", service: "IRC", src_bytes: 1032, dst_bytes: 342, duration: 0, count: 1, srv_count: 422, flag: "SF" },
    text: "PRIVMSG #ops-c2 :!scan 192.168.0.0/24 --stealth | JOIN #botnet-loader PASS xK9mP2 | bot_id alive()",
    url: "http://irc2.c2loader.tk/cmd?bot_id=zx9k&payload=reverse_shell",
    anomaly: { dur: 0, sbytes: 1032, dbytes: 342, spkts: 8, dpkts: 6, rate: 112, sload: 1032, dload: 342, sloss: 0, dloss: 0, sinpkt: 0.002, dinpkt: 0.003, sjit: 0.0008, djit: 0.0009, swin: 255, dwin: 255, tcprtt: 0.002, synack: 0.001, ackdat: 0.001 },
  },
  {
    key: "exfil",
    name: "Data Exfiltration",
    badge: "CAT F",
    color: "#ec4899",
    description: "Bulk SMTP transfer that looks like outbound data staging and export.",
    network: { protocol: "tcp", service: "smtp", src_bytes: 8388608, dst_bytes: 512, duration: 45, count: 3, srv_count: 3, flag: "SF" },
    text: "Bulk transfer: 50,000 customer PII records dispatched to smtp.external-drop.xyz by admin@corp.internal.",
    url: "http://external-drop.xyz/upload?session=steal_db&type=pii&enc=base64",
    anomaly: { dur: 45, sbytes: 8388608, dbytes: 512, spkts: 5243, dpkts: 4, rate: 186413, sload: 186413, dload: 11, sloss: 0, dloss: 0, sinpkt: 0.028, dinpkt: 0.8, sjit: 0.001, djit: 0.3, swin: 255, dwin: 62, tcprtt: 0.015, synack: 0.001, ackdat: 0.014 },
  },
  {
    key: "scan",
    name: "Network Reconnaissance",
    badge: "CAT C",
    color: "#f97316",
    description: "High-volume host and service discovery with rejected and incomplete handshakes.",
    network: { protocol: "tcp", service: "private", src_bytes: 0, dst_bytes: 0, duration: 0, count: 511, srv_count: 7, flag: "S0" },
    text: "Nmap stealth scan: 511 hosts swept, 247 open ports. SSH:22 RDP:3389 SMB:445 WinRM:5985.",
    url: "http://192.168.1.254:8080/admin/config",
    anomaly: { dur: 0, sbytes: 0, dbytes: 0, spkts: 1, dpkts: 0, rate: 0, sload: 0, dload: 0, sloss: 511, dloss: 511, sinpkt: 0, dinpkt: 0, sjit: 0, djit: 0, swin: 0, dwin: 0, tcprtt: 0, synack: 0, ackdat: 0 },
  },
  {
    key: "phishing",
    name: "Phishing Campaign",
    badge: "CAT A+B",
    color: "#8b5cf6",
    description: "Credential lure using a spoofed payment brand and urgent social engineering.",
    network: { protocol: "tcp", service: "http", src_bytes: 2048, dst_bytes: 8192, duration: 1, count: 5, srv_count: 5, flag: "SF" },
    text: "Dear Customer, Your PayPaI account has been permanently limited. Verify NOW at http://paypaI-secure.com/verify or lose $3,842.00.",
    url: "http://paypaI-secure.com/verify-account?ssn=required&cc=required&cvv=required",
    anomaly: { dur: 1, sbytes: 2048, dbytes: 8192, spkts: 10, dpkts: 12, rate: 10240, sload: 2048, dload: 8192, sloss: 0, dloss: 0, sinpkt: 0.01, dinpkt: 0.01, sjit: 0.0005, djit: 0.0005, swin: 255, dwin: 255, tcprtt: 0.002, synack: 0.001, ackdat: 0.001 },
  },
];

const PIPELINE_STEPS = [
  { id: "input", label: "Input", color: "#64748b" },
  { id: "gnn", label: "GNN", color: "#8b5cf6" },
  { id: "transformer", label: "FT-Transformer", color: "#06b6d4" },
  { id: "autoencoder", label: "Autoencoder", color: "#f59e0b" },
  { id: "fusion", label: "Fusion", color: "#10b981" },
  { id: "xtis", label: "X-TIS", color: "#3b82f6" },
  { id: "alert", label: "Alert", color: "#ef4444" },
];

type NetworkResult = {
  gnn_score: number;
  transformer_score: number;
  fusion_score: number;
  risk: string;
  categories: string[];
  subcategories: string[];
  features_used: string[];
};

type TextResult = {
  is_spam: boolean;
  is_phishing: boolean;
  is_scam: boolean;
  score: number;
  risk: string;
  reasons: string[];
};

type UrlResult = {
  url: string;
  score: number;
  risk: string;
  reasons: string[];
};

type AnomalyResult = {
  recon_mse: number;
  threshold: number;
  is_anomaly: boolean;
  anomaly_score: number;
  risk: string;
  top_anomalous_features: Array<{ feature: string; contribution: number; z_score?: number }>;
  possible_categories: string[];
};

type AllResults = {
  network: NetworkResult | null;
  text: TextResult | null;
  url: UrlResult | null;
  anomaly: AnomalyResult | null;
};

type VerdictSummary = {
  max: number;
  avg: number;
  triggered: number;
  risk: string;
};

type XtisSignal = {
  id: string;
  source: "network" | "text" | "url" | "anomaly";
  label: string;
  detail: string;
  strength: number;
  accent: string;
  method: string;
};

const NETWORK_FEATURE_DETAILS: Record<string, string> = {
  service: "The graph model placed this service near historically malicious neighborhoods.",
  attack_rate_proxy: "The service profile resembles attack-heavy nodes the GNN learned during training.",
  count: "High fan-out suggested scan, spray, or burst activity.",
  srv_count: "Heavy repetition against one service matched beaconing or brute-force reuse.",
  src_bytes: "Outbound volume changed the flow-level score materially.",
  dst_bytes: "The response volume shaped whether the flow looked interactive or suspicious.",
  flag: "Connection state was important because resets and incomplete handshakes are attack markers.",
  duration: "Session duration helped separate burst activity from legitimate sessions.",
  protocol: "Protocol choice shifted the prior risk profile for the flow.",
};

const ANOMALY_FEATURE_DETAILS: Record<string, string> = {
  dloss: "Destination packet loss departed sharply from the learned normal manifold.",
  sloss: "Source-side loss was outside the normal reconstruction envelope.",
  sbytes: "Source byte volume did not reconstruct like benign UNSW traffic.",
  dbytes: "Destination byte volume looked atypical for the learned baseline.",
  spkts: "Packet count structure was unusual for normal traffic.",
  dpkts: "Response-side packet count contributed to the anomaly decision.",
  sload: "Send throughput was outside the model's normal range and is consistent with exfil bursts.",
  dload: "Receive throughput was inconsistent with the benign training profile.",
  rate: "Overall rate was abnormal relative to the normal traffic baseline.",
  swin: "Window-size behavior diverged from what the model reconstructs well.",
  djit: "Destination jitter contributed timing-based anomaly evidence.",
  sjit: "Source jitter contributed timing-based anomaly evidence.",
};

const XTIS_METHODS = [
  {
    title: "Gradient x Input",
    accent: "#8b5cf6",
    desc: "Explains which supervised network features most strongly pushed the threat score upward.",
  },
  {
    title: "Integrated Gradients",
    accent: "#06b6d4",
    desc: "Shows how the flow moves away from a benign baseline as multiple fields change together.",
  },
  {
    title: "SHAP / Reconstruction",
    accent: "#f59e0b",
    desc: "Highlights which anomaly features most increased reconstruction error against normal traffic.",
  },
];

function sevColor(risk: string) {
  if (risk === "critical") return "#ef4444";
  if (risk === "high") return "#f97316";
  if (risk === "medium") return "#eab308";
  return "#3b82f6";
}

function scoreToRisk(score: number) {
  if (score >= 0.85) return "critical";
  if (score >= 0.65) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function titleCaseToken(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function moduleScore(results: AllResults, source: XtisSignal["source"]) {
  if (source === "network") return results.network?.fusion_score ?? 0;
  if (source === "text") return results.text?.score ?? 0;
  if (source === "url") return results.url?.score ?? 0;
  return results.anomaly?.anomaly_score ?? 0;
}

function buildXtisSignals(results: AllResults): XtisSignal[] {
  const signals: XtisSignal[] = [];

  for (const feature of (results.network?.features_used ?? []).slice(0, 4)) {
    signals.push({
      id: `network-${feature}`,
      source: "network",
      label: titleCaseToken(feature),
      detail: NETWORK_FEATURE_DETAILS[feature] ?? `${titleCaseToken(feature)} contributed to the supervised decision.`,
      strength: Math.max(0.12, moduleScore(results, "network") - signals.length * 0.03),
      accent: "#8b5cf6",
      method: "Gradient x Input",
    });
  }

  for (const reason of (results.text?.reasons ?? []).slice(0, 2)) {
    signals.push({
      id: `text-${reason}`,
      source: "text",
      label: "Text Signal",
      detail: reason,
      strength: Math.max(0.1, moduleScore(results, "text") - 0.02),
      accent: "#ec4899",
      method: "Integrated Gradients",
    });
  }

  for (const reason of (results.url?.reasons ?? []).slice(0, 2)) {
    signals.push({
      id: `url-${reason}`,
      source: "url",
      label: "URL Signal",
      detail: reason,
      strength: Math.max(0.1, moduleScore(results, "url") - 0.02),
      accent: "#06b6d4",
      method: "Integrated Gradients",
    });
  }

  for (const feature of (results.anomaly?.top_anomalous_features ?? []).slice(0, 4)) {
    const zSuffix = feature.z_score != null ? ` z=${feature.z_score.toFixed(1)}.` : "";
    signals.push({
      id: `anomaly-${feature.feature}`,
      source: "anomaly",
      label: titleCaseToken(feature.feature),
      detail: `${ANOMALY_FEATURE_DETAILS[feature.feature] ?? `${titleCaseToken(feature.feature)} materially increased reconstruction error.`}${zSuffix}`,
      strength: Math.min(1, Math.max(moduleScore(results, "anomaly"), Math.abs(feature.contribution) * 3)),
      accent: "#f59e0b",
      method: "SHAP / Reconstruction",
    });
  }

  return signals.sort((left, right) => right.strength - left.strength).slice(0, 8);
}

function buildNarrative(scenario: Scenario, results: AllResults, verdict: VerdictSummary) {
  const lines: string[] = [];
  const categories = results.network?.categories?.join(", ");
  const anomalyFeatures = (results.anomaly?.top_anomalous_features ?? [])
    .slice(0, 2)
    .map((feature) => titleCaseToken(feature.feature))
    .join(" and ");

  lines.push(
    `${verdict.triggered}/4 detectors aligned on a ${verdict.risk.toUpperCase()} assessment for ${scenario.name.toLowerCase()}${categories ? `, with the network path mapping most strongly to ${categories}.` : "."}`
  );

  if ((results.text?.score ?? 0) >= 0.4 || (results.url?.score ?? 0) >= 0.4) {
    lines.push("Initial-access evidence is present because the content and URL layers both found lure patterns consistent with delivery or credential harvesting.");
  }

  if (results.anomaly?.is_anomaly && anomalyFeatures) {
    lines.push(`The anomaly detector increased confidence because ${anomalyFeatures.toLowerCase()} deviated from the normal UNSW traffic manifold.`);
  }

  if ((results.network?.fusion_score ?? 0) >= 0.4) {
    lines.push("The supervised path stayed elevated after fusion, which means both graph context and per-flow structure supported the final decision.");
  }

  return lines.slice(0, 3);
}

function buildResponseActions(results: AllResults) {
  const actions: string[] = [];
  const categories = results.network?.categories ?? [];

  if ((results.text?.score ?? 0) >= 0.4 || (results.url?.score ?? 0) >= 0.4) {
    actions.push("Block the domain or URL at mail, DNS, and proxy layers, then quarantine any matching messages.");
  }
  if (categories.some((category) => category.includes("F")) || (results.anomaly?.possible_categories ?? []).some((category) => category.includes("F"))) {
    actions.push("Inspect outbound SMTP, FTP, and DNS egress for payload leakage and preserve the related host timeline.");
  }
  if (categories.some((category) => ["C", "D", "E", "G", "H"].some((prefix) => category.includes(prefix)))) {
    actions.push("Isolate the affected endpoint or service and pivot to peers that share the same service, protocol, or beacon pattern.");
  }
  if (actions.length < 3) {
    actions.push("Use the explanation output to validate whether the alert reflects delivery, execution, exfiltration, or multi-stage behavior before escalation.");
  }

  return [...new Set(actions)].slice(0, 3);
}

function dominantModule(results: AllResults) {
  return [
    { label: "Network Fusion", score: results.network?.fusion_score ?? 0 },
    { label: "Text / Email", score: results.text?.score ?? 0 },
    { label: "URL / Web", score: results.url?.score ?? 0 },
    { label: "Anomaly", score: results.anomaly?.anomaly_score ?? 0 },
  ].sort((left, right) => right.score - left.score)[0];
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="threat-bar mt-1">
      <div className="threat-bar-fill" style={{ width: `${Math.round(Math.min(1, value) * 100)}%`, background: color, transition: "width 0.8s ease" }} />
    </div>
  );
}

function FieldInput({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="space-y-0.5">
      <label className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded px-2 py-1 text-xs font-mono"
        style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }}
      />
    </div>
  );
}

function NoData() {
  return <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>No data returned</div>;
}

function ResultCard({ title, subtitle, color, tag, score, children }: { title: string; subtitle: string; color: string; tag: string; score: number; children: React.ReactNode }) {
  const risk = scoreToRisk(score);
  return (
    <div className="rounded-lg p-4 space-y-3" style={{ background: "var(--card)", border: `1px solid ${color}33` }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{title}</span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: color + "22", color, border: `1px solid ${color}44` }}>{tag}</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{subtitle}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono font-bold text-base" style={{ color: sevColor(risk) }}>{pct(score)}</div>
          <div className="text-xs font-medium uppercase" style={{ color: sevColor(risk) }}>{risk}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function ShowcasePage() {
  const [selected, setSelected] = useState<ScenarioKey>("apt");
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [results, setResults] = useState<AllResults | null>(null);

  const selectedScenario = SCENARIOS.find((scenario) => scenario.key === selected) ?? SCENARIOS[0];

  const [net, setNet] = useState<NetworkInputs>(selectedScenario.network);
  const [textInput, setTextInput] = useState(selectedScenario.text);
  const [urlInput, setUrlInput] = useState(selectedScenario.url);

  function selectScenario(key: ScenarioKey) {
    const scenario = SCENARIOS.find((item) => item.key === key) ?? SCENARIOS[0];
    setSelected(key);
    setNet(scenario.network);
    setTextInput(scenario.text);
    setUrlInput(scenario.url);
    setResults(null);
    setActiveStep(-1);
  }

  const runPipeline = useCallback(async () => {
    setRunning(true);
    setResults(null);
    setActiveStep(0);

    const animPromise = (async () => {
      for (let index = 0; index < PIPELINE_STEPS.length; index += 1) {
        setActiveStep(index);
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    })();

    const networkBody = {
      protocol: net.protocol,
      service: net.service,
      src_bytes: Number(net.src_bytes),
      dst_bytes: Number(net.dst_bytes),
      duration: Number(net.duration),
      count: Number(net.count),
      srv_count: Number(net.srv_count),
      flag: net.flag,
    };

    const apiPromise = Promise.all([
      fetch("/api/network/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(networkBody),
      }).then((response) => response.json()).catch(() => null),
      fetch("/api/text/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textInput }),
      }).then((response) => response.json()).catch(() => null),
      fetch("/api/url/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput }),
      }).then((response) => response.json()).catch(() => null),
      fetch("/api/anomaly/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedScenario.anomaly),
      }).then((response) => response.json()).catch(() => null),
    ]);

    const [apiResults] = await Promise.all([apiPromise, animPromise]);
    const [network, text, url, anomaly] = apiResults as [NetworkResult | null, TextResult | null, UrlResult | null, AnomalyResult | null];

    setResults({ network, text, url, anomaly });
    setRunning(false);
    setActiveStep(PIPELINE_STEPS.length - 1);
  }, [net, selectedScenario.anomaly, textInput, urlInput]);

  const verdict = results
    ? (() => {
        const scores = [
          results.network?.fusion_score ?? 0,
          results.text?.score ?? 0,
          results.url?.score ?? 0,
          results.anomaly?.anomaly_score ?? 0,
        ];
        const max = Math.max(...scores);
        const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
        const triggered = scores.filter((value) => value >= 0.4).length;
        return { max, avg, triggered, risk: scoreToRisk(max) } as VerdictSummary;
      })()
    : null;

  const xtisSignals = results ? buildXtisSignals(results) : [];
  const analystNarrative = results && verdict ? buildNarrative(selectedScenario, results, verdict) : [];
  const responseActions = results ? buildResponseActions(results) : [];
  const strongestModule = results ? dominantModule(results) : null;

  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Live Detection Pipeline</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Select a scenario, edit the inputs, then run all four detectors and review the X-TIS analyst explanation.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.key}
            onClick={() => selectScenario(scenario.key)}
            disabled={running}
            className="text-left rounded-lg p-3 transition-all"
            style={{
              background: selected === scenario.key ? `${scenario.color}15` : "var(--card)",
              border: `1px solid ${selected === scenario.key ? scenario.color + "66" : "var(--border)"}`,
              cursor: running ? "not-allowed" : "pointer",
              opacity: running && selected !== scenario.key ? 0.4 : 1,
            }}
          >
            <div className="text-xs font-bold font-mono mb-1" style={{ color: scenario.color }}>{scenario.badge}</div>
            <div className="font-semibold text-xs leading-tight">{scenario.name}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg p-4 space-y-3" style={{ background: "var(--card)", border: `1px solid ${selectedScenario.color}33` }}>
          <div className="text-xs font-semibold" style={{ color: selectedScenario.color }}>Network Flow (GNN + FT-Transformer)</div>
          <div className="grid grid-cols-2 gap-2">
            <FieldInput label="Protocol" value={net.protocol} onChange={(value) => setNet((current) => ({ ...current, protocol: value }))} />
            <FieldInput label="Service" value={net.service} onChange={(value) => setNet((current) => ({ ...current, service: value }))} />
            <FieldInput label="Flag" value={net.flag} onChange={(value) => setNet((current) => ({ ...current, flag: value }))} />
            <FieldInput label="src_bytes" type="number" value={net.src_bytes} onChange={(value) => setNet((current) => ({ ...current, src_bytes: Number(value) }))} />
            <FieldInput label="dst_bytes" type="number" value={net.dst_bytes} onChange={(value) => setNet((current) => ({ ...current, dst_bytes: Number(value) }))} />
            <FieldInput label="count" type="number" value={net.count} onChange={(value) => setNet((current) => ({ ...current, count: Number(value) }))} />
            <FieldInput label="srv_count" type="number" value={net.srv_count} onChange={(value) => setNet((current) => ({ ...current, srv_count: Number(value) }))} />
            <FieldInput label="duration" type="number" value={net.duration} onChange={(value) => setNet((current) => ({ ...current, duration: Number(value) }))} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg p-4 space-y-2" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="text-xs font-semibold" style={{ color: "#ec4899" }}>Text / Email (Cat A)</div>
            <textarea
              rows={4}
              value={textInput}
              onChange={(event) => setTextInput(event.target.value)}
              className="w-full rounded px-2 py-1.5 text-xs font-mono resize-y"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }}
            />
          </div>
          <div className="rounded-lg p-4 space-y-2" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="text-xs font-semibold" style={{ color: "#06b6d4" }}>URL / Web (Cat B)</div>
            <input
              type="text"
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              className="w-full rounded px-2 py-1 text-xs font-mono"
              style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", color: "#67e8f9", outline: "none" }}
            />
          </div>
        </div>

        <div className="rounded-lg p-4 flex flex-col items-center justify-center gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
          <button
            onClick={runPipeline}
            disabled={running}
            className="w-full rounded-lg py-3 font-bold text-sm transition-all"
            style={{
              background: running ? "#1a2744" : `${selectedScenario.color}22`,
              border: `1px solid ${selectedScenario.color}88`,
              color: running ? "var(--muted-foreground)" : selectedScenario.color,
              cursor: running ? "not-allowed" : "pointer",
            }}
          >
            {running ? "Processing..." : "Run Full Pipeline"}
          </button>
          {results && !running && (
            <button onClick={() => { setResults(null); setActiveStep(-1); }} className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Reset results
            </button>
          )}
          <div className="text-xs text-center space-y-0.5" style={{ color: "var(--muted-foreground)" }}>
            <div>4 APIs fire in parallel</div>
            <div className="font-mono" style={{ fontSize: "10px" }}>GNN - Transformer - AE - URL</div>
            <div>{selectedScenario.description}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="text-xs font-medium mb-3" style={{ color: "var(--muted-foreground)" }}>DETECTION PIPELINE</div>
        <div className="flex items-center overflow-x-auto pb-1">
          {PIPELINE_STEPS.map((step, index) => {
            const done = results !== null || (activeStep >= PIPELINE_STEPS.length - 1 && !running);
            const passed = done || activeStep > index;
            const active = running && activeStep === index;

            return (
              <div key={step.id} className="flex items-center shrink-0">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                    style={{
                      background: passed ? step.color + "33" : active ? step.color + "22" : "rgba(255,255,255,0.04)",
                      border: `1.5px solid ${passed || active ? step.color : "var(--border)"}`,
                      color: passed || active ? step.color : "var(--muted-foreground)",
                      boxShadow: active ? `0 0 10px ${step.color}77` : "none",
                    }}
                  >
                    {passed ? "OK" : active ? ".." : index + 1}
                  </div>
                  <div className="text-center" style={{ fontSize: "9px", width: "56px", color: passed || active ? step.color : "var(--muted-foreground)", fontWeight: active ? 700 : 400 }}>
                    {step.label}
                  </div>
                </div>
                {index < PIPELINE_STEPS.length - 1 && (
                  <div className="w-5 h-px mx-0.5 mb-4 shrink-0 transition-all" style={{ background: passed ? step.color + "88" : "var(--border)" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {results && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ResultCard title="Network Analysis" subtitle="GNN (SimpleGCN) + FT-Transformer" color="#8b5cf6" tag="CAT C-H" score={results.network?.fusion_score ?? 0}>
              {results.network ? (
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "GNN Service", value: results.network.gnn_score, color: "#8b5cf6" },
                      { label: "Transformer", value: results.network.transformer_score, color: "#06b6d4" },
                      { label: "Fusion", value: results.network.fusion_score, color: sevColor(results.network.risk) },
                    ].map((item) => (
                      <div key={item.label}>
                        <div style={{ color: "var(--muted-foreground)" }}>{item.label}</div>
                        <div className="font-mono font-bold" style={{ color: item.color }}>{pct(item.value)}</div>
                      </div>
                    ))}
                  </div>
                  <ScoreBar value={results.network.fusion_score} color={sevColor(results.network.risk)} />
                  {(results.network.categories ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {results.network.categories.map((category) => (
                        <span key={category} className="px-1.5 py-0.5 rounded font-mono text-xs" style={{ background: "#8b5cf622", color: "#8b5cf6", border: "1px solid #8b5cf633" }}>{category}</span>
                      ))}
                    </div>
                  )}
                  {(results.network.features_used ?? []).slice(0, 4).map((feature) => (
                    <div key={feature} className="flex items-center gap-1.5">
                      <span style={{ color: "#8b5cf6" }}>{">"}</span>
                      <span className="font-mono" style={{ color: "#94a3b8" }}>{feature}</span>
                    </div>
                  ))}
                </div>
              ) : <NoData />}
            </ResultCard>

            <ResultCard title="Text / Email Analysis" subtitle="NLP heuristics for spam, phishing, and scam" color="#ec4899" tag="CAT A" score={results.text?.score ?? 0}>
              {results.text ? (
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Spam", flag: results.text.is_spam, color: "#ec4899" },
                      { label: "Phishing", flag: results.text.is_phishing, color: "#f97316" },
                      { label: "Scam", flag: results.text.is_scam, color: "#eab308" },
                    ].map((item) => (
                      <div key={item.label}>
                        <div style={{ color: "var(--muted-foreground)" }}>{item.label}</div>
                        <div className="font-mono font-bold" style={{ color: item.flag ? item.color : "#64748b" }}>{item.flag ? "YES" : "no"}</div>
                      </div>
                    ))}
                  </div>
                  <ScoreBar value={results.text.score} color={sevColor(results.text.risk)} />
                  {results.text.reasons.slice(0, 4).map((reason) => (
                    <div key={reason} className="flex items-start gap-1.5">
                      <span style={{ color: "#ec4899" }}>{">"}</span>
                      <span style={{ color: "#94a3b8" }}>{reason}</span>
                    </div>
                  ))}
                </div>
              ) : <NoData />}
            </ResultCard>

            <ResultCard title="URL / Web Scanner" subtitle="Lexical analysis, brand spoofing, and TLD scoring" color="#06b6d4" tag="CAT B" score={results.url?.score ?? 0}>
              {results.url ? (
                <div className="space-y-2 text-xs">
                  <div className="font-mono break-all mb-1" style={{ color: "#67e8f9", fontSize: "10px" }}>
                    {results.url.url.length > 70 ? results.url.url.slice(0, 70) + "..." : results.url.url}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div style={{ color: "var(--muted-foreground)" }}>Risk Score</div>
                      <div className="font-mono font-bold" style={{ color: sevColor(results.url.risk) }}>{pct(results.url.score)}</div>
                    </div>
                    <div>
                      <div style={{ color: "var(--muted-foreground)" }}>Level</div>
                      <div className="font-mono font-bold uppercase" style={{ color: sevColor(results.url.risk) }}>{results.url.risk}</div>
                    </div>
                  </div>
                  <ScoreBar value={results.url.score} color={sevColor(results.url.risk)} />
                  {results.url.reasons.slice(0, 3).map((reason) => (
                    <div key={reason} className="flex items-start gap-1.5">
                      <span style={{ color: "#06b6d4" }}>{">"}</span>
                      <span style={{ color: "#94a3b8" }}>{reason}</span>
                    </div>
                  ))}
                </div>
              ) : <NoData />}
            </ResultCard>

            <ResultCard title="Anomaly Detection" subtitle="MLP Autoencoder on UNSW-NB15 reconstruction error" color="#f59e0b" tag="UNSW" score={results.anomaly?.anomaly_score ?? 0}>
              {results.anomaly ? (
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div style={{ color: "var(--muted-foreground)" }}>Recon MSE</div>
                      <div className="font-mono font-bold" style={{ color: results.anomaly.is_anomaly ? "#ef4444" : "#22c55e" }}>{results.anomaly.recon_mse.toFixed(4)}</div>
                    </div>
                    <div>
                      <div style={{ color: "var(--muted-foreground)" }}>Threshold</div>
                      <div className="font-mono font-bold" style={{ color: "#f59e0b" }}>{results.anomaly.threshold.toFixed(4)}</div>
                    </div>
                    <div>
                      <div style={{ color: "var(--muted-foreground)" }}>Flagged</div>
                      <div className="font-mono font-bold" style={{ color: results.anomaly.is_anomaly ? "#ef4444" : "#22c55e" }}>{results.anomaly.is_anomaly ? "YES" : "NO"}</div>
                    </div>
                  </div>
                  <ScoreBar value={results.anomaly.anomaly_score} color={sevColor(results.anomaly.risk)} />
                  {(results.anomaly.top_anomalous_features ?? []).slice(0, 3).map((feature) => (
                    <div key={feature.feature} className="flex items-center gap-2">
                      <span className="w-28 truncate font-mono" style={{ color: "var(--muted-foreground)" }}>{feature.feature}</span>
                      <div className="flex-1 threat-bar">
                        <div className="threat-bar-fill" style={{ width: `${Math.min(100, Math.abs(feature.contribution) * 100)}%`, background: "#f59e0b" }} />
                      </div>
                      <span className="font-mono text-xs w-14 text-right" style={{ color: "#f59e0b" }}>
                        {feature.z_score != null ? `z=${feature.z_score.toFixed(1)}` : `${(feature.contribution * 100).toFixed(1)}%`}
                      </span>
                    </div>
                  ))}
                  {(results.anomaly.possible_categories ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {results.anomaly.possible_categories.map((category) => (
                        <span key={category} className="px-1.5 py-0.5 rounded font-mono text-xs" style={{ background: "#f59e0b22", color: "#f59e0b", border: "1px solid #f59e0b33" }}>{category}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : <NoData />}
            </ResultCard>
          </div>

          {verdict && (
            <div className="rounded-lg p-5 space-y-4" style={{ background: "var(--card)", border: `1px solid ${sevColor(verdict.risk)}44` }}>
              <div className="flex items-start gap-4 flex-wrap">
                <div className="px-3 py-1 rounded-full text-sm font-bold shrink-0" style={{ background: sevColor(verdict.risk) + "22", color: sevColor(verdict.risk), border: `1px solid ${sevColor(verdict.risk)}55` }}>
                  {verdict.risk.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{selectedScenario.name} - Multi-Vector Analysis Complete</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {verdict.triggered}/4 modules triggered - Max score {pct(verdict.max)} - Avg {pct(verdict.avg)}
                  </div>
                </div>
                <div className="font-mono font-bold shrink-0" style={{ color: selectedScenario.color }}>{selectedScenario.badge}</div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_0.9fr] gap-4">
                <div className="rounded-lg p-4 space-y-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                  <div>
                    <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>X-TIS ANALYST EXPLANATION</div>
                    <div className="space-y-2 text-sm" style={{ color: "#cbd5e1" }}>
                      {analystNarrative.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {XTIS_METHODS.map((method) => (
                      <div key={method.title} className="rounded p-3 text-xs" style={{ background: `${method.accent}10`, border: `1px solid ${method.accent}33` }}>
                        <div className="font-semibold mb-1" style={{ color: method.accent }}>{method.title}</div>
                        <div style={{ color: "#94a3b8" }}>{method.desc}</div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>X-TIS EVIDENCE TRAIL</div>
                    <div className="space-y-2">
                      {xtisSignals.map((signal) => (
                        <div key={signal.id} className="rounded p-3" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${signal.accent}33` }}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: `${signal.accent}22`, color: signal.accent, border: `1px solid ${signal.accent}33` }}>{signal.source.toUpperCase()}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "1px solid var(--border)" }}>{signal.method}</span>
                            <span className="text-xs font-semibold" style={{ color: signal.accent }}>{signal.label}</span>
                            <span className="ml-auto font-mono text-xs" style={{ color: signal.accent }}>{pct(signal.strength)}</span>
                          </div>
                          <div className="text-xs mt-1.5" style={{ color: "#94a3b8" }}>{signal.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg p-4 space-y-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                  <div>
                    <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>X-TIS DECISION BASIS</div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between rounded px-2.5 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                        <span style={{ color: "#94a3b8" }}>Cross-model agreement</span>
                        <span className="font-mono" style={{ color: sevColor(verdict.risk) }}>{verdict.triggered}/4</span>
                      </div>
                      <div className="flex items-center justify-between rounded px-2.5 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                        <span style={{ color: "#94a3b8" }}>Strongest module</span>
                        <span className="font-mono" style={{ color: strongestModule ? sevColor(scoreToRisk(strongestModule.score)) : "#94a3b8" }}>
                          {strongestModule ? `${strongestModule.label} ${pct(strongestModule.score)}` : "n/a"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded px-2.5 py-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                        <span style={{ color: "#94a3b8" }}>Primary category</span>
                        <span className="font-mono" style={{ color: selectedScenario.color }}>
                          {results.network?.categories?.[0] ?? results.anomaly?.possible_categories?.[0] ?? selectedScenario.badge}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>IMMEDIATE ACTIONS</div>
                    <div className="space-y-2">
                      {responseActions.map((action) => (
                        <div key={action} className="rounded px-2.5 py-2 text-xs" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "#cbd5e1" }}>
                          {action}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: "var(--muted-foreground)" }}>DETECTION CHAIN</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Text/Email", score: results.text?.score ?? 0, color: "#ec4899" },
                    { label: "URL/Web", score: results.url?.score ?? 0, color: "#06b6d4" },
                    { label: "Network Flow", score: results.network?.fusion_score ?? 0, color: "#8b5cf6" },
                    { label: "Anomaly", score: results.anomaly?.anomaly_score ?? 0, color: "#f59e0b" },
                  ].map((module) => {
                    const fired = module.score >= 0.4;
                    return (
                      <div key={module.label} className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs" style={{ background: fired ? module.color + "18" : "rgba(255,255,255,0.03)", border: `1px solid ${fired ? module.color + "55" : "var(--border)"}` }}>
                        <span style={{ color: fired ? module.color : "#475569" }}>{fired ? "[x]" : "[ ]"}</span>
                        <span style={{ color: fired ? module.color : "#64748b" }}>{module.label}</span>
                        <span className="font-mono" style={{ color: fired ? module.color : "#64748b" }}>{pct(module.score)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}