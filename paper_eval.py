"""paper_eval.py

Generates paper-ready evaluation artifacts:
- ROC curve on held-out split (val) with AUC > 0.5 (if model is better than random)
- Baseline comparisons (LogReg, SVM, RF, KNN, Naive Bayes)
- Metrics tables (Accuracy / Precision / Recall / F1 / AUC)
- CSV + LaTeX outputs for research paper

This script is intentionally reproducible:
- Uses the existing split labels in service_predictions_with_split.csv
- Uses random_state=42 for stochastic models

Run:
  D:/majoproj/.venv/Scripts/python.exe paper_eval.py
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import pickle
import numpy as np
import pandas as pd

import torch
import torch.nn.functional as F

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold
from sklearn.base import clone
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


RANDOM_STATE = 42


@dataclass
class EvalResult:
    model: str
    split: str
    n: int
    positives: int
    accuracy: float
    precision: float
    recall: float
    f1: float
    auc: float | None


def _safe_auc(y_true: np.ndarray, y_score: np.ndarray) -> float | None:
    # AUC is undefined if only one class is present.
    if len(np.unique(y_true)) < 2:
        return None
    return float(roc_auc_score(y_true, y_score))


class SimpleGCN(torch.nn.Module):
    def __init__(self, in_dim: int, hid_dim: int, out_dim: int):
        super().__init__()
        self.w0 = torch.nn.Linear(in_dim, hid_dim, bias=False)
        self.w1 = torch.nn.Linear(hid_dim, out_dim, bias=False)

    def forward(self, x: torch.Tensor, A_hat: torch.Tensor) -> torch.Tensor:
        x = self.w0(x)
        x = torch.matmul(A_hat, x)
        x = torch.relu(x)
        x = self.w1(x)
        x = torch.matmul(A_hat, x)
        return x


def normalize_adj(A: np.ndarray) -> np.ndarray:
    A = A + np.eye(A.shape[0], dtype=A.dtype)
    deg = A.sum(axis=1)
    deg_inv_sqrt = np.where(deg > 0, 1.0 / np.sqrt(deg), 0.0)
    D_inv_sqrt = np.diag(deg_inv_sqrt)
    return D_inv_sqrt @ A @ D_inv_sqrt


def build_service_adj_from_bipartite(G, services: List[str]) -> np.ndarray:
    svc_set = set(services)
    prot_to_services: Dict[str, set] = {}
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


def load_graph_Ahat(root: Path, services: List[str]) -> torch.Tensor:
    graph_path = root / "service_protocol_graph.gpickle"
    if not graph_path.exists():
        raise FileNotFoundError(graph_path)

    with open(graph_path, "rb") as fh:
        G = pickle.load(fh)

    A = build_service_adj_from_bipartite(G, services)
    A_hat = normalize_adj(A)
    return torch.tensor(A_hat, dtype=torch.float32)


def train_gnn_fold(
    X: np.ndarray,
    y: np.ndarray,
    A_hat_t: torch.Tensor,
    train_idx: np.ndarray,
    val_idx: np.ndarray,
    epochs: int = 100,
    lr: float = 0.01,
) -> Tuple[np.ndarray, np.ndarray]:
    """Train GNN using train_idx and return (val_prob, val_pred)."""

    torch.manual_seed(RANDOM_STATE)
    np.random.seed(RANDOM_STATE)

    x_t = torch.tensor(X, dtype=torch.float32)
    y_t = torch.tensor(y, dtype=torch.long)

    model = SimpleGCN(in_dim=X.shape[1], hid_dim=16, out_dim=2)

    # class weights derived from training fold only
    unique, counts = np.unique(y[train_idx], return_counts=True)
    class_counts = dict(zip(unique, counts))
    weight = np.array([class_counts.get(0, 0), class_counts.get(1, 0)], dtype=np.float32)
    weight = torch.tensor(weight.max() / (weight + 1e-9), dtype=torch.float32)

    opt = torch.optim.Adam(model.parameters(), lr=lr)

    train_idx_t = torch.tensor(train_idx, dtype=torch.long)
    val_idx_t = torch.tensor(val_idx, dtype=torch.long)

    for _ in range(epochs):
        model.train()
        opt.zero_grad()
        out = model(x_t, A_hat_t)
        loss = F.cross_entropy(out[train_idx_t], y_t[train_idx_t], weight=weight)
        loss.backward()
        opt.step()

    model.eval()
    with torch.no_grad():
        out_all = model(x_t, A_hat_t)
        prob_all = torch.softmax(out_all, dim=1)[:, 1].cpu().numpy()
        pred_all = out_all.argmax(dim=1).cpu().numpy()

    return prob_all[val_idx], pred_all[val_idx]


def compute_metrics(name: str, split: str, y_true: np.ndarray, y_prob: np.ndarray, y_pred: np.ndarray) -> EvalResult:
    return EvalResult(
        model=name,
        split=split,
        n=int(y_true.shape[0]),
        positives=int(y_true.sum()),
        accuracy=float(accuracy_score(y_true, y_pred)),
        precision=float(precision_score(y_true, y_pred, zero_division=0)),
        recall=float(recall_score(y_true, y_pred, zero_division=0)),
        f1=float(f1_score(y_true, y_pred, zero_division=0)),
        auc=_safe_auc(y_true, y_prob),
    )


def load_dataset(
    root: Path,
    preds_filename: str,
    feature_cols: List[str],
) -> Tuple[pd.DataFrame, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    preds_path = root / preds_filename
    stats_path = root / "service_stats.csv"

    if not preds_path.exists():
        raise FileNotFoundError(preds_path)
    if not stats_path.exists():
        raise FileNotFoundError(stats_path)

    preds = pd.read_csv(preds_path)
    stats = pd.read_csv(stats_path, index_col=0)

    # Join to align ordering by service name
    df = preds.merge(stats.reset_index().rename(columns={"index": "service"}), on="service", how="inner")

    missing = [c for c in feature_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required feature columns: {missing}")

    X = df[feature_cols].to_numpy(dtype=np.float32)
    y = df["true"].to_numpy(dtype=np.int64)

    train_mask = (df["split"] == "train").to_numpy()
    val_mask = (df["split"] == "val").to_numpy()

    if train_mask.sum() == 0 or val_mask.sum() == 0:
        raise ValueError("Expected non-empty train/val splits in service_predictions_with_split.csv")

    return df, X, y, train_mask, val_mask


def build_baselines() -> Dict[str, object]:
    return {
        "LogReg": Pipeline(
            steps=[
                ("scaler", StandardScaler()),
                ("clf", LogisticRegression(max_iter=2000, random_state=RANDOM_STATE)),
            ]
        ),
        "SVM-RBF": Pipeline(
            steps=[
                ("scaler", StandardScaler()),
                ("clf", SVC(kernel="rbf", probability=True, random_state=RANDOM_STATE)),
            ]
        ),
        "RandomForest": RandomForestClassifier(
            n_estimators=300,
            random_state=RANDOM_STATE,
            class_weight="balanced",
        ),
        "KNN": Pipeline(
            steps=[
                ("scaler", StandardScaler()),
                ("clf", KNeighborsClassifier(n_neighbors=5)),
            ]
        ),
        "NaiveBayes": GaussianNB(),
    }


def get_score_prob_and_pred(model, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Return (score_for_auc, prob_for_threshold, pred).

    Notes:
    - ROC/AUC only needs a ranking score. For some models (notably SVC) `predict_proba`
      can be unstable with tiny/imbalanced validation sets, so we prefer `decision_function`
      for the ROC/AUC score if available.
    - We still compute a probability-like value for thresholded metrics.
    """
    score = None
    if hasattr(model, "decision_function"):
        try:
            score = model.decision_function(X)
        except Exception:
            score = None

    prob = None
    if hasattr(model, "predict_proba"):
        try:
            prob = model.predict_proba(X)[:, 1]
        except Exception:
            prob = None

    if prob is None:
        # map score to (0,1) if we don't have calibrated probabilities
        if score is None:
            raise RuntimeError(f"Model {type(model)} provides neither predict_proba nor decision_function")
        prob = 1.0 / (1.0 + np.exp(-score))

    if score is None:
        score = prob

    pred = (prob >= 0.5).astype(np.int64)
    return score.astype(np.float64), prob.astype(np.float64), pred


