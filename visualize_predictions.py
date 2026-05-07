import pickle
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import networkx as nx
import numpy as np
import pandas as pd


def main():
    root = Path('.')
    stats_path = root / 'service_stats.csv'
    graph_path = root / 'service_protocol_graph.gpickle'
    pred_path = root / 'gnn_pred.txt'

    if not stats_path.exists():
        print('Missing', stats_path)
        return
    if not graph_path.exists():
        print('Missing', graph_path)
        return
    if not pred_path.exists():
        print('Missing', pred_path)
        return

    service_stats = pd.read_csv(stats_path, index_col=0)
    services = list(service_stats.index)

    with open(graph_path, 'rb') as fh:
        G = pickle.load(fh)

    pred = np.loadtxt(pred_path, dtype=int)

    # Ensure pred length matches services
    if len(pred) != len(services):
        print('Prediction length', len(pred), 'does not match number of services', len(services))
        return

    colors = ['red' if p else 'green' for p in pred]

    # Draw only the service nodes and edges between them (if present)
    # Our G is bipartite (services and protocols); keep only service-service edges if any
    service_set = set(services)
    # Create a projected subgraph: connect services that share a protocol
    service_nodes_present = [n for n in services if n in G]
    H = G.subgraph(service_nodes_present).copy()

    plt.figure(figsize=(14, 10))
    pos = nx.spring_layout(H, seed=42)
    nx.draw_networkx_nodes(H, pos, node_color=[colors[services.index(n)] for n in H.nodes()], node_size=600)
    nx.draw_networkx_labels(H, pos, font_size=8)
    nx.draw_networkx_edges(H, pos, edge_color='gray')
    plt.title('GNN Prediction: Service Nodes (Green=safe, Red=attack-linked)')
    out_path = root / 'service_predictions.png'
    plt.tight_layout()
    plt.savefig(out_path, dpi=200)
    print('Saved visualization to', out_path)

    risky_services = [services[i] for i, v in enumerate(pred) if v]
    print('Services predicted as risky:', risky_services)


if __name__ == '__main__':
    main()
