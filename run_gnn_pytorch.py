import itertools
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F


def build_service_adj_from_bipartite(graph, services):
    # graph: networkx Graph with service and protocol nodes
    # services: list of service node names
    svc_set = set(services)
    # for each protocol, find adjacent services
    prot_to_services = {}
    for s in services:
        for nbr in graph.neighbors(s):
            if nbr not in svc_set:
                prot_to_services.setdefault(nbr, set()).add(s)
    # build edges between services that share a protocol
    n = len(services)
    idx = {s: i for i, s in enumerate(services)}
    A = np.zeros((n, n), dtype=np.float32)
    for prot, svcs in prot_to_services.items():
        for a, b in itertools.combinations(sorted(svcs), 2):
            i, j = idx[a], idx[b]
            A[i, j] = 1.0
            A[j, i] = 1.0
    return A


def normalize_adj(A):
    # A is numpy array (n,n)
    A = A + np.eye(A.shape[0], dtype=A.dtype)
    deg = A.sum(axis=1)
    deg_inv_sqrt = np.where(deg > 0, 1.0 / np.sqrt(deg), 0.0)
    D_inv_sqrt = np.diag(deg_inv_sqrt)
    return D_inv_sqrt @ A @ D_inv_sqrt


class SimpleGCN(torch.nn.Module):
    def __init__(self, in_dim, hid_dim, out_dim):
        super().__init__()
        self.w0 = torch.nn.Linear(in_dim, hid_dim, bias=False)
        self.w1 = torch.nn.Linear(hid_dim, out_dim, bias=False)

    def forward(self, x, A_hat):
        # x: [N, in_dim], A_hat: [N,N]
        x = self.w0(x)
        x = torch.matmul(A_hat, x)
        x = F.relu(x)
        x = self.w1(x)
        x = torch.matmul(A_hat, x)
        return x


def main():
    root = Path('.')
    stats_path = root / 'service_stats.csv'
    graph_path = root / 'service_protocol_graph.gpickle'
    if not stats_path.exists() or not graph_path.exists():
        print('Missing required files: service_stats.csv or service_protocol_graph.gpickle')
        return

    service_stats = pd.read_csv(stats_path, index_col=0)
    services = list(service_stats.index)

    # features and labels
    X = service_stats[['src_bytes_mean', 'dst_bytes_mean', 'attack_rate']].values.astype(np.float32)
    y = (service_stats['attack_rate'] > 0).astype(int).values.astype(np.int64)

    # load graph (pickled networkx Graph)
    with open(graph_path, 'rb') as fh:
        G = pickle.load(fh)

    # build service-service adjacency by connecting services that share a protocol
    A = build_service_adj_from_bipartite(G, services)
    # If adjacency is empty (no shared protocols), fall back to isolated nodes (identity)
    if A.sum() == 0:
        print('No service-service edges detected; using identity adjacency (no propagation)')

    A_hat = normalize_adj(A)

    # convert to torch
    x = torch.tensor(X)
    A_hat_t = torch.tensor(A_hat, dtype=torch.float32)
    y_t = torch.tensor(y, dtype=torch.long)

    model = SimpleGCN(in_dim=x.shape[1], hid_dim=16, out_dim=2)
    opt = torch.optim.Adam(model.parameters(), lr=0.01)

    for epoch in range(1, 41):
        model.train()
        opt.zero_grad()
        out = model(x, A_hat_t)
        loss = F.cross_entropy(out, y_t)
        loss.backward()
        opt.step()
        if epoch % 10 == 0 or epoch == 1:
            pred = out.argmax(dim=1)
            acc = (pred == y_t).float().mean().item()
            print(f'Epoch {epoch}, Loss: {loss.item():.4f}, Acc: {acc:.4f}')

    # save model and predictions
    torch.save(model.state_dict(), 'gnn_model_pt_only.pt')
    preds = out.argmax(dim=1).detach().numpy()
    np.savetxt('gnn_pred.txt', preds, fmt='%d')
    print('Saved gnn_model_pt_only.pt and gnn_pred.txt')


if __name__ == '__main__':
    main()
