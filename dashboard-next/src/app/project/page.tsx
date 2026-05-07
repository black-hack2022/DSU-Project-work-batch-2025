import Link from "next/link";

export default function ProjectPage() {
  return (
    <div className="p-5 space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">IS-HAITI — System Overview</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
          Intellectual Smart Hybrid AI System for Real-Time Threat Intelligence · Team No. 89
        </p>
      </div>

      {/* What the system does */}
      <div
        className="rounded-lg p-5 space-y-3"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <h2 className="font-semibold">What This System Does</h2>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          IS-HAITI is a hybrid AI cyber threat intelligence platform that combines deep learning
          (GNN + Transformer + Autoencoder) with rule-based detectors to detect, classify,
          and explain cyberattacks across 8 categories (A–H) in real time.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { cat: "A", label: "Text / Email Threats", sub: "Spam · Phishing · SMS Scam · Social Engineering", color: "#8b5cf6" },
            { cat: "B", label: "URLs / Web Threats", sub: "Malicious URLs · Drive-by · Redirect chains · Brand spoofing", color: "#06b6d4" },
            { cat: "C", label: "Network Attacks", sub: "Port scan · Brute-force · SSH/RDP attack · ICMP recon", color: "#ef4444" },
            { cat: "D", label: "Lateral Movement", sub: "SMB · NetBIOS · Pass-the-Hash/Ticket · East-West pivot", color: "#f97316" },
            { cat: "E", label: "Botnets / C2", sub: "IRC botnet · HTTP beacon · DNS tunnel · DGA · Fast-flux", color: "#eab308" },
            { cat: "F", label: "Data Exfiltration", sub: "SMTP exfil · DNS exfil · HTTP POST leakage", color: "#ec4899" },
            { cat: "G", label: "Malware Behavior", sub: "Beaconing · Backdoor · Persistence · Memory dump", color: "#10b981" },
            { cat: "H", label: "Multi-Stage / Unknown", sub: "APT chains · Slow-and-low · Zero-day · Structural anomalies", color: "#3b82f6" },
          ].map((c) => (
            <div
              key={c.cat}
              className="rounded p-3"
              style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${c.color}44` }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-5 w-5 rounded text-xs font-bold flex items-center justify-center shrink-0"
                  style={{ background: `${c.color}22`, color: c.color }}
                >
                  {c.cat}
                </span>
                <span className="font-medium text-sm">{c.label}</span>
              </div>
              <div className="text-xs mt-0.5 pl-7" style={{ color: "var(--muted-foreground)" }}>{c.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Core components */}
      <div
        className="rounded-lg p-5 space-y-3"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <h2 className="font-semibold">Core AI Components</h2>
        <div className="space-y-3">
          {[
            {
              name: "GNN — SimpleGCN",
              color: "var(--color-gnn)",
              detail: "2-layer Graph Convolutional Network on a service-protocol bipartite graph (73 nodes, 72 edges). Trained on aggregated KDD Cup 1999 service statistics. AUC: 0.742, F1: 0.977. Detects 67/70 services as malicious (95.7% rate).",
            },
            {
              name: "FT-Transformer (Feature Tokenizer)",
              color: "var(--color-transformer)",
              detail: "Per-flow tabular transformer: numeric tokenizer (x·W+b) → CLS prepend → 4× [MultiHead-8h attention + FFN-GELU] → CLS classification. Fusion: 70% transformer + 30% GNN service risk. KDD Cup 1999 + UNSW-NB15.",
            },
            {
              name: "MLP Autoencoder",
              color: "var(--color-autoencoder)",
              detail: "Unsupervised anomaly detection. Architecture: 49→256→128→32→128→256→49. Trained on normal UNSW-NB15 traffic only. Threshold: p99.5 percentile of training reconstruction error. Flags zero-day / unknown attacks.",
            },
            {
              name: "Rule-Based Detectors (A–D + E–H Taxonomy)",
              color: "var(--color-safe)",
              detail: "Heuristic scoring for text threats (A), URL analysis (B), network attacks (C/D), and E–H service-level taxonomy categorization. Implements ThreatFinding dataclass with categorize_flow_e_to_h() and DGA lexical scoring.",
            },
            {
              name: "X-TIS Explainability",
              color: "#f59e0b",
              detail: "3 attribution methods: Gradient×Input, Integrated Gradients (50 steps), SHAP KernelExplainer (100 samples). Provides per-feature importance and subgraph context for every detection.",
            },
          ].map((c) => (
            <div key={c.name} className="flex gap-3">
              <span className="h-2 w-2 rounded-full shrink-0 mt-1.5" style={{ background: c.color }} />
              <div>
                <div className="font-medium text-sm">{c.name}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{c.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Operational workflow */}
      <div
        className="rounded-lg p-5 space-y-3"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <h2 className="font-semibold">Operational Workflow</h2>
        <div className="flex flex-wrap gap-0">
          {[
            { step: "1", label: "Ingest", desc: "Zeek · Suricata · CICFlowMeter · PCAP · Raw CSV" },
            { step: "2", label: "Normalize", desc: "Unify flows/messages/URLs into standard format" },
            { step: "3", label: "Detect", desc: "Run GNN + FT-Transformer + Autoencoder + Rules" },
            { step: "4", label: "Explain", desc: "X-TIS: SHAP + Integrated Gradients + graph context" },
            { step: "5", label: "Report", desc: "Export CSV/JSON/HTML + alert dashboard" },
          ].map((s, i, arr) => (
            <div key={s.step} className="flex items-center">
              <div
                className="rounded p-3 text-center min-w-24"
                style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}
              >
                <div className="text-xs font-bold" style={{ color: "#3b82f6" }}>Step {s.step}</div>
                <div className="font-medium text-sm mt-0.5">{s.label}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{s.desc}</div>
              </div>
              {i < arr.length - 1 && (
                <span className="mx-1 text-xs" style={{ color: "var(--muted-foreground)" }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Datasets */}
      <div
        className="rounded-lg p-5 space-y-3"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <h2 className="font-semibold">Datasets Used</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {[
            { name: "KDD Cup 1999", size: "125,973 connections", feats: "41 features, 22 attack types", use: "GNN + FT-Transformer training" },
            { name: "UNSW-NB15", size: "2,540,044 records", feats: "49 features, 9 attack categories", use: "Autoencoder + FT-Transformer" },
            { name: "SpamAssassin", size: "~6,000 emails", feats: "easy_ham + spam", use: "Category A text detection" },
            { name: "SMS Spam Collection", size: "5,574 messages", feats: "ham/spam labels", use: "Category A SMS scam" },
            { name: "Kaggle Spam Dataset", size: "~5,000 emails", feats: "spam labels", use: "Category A supplement" },
          ].map((d) => (
            <div
              key={d.name}
              className="rounded p-2.5"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}
            >
              <div className="font-medium text-sm">{d.name}</div>
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>{d.size} · {d.feats}</div>
              <div className="text-xs mt-0.5" style={{ color: "#3b82f6" }}>{d.use}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 text-sm">
        {[
          { href: "/dashboard", label: "A–H Dashboard" },
          { href: "/detection/network", label: "Network Detection" },
          { href: "/explainability", label: "X-TIS" },
          { href: "/metrics", label: "Metrics" },
          { href: "/reports", label: "Reports" },
          { href: "/simulation", label: "Simulation" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="px-3 py-1.5 rounded text-xs"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            {l.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}
