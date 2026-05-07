import pickle
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import networkx as nx
import torch
import torch.nn.functional as F
from sklearn.metrics import roc_curve, auc, precision_recall_fscore_support


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


def main():
    root = Path('.')
    stats_path = root / 'service_stats.csv'
    graph_path = root / 'service_protocol_graph.gpickle'
    model_path = root / 'gnn_model_pt_only.pt'

    assert stats_path.exists(), stats_path
    assert graph_path.exists(), graph_path
    assert model_path.exists(), model_path

    service_stats = pd.read_csv(stats_path, index_col=0)
    services = list(service_stats.index)
    X = service_stats[['src_bytes_mean', 'dst_bytes_mean', 'attack_rate']].values.astype(np.float32)
    y = (service_stats['attack_rate'] > 0).astype(int).values.astype(np.int64)

    with open(graph_path, 'rb') as fh:
        G = pickle.load(fh)

    A = build_service_adj_from_bipartite(G, services)
    A_hat = normalize_adj(A)

    x = torch.tensor(X)
    A_hat_t = torch.tensor(A_hat, dtype=torch.float32)

    model = SimpleGCN(in_dim=x.shape[1], hid_dim=16, out_dim=2)
    model.load_state_dict(torch.load(model_path))
    model.eval()
    with torch.no_grad():
        out = model(x, A_hat_t)
        probs = torch.softmax(out, dim=1)[:, 1].numpy()
        preds = out.argmax(dim=1).numpy()

    # ROC
    fpr, tpr, _ = roc_curve(y, probs)
    roc_auc = auc(fpr, tpr)
    plt.figure()
    plt.plot(fpr, tpr, label=f'ROC (AUC = {roc_auc:.3f})')
    plt.plot([0, 1], [0, 1], 'k--')
    plt.xlabel('FPR')
    plt.ylabel('TPR')
    plt.title('ROC curve')
    plt.legend(loc='lower right')
    plt.savefig('roc_curve.png', dpi=200)
    print('Saved roc_curve.png (AUC=', roc_auc, ')')

    # Precision/recall/f1
    precision, recall, f1, _ = precision_recall_fscore_support(y, preds, average='binary', zero_division=0)
    with open('classification_summary.txt', 'w') as fh:
        fh.write(f'Precision: {precision:.4f}\nRecall: {recall:.4f}\nF1: {f1:.4f}\nAUC: {roc_auc:.4f}\n')
    print('Saved classification_summary.txt')

    # Top risky services by predicted prob
    df_out = pd.DataFrame({'service': services, 'prob': probs, 'pred': preds, 'true': y})
    df_out_sorted = df_out.sort_values('prob', ascending=False)
    df_out_sorted.to_csv('service_predictions_table.csv', index=False)
    print('Saved service_predictions_table.csv')

    plt.figure(figsize=(10, 6))
    topk = df_out_sorted.head(20)
    plt.barh(topk['service'][::-1], topk['prob'][::-1], color='orangered')
    plt.xlabel('Predicted attack probability')
    plt.title('Top 20 services by predicted attack probability')
    plt.tight_layout()
    plt.savefig('top20_risky_services.png', dpi=200)
    print('Saved top20_risky_services.png')

    # Updated network visualization with node sizes by degree and color by prob threshold
    probs_map = {s: probs[i] for i, s in enumerate(services)}
    node_colors = ['red' if probs_map[s] > 0.5 else 'green' for s in services]
    degrees = [sum(1 for _ in G.neighbors(s) if _ in services) if s in G else 0 for s in services]
    node_sizes = [50 + d * 20 for d in degrees]

    H = G.subgraph([s for s in services if s in G]).copy()
    plt.figure(figsize=(14, 10))
    pos = nx.spring_layout(H, seed=42)
    nx.draw_networkx_nodes(H, pos, node_color=[node_colors[services.index(n)] for n in H.nodes()], node_size=[node_sizes[services.index(n)] for n in H.nodes()])
    nx.draw_networkx_labels(H, pos, font_size=8)
    nx.draw_networkx_edges(H, pos, edge_color='gray')
    plt.title('Service graph: node color=pred>0.5, size~degree')
    plt.tight_layout()
    plt.savefig('service_graph_predicted.png', dpi=200)
    print('Saved service_graph_predicted.png')


if __name__ == '__main__':
    main()
