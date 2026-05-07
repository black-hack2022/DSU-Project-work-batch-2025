# Results (Copy/Paste Section)

## Experimental Setup
We evaluate a graph-based malicious service detection model derived from the KDD’99/KDDTrain+ traffic corpus. Network connection records are aggregated at the **service** level, producing a compact graph where each node represents a network service (e.g., `ftp`, `domain`, `irc`) and edges capture **service relatedness via shared protocol neighborhoods** (constructed by projecting a bipartite service↔protocol graph into a service–service adjacency). In total, the graph contains **70 service nodes**.

To avoid target leakage, we train and evaluate using a **no-leak feature set** consisting only of:
- `src_bytes_mean` (mean source bytes per service),
- `dst_bytes_mean` (mean destination bytes per service),
- `count` (number of aggregated connections per service).

The binary label indicates whether a service is attack-linked (derived from historical attack presence in the underlying connections). All experiments use `random_state=42`.

## Model and Baselines
**Our method (Our-GNN)** is a lightweight 2-layer Graph Convolutional Network (GCN) implemented in PyTorch. Given node features $X$ and normalized adjacency $\hat{A}$, the model performs message passing and outputs $P(\text{malicious})$ for each service. We compare against common non-graph baselines trained on the same node features: Logistic Regression, RBF-SVM, Random Forest, k-NN, and Naive Bayes.

## Main Results
We report ROC-AUC along with Accuracy/Precision/Recall/F1. For robust reporting, we emphasize **5-fold stratified cross-validation (CV)** using pooled out-of-fold scores. The key outcome is that the proposed graph model achieves **AUC > 0.5** and strong classification metrics.

- **Our-GNN (5-fold CV, pooled):** AUC **0.962**, Accuracy **0.929**, F1 **0.961**.
- Baselines vary by metric; in our setting, Random Forest attains higher Accuracy/F1, while Our-GNN attains the highest AUC.

Paper-ready outputs (already generated in the repo):
- ROC curve (CV pooled): `paper_noleak_roc_compare_cv.png`
- Metrics table (CSV/LaTeX): `paper_noleak_metrics_cv.csv`, `paper_noleak_metrics_cv.tex`
- Paper-styled booktabs tables: `paper_tables_noleak.tex`

## Interpretation
The graph formulation enables **context-aware detection**: a service’s risk score is influenced not only by its own traffic statistics but also by signals propagated from its protocol-neighborhood peers. This is especially relevant in network settings where malicious behavior clusters across related services and protocols.

## Limitations and Reporting Notes
This experiment operates on a small, service-aggregated graph (70 nodes) with a strong class imbalance (most services are attack-linked). As a result:
- Single held-out splits can look overly optimistic; we therefore recommend reporting **cross-validation pooled ROC-AUC**.
- Future work can increase realism by incorporating time-based splits, additional non-leaky features (e.g., entropy/unique source counts), and evaluation on a completely separate dataset.
