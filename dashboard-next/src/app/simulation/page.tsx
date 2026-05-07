"use client";

import { useState } from "react";
import Link from "next/link";

type AttackStep = {
  phase: string;
  action: string;
  ioc: string;
  category: string;
  detected_by: string;
  severity: "critical" | "high" | "medium" | "low";
};

type AttackScenario = {
  id: string;
  name: string;
  category: string;
  description: string;
  mitre_tactics: string[];
  steps: AttackStep[];
};

const SCENARIOS: AttackScenario[] = [
  {
    id: "apt-multi-stage",
    name: "APT Multi-Stage Campaign",
    category: "H",
    description: "Advanced persistent threat: spear-phishing → credential theft → lateral movement → C2 → data exfiltration",
    mitre_tactics: ["Initial Access", "Execution", "Credential Access", "Lateral Movement", "Command & Control", "Exfiltration"],
    steps: [
      { phase: "Initial Access", action: "Spear-phishing email with malicious link", ioc: "http://secure-login-update.xyz/verify", category: "A/B", detected_by: "Text Detector + URL Scorer", severity: "high" },
      { phase: "Execution", action: "Malicious payload download via HTTP", ioc: "GET /update.exe (83KB binary)", category: "B/G", detected_by: "URL Scorer + FT-Transformer", severity: "high" },
      { phase: "Credential Access", action: "Brute-force SSH on internal server", ioc: "tcp/22: 342 failed auth attempts", category: "C", detected_by: "Network Heuristics", severity: "critical" },
      { phase: "Lateral Movement", action: "SMB share enumeration + file access", ioc: "SMB/445 to 12 internal hosts", category: "D", detected_by: "Network Heuristics", severity: "critical" },
      { phase: "C2 Establishment", action: "HTTP beaconing every 60s", ioc: "Periodic 146-byte outbound http", category: "E", detected_by: "GNN + FT-Transformer", severity: "critical" },
      { phase: "Reconnaissance", action: "Internal DNS tunnel for C2 comms", ioc: "High-entropy DNS A queries", category: "E", detected_by: "GNN + Taxonomy", severity: "high" },
      { phase: "Exfiltration", action: "Large SMTP data transfer", ioc: "smtp: src_bytes=8000, dst_bytes=60000", category: "F", detected_by: "GNN + FT-Transformer", severity: "critical" },
    ],
  },
  {
    id: "botnet-c2",
    name: "Botnet C2 Communication",
    category: "E",
    description: "Bot infection → C2 check-in → command execution → DGA fallback communication",
    mitre_tactics: ["Command & Control", "Defense Evasion"],
    steps: [
      { phase: "Bot Activation", action: "Initial HTTP C2 check-in", ioc: "Periodic short http connections (146B)", category: "E", detected_by: "GNN + FT-Transformer", severity: "high" },
      { phase: "Command Poll", action: "Repeated connections to private service", ioc: "private: count=289 same_srv", category: "E", detected_by: "GNN (attack_rate=0.99)", severity: "critical" },
      { phase: "DGA Fallback", action: "Domain generation for C2 resilience", ioc: "Lexically random domains, high entropy", category: "E", detected_by: "Taxonomy (DGA lexical score)", severity: "high" },
      { phase: "Peer Discovery", action: "Outbound UDP scans for peer bots", ioc: "UDP port sweep: count=511", category: "E/C", detected_by: "Network Heuristics + GNN", severity: "medium" },
    ],
  },
  {
    id: "insider-exfil",
    name: "Insider Data Exfiltration",
    category: "F",
    description: "Privileged user abusing SMTP and DNS to leak sensitive data",
    mitre_tactics: ["Collection", "Exfiltration"],
    steps: [
      { phase: "Collection", action: "Bulk file access on file server", ioc: "ftp_data: high src_bytes, logged_in=1", category: "F/C", detected_by: "FT-Transformer", severity: "medium" },
      { phase: "Encoding", action: "Data encoded into DNS TXT queries", ioc: "DNS TXT: unusual payload lengths", category: "F", detected_by: "Taxonomy (dns_exfil)", severity: "high" },
      { phase: "Exfiltration", action: "SMTP burst transfer to external domain", ioc: "smtp: src_bytes=89340 in 2.4s", category: "F", detected_by: "GNN + FT-Transformer", severity: "critical" },
      { phase: "Cleanup", action: "Log deletion via rsh/rexec", ioc: "rsh connections from compromised host", category: "D/H", detected_by: "GNN (rsh anomaly)", severity: "high" },
    ],
  },
  {
    id: "network-recon",
    name: "Network Reconnaissance",
    category: "C",
    description: "External attacker mapping the network before exploitation",
    mitre_tactics: ["Reconnaissance", "Discovery"],
    steps: [
      { phase: "Port Discovery", action: "SYN scan across all ports", ioc: "tcp: REJ flags, count=511, srv_count=3", category: "C", detected_by: "Network Heuristics (port_scan)", severity: "medium" },
      { phase: "Service Enum", action: "Banner grabbing on open ports", ioc: "Short-duration tcp connections, 0 bytes", category: "C", detected_by: "Network Heuristics", severity: "medium" },
      { phase: "OS Fingerprint", action: "ICMP probe sweep", ioc: "icmp: count=512, seq pattern", category: "C", detected_by: "Network Heuristics (icmp_recon)", severity: "low" },
      { phase: "Vulnerability Scan", action: "SSH version probe + exploit attempt", ioc: "ssh: serror_rate=0.95", category: "C", detected_by: "GNN + Network Heuristics", severity: "high" },
    ],
  },
];

