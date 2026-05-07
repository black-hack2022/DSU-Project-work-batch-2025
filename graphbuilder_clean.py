import sys
from pathlib import Path

import pandas as pd
import networkx as nx
import pickle

from first1 import load_df
from col import apply_columns


PREPRO_PATH = Path('kdd_preprocessed.csv')


def ensure_preprocessed():
    if PREPRO_PATH.exists():
        print(f"Found existing preprocessed file: {PREPRO_PATH}")
        return PREPRO_PATH
    print(f"Preprocessed file not found: {PREPRO_PATH}. Creating from KDDTrain+.txt ...")
    df = load_df('KDDTrain+.txt')
    df = apply_columns(df)
    df['is_attack'] = (df['label'] != 'normal').astype(int)
    df.to_csv(PREPRO_PATH, index=False)
    print(f"Wrote {PREPRO_PATH} with shape {df.shape}")
    return PREPRO_PATH


def build_and_save():
    prepro = ensure_preprocessed()
    df = pd.read_csv(prepro)

    G = nx.Graph()
    pairs = df[['service', 'protocol_type']].drop_duplicates()
    for s, p in pairs.itertuples(index=False):
        G.add_node(s, role='service')
        G.add_node(p, role='protocol')
        G.add_edge(s, p)

    with open('service1_protocol_graph.gpickle', 'wb') as fh:
        pickle.dump(G, fh)
    print('Saved graph: service1_protocol_graph.gpickle (nodes={}, edges={})'.format(G.number_of_nodes(), G.number_of_edges()))

    # Build richer per-service stats for downstream GNN.
    # Keep original column names for backward compatibility, but add more aggregates.
    numeric_cols = [
        "duration",
        "src_bytes",
        "dst_bytes",
        "wrong_fragment",
        "urgent",
        "hot",
        "num_failed_logins",
        "num_compromised",
        "num_root",
        "srv_count",
        "serror_rate",
        "srv_serror_rate",
        "rerror_rate",
        "srv_rerror_rate",
        "same_srv_rate",
        "diff_srv_rate",
        "srv_diff_host_rate",
        "dst_host_count",
        "dst_host_srv_count",
        "dst_host_same_srv_rate",
        "dst_host_diff_srv_rate",
        "dst_host_same_src_port_rate",
        "dst_host_srv_diff_host_rate",
        "dst_host_serror_rate",
        "dst_host_srv_serror_rate",
        "dst_host_rerror_rate",
        "dst_host_srv_rerror_rate",
        # This is a KDD per-flow feature; we rename its aggregate to avoid confusion with row count.
        "count",
    ]
    rate_cols = [
        "logged_in",
        "is_guest_login",
        "is_host_login",
        "land",
        "root_shell",
        "su_attempted",
    ]
    present_numeric = [c for c in numeric_cols if c in df.columns]
    present_rate = [c for c in rate_cols if c in df.columns]

    agg_spec = {
        # Backward compatible columns
        "src_bytes_mean": ("src_bytes", "mean"),
        "dst_bytes_mean": ("dst_bytes", "mean"),
        "attack_rate": ("is_attack", "mean"),
        "count": ("service", "count"),
    }

    for c in present_numeric:
        agg_spec[f"{c}_mean"] = (c, "mean")
        agg_spec[f"{c}_std"] = (c, "std")

    for c in present_rate:
        # Treat these as rates/proportions.
        agg_spec[f"{c}_rate"] = (c, "mean")

    service_stats = df.groupby("service").agg(**agg_spec).fillna(0.0)

    # Rename KDD per-flow count aggregate to avoid ambiguity with row count.
    if "count_mean" in service_stats.columns:
        service_stats = service_stats.rename(columns={"count_mean": "flow_count_mean", "count_std": "flow_count_std"})

    service_stats.to_csv('service_stats1.csv')
    print('Saved service stats: service_stats1.csv (rows={})'.format(len(service_stats)))


if __name__ == '__main__':
    build_and_save()
