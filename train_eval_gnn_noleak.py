"""train_eval_gnn_noleak.py

Retrain the GNN while avoiding target leakage:
- Label y is derived from attack presence (attack_rate > 0)
- Features EXCLUDE attack_rate and instead use: src_bytes_mean, dst_bytes_mean, count

Outputs:
- gnn_model_noleak.pt
- eval_report_noleak.json (AUC/precision/recall/f1 on ALL services; descriptive)
- service_predictions_noleak_with_split.csv (prob/pred/true with train/val split)

Run:
  D:/majoproj/.venv/Scripts/python.exe train_eval_gnn_noleak.py
"""

import pickle
import json
import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, precision_recall_fscore_support
from sklearn.preprocessing import StandardScaler


RANDOM_STATE = 42
DEFAULT_FEATURES = [
    # Backwards-compatible base features
    "src_bytes_mean",
    "dst_bytes_mean",
    "count",
    # Enriched aggregates if present (graphbuilder_clean.py can create these)
    "duration_mean",
    "duration_std",
    "srv_count_mean",
    "srv_count_std",
    "serror_rate_mean",
    "rerror_rate_mean",
    "same_srv_rate_mean",
    "diff_srv_rate_mean",
    "dst_host_serror_rate_mean",
    "dst_host_rerror_rate_mean",
    "flow_count_mean",
]


class SimpleGCN(torch.nn.Module):
    def __init__(self, in_dim, hid_dim, out_dim):
        super().__init__()
        self.w0 = torch.nn.Linear(in_dim, hid_dim, bias=False)
        self.w1 = torch.nn.Linear(hid_dim, out_dim, bias=False)

    def forward(self, x, A_hat):
        x = self.w0(x)
        x = torch.matmul(A_hat, x)
        x = torch.relu(x)
        x = self.w1(x)
        x = torch.matmul(A_hat, x)
        return x


def normalize_adj(A):
    A = A + np.eye(A.shape[0], dtype=A.dtype)
    deg = A.sum(axis=1)
    deg_inv_sqrt = np.where(deg > 0, 1.0 / np.sqrt(deg), 0.0)
    D_inv_sqrt = np.diag(deg_inv_sqrt)
    return D_inv_sqrt @ A @ D_inv_sqrt


def build_service_adj_from_bipartite(G, services):
    svc_set = set(services)
    prot_to_services = {}
    for s in services:
        if s not in G:
            continue
        for nbr in G.neighbors(s):
            if nbr not in svc_set:
                prot_to_services.setdefault(nbr, set()).add(s)
    n = len(services)
    idx = {s: i for i, s in enumerate(services)}
    A = np.zeros((n, n), dtype=np.float32)
    import itertools
    for _, svcs in prot_to_services.items():
        for a, b in itertools.combinations(sorted(svcs), 2):
            i, j = idx[a], idx[b]
            A[i, j] = 1.0
            A[j, i] = 1.0
    return A


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Train SimpleGCN on service graph (no-leak features)")
    ap.add_argument(
        "--root",
        type=str,
        default=None,
        help=(
            "Directory containing service_stats.csv and service_protocol_graph.gpickle. "
            "Default: directory of this script."
        ),
    )
    ap.add_argument(
        "--features",
        type=str,
        default=None,
        help=(
            "Comma-separated list of service_stats.csv columns to use as node features. "
            "Default: a curated feature set (uses only columns that exist)."
        ),
    )
    ap.add_argument(
        "--epochs",
        type=int,
        default=200,
        help="Max epochs (early stopping may stop before this).",
    )
    ap.add_argument(
        "--patience",
        type=int,
        default=25,
        help="Early stopping patience measured on validation AUC.",
    )
    ap.add_argument(
        "--hidden_dim",
        type=int,
        default=32,
        help="Hidden dimension for GCN.",
    )
    ap.add_argument(
        "--lr",
        type=float,
        default=1e-2,
        help="Learning rate.",
    )
    ap.add_argument(
        "--weight_decay",
        type=float,
        default=1e-4,
        help="L2 weight decay.",
    )
    return ap.parse_args()


def resolve_data_root(args_root: str | None) -> Path:
    """Resolve the directory that contains required input files.

    We try (in order): explicit --root, script directory, script parent, current working directory.
    This makes the script robust when copied into a bundle where data may live one level up.
    """

    candidates: list[Path] = []
    if args_root:
        candidates.append(Path(args_root).resolve())

    script_dir = Path(__file__).resolve().parent
    candidates.append(script_dir)
    candidates.append(script_dir.parent)
    candidates.append(Path.cwd().resolve())

    required = ["service_stats.csv", "service_protocol_graph.gpickle"]
    for c in candidates:
        if all((c / r).exists() for r in required):
            return c

    msg = "Could not find required files in any candidate root. Tried:\n" + "\n".join(
        f"- {c}" for c in candidates
    )
    msg += "\nRequired:\n" + "\n".join(f"- {r}" for r in required)
    raise FileNotFoundError(msg)


