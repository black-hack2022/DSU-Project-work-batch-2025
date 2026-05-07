from __future__ import annotations

import pickle
from pathlib import Path

import networkx as nx
import pandas as pd


def _pick_col(df: pd.DataFrame, candidates: list[str]) -> str:
    for c in candidates:
        if c in df.columns:
            return c
    raise ValueError(f"None of these columns found: {candidates}. Available={list(df.columns)[:50]}")


def build_service_protocol_graph(df: pd.DataFrame, *, service_col: str, proto_col: str) -> nx.Graph:
    G = nx.Graph()
    pairs = df[[service_col, proto_col]].dropna().drop_duplicates()
    for s, p in pairs.itertuples(index=False):
        G.add_node(str(s), role="service")
        G.add_node(str(p), role="protocol")
        G.add_edge(str(s), str(p))
    return G


def write_gnn_inputs_from_scored_flows(
    scored_csv: str | Path,
    out_dir: str | Path,
    *,
    anomaly_flag_col: str = "is_anomaly",
) -> Path:
    """Create `service_stats.csv` + `service_protocol_graph.gpickle` from scored UNSW flows.

    Output columns match the existing GNN pipeline expectations:
    - src_bytes_mean
    - dst_bytes_mean
    - attack_rate   (here: anomaly rate)
    - count

    Column mapping for UNSW:
    - service: `service`
    - protocol: `proto`
    - src bytes: `sbytes`
    - dst bytes: `dbytes`
    """

    scored_csv = Path(scored_csv)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(scored_csv)

    service_col = _pick_col(df, ["service"])  # UNSW uses 'service'
    proto_col = _pick_col(df, ["proto", "protocol_type"])  # UNSW uses 'proto'
    src_col = _pick_col(df, ["sbytes", "src_bytes"])  # UNSW uses 'sbytes'
    dst_col = _pick_col(df, ["dbytes", "dst_bytes"])  # UNSW uses 'dbytes'

    if anomaly_flag_col not in df.columns:
        raise ValueError(f"Missing anomaly flag column '{anomaly_flag_col}' in {scored_csv}")

    # Graph
    G = build_service_protocol_graph(df, service_col=service_col, proto_col=proto_col)
    with open(out_dir / "service_protocol_graph.gpickle", "wb") as fh:
        pickle.dump(G, fh)

    # Service stats
    stats = df.groupby(service_col).agg(
        src_bytes_mean=(src_col, "mean"),
        dst_bytes_mean=(dst_col, "mean"),
        attack_rate=(anomaly_flag_col, "mean"),
        count=(service_col, "count"),
    )

    stats.to_csv(out_dir / "service_stats.csv")

    return out_dir