def save_metrics_table(results: List[EvalResult], out_csv: Path, out_tex: Path) -> pd.DataFrame:
    df = pd.DataFrame([r.__dict__ for r in results])

    # Format AUC as NaN if undefined
    df["auc"] = df["auc"].astype(float)

    # Order columns for papers
    df = df[["model", "split", "n", "positives", "accuracy", "precision", "recall", "f1", "auc"]]
    df = df.sort_values(["split", "auc", "f1"], ascending=[True, False, False])

    df.to_csv(out_csv, index=False)

    # LaTeX table (paper-friendly)
    df_tex = df.copy()
    for c in ["accuracy", "precision", "recall", "f1", "auc"]:
        df_tex[c] = df_tex[c].map(lambda x: "" if pd.isna(x) else f"{x:.3f}")
    df_tex.to_latex(out_tex, index=False)

    return df


def plot_roc_curves(
    y_true: np.ndarray,
    curves: Dict[str, np.ndarray],
    out_path: Path,
    title: str,
) -> pd.DataFrame:
    """curves: model_name -> y_prob array"""

    plt.figure(figsize=(7.5, 6.0))
    roc_points: List[Dict[str, float | str]] = []

    # diagonal
    plt.plot([0, 1], [0, 1], linestyle="--", color="#666", linewidth=1, label="Random")

    for name, probs in curves.items():
        if len(np.unique(y_true)) < 2:
            continue
        fpr, tpr, thr = roc_curve(y_true, probs)
        auc = roc_auc_score(y_true, probs)
        plt.plot(fpr, tpr, linewidth=2, label=f"{name} (AUC={auc:.3f})")

        for a, b, c in zip(fpr, tpr, thr):
            roc_points.append({"model": name, "fpr": float(a), "tpr": float(b), "threshold": float(c)})

    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title(title)
    plt.grid(True, alpha=0.25)
    plt.legend(loc="lower right", fontsize=9)
    plt.tight_layout()
    plt.savefig(out_path, dpi=200)
    plt.close()

    roc_df = pd.DataFrame(roc_points)
    return roc_df


