import pickle
from pathlib import Path
import json
import argparse

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, precision_recall_fscore_support


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
    for prot, svcs in prot_to_services.items():
        for a, b in itertools.combinations(sorted(svcs), 2):
            i, j = idx[a], idx[b]
            A[i, j] = 1.0
            A[j, i] = 1.0
    return A


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Train SimpleGCN on service graph")
    ap.add_argument(
        "--root",
        type=str,
        default=None,
        help=(
            "Directory containing service_stats.csv and service_protocol_graph.gpickle. "
            "Default: directory of this script."
        ),
    )
    return ap.parse_args()


def resolve_data_root(args_root: str | None) -> Path:
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
    args = parse_args()

    root = resolve_data_root(args.root)
    stats_path = root / 'service_stats.csv'
    graph_path = root / 'service_protocol_graph.gpickle'
    # resolve_data_root ensures these exist

    service_stats = pd.read_csv(stats_path, index_col=0)
    services = list(service_stats.index)
    X = service_stats[['src_bytes_mean', 'dst_bytes_mean', 'attack_rate']].values.astype(np.float32)
    y = (service_stats['attack_rate'] > 0).astype(int).values.astype(np.int64)

    with open(graph_path, 'rb') as fh:
        G = pickle.load(fh)

    A = build_service_adj_from_bipartite(G, services)
    A_hat = normalize_adj(A)

    # train/val split (stratified)
    idx = np.arange(len(services))
    train_idx, val_idx = train_test_split(idx, test_size=0.3, stratify=y, random_state=42)

    x = torch.tensor(X)
    A_hat_t = torch.tensor(A_hat, dtype=torch.float32)
    y_t = torch.tensor(y, dtype=torch.long)

    model = SimpleGCN(in_dim=x.shape[1], hid_dim=16, out_dim=2)

    # class weights
    unique, counts = np.unique(y, return_counts=True)
    class_counts = dict(zip(unique, counts))
    weight = np.array([class_counts.get(0, 0), class_counts.get(1, 0)], dtype=np.float32)
    weight = torch.tensor(weight.max() / (weight + 1e-9), dtype=torch.float32)

    opt = torch.optim.Adam(model.parameters(), lr=0.01)

    best_val_auc = 0.0
    best_state = None

    for epoch in range(1, 101):
        model.train()
        opt.zero_grad()
        out = model(x, A_hat_t)
        loss = F.cross_entropy(out[train_idx], y_t[train_idx], weight=weight)
        loss.backward()
        opt.step()

        if epoch % 10 == 0 or epoch == 1:
            model.eval()
            with torch.no_grad():
                out_all = model(x, A_hat_t)
                probs = torch.softmax(out_all, dim=1)[:, 1].numpy()
                preds = out_all.argmax(dim=1).numpy()
                val_probs = probs[val_idx]
                val_true = y[val_idx]
                try:
                    val_auc = float(roc_auc_score(val_true, val_probs))
                except Exception:
                    val_auc = 0.0
                precision, recall, f1, _ = precision_recall_fscore_support(val_true, preds[val_idx], average='binary', zero_division=0)
                print(f'Epoch {epoch}, Loss {loss.item():.4f}, Val AUC {val_auc:.4f}, Prec {precision:.4f}, Rec {recall:.4f}, F1 {f1:.4f}')
                if val_auc > best_val_auc:
                    best_val_auc = val_auc
                    best_state = model.state_dict()

    # save best model
    if best_state is not None:
        torch.save(best_state, 'gnn_model.pt')
    else:
        torch.save(model.state_dict(), 'gnn_model.pt')

    # final eval on whole set
    try:
        state = torch.load('gnn_model.pt', weights_only=True)
    except TypeError:
        state = torch.load('gnn_model.pt')
    model.load_state_dict(state)
    model.eval()
    with torch.no_grad():
        out_all = model(x, A_hat_t)
        probs = torch.softmax(out_all, dim=1)[:, 1].numpy()
        preds = out_all.argmax(dim=1).numpy()

    # compute metrics
    try:
        auc_score = float(roc_auc_score(y, probs))
    except Exception:
        auc_score = 0.0
    precision, recall, f1, _ = precision_recall_fscore_support(y, preds, average='binary', zero_division=0)

    report = {
        'auc': auc_score,
        'precision': float(precision),
        'recall': float(recall),
        'f1': float(f1),
        'best_val_auc': float(best_val_auc),
        'n_services': len(services)
    }
    with open('eval_report.json', 'w') as fh:
        json.dump(report, fh, indent=2)
    print('Saved eval_report.json', report)

    # save per-service predictions with split label
    split = ['train' if i in train_idx else 'val' if i in val_idx else 'none' for i in range(len(services))]
    df_out = pd.DataFrame({'service': services, 'prob': probs, 'pred': preds, 'true': y, 'split': split})
    df_out.to_csv('service_predictions_with_split.csv', index=False)
    print('Saved service_predictions_with_split.csv')


if __name__ == '__main__':
    main()
