from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Dict, Tuple

import numpy as np
import torch
import torch.nn.functional as F
from sklearn.metrics import roc_auc_score, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from torch.utils.data import DataLoader
from tqdm import tqdm

from tabular_transformer.dataset import TabularDataset, load_split
from tabular_transformer.model import FTTransformer


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


@torch.no_grad()
def transformer_probs(
    ckpt_path: Path,
    split_tensors,
    meta: Dict,
    batch_size: int,
    device: torch.device,
) -> np.ndarray:
    ckpt = torch.load(ckpt_path, map_location=device)
    cfg = ckpt.get("config", {}) if isinstance(ckpt, dict) else {}
    ckpt_meta = ckpt.get("meta", meta) if isinstance(ckpt, dict) else meta

    model = FTTransformer(
        n_num=int(ckpt_meta["n_num"]),
        cat_cardinalities=ckpt_meta.get("cat_cardinalities", []),
        d_token=int(cfg.get("d_token", 192)),
        n_heads=int(cfg.get("n_heads", 8)),
        n_layers=int(cfg.get("n_layers", 4)),
        d_ff=int(cfg.get("d_ff", 384)),
        dropout=float(cfg.get("dropout", 0.1)),
    ).to(device)

    state = ckpt["model"] if isinstance(ckpt, dict) and "model" in ckpt else ckpt
    model.load_state_dict(state)
    model.eval()

    loader = DataLoader(
        TabularDataset(split_tensors),
        batch_size=batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=(device.type == "cuda"),
    )

    probs = []
    for batch in tqdm(loader, desc="transformer_infer", leave=False):
        x_num = batch["x_num"].to(device)
        x_cat = batch["x_cat"].to(device)
        logits = model(x_num=x_num, x_cat=x_cat)
        p = torch.sigmoid(logits).detach().cpu().numpy()
        probs.append(p)

    return np.concatenate(probs)


def build_service_graph_from_rows(
    service_ids: np.ndarray,
    proto_ids: np.ndarray,
    services: np.ndarray,
) -> np.ndarray:
    # Build adjacency among services if they share any proto.
    svc_set = set(services.tolist())
    prot_to_services: Dict[int, set] = {}
    for s, p in zip(service_ids.tolist(), proto_ids.tolist()):
        if s not in svc_set:
            continue
        if p == 0:
            continue
        prot_to_services.setdefault(int(p), set()).add(int(s))

    idx = {int(s): i for i, s in enumerate(services.tolist())}
    n = len(services)
    A = np.zeros((n, n), dtype=np.float32)

    for svcs in prot_to_services.values():
        svcs = sorted(svcs)
        for i in range(len(svcs)):
            for j in range(i + 1, len(svcs)):
                a = idx[svcs[i]]
                b = idx[svcs[j]]
                A[a, b] = 1.0
                A[b, a] = 1.0

    return A