def run_crossval(
    root: Path,
    df: pd.DataFrame,
    X: np.ndarray,
    y: np.ndarray,
    baselines: Dict[str, object],
    n_splits: int = 5,
) -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, np.ndarray]]:
    """Returns (pooled_metrics_df, fold_metrics_df, oof_score_by_model)."""

    services = df["service"].tolist()
    A_hat_t = load_graph_Ahat(root, services)

    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=RANDOM_STATE)

    models_all = {"Our-GNN": None, **baselines}
    oof_score: Dict[str, np.ndarray] = {k: np.full(len(y), np.nan, dtype=np.float64) for k in models_all.keys()}
    oof_pred: Dict[str, np.ndarray] = {k: np.full(len(y), -1, dtype=np.int64) for k in models_all.keys()}

    fold_rows: List[Dict[str, float | str | int]] = []

    for fold, (tr_idx, te_idx) in enumerate(skf.split(X, y), start=1):
        # Our GNN
        gnn_prob_te, gnn_pred_te = train_gnn_fold(X, y, A_hat_t, tr_idx, te_idx)
        oof_score["Our-GNN"][te_idx] = gnn_prob_te
        oof_pred["Our-GNN"][te_idx] = gnn_pred_te
        fold_rows.append(
            {
                "fold": fold,
                "model": "Our-GNN",
                "auc": _safe_auc(y[te_idx], gnn_prob_te),
                "accuracy": float(accuracy_score(y[te_idx], gnn_pred_te)),
            }
        )

        # Baselines
        for name, model in baselines.items():
            m = clone(model)
            m.fit(X[tr_idx], y[tr_idx])

            # score for ROC/AUC
            if hasattr(m, "decision_function"):
                try:
                    score_te = m.decision_function(X[te_idx])
                except Exception:
                    score_te = None
            else:
                score_te = None

            if score_te is None:
                score_te = m.predict_proba(X[te_idx])[:, 1]

            pred_te = m.predict(X[te_idx]).astype(np.int64)

            oof_score[name][te_idx] = np.asarray(score_te, dtype=np.float64)
            oof_pred[name][te_idx] = pred_te

            fold_rows.append(
                {
                    "fold": fold,
                    "model": name,
                    "auc": _safe_auc(y[te_idx], np.asarray(score_te, dtype=np.float64)),
                    "accuracy": float(accuracy_score(y[te_idx], pred_te)),
                }
            )

    # pooled metrics across all out-of-fold predictions
    pooled_rows: List[EvalResult] = []
    for name in models_all.keys():
        score = oof_score[name]
        pred = oof_pred[name]
        # For pooled AUC, use score; for other metrics, use pred
        auc = _safe_auc(y, score)
        pooled_rows.append(
            EvalResult(
                model=name,
                split=f"cv{n_splits}",
                n=int(len(y)),
                positives=int(y.sum()),
                accuracy=float(accuracy_score(y, pred)),
                precision=float(precision_score(y, pred, zero_division=0)),
                recall=float(recall_score(y, pred, zero_division=0)),
                f1=float(f1_score(y, pred, zero_division=0)),
                auc=auc,
            )
        )

    pooled_df = pd.DataFrame([r.__dict__ for r in pooled_rows])
    fold_df = pd.DataFrame(fold_rows)
    return pooled_df, fold_df, oof_score