def main():
    torch.manual_seed(RANDOM_STATE)
    np.random.seed(RANDOM_STATE)

    args = parse_args()

    root = resolve_data_root(args.root)
    stats_path = root / "service_stats.csv"
    graph_path = root / "service_protocol_graph.gpickle"

    service_stats = pd.read_csv(stats_path, index_col=0)
    services = list(service_stats.index)

    if args.features:
        requested = [c.strip() for c in args.features.split(",") if c.strip()]
    else:
        requested = DEFAULT_FEATURES

    features = [c for c in requested if c in service_stats.columns]
    if not features:
        raise ValueError(
            "No requested features were found in service_stats.csv. "
            f"Requested={requested[:10]}... Available={list(service_stats.columns)[:20]}..."
        )

    X_raw = service_stats[features].values.astype(np.float32)
    y = (service_stats["attack_rate"] > 0).astype(int).values.astype(np.int64)

    with open(graph_path, "rb") as fh:
        G = pickle.load(fh)

    A = build_service_adj_from_bipartite(G, services)
    A_hat = normalize_adj(A)

    # train/val split (stratified)
    idx = np.arange(len(services))
    train_idx, val_idx = train_test_split(idx, test_size=0.3, stratify=y, random_state=RANDOM_STATE)

    # Standardize using training split only (prevents leakage).
    scaler = StandardScaler()
    scaler.fit(X_raw[train_idx])
    X = scaler.transform(X_raw).astype(np.float32)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    x = torch.tensor(X, device=device)
    A_hat_t = torch.tensor(A_hat, dtype=torch.float32, device=device)
    y_t = torch.tensor(y, dtype=torch.long, device=device)

    model = SimpleGCN(in_dim=x.shape[1], hid_dim=int(args.hidden_dim), out_dim=2).to(device)

    # class weights from training only
    unique, counts = np.unique(y[train_idx], return_counts=True)
    class_counts = dict(zip(unique, counts))
    weight = np.array([class_counts.get(0, 0), class_counts.get(1, 0)], dtype=np.float32)
    weight = torch.tensor(weight.max() / (weight + 1e-9), dtype=torch.float32)

    opt = torch.optim.Adam(model.parameters(), lr=float(args.lr), weight_decay=float(args.weight_decay))

    best_val_auc = -1.0
    best_state = None
    patience_left = int(args.patience)

    print(f"Device: {device}")
    print(f"Features ({len(features)}): {features}")

    for epoch in range(1, int(args.epochs) + 1):
        model.train()
        opt.zero_grad()
        out = model(x, A_hat_t)
        loss = F.cross_entropy(out[train_idx], y_t[train_idx], weight=weight)
        loss.backward()
        opt.step()

        # Evaluate every epoch (cheap for this small graph) for early stopping.
        model.eval()
        with torch.no_grad():
            out_all = model(x, A_hat_t)
            probs = torch.softmax(out_all, dim=1)[:, 1].detach().cpu().numpy()
            preds = out_all.argmax(dim=1).detach().cpu().numpy()

            val_probs = probs[val_idx]
            val_true = y[val_idx]
            try:
                val_auc = float(roc_auc_score(val_true, val_probs))
            except Exception:
                val_auc = 0.0

            if epoch % 10 == 0 or epoch == 1:
                precision, recall, f1, _ = precision_recall_fscore_support(
                    val_true,
                    preds[val_idx],
                    average="binary",
                    zero_division=0,
                )
                print(
                    f"Epoch {epoch}, Loss {loss.item():.4f}, Val AUC {val_auc:.4f}, "
                    f"Prec {precision:.4f}, Rec {recall:.4f}, F1 {f1:.4f}"
                )

            if val_auc > best_val_auc + 1e-6:
                best_val_auc = val_auc
                best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
                patience_left = int(args.patience)
            else:
                patience_left -= 1

        if patience_left <= 0:
            print(f"Early stopping at epoch {epoch} (best Val AUC={best_val_auc:.4f})")
            break

    # Save best model
    if best_state is not None:
        torch.save(best_state, "gnn_model_noleak.pt")
    else:
        torch.save({k: v.detach().clone() for k, v in model.state_dict().items()}, "gnn_model_noleak.pt")

    # Final outputs (descriptive)
    try:
        state = torch.load("gnn_model_noleak.pt", weights_only=True)
    except TypeError:
        # Older PyTorch versions don't support weights_only.
        state = torch.load("gnn_model_noleak.pt")
    model.load_state_dict(state)
    model.eval()
    with torch.no_grad():
        out_all = model(x, A_hat_t)
        probs = torch.softmax(out_all, dim=1)[:, 1].detach().cpu().numpy()
        preds = out_all.argmax(dim=1).detach().cpu().numpy()

    try:
        auc_score = float(roc_auc_score(y, probs))
    except Exception:
        auc_score = 0.0

    precision, recall, f1, _ = precision_recall_fscore_support(y, preds, average="binary", zero_division=0)

    report = {
        "features": features,
        "scaler": "StandardScaler(train_split)",
        "auc": float(auc_score),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "best_val_auc": float(best_val_auc),
        "n_services": int(len(services)),
    }

    with open("eval_report_noleak.json", "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)

    split = ["train" if i in set(train_idx) else "val" for i in range(len(services))]
    df_out = pd.DataFrame({"service": services, "prob": probs, "pred": preds, "true": y, "split": split})
    df_out.to_csv("service_predictions_noleak_with_split.csv", index=False)

    print("Saved gnn_model_noleak.pt")
    print("Saved eval_report_noleak.json", report)
    print("Saved service_predictions_noleak_with_split.csv")


if __name__ == "__main__":
    main()
