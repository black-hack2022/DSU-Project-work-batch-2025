import sys
from pathlib import Path

import pandas as pd
import networkx as nx
import pickle

from first1 import load_df
from col import apply_columns


PREPRO_PATH = Path("kdd_preprocessed.csv")


def ensure_preprocessed():
    """Ensure `kdd_preprocessed.csv` exists. If not, create it from `KDDTrain+.txt`."""
    if PREPRO_PATH.exists():
        print(f"Found existing preprocessed file: {PREPRO_PATH}")
        return PREPRO_PATH

    print(f"Preprocessed file not found: {PREPRO_PATH}. Creating from KDDTrain+.txt ...")
    try:
        df = load_df("KDDTrain+.txt")
        df = apply_columns(df)
        df["is_attack"] = (df["label"] != "normal").astype(int)
        df.to_csv(PREPRO_PATH, index=False)
        print(f"Wrote {PREPRO_PATH} with shape {df.shape}")
        return PREPRO_PATH
    except Exception as e:
        print("Failed to create preprocessed CSV:", e)
        raise   



def build_and_save():
    prepro = ensure_preprocessed()
    df = pd.read_csv(prepro)

    # Build graph from service ↔ protocol pairs
    G = nx.Graph()

    # unique pairs for efficiency
    pairs = df[["service", "protocol_type"]].drop_duplicates()

    for s, p in pairs.itertuples(index=False):
        G.add_node(s, role="service")
        G.add_node(p, role="protocol")
        G.add_edge(s, p)

    # Save graph using pickle (works on all NetworkX versions)
    with open("service_protocol_graph.gpickle", "wb") as fh:
        pickle.dump(G, fh)

    print(
        f"Saved graph: service_protocol_graph.gpickle "
        f"(nodes={G.number_of_nodes()}, edges={G.number_of_edges()})"
    )

    # Aggregate service statistics
    service_stats = df.groupby("service").agg(
        src_bytes_mean=("src_bytes", "mean"),
        dst_bytes_mean=("dst_bytes", "mean"),
        attack_rate=("is_attack", "mean"),
        count=("service", "count"),
    )

    service_stats.to_csv("service_stats.csv")
    print(f"Saved service stats: service_stats.csv (rows={len(service_stats)})")



if __name__ == "__main__":
    try:
        build_and_save()
    except Exception as exc:
        print("Error running graphbuilder:", exc)
        sys.exit(1)