def main() -> None:
    root = Path(".")

    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--preds",
        default="service_predictions_with_split.csv",
        help="CSV with columns service,prob,pred,true,split (default: service_predictions_with_split.csv)",
    )
    parser.add_argument(
        "--features",
        default="src_bytes_mean,dst_bytes_mean,attack_rate",
        help="Comma-separated feature columns to use from service_stats.csv",
    )
    parser.add_argument(
        "--tag",
        default="",
        help="Optional tag to insert into output filenames, e.g. 'noleak' -> paper_noleak_metrics_val.csv",
    )
    args = parser.parse_args()

    feature_cols = [c.strip() for c in args.features.split(",") if c.strip()]
    if not feature_cols:
        raise ValueError("--features cannot be empty")

    def out(stem: str) -> Path:
        return root / (f"paper_{args.tag}_{stem}" if args.tag else f"paper_{stem}")

    df, X, y, train_mask, val_mask = load_dataset(root, args.preds, feature_cols)

    # Our model scores are already saved by train_eval_gnn.py
    ours_prob = df["prob"].to_numpy(dtype=np.float64)
    ours_pred = df["pred"].to_numpy(dtype=np.int64)

    # Metrics on validation split (paper-relevant)
    results: List[EvalResult] = []

    y_val = y[val_mask]
    ours_prob_val = ours_prob[val_mask]
    ours_pred_val = ours_pred[val_mask]
    results.append(compute_metrics("Our-GNN", "val", y_val, ours_prob_val, ours_pred_val))

    # Train baselines on train split, evaluate on val split
    baselines = build_baselines()
    X_train, y_train = X[train_mask], y[train_mask]
    X_val = X[val_mask]

    curves_val: Dict[str, np.ndarray] = {"Our-GNN": ours_prob_val}

    for name, model in baselines.items():
        model.fit(X_train, y_train)
        score_val, prob_val, pred_val = get_score_prob_and_pred(model, X_val)
        results.append(compute_metrics(name, "val", y_val, prob_val, pred_val))
        curves_val[name] = score_val

    # Save metrics
    out_csv = out("metrics_val.csv")
    out_tex = out("metrics_val.tex")
    metrics_df = save_metrics_table(results, out_csv, out_tex)

    # ROC curve (val)
    roc_png = out("roc_compare_val.png")
    roc_points = plot_roc_curves(
        y_true=y_val,
        curves=curves_val,
        out_path=roc_png,
        title="ROC on Held-out Services (Validation Split)",
    )
    roc_points.to_csv(out("roc_points_val.csv"), index=False)

    # Also save an ROC curve for Our-GNN only (clean single-line)
    roc_png_ours = out("roc_val.png")
    _ = plot_roc_curves(
        y_true=y_val,
        curves={"Our-GNN": ours_prob_val},
        out_path=roc_png_ours,
        title="ROC (Our GNN) on Held-out Services",
    )

    # Also save an ROC curve for Our-GNN on the full set (matches eval_report.json AUC)
    roc_png_all = out("roc_all_ours.png")
    _ = plot_roc_curves(
        y_true=y,
        curves={"Our-GNN": ours_prob},
        out_path=roc_png_all,
        title="ROC (Our GNN) on All Services (Descriptive)",
    )

    # Short markdown summary
    summary_md = out("results.md")
    ours_auc_val = results[0].auc
    with open(summary_md, "w", encoding="utf-8") as f:
        f.write("# Paper Evaluation Outputs\n\n")
        f.write("This evaluation uses the existing `train`/`val` split from `service_predictions_with_split.csv`.\n\n")
        f.write("## Key outputs\n")
        f.write(f"- `{roc_png_ours.name}` (Our GNN ROC on validation)\n")
        f.write(f"- `{roc_png.name}` (Our GNN vs baselines)\n")
        f.write(f"- `{roc_png_all.name}` (Our GNN ROC on all services; descriptive)\n")
        f.write(f"- `{out_csv.name}` and `{out_tex.name}` (comparison table)\n")
        f.write(f"- `{out('roc_points_val.csv').name}` (ROC points for reproducibility)\n\n")
        f.write("## Notes\n")
        f.write(f"- Random seed: {RANDOM_STATE}\n")
        f.write("- Baselines trained on `train` split and evaluated on `val` split\n")
        f.write(f"- Our-GNN validation AUC: {ours_auc_val if ours_auc_val is not None else 'undefined'}\n")

    # Cross-validation (more robust for papers than a single small val split)
    pooled_cv_df, fold_cv_df, oof_score = run_crossval(root, df, X, y, baselines, n_splits=5)

    pooled_cv_csv = out("metrics_cv.csv")
    pooled_cv_tex = out("metrics_cv.tex")
    pooled_cv_df = pooled_cv_df.sort_values(["auc", "f1"], ascending=[False, False])
    pooled_cv_df.to_csv(pooled_cv_csv, index=False)

    pooled_cv_tex_df = pooled_cv_df.copy()
    for c in ["accuracy", "precision", "recall", "f1", "auc"]:
        pooled_cv_tex_df[c] = pooled_cv_tex_df[c].map(lambda x: "" if pd.isna(x) else f"{x:.3f}")
    pooled_cv_tex_df.to_latex(pooled_cv_tex, index=False)

    fold_cv_path = out("metrics_cv_folds.csv")
    fold_cv_df.to_csv(fold_cv_path, index=False)

    # Pooled ROC from out-of-fold scores
    roc_cv_png = out("roc_compare_cv.png")
    roc_cv_points = plot_roc_curves(
        y_true=y,
        curves=oof_score,
        out_path=roc_cv_png,
        title="ROC from 5-Fold Cross-Validation (Out-of-Fold Scores)",
    )
    roc_cv_points.to_csv(out("roc_points_cv.csv"), index=False)

    # Append CV outputs to markdown
    with open(summary_md, "a", encoding="utf-8") as f:
        f.write("\n## Cross-validation outputs\n")
        f.write(f"- `{pooled_cv_csv.name}` and `{pooled_cv_tex.name}` (pooled 5-fold CV metrics)\n")
        f.write(f"- `{fold_cv_path.name}` (per-fold AUC/accuracy)\n")
        f.write(f"- `{roc_cv_png.name}` (pooled ROC from out-of-fold scores)\n")

    print("Saved:")
    print(f"  - {out_csv}")
    print(f"  - {out_tex}")
    print(f"  - {roc_png_ours}")
    print(f"  - {roc_png}")
    print(f"  - {roc_png_all}")
    print(f"  - {out('roc_points_val.csv')}")
    print(f"  - {summary_md}")
    print(f"  - {pooled_cv_csv}")
    print(f"  - {pooled_cv_tex}")
    print(f"  - {fold_cv_path}")
    print(f"  - {roc_cv_png}")
    print(f"  - {out('roc_points_cv.csv')}")

    # Print top-level table preview
    print("\nValidation metrics (sorted):")
    with pd.option_context('display.max_columns', None, 'display.width', 140):
        print(metrics_df.to_string(index=False))


if __name__ == "__main__":
    main()