def aggregate_per_service(
    services: np.ndarray,
    service_ids: np.ndarray,
    probs: np.ndarray,
    y: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    # Features: mean_p, max_p, log1p(count)
    feats = np.zeros((len(services), 3), dtype=np.float32)
    labels = np.zeros((len(services),), dtype=np.int64)

    svc_to_idx = {int(s): i for i, s in enumerate(services.tolist())}

    counts = np.zeros((len(services),), dtype=np.int64)
    sum_p = np.zeros((len(services),), dtype=np.float64)
    max_p = np.zeros((len(services),), dtype=np.float64)

    for s, p, yy in zip(service_ids.tolist(), probs.tolist(), y.tolist()):
        if int(s) not in svc_to_idx:
            continue
        i = svc_to_idx[int(s)]
        counts[i] += 1
        sum_p[i] += float(p)
        max_p[i] = max(max_p[i], float(p))
        if int(yy) == 1:
            labels[i] = 1

    mean_p = np.divide(sum_p, np.maximum(counts, 1), dtype=np.float64)
    feats[:, 0] = mean_p.astype(np.float32)
    feats[:, 1] = max_p.astype(np.float32)
    feats[:, 2] = np.log1p(counts.astype(np.float32))

    return feats, labels, counts


def safe_service_split(
    idx_all: np.ndarray,
    y_svc: np.ndarray,
    val_size: float,
    seed: int,
    max_tries: int = 25,
) -> Tuple[np.ndarray, np.ndarray]:
    # For tiny numbers of services, a stratified split can still yield a val set
    # containing only one class. Retry a few seeds to find a split with both classes.
    if len(np.unique(y_svc)) < 2:
        return idx_all, np.array([], dtype=np.int64)

    for k in range(max_tries):
        tr, va = train_test_split(
            idx_all,
            test_size=val_size,
            random_state=seed + k,
            stratify=y_svc,
        )
        if len(va) == 0:
            continue
        if len(np.unique(y_svc[va])) >= 2 and len(np.unique(y_svc[tr])) >= 2:
            return tr, va

    # Fall back to the first split
    tr, va = train_test_split(
        idx_all,
        test_size=val_size,
        random_state=seed,
        stratify=y_svc,
    )
    return tr, va


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data_dir", type=str, default="data/processed/unsw_nb15")
    ap.add_argument("--transformer_ckpt", type=str, default="runs/unsw_nb15/best_model.pt")
    ap.add_argument("--out_dir", type=str, default="runs/fusion_unsw_gnn")

    ap.add_argument("--gcn_hidden", type=int, default=16)
    ap.add_argument("--epochs", type=int, default=200)
    ap.add_argument("--lr", type=float, default=0.01)
    ap.add_argument("--val_size", type=float, default=0.3)
    ap.add_argument("--seed", type=int, default=42)

    ap.add_argument("--infer_batch", type=int, default=4096)
    ap.add_argument("--device", type=str, default=None)
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    device = torch.device(args.device) if args.device else torch.device("cuda" if torch.cuda.is_available() else "cpu")

    data_dir = Path(args.data_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    train_tensors, meta = load_split(data_dir / "train")

    if "cat_cols" not in meta or "proto" not in meta["cat_cols"] or "service" not in meta["cat_cols"]:
        raise SystemExit(f"Expected cat_cols to include proto and service. Got: {meta.get('cat_cols')}")

    proto_idx = meta["cat_cols"].index("proto")
    service_idx = meta["cat_cols"].index("service")

    x_cat = train_tensors.x_cat.numpy()
    y = train_tensors.y.numpy().astype(np.int64)

    service_ids = x_cat[:, service_idx].astype(np.int64)
    proto_ids = x_cat[:, proto_idx].astype(np.int64)

    # Use only known (non-UNK) services as nodes
    services = np.unique(service_ids)
    services = services[services != 0]

    ckpt_path = Path(args.transformer_ckpt)
    probs = transformer_probs(ckpt_path, train_tensors, meta, args.infer_batch, device)

    X_svc, y_svc, counts = aggregate_per_service(services, service_ids, probs, y)

    # Build service adjacency from train rows
    A = build_service_graph_from_rows(service_ids, proto_ids, services)
    A_hat = normalize_adj(A)

    # Split services for GNN supervision
    idx_all = np.arange(len(services))
    train_idx, val_idx = safe_service_split(idx_all, y_svc, args.val_size, args.seed)

    x_t = torch.tensor(X_svc, dtype=torch.float32, device=device)
    y_t = torch.tensor(y_svc, dtype=torch.long, device=device)
    A_hat_t = torch.tensor(A_hat, dtype=torch.float32, device=device)

    model = SimpleGCN(in_dim=x_t.shape[1], hid_dim=args.gcn_hidden, out_dim=2).to(device)

    # Class weights (from train nodes only)
    unique, counts_cls = np.unique(y_svc[train_idx], return_counts=True)
    cls_counts = dict(zip(unique.tolist(), counts_cls.tolist()))
    w = np.array([cls_counts.get(0, 0), cls_counts.get(1, 0)], dtype=np.float32)
    w = torch.tensor(w.max() / (w + 1e-9), dtype=torch.float32, device=device)

    opt = torch.optim.Adam(model.parameters(), lr=args.lr)

    best_val_auc = -1.0
    best_state = None

    for epoch in range(1, args.epochs + 1):
        model.train()
        opt.zero_grad()
        out = model(x_t, A_hat_t)
        loss = F.cross_entropy(out[train_idx], y_t[train_idx], weight=w)
        loss.backward()
        opt.step()

        if epoch % 20 == 0 or epoch == 1:
            model.eval()
            with torch.no_grad():
                out_all = model(x_t, A_hat_t)
                prob_all = torch.softmax(out_all, dim=1)[:, 1].detach().cpu().numpy()
                pred_all = out_all.argmax(dim=1).detach().cpu().numpy()

            val_true = y_svc[val_idx]
            val_prob = prob_all[val_idx]
            val_pred = pred_all[val_idx]

            if len(np.unique(val_true)) < 2:
                val_auc = None
            else:
                val_auc = float(roc_auc_score(val_true, val_prob))

            prec, rec, f1, _ = precision_recall_fscore_support(val_true, val_pred, average="binary", zero_division=0)
            if val_auc is None:
                print(f"epoch={epoch} loss={loss.item():.4f} val_auc=NA prec={prec:.4f} rec={rec:.4f} f1={f1:.4f}")
            else:
                print(
                    f"epoch={epoch} loss={loss.item():.4f} val_auc={val_auc:.4f} "
                    f"prec={prec:.4f} rec={rec:.4f} f1={f1:.4f}"
                )

            if val_auc is not None and val_auc > best_val_auc:
                best_val_auc = float(val_auc)
                best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}

    if best_state is not None:
        model.load_state_dict(best_state)

    # Final predictions for all service nodes
    model.eval()
    with torch.no_grad():
        out_all = model(x_t, A_hat_t)
        prob_all = torch.softmax(out_all, dim=1)[:, 1].detach().cpu().numpy()
        pred_all = out_all.argmax(dim=1).detach().cpu().numpy()

    # Report
    auc_all = None
    if len(np.unique(y_svc)) >= 2:
        auc_all = float(roc_auc_score(y_svc, prob_all))

    prec_all, rec_all, f1_all, _ = precision_recall_fscore_support(y_svc, pred_all, average="binary", zero_division=0)

    report = {
        "dataset": "unsw_nb15",
        "fusion": "transformer_probs_as_features + service_graph_shared_proto + SimpleGCN",
        "n_services": int(len(services)),
        "service_feature_dim": int(X_svc.shape[1]),
        "auc_all": auc_all,
        "precision_all": float(prec_all),
        "recall_all": float(rec_all),
        "f1_all": float(f1_all),
        "best_val_auc": float(best_val_auc) if best_val_auc >= 0 else None,
        "transformer_ckpt": str(ckpt_path),
        "seed": int(args.seed),
    }

    (out_dir / "fusion_eval_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    # Save model + artifacts
    torch.save(
        {
            "model": model.state_dict(),
            "services": services,
            "meta": meta,
            "report": report,
        },
        out_dir / "fusion_gnn_model.pt",
    )

    # Save per-service predictions
    import pandas as pd

    df = pd.DataFrame(
        {
            "service_token": services.astype(int),
            "count_train_rows": counts.astype(int),
            "x_mean_transformer_prob": X_svc[:, 0],
            "x_max_transformer_prob": X_svc[:, 1],
            "x_log1p_count": X_svc[:, 2],
            "gnn_prob": prob_all,
            "gnn_pred": pred_all,
            "true": y_svc.astype(int),
            "split": ["train" if i in set(train_idx.tolist()) else "val" for i in idx_all.tolist()],
        }
    )
    df.to_csv(out_dir / "fusion_service_predictions.csv", index=False)

    print(f"Wrote: {out_dir / 'fusion_eval_report.json'}")
    print(f"Wrote: {out_dir / 'fusion_service_predictions.csv'}")
    print(f"Wrote: {out_dir / 'fusion_gnn_model.pt'}")


if __name__ == "__main__":
    main()
