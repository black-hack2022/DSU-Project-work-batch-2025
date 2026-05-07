# CHAPTER 8 — RESULTS


## 8.1 Network Graph Visualization and Structural Analysis

### 8.1.1 Service–Protocol Interaction Graph (NSL‑KDD / KDD-derived)
The service interaction network is represented as a **service graph**, where:
- **Nodes** represent unique network services (e.g., `http`, `domain`, `ftp`, `irc`).
- **Edges** represent service relatedness derived from protocol neighborhood connectivity.
- The graph used for the core service-level experiments contains **70 services**.

This graph formulation is important because malicious behavior is rarely isolated to a single service. Instead, related services (by protocol usage and communication neighborhoods) often show correlated anomalous signals. The graph allows the model to learn **context-aware threat intelligence**, where a service risk score can be influenced by its neighbors.

**[IMAGE PLACEHOLDER]**

- **Fig 8.1:** Service–Protocol Graph (full topology)
- File (if you generate one): `figures/service_protocol_graph.png`

> If you do not have a full topology image yet, you can keep the placeholder and include the subgraph visuals from the X‑TIS section (8.4), which are already generated.

### 8.1.2 Node Color Scheme (Risk Heatmap)
In all graph visualizations, node color encodes the model’s predicted probability of being attack-linked.

**Service node coloration scheme**
- Low risk: $P(attack) < 0.30$
- Medium risk: $0.30 \le P(attack) < 0.70$
- High risk: $P(attack) \ge 0.70$

**Node size** is proportional to node connectivity (degree), highlighting high-traffic hub services (e.g., HTTP/DNS) versus smaller peripheral services that may still show high risk.

---

## 8.2 GNN Model Performance and Robustness (Service-Level)

### 8.2.1 Experimental Setup (No-Leak Evaluation)
To avoid target leakage, we report a strict **no-leak** evaluation using only the following aggregated service features:
- `src_bytes_mean` (mean source bytes per service)
- `dst_bytes_mean` (mean destination bytes per service)
- `count` (number of aggregated connections per service)

The label is binary: whether the service is attack-linked (based on historical attack presence in the underlying connections).

### 8.2.2 ROC Analysis (No-Leak)
**[IMAGE]**

- **Fig 8.2:** Pooled ROC curves (Our‑GNN vs baselines, 5‑fold CV)
- Image file: `paper_noleak_roc_compare_cv.png`

The ROC curve indicates strong separability between attack-linked and benign services across thresholds.

### 8.2.3 Quantitative Results (No-Leak)
We emphasize **5-fold stratified cross-validation (CV)** and pooled out-of-fold scoring for stable reporting.

**Our‑GNN (No‑Leak, 5‑fold CV, pooled)**
- Accuracy: **0.9286**
- Precision: **1.0000**
- Recall: **0.9242**
- F1-score: **0.9606**
- ROC‑AUC: **0.9621**

**[TABLE PLACEHOLDER]**

- **Table 8.1:** No‑Leak CV metrics (Our‑GNN vs baselines)
- Source file: `paper_noleak_metrics_cv.csv` (LaTeX: `paper_noleak_metrics_cv.tex`)

**Validation split note:** On the held-out validation split, Our‑GNN achieves ROC‑AUC = **1.0**.
- Source file: `paper_noleak_metrics_val.csv` (LaTeX: `paper_noleak_metrics_val.tex`)

### 8.2.4 Interpretation
The key advantage of the GNN is **message passing**, enabling a service to inherit risk context from its neighborhood. This aligns with security reality: related services/protocols often participate jointly in multi-stage attacks (C2, lateral movement, exfiltration).

---

## 8.3 Attack Risk Stratification (Service Ranking)

### 8.3.1 Top‑Risk Services
The system produces a ranked list of services by predicted attack probability, supporting analyst prioritization (monitoring, blocking, segmentation, alert tuning).

**[IMAGE]**

- **Fig 8.3:** Top services by predicted attack probability
- Image file: `top20_risky_services.png`

### 8.3.2 Practical Security Meaning
High-risk scores for uncommon or legacy services (e.g., IRC-like, P2P-like, unusual ports) are treated as strong indicators for compromise or policy violations in enterprise settings.

---

## 8.4 Fine-Grained Attack Pattern Analysis using X‑TIS (Explainability)