const SEV_COLOR: Record<string, string> = {
  critical: "var(--color-critical)",
  high: "var(--color-high)",
  medium: "var(--color-medium)",
  low: "var(--color-low)",
};

export default function SimulationPage() {
  const [selected, setSelected] = useState<AttackScenario>(SCENARIOS[0]);
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  function startSimulation() {
    setCompletedSteps(new Set());
    setActiveStep(0);
    setRunning(true);

    let step = 0;
    const total = selected.steps.length;

    function advance() {
      if (step < total) {
        setActiveStep(step);
        setCompletedSteps((prev) => {
          const next = new Set(prev);
          if (step > 0) next.add(step - 1);
          return next;
        });
        step++;
        setTimeout(advance, 1200);
      } else {
        setActiveStep(null);
        setCompletedSteps(new Set(Array.from({ length: total }, (_, i) => i)));
        setRunning(false);
      }
    }

    setTimeout(advance, 400);
  }

  function reset() {
    setActiveStep(null);
    setCompletedSteps(new Set());
    setRunning(false);
  }

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Attack Simulation</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Step-through visualization of A–H attack chains and detection coverage
        </p>
      </div>

      {/* Scenario selector */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="text-sm font-semibold mb-3" style={{ color: "var(--muted-foreground)" }}>
          Select Attack Scenario
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => { setSelected(s); reset(); }}
              className="text-left rounded p-3 transition-all"
              style={
                selected.id === s.id
                  ? { background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)", color: "var(--foreground)" }
                  : { background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--foreground)" }
              }
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-bold"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}
                >
                  Cat {s.category}
                </span>
                <span className="font-semibold text-sm">{s.name}</span>
              </div>
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{s.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Simulation controls */}
      <div
        className="rounded-lg p-4"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-bold">{selected.name}</div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {selected.mitre_tactics.map((t) => (
                <span
                  key={t}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(139,92,246,0.12)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.25)" }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {running || completedSteps.size > 0 ? (
              <button
                onClick={reset}
                className="text-sm px-3 py-1.5 rounded"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                Reset
              </button>
            ) : null}
            <button
              onClick={startSimulation}
              disabled={running}
              className="text-sm px-4 py-1.5 rounded font-medium disabled:opacity-50"
              style={{ background: running ? "rgba(59,130,246,0.3)" : "#3b82f6", color: "white" }}
            >
              {running ? "Running…" : completedSteps.size > 0 ? "Re-run" : "▶ Start Simulation"}
            </button>
          </div>
        </div>

        {/* Attack timeline */}
        <div className="space-y-2">
          {selected.steps.map((step, i) => {
            const isActive = activeStep === i;
            const isDone = completedSteps.has(i);
            return (
              <div
                key={i}
                className="rounded p-3 transition-all"
                style={{
                  background: isActive ? "rgba(59,130,246,0.1)" : isDone ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isActive ? "rgba(59,130,246,0.5)" : isDone ? "rgba(34,197,94,0.2)" : "var(--border)"}`,
                  opacity: !running && completedSteps.size === 0 ? 0.7 : 1,
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Step indicator */}
                  <div
                    className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                    style={{
                      background: isActive ? "#3b82f6" : isDone ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)",
                      color: isActive ? "white" : isDone ? "#86efac" : "var(--muted-foreground)",
                    }}
                  >
                    {isDone ? "✓" : isActive ? "▶" : i + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-xs font-medium"
                        style={{ color: isActive ? "#93c5fd" : isDone ? "#86efac" : "var(--muted-foreground)" }}
                      >
                        {step.phase}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: `${SEV_COLOR[step.severity]}22`, color: SEV_COLOR[step.severity], border: `1px solid ${SEV_COLOR[step.severity]}44` }}
                      >
                        {step.severity.toUpperCase()}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(59,130,246,0.12)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)" }}
                      >
                        Cat {step.category}
                      </span>
                    </div>
                    <div className="text-sm font-medium mt-0.5">{step.action}</div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.3)", color: "#94a3b8" }}>
                        {step.ioc}
                      </span>
                      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        Detected by: <span style={{ color: isDone || isActive ? "#86efac" : "var(--muted-foreground)" }}>{step.detected_by}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary when complete */}
        {completedSteps.size === selected.steps.length && !running && (
          <div
            className="mt-4 rounded p-3"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            <div className="font-semibold text-sm" style={{ color: "#86efac" }}>
              ✓ Simulation Complete — All {selected.steps.length} attack steps detected
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
              Detection coverage:{" "}
              {[...new Set(selected.steps.map((s) => s.detected_by.split(" + ")).flat())].join(" · ")}
            </div>
            <div className="flex gap-2 mt-2">
              <Link
                href="/alerts"
                className="text-xs px-3 py-1.5 rounded"
                style={{ background: "rgba(59,130,246,0.15)", color: "#93c5fd", border: "1px solid rgba(59,130,246,0.3)" }}
              >
                View in Alerts
              </Link>
              <Link
                href="/explainability"
                className="text-xs px-3 py-1.5 rounded"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                X-TIS Analysis
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