X‑TIS-style explainability is provided at two levels:
1. **Feature attribution**: highlights which service features most contribute to the risk score.
2. **Subgraph visualization**: extracts the local neighborhood around a high-risk service to show how risk may propagate through related services.

### 8.4.1 Subgraph 1 — IRC-Mediated Command-and-Control (C2)
**[IMAGE]**

- **Fig 8.4:** IRC subgraph highlighting attack relations
- Image file: `x_tis_outputs2/IRC_subgraph.png` (also available: `x_tis_outputs2/IRC_subgraph_ig.png`, `x_tis_outputs2/IRC_subgraph_shap.png`)

**Interpretation:** IRC-like services are frequently abused for botnet control channels. A high-risk IRC node with suspicious neighbors indicates potential C2 coordination and lateral spread.

### 8.4.2 Subgraph 2 — NetBIOS/SMB-Style Lateral Movement Cluster
**[IMAGE]**

- **Fig 8.5:** NetBIOS/SMB-related subgraph
- Image file: `x_tis_outputs2/netbios_ssn_subgraph.png` (also: `x_tis_outputs2/netbios_ssn_subgraph_ig.png`, `x_tis_outputs2/netbios_ssn_subgraph_shap.png`)

**Interpretation:** Tight clustering around NetBIOS/SMB-related services is consistent with Windows lateral movement (credential reuse, remote execution, file share probing).

### 8.4.3 Subgraph 3 — Credential Harvesting / Memory Dumping Signals
**[IMAGE]**

- **Fig 8.6:** PM_Dump subgraph and attribution view
- Image file: `x_tis_outputs2/pm_dump_subgraph.png` (annotated SHAP: `x_tis_outputs2/annotated_shap_pm_dump.png`)

**Interpretation:** Process memory dumping is a common technique for extracting secrets and credentials, often preceding mail/service access and exfiltration.

### 8.4.4 Subgraph 4 — DNS-based Command-and-Control / Tunneling Indicator
**[IMAGE]**

- **Fig 8.7:** NetBIOS_DGM / DNS anomaly-style subgraph
- Image file: `x_tis_outputs2/netbios_dgm_subgraph.png` (also: `x_tis_outputs2/netbios_dgm_subgraph_ig.png`, `x_tis_outputs2/netbios_dgm_subgraph_shap.png`)

**Interpretation:** DNS is frequently allowed through firewalls; anomalies around DNS/related services can indicate covert channels for C2 or data transfer.

---

## 8.5 Transformer Model Results (Flow-Level) and Fusion Results

### 8.5.1 Tabular Transformer Performance (per dataset)
A tabular Transformer (FT‑Transformer-like) was trained to output $P(attack)$ at the **flow/record** level. Metrics below are taken from saved run artifacts.

**KDD (validation / test)**
- Val: Accuracy 0.9948, F1 0.9944, ROC‑AUC 0.99985
- Test: Accuracy 0.9948, F1 0.9944, ROC‑AUC 0.99982
- Files: `transformer_tabular/runs/kdd/metrics_val.json`, `transformer_tabular/runs/kdd/metrics_test.json`

**CICIDS2017 (validation / test)**
- Val: Accuracy 0.9903, F1 0.9751, ROC‑AUC 0.99927
- Test: Accuracy 0.9954, F1 0.9884, ROC‑AUC 0.99982
- Files: `transformer_tabular/runs/cicids2017/metrics_val.json`, `transformer_tabular/runs/cicids2017/metrics_test.json`

**UNSW‑NB15 (validation / test)**
- Val: Accuracy 0.9976, F1 0.9978, ROC‑AUC 0.99995
- Test: Accuracy 0.4002, F1 0.2626, ROC‑AUC 0.63822 (PR‑AUC 0.80590)
- Files: `transformer_tabular/runs/unsw_nb15/metrics_val.json`, `transformer_tabular/runs/unsw_nb15/metrics_test.json`

**Discussion:** The UNSW test degradation indicates dataset shift and/or label/feature distribution mismatch between splits. Therefore, we report both ROC‑AUC and PR‑AUC and treat test metrics as the realistic generalization indicator.

### 8.5.2 Fusion: Transformer → Service Aggregation → GNN
To bridge per-flow predictions with service-level threat intelligence, Transformer probabilities are aggregated into service node features and then processed by a GNN on a service graph.

**KDD Fusion Results (service-level)**
- Services: 68
- ROC‑AUC (all services): **0.97266**
- Precision/Recall/F1: 0.94118 / 1.00000 / 0.96970
- File: `transformer_tabular/runs/fusion_kdd_gnn/fusion_eval_report.json`

**[IMAGE PLACEHOLDER]**
- **Fig 8.8:** Fusion pipeline schematic (Transformer → Aggregation → GNN)
- File (add diagram): `figures/fusion_pipeline.png`

### 8.5.3 Detection-mode Output (Operational Report)
A detection script generates per-record risk scores and a best-effort categorization for network-style threats.

- Rows processed (smoke run): 5000
- Predicted attacks: 2361
- Files: `transformer_tabular/runs/kdd_threat_detections_smoke.csv`, `transformer_tabular/runs/kdd_threat_detections_smoke.summary.json`

---

## 8.6 Category A and Category B Threat Detection Results (Content + URLs)

### 8.6.1 Category A — Spam / Phishing / Scam (Text Threats) + X‑TIS Reports
A content-based detector was implemented to process SMS/email text (because flow datasets do not include message bodies). It outputs X‑TIS-style explanations per message and generates a single-file HTML report for analyst review.

**spam.csv (labeled)**
- Messages: 5572
- Flagged: 302
- Accuracy / Precision / Recall / F1: 0.9079 / 0.8874 / 0.3588 / 0.5110
- Files: `text_threats/out_spam_csv_xtis_full/run_summary.json`, `text_threats/out_spam_csv_xtis_full/report.html`

**SMSSpamCollection (labeled)**
- Messages: 5574
- Flagged: 302
- Accuracy / Precision / Recall / F1: 0.9080 / 0.8874 / 0.3588 / 0.5110
- Files: `text_threats/out_sms_collection_xtis_full/run_summary.json`, `text_threats/out_sms_collection_xtis_full/report.html`

**easy_ham (unlabeled ham)**
- Messages: 2551
- Flagged: 1650 (reported as a limitation of a heuristic baseline without calibration)
- Files: `text_threats/out_easy_ham_xtis/run_summary.json`, `text_threats/out_easy_ham_xtis/report.html`

**[IMAGE PLACEHOLDER]**
- **Fig 8.9:** Screenshot of Category A HTML report (spam/phishing)
- Source HTML: `text_threats/out_spam_csv_xtis_full/report.html`

### 8.6.2 Category B — Malicious URL & Website Attacks (URL Threats) + HTML Reports
A URL threat detector was implemented using offline lexical signals (shortener/IP/punycode/suspicious TLD/brand + login keywords/entropy). It produces per-URL risk scores and X‑TIS-style top-feature explanations. HTML reports are generated for quick analyst interpretation.

**Run summary (URLs extracted from messages)**
- URLs analyzed: 67
- URLs flagged: 24
- File: `url_threats/run_summary.json`

**HTML reports produced**
- `url_threats/reports/report_from_spam_csv.html`
- `url_threats/reports/report_from_sms_collection.html`

**[IMAGE PLACEHOLDER]**
- **Fig 8.10:** Screenshot of Category B HTML report (malicious URLs)
- Source HTML: `url_threats/reports/report_from_spam_csv.html`

---

# CHAPTER 9 — DELIVERABLES

This chapter lists the concrete things produced by the project, written in plain language so that a non-specialist can understand what they are and why they matter.

---

## 9.1 Trained Threat Detection Models

### 9.1.1 Network record (flow) risk model
**Deliverable:** A trained machine-learning model that scores each network record as **low to high risk**.

**What it does:** For every row/connection in a network dataset, it outputs a risk score (think “how likely this looks like an attack”).

**Why it matters:** This is the core “early warning” detector at the most detailed level (per connection).

**How a reviewer uses it:** Run the provided evaluation script to reproduce the reported accuracy/ROC results, or run the detection script to produce a ranked list of risky records.

### 9.1.2 Service risk model (service-level graph model)
**Deliverable:** A trained model that scores **network services** (for example, web, DNS, email-related services) as low to high risk.

**What it does:** Instead of scoring individual connections, it produces a risk score per service and uses a service-to-service relationship map so that related services can influence each other.

**Why it matters:** Service-level outputs are easier to act on in real operations (monitor, restrict, or investigate a service), and the relationship map helps capture “attack context.”

**How a reviewer uses it:** Run the evaluation to reproduce the ROC curves and the ranked list of highest-risk services.

### 9.1.3 Hybrid (combined) pipeline model
**Deliverable:** A combined pipeline that links both ideas above into one system.

**What it does:**
1) Scores individual connections (record-level risk),
2) Summarizes those risks into service-level signals,
3) Produces final service risk scores using the service relationship map.

**Why it matters:** It provides both detailed detection and an operational summary view, which is closer to how real security monitoring is performed.

---

## 9.2 Evaluation Results and Paper-Ready Tables/Figures

### 9.2.1 Paper-ready metrics tables
**Deliverable:** Tables of key performance numbers ready to paste into the report.

**What it contains:** Accuracy and other standard “how good is the detector?” scores (reported for Our‑GNN and baseline models under the no-leak setting).

**Why it matters:** This is the primary quantitative evidence supporting the service-level model claims.

### 9.2.2 Paper-ready ROC plots
**Deliverable:** ROC curve figures for the report.

**What it shows:** A standard accuracy curve that shows how detection quality changes as you move the alert threshold from strict to lenient, including baseline comparisons.

### 9.2.3 Narrative results write-up
**Deliverable:** A written results summary that matches the computed metrics.

**Why it matters:** Ensures the written report matches the actual computed metrics.

---

## 9.3 Explainability (X‑TIS) Artifacts

### 9.3.1 Service-level X‑TIS visuals
**Deliverable:** Visual explanations showing why the service risk model flagged something.

**What it contains:**
- Subgraph images showing which services are connected to a high-risk service (local neighborhood context)
- Attribution-style visuals indicating which features contributed most to the prediction

**Why it matters:** These artifacts justify model decisions and support “threat intelligence” interpretation (C2 clusters, lateral movement clusters, etc.).

### 9.3.2 Text-level X‑TIS outputs (Category A)
**Deliverable:** Explainable detections for suspicious messages (spam/phishing/scam).

**What it contains (per message):**
- Risk score and predicted subtype
- Extracted URLs (when present)
- Top contributing features that explain why a message was flagged

**Why it matters:** Makes content-based detections transparent and easy to audit.

### 9.3.3 URL-level X‑TIS outputs (Category B)
**Deliverable:** Explainable detections for suspicious links (malicious URLs/websites).

**What it contains (per URL):**
- Risk score
- Predicted URL subtype (best-effort)
- Top URL features that contributed to risk (e.g., suspicious TLD, URL obfuscation, brand/login keywords)

---

## 9.4 Analyst-Friendly Reports (HTML)

### 9.4.1 Category A HTML reports (Spam/Phishing/Scam)
**Deliverable:** A clickable, human-readable report for message threat detection.

**What it shows:**
- Score distribution plots
- Counts of detected subtypes
- Top-N flagged messages with explanations

**Why it matters:** A reviewer can open the report and understand results immediately without running code.

### 9.4.2 Category B HTML reports (Malicious URLs/Websites)
**Deliverable:** A clickable, human-readable report for suspicious link detection.

**What it shows:**
- URL list with risk scores
- Top contributing features per URL
- Summary charts for quick review

---

## 9.5 Operational Scripts and Pipelines

### 9.5.1 Training and evaluation scripts
**Deliverable:** Runnable scripts to train the models and reproduce the metrics.

**Why it matters:** Supports repeatable experimentation and validation by a reviewer.

### 9.5.2 Threat detection scripts (inference)
**Deliverable:** Detection scripts that generate actionable outputs.

**What they produce:** CSV/JSON predictions plus HTML summaries (for text and URL threats).

### 9.5.3 Reproducibility artifacts
**Deliverable:** Saved run outputs used as evidence for the reported results.

**What it contains:** metrics summaries, evaluation reports, and run summaries generated at execution time.

---

## 9.6 Report Asset Bundle (One-Folder Submission)
**Deliverable:** One folder named “Report Assets” containing everything needed to assemble the final PDF quickly.

**What it contains:**
- All report figures (PNG)
- The HTML reports (open in a browser and take screenshots)
- The tables/metrics used to write the Results chapter
- Sample CSV outputs as evidence of the pipeline

**Why it matters:** This prevents missing-figure issues and makes submission/review easier.

---

