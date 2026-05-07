from __future__ import annotations

import json
import math
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import numpy as np
import pandas as pd


EH_TAXONOMY: Dict[str, list[str]] = {
    "E. Botnets & Command-and-Control (C2)": [
        "IRC-based botnets",
        "HTTP/HTTPS beaconing",
        "DNS tunneling",
        "Peer-to-peer (P2P) botnets",
        "Fast-flux domains",
        "Domain Generation Algorithm (DGA) traffic",
    ],
    "F. Data Exfiltration Attacks": [
        "SMTP-based data exfiltration",
        "IMAP-based data exfiltration",
        "DNS-based data exfiltration",
        "HTTP POST data leakage",
    ],
    "G. Malware Behavioral Attacks": [
        "Malware beaconing",
        "Backdoor communication",
        "Botnet behavior",
        "Persistence-related behavior",
        "Process memory dumping behavior (network-level indicators)",
    ],
    "H. Multi-Stage / Unknown Attacks": [
        "Multi-stage attack chains",
        "Slow-and-low attacks",
        "Coordinated attack campaigns",
        "Previously unseen (unknown) attack patterns",
        "Structural and temporal anomalies",
    ],
}


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _safe_mkdir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _read_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _try_import_sklearn() -> bool:
    try:
        import sklearn  # noqa: F401

        return True
    except Exception:
        return False


def _auc_roc(y_true: np.ndarray, y_score: np.ndarray) -> Optional[float]:
    if y_true.size == 0:
        return None

    if _try_import_sklearn():
        from sklearn.metrics import roc_auc_score

        try:
            return float(roc_auc_score(y_true, y_score))
        except Exception:
            return None

    # Minimal AUC (rank-based) fallback
    # Compute Mann–Whitney U / AUC from ranks.
    y_true = y_true.astype(int)
    pos = y_true == 1
    neg = y_true == 0
    n_pos = int(pos.sum())
    n_neg = int(neg.sum())
    if n_pos == 0 or n_neg == 0:
        return None

    order = np.argsort(y_score)
    ranks = np.empty_like(order, dtype=float)
    ranks[order] = np.arange(1, len(y_score) + 1, dtype=float)

    sum_ranks_pos = float(ranks[pos].sum())
    auc = (sum_ranks_pos - n_pos * (n_pos + 1) / 2.0) / (n_pos * n_neg)
    return float(auc)


def _precision_recall_f1(y_true: np.ndarray, y_pred: np.ndarray) -> Tuple[float, float, float]:
    y_true = y_true.astype(int)
    y_pred = y_pred.astype(int)
    tp = int(((y_true == 1) & (y_pred == 1)).sum())
    fp = int(((y_true == 0) & (y_pred == 1)).sum())
    fn = int(((y_true == 1) & (y_pred == 0)).sum())

    precision = tp / max(1, tp + fp)
    recall = tp / max(1, tp + fn)
    f1 = 0.0 if (precision + recall) == 0 else 2 * precision * recall / (precision + recall)
    return float(precision), float(recall), float(f1)


def _accuracy(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    y_true = y_true.astype(int)
    y_pred = y_pred.astype(int)
    if y_true.size == 0:
        return 0.0
    return float((y_true == y_pred).mean())


def _slugify(s: str) -> str:
    s = s.strip().lower()
    out = []
    for ch in s:
        if ch.isalnum():
            out.append(ch)
        else:
            out.append("-")
    slug = "".join(out)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


@dataclass(frozen=True)
class ReportPaths:
    out_dir: Path
    assets_dir: Path

    html_path: Path
    gnn_csv: Path
    transformer_csv: Path
    ae_scored_csv: Path


def _init_paths(out_dir: Path) -> ReportPaths:
    assets_dir = out_dir / "assets"
    _safe_mkdir(out_dir)
    _safe_mkdir(assets_dir)

    return ReportPaths(
        out_dir=out_dir,
        assets_dir=assets_dir,
        html_path=out_dir / "index.html",
        gnn_csv=out_dir / "gnn_service_detections.csv",
        transformer_csv=out_dir / "transformer_flow_detections.csv",
        ae_scored_csv=out_dir / "unsw_ae_test_scored.csv",
    )


def run_gnn_service_detection(paths: ReportPaths) -> pd.DataFrame:
    # Import locally to avoid importing torch unless needed.
    from live_detection import MaliciousServiceDetector

    det = MaliciousServiceDetector(model_path="gnn_model.pt", stats_path="service_stats.csv", graph_path="service_protocol_graph.gpickle")
    results = det.detect()
    results.to_csv(paths.gnn_csv, index=False)

    # Create the existing visualization dashboard image.
    try:
        img_path = paths.assets_dir / "gnn_threat_dashboard.png"
        det.visualize_threats(results, output_path=str(img_path))
    except Exception:
        pass

    return results


def run_x_tis(paths: ReportPaths, *, top_k: int = 10, hop: int = 2) -> None:
    # Use the existing script functionality to generate images + json.
    import x_tis

    try:
        x_tis.explain_topk(k=top_k, hop=hop)
    except Exception:
        # x_tis is best-effort; do not fail whole report.
        return

    # Copy generated images + csv/json into report folder for the HTML.
    src_dir = Path("x_tis_outputs")
    if not src_dir.exists():
        return

    dst_dir = paths.assets_dir / "x_tis_outputs"
    if dst_dir.exists():
        shutil.rmtree(dst_dir)
    shutil.copytree(src_dir, dst_dir)


def run_transformer_flow_detection(paths: ReportPaths, *, limit_rows: Optional[int] = 50000) -> pd.DataFrame:
    out_csv = paths.transformer_csv

    cmd = [
        sys.executable,
        str(Path("transformer_tabular") / "detect_kdd_threats.py"),
        "--input_csv",
        "kdd_preprocessed.csv",
        "--processed_dir",
        str(Path("transformer_tabular") / "data" / "processed" / "kdd"),
        "--transformer_ckpt",
        str(Path("transformer_tabular") / "runs" / "kdd" / "best_model.pt"),
        "--out_csv",
        str(out_csv),
    ]
    if limit_rows is not None:
        cmd.extend(["--limit_rows", str(int(limit_rows))])

    subprocess.run(cmd, check=True)
    return pd.read_csv(out_csv)


def copy_anomaly_autoencoder_artifacts(paths: ReportPaths) -> Tuple[pd.DataFrame, Dict[str, Any], Dict[str, Any]]:
    model_dir = Path("anomaly_autoencoder_unsw") / "artifacts" / "unsw_ae"
    scored_path = model_dir / "test_scored.csv"
    metrics_path = model_dir / "metrics.json"
    threshold_path = model_dir / "threshold.json"

    df = pd.read_csv(scored_path)
    df.to_csv(paths.ae_scored_csv, index=False)

    metrics = _read_json(metrics_path)
    threshold = _read_json(threshold_path)
    return df, metrics, threshold


def plot_assets(paths: ReportPaths, gnn_df: pd.DataFrame, transformer_df: pd.DataFrame, ae_df: pd.DataFrame, ae_threshold: Dict[str, Any]) -> Dict[str, str]:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import networkx as nx
    import pickle

    created: Dict[str, str] = {}

    # 1) Service graph image
    try:
        g_path = Path("service_protocol_graph.gpickle")
        with open(g_path, "rb") as fh:
            G = pickle.load(fh)

        plt.figure(figsize=(10, 8))
        pos = nx.spring_layout(G, seed=42)
        node_colors = []
        for n, d in G.nodes(data=True):
            role = d.get("role")
            node_colors.append("#ffcc80" if role == "service" else "#90caf9")
        nx.draw(G, pos, node_size=120, node_color=node_colors, with_labels=False, alpha=0.8, width=0.5)
        plt.title("Service ↔ Protocol Graph")
        out = paths.assets_dir / "service_protocol_graph.png"
        plt.tight_layout()
        plt.savefig(out, dpi=160)
        plt.close()
        created["service_graph"] = out.name
    except Exception:
        pass

    # 2) GNN threat score histogram
    try:
        plt.figure(figsize=(8, 4))
        scores = gnn_df.get("threat_score")
        if scores is not None:
            plt.hist(scores.astype(float), bins=30)
            plt.title("GNN Service Threat Score Distribution")
            plt.xlabel("threat_score")
            plt.ylabel("count")
            out = paths.assets_dir / "gnn_threat_score_hist.png"
            plt.tight_layout()
            plt.savefig(out, dpi=160)
            plt.close()
            created["gnn_hist"] = out.name
    except Exception:
        pass

    # 3) Transformer combined risk histogram
    try:
        plt.figure(figsize=(8, 4))
        cr = transformer_df.get("combined_risk")
        if cr is not None:
            plt.hist(cr.astype(float), bins=30)
            plt.title("Transformer Flow Combined Risk Distribution")
            plt.xlabel("combined_risk")
            plt.ylabel("count")
            out = paths.assets_dir / "transformer_combined_risk_hist.png"
            plt.tight_layout()
            plt.savefig(out, dpi=160)
            plt.close()
            created["tr_hist"] = out.name
    except Exception:
        pass

    # 4) Autoencoder anomaly_score distribution + threshold
    try:
        t = float(ae_threshold.get("threshold", 0.0))
        plt.figure(figsize=(8, 4))
        s = pd.to_numeric(ae_df.get("anomaly_score"), errors="coerce").fillna(0.0)
        plt.hist(s, bins=60)
        plt.axvline(t, color="red", linestyle="--", linewidth=2, label=f"threshold={t:.4f}")
        plt.title("UNSW Autoencoder Anomaly Score Distribution")
        plt.xlabel("anomaly_score")
        plt.ylabel("count")
        plt.legend()
        out = paths.assets_dir / "ae_anomaly_score_hist.png"
        plt.tight_layout()
        plt.savefig(out, dpi=160)
        plt.close()
        created["ae_hist"] = out.name
    except Exception:
        pass

    return created


def plot_eh_subtype_counts(
    paths: ReportPaths,
    *,
    gnn_df: pd.DataFrame,
    transformer_df: pd.DataFrame,
) -> Dict[str, str]:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    created: Dict[str, str] = {}

    def count_for(category: str) -> pd.DataFrame:
        subtypes = EH_TAXONOMY[category]
        g_counts = (
            gnn_df.loc[gnn_df.get("threat_group_eh") == category, "threat_subtype_eh"].value_counts().to_dict()
            if not gnn_df.empty and "threat_group_eh" in gnn_df.columns and "threat_subtype_eh" in gnn_df.columns
            else {}
        )
        t_counts = (
            transformer_df.loc[transformer_df.get("category_group") == category, "category_subtype"].value_counts().to_dict()
            if not transformer_df.empty and "category_group" in transformer_df.columns and "category_subtype" in transformer_df.columns
            else {}
        )

        rows = []
        for st in subtypes:
            rows.append(
                {
                    "subtype": st,
                    "gnn_count": int(g_counts.get(st, 0)),
                    "transformer_count": int(t_counts.get(st, 0)),
                    "total": int(g_counts.get(st, 0)) + int(t_counts.get(st, 0)),
                }
            )
        return pd.DataFrame(rows)

    for cat in EH_TAXONOMY.keys():
        df = count_for(cat)
        if df.empty:
            continue
        plt.figure(figsize=(10, 4))
        x = np.arange(len(df))
        plt.bar(x, df["total"].to_numpy(), label="total")
        plt.xticks(x, [s.replace(" ", "\n") for s in df["subtype"].tolist()], rotation=0, fontsize=7)
        plt.ylabel("count")
        plt.title(f"{cat} — Subtype Counts (GNN + Transformer)")
        plt.tight_layout()
        out = paths.assets_dir / f"eh_{_slugify(cat)}_subtype_counts.png"
        plt.savefig(out, dpi=160)
        plt.close()
        created[cat] = out.name

    return created


def _safe_head_table(df: pd.DataFrame, *, max_rows: int = 200) -> str:
    if df is None or df.empty:
        return "<p>No rows.</p>"
    return df.head(max_rows).to_html(index=False, escape=True)


def _safe_table(df: pd.DataFrame, *, max_rows: Optional[int] = None) -> str:
    if df is None or df.empty:
        return "<p>No rows.</p>"
    if max_rows is not None:
        return df.head(max_rows).to_html(index=False, escape=True)
    return df.to_html(index=False, escape=True)


def write_eh_pages(
    paths: ReportPaths,
    *,
    gnn_df: pd.DataFrame,
    transformer_df: pd.DataFrame,
    subtype_plots: Dict[str, str],
    max_rows_per_table: Optional[int] = None,
) -> Dict[str, str]:
    """Write separate HTML files for E–H categories (E page, F page, G page, H page).

    Returns a mapping of category -> filename.
    """
    created: Dict[str, str] = {}

    # Cleanup legacy per-subtype pages from previous runs (if any)
    for p in paths.out_dir.glob("detections_*__*.html"):
        try:
            p.unlink()
        except Exception:
            pass

    def img_tag(name: str, alt: str) -> str:
        p = paths.assets_dir / name
        if not p.exists():
            return ""
        return f'<div class="img"><img src="assets/{name}" alt="{alt}"></div>'

    css = (
        "<style>body{font-family:Segoe UI,Arial,sans-serif;margin:24px;}h1{margin:0 0 6px 0;}"
        ".meta{color:#444;margin-bottom:18px;}table{border-collapse:collapse;width:100%;margin:10px 0;}"
        "th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px;}th{background:#f5f5f5;text-align:left;}"
        ".card{border:1px solid #ddd;border-radius:8px;padding:12px;margin:14px 0;}"
        ".img img{max-width:100%;height:auto;border:1px solid #eee;border-radius:6px;}"
        "a{color:#0b57d0;text-decoration:none;}a:hover{text-decoration:underline;}"
        "</style>"
    )

    # Per-category pages only
    for cat, subtypes in EH_TAXONOMY.items():
        cat_slug = _slugify(cat)
        cat_file = f"detections_{cat_slug}.html"
        created[cat] = cat_file

        # Count summary
        g_counts = (
            gnn_df.loc[gnn_df.get("threat_group_eh") == cat, "threat_subtype_eh"].value_counts().to_dict()
            if not gnn_df.empty and "threat_group_eh" in gnn_df.columns and "threat_subtype_eh" in gnn_df.columns
            else {}
        )
        t_counts = (
            transformer_df.loc[transformer_df.get("category_group") == cat, "category_subtype"].value_counts().to_dict()
            if not transformer_df.empty and "category_group" in transformer_df.columns and "category_subtype" in transformer_df.columns
            else {}
        )
        rows = []
        for st in subtypes:
            rows.append(
                {
                    "subtype": st,
                    "gnn_count": int(g_counts.get(st, 0)),
                    "transformer_count": int(t_counts.get(st, 0)),
                    "total": int(g_counts.get(st, 0)) + int(t_counts.get(st, 0)),
                }
            )
        counts_df = pd.DataFrame(rows)

        g_cat = (
            gnn_df.loc[gnn_df["threat_group_eh"] == cat].sort_values("threat_score", ascending=False)
            if not gnn_df.empty and "threat_group_eh" in gnn_df.columns and "threat_score" in gnn_df.columns
            else pd.DataFrame()
        )
        t_cat = (
            transformer_df.loc[transformer_df["category_group"] == cat].sort_values("combined_risk", ascending=False)
            if not transformer_df.empty and "category_group" in transformer_df.columns and "combined_risk" in transformer_df.columns
            else pd.DataFrame()
        )

        html = []
        html.append("<!doctype html><html><head><meta charset='utf-8'>")
        html.append("<meta name='viewport' content='width=device-width, initial-scale=1'>")
        html.append(f"<title>{cat} — Detections</title>{css}</head><body>")
        html.append(f"<h1>{cat}</h1>")
        html.append(f"<div class='meta'>Generated {_now()} — <a href='index.html'>Back to main report</a></div>")

        html.append("<div class='card'>")
        html.append("<h2>Subtype Breakdown</h2>")
        if cat in subtype_plots:
            html.append(img_tag(subtype_plots[cat], f"{cat} subtype counts"))
        html.append(counts_df.to_html(index=False, escape=True))
        html.append("</div>")

        html.append("<div class='card'>")
        html.append("<h2>Top GNN Service Detections</h2>")
        if not g_cat.empty:
            show_cols = [c for c in ["service", "threat_score", "alert_level", "threat_subtype_eh", "threat_reason_eh"] if c in g_cat.columns]
            html.append(_safe_table(g_cat[show_cols], max_rows=max_rows_per_table))
        else:
            html.append("<p>No GNN detections for this category in this run.</p>")
        html.append("</div>")

        html.append("<div class='card'>")
        html.append("<h2>Top Transformer Flow Detections</h2>")
        if not t_cat.empty:
            show_cols = [c for c in ["row_id", "protocol_type", "service", "combined_risk", "pred_attack", "category_subtype", "reason"] if c in t_cat.columns]
            html.append(_safe_table(t_cat[show_cols], max_rows=max_rows_per_table))
        else:
            html.append("<p>No transformer detections for this category in this run.</p>")
        html.append("</div>")

        html.append("</body></html>")
        (paths.out_dir / cat_file).write_text("\n".join(html), encoding="utf-8")

    return created


def write_metrics_files(
    paths: ReportPaths,
    *,
    gnn_eval: Dict[str, Any],
    gnn_eval_noleak: Dict[str, Any],
    gnn_df: pd.DataFrame,
    transformer_df: pd.DataFrame,
    ae_df: pd.DataFrame,
    ae_metrics: Dict[str, Any],
    ae_threshold: Dict[str, Any],
) -> Tuple[Path, Path]:
    # Transformer metrics (requires ground-truth from kdd_preprocessed.csv)
    transformer_metrics: Dict[str, Any] = {}
    try:
        src = pd.read_csv("kdd_preprocessed.csv", nrows=len(transformer_df))
        if "is_attack" in src.columns and "combined_risk" in transformer_df.columns:
            y_true = src["is_attack"].astype(int).to_numpy()
            y_score = transformer_df["combined_risk"].astype(float).to_numpy()
            y_pred = (y_score >= 0.5).astype(int)
            p, r, f1 = _precision_recall_f1(y_true, y_pred)
            transformer_metrics = {
                "n_rows": int(len(y_true)),
                "auc": _auc_roc(y_true, y_score),
                "precision": p,
                "recall": r,
                "f1": f1,
                "accuracy": _accuracy(y_true, y_pred),
                "threshold": 0.5,
            }
    except Exception:
        transformer_metrics = {}

    # Autoencoder metrics (ground-truth label is present in UNSW test_scored.csv)
    ae_recomputed: Dict[str, Any] = {}
    try:
        if "label" in ae_df.columns and "anomaly_score" in ae_df.columns and "is_anomaly" in ae_df.columns:
            y_true = (ae_df["label"].astype(int) > 0).astype(int).to_numpy()
            y_score = ae_df["anomaly_score"].astype(float).to_numpy()
            y_pred = (ae_df["is_anomaly"].astype(int) > 0).astype(int).to_numpy()
            p, r, f1 = _precision_recall_f1(y_true, y_pred)
            ae_recomputed = {
                "n_rows": int(len(y_true)),
                "auc": _auc_roc(y_true, y_score),
                "precision": p,
                "recall": r,
                "f1": f1,
                "accuracy": _accuracy(y_true, y_pred),
            }
    except Exception:
        ae_recomputed = {}

    # E–H counts across detectors
    eh_counts: Dict[str, Any] = {}
    for cat, subtypes in EH_TAXONOMY.items():
        g_total = int((gnn_df.get("threat_group_eh") == cat).sum()) if not gnn_df.empty and "threat_group_eh" in gnn_df.columns else 0
        t_total = (
            int((transformer_df.get("category_group") == cat).sum())
            if not transformer_df.empty and "category_group" in transformer_df.columns
            else 0
        )
        by_subtype = {}
        for st in subtypes:
            g_st = (
                int(((gnn_df.get("threat_group_eh") == cat) & (gnn_df.get("threat_subtype_eh") == st)).sum())
                if not gnn_df.empty and "threat_subtype_eh" in gnn_df.columns
                else 0
            )
            t_st = (
                int(((transformer_df.get("category_group") == cat) & (transformer_df.get("category_subtype") == st)).sum())
                if not transformer_df.empty and "category_subtype" in transformer_df.columns
                else 0
            )
            by_subtype[st] = {"gnn": g_st, "transformer": t_st, "total": g_st + t_st}
        eh_counts[cat] = {"gnn_total": g_total, "transformer_total": t_total, "total": g_total + t_total, "subtypes": by_subtype}

    # Consolidated JSON
    summary: Dict[str, Any] = {
        "generated_at": _now(),
        "gnn": {"eval": gnn_eval, "eval_noleak": gnn_eval_noleak},
        "transformer": {"computed": transformer_metrics},
        "autoencoder": {"artifacts": ae_metrics, "threshold": ae_threshold, "recomputed": ae_recomputed},
        "project": {
            "services_monitored": int(gnn_eval.get("n_services", len(gnn_df))),
            "gnn_services_flagged": int(gnn_df.get("is_malicious", pd.Series([], dtype=int)).astype(int).sum()) if not gnn_df.empty and "is_malicious" in gnn_df.columns else None,
            "transformer_rows_scored": int(len(transformer_df)) if transformer_df is not None else 0,
            "transformer_pred_attack": int(transformer_df.get("pred_attack", pd.Series([], dtype=int)).astype(int).sum()) if transformer_df is not None and not transformer_df.empty and "pred_attack" in transformer_df.columns else None,
            "eh_counts": eh_counts,
        },
    }

    metrics_json = paths.out_dir / "metrics.json"
    metrics_json.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    # Metrics HTML (single file, minimal)
    css = (
        "<style>body{font-family:Segoe UI,Arial,sans-serif;margin:24px;}h1{margin:0 0 6px 0;}"
        ".meta{color:#444;margin-bottom:18px;}table{border-collapse:collapse;width:100%;margin:10px 0;}"
        "th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px;}th{background:#f5f5f5;text-align:left;}"
        ".card{border:1px solid #ddd;border-radius:8px;padding:12px;margin:14px 0;}"
        "code{background:#f6f8fa;padding:1px 4px;border-radius:4px;}"
        "a{color:#0b57d0;text-decoration:none;}a:hover{text-decoration:underline;}"
        "</style>"
    )
    html = []
    html.append("<!doctype html><html><head><meta charset='utf-8'>")
    html.append("<meta name='viewport' content='width=device-width, initial-scale=1'>")
    html.append(f"<title>Model & Project Metrics</title>{css}</head><body>")
    html.append("<h1>Model & Project Metrics</h1>")
    html.append(f"<div class='meta'>Generated {_now()} — <a href='index.html'>Back to main report</a> — <a href='metrics.json'>Download JSON</a></div>")

    def fmt(v: Any) -> str:
        if v is None:
            return "—"
        if isinstance(v, (float, np.floating)):
            if math.isnan(float(v)):
                return "—"
            return f"{float(v):.4f}"
        return str(v)

    html.append("<div class='card'><h2>GNN (Service-level)</h2>")
    g_rows = []
    for name, obj in [("eval", gnn_eval), ("eval_noleak", gnn_eval_noleak)]:
        if not obj:
            continue
        g_rows.append(
            {
                "source": name,
                "auc": fmt(obj.get("auc")),
                "precision": fmt(obj.get("precision")),
                "recall": fmt(obj.get("recall")),
                "f1": fmt(obj.get("f1")),
                "n_services": fmt(obj.get("n_services")),
            }
        )
    html.append(pd.DataFrame(g_rows).to_html(index=False, escape=True) if g_rows else "<p>No eval report found.</p>")
    html.append("</div>")

    html.append("<div class='card'><h2>Transformer (Flow-level)</h2>")
    html.append(pd.DataFrame([transformer_metrics]).to_html(index=False, escape=True) if transformer_metrics else "<p>Could not compute transformer metrics (missing labels or columns).</p>")
    html.append("</div>")

    html.append("<div class='card'><h2>UNSW Autoencoder (Anomaly)</h2>")
    ae_tbl = {
        "artifact_test_auc": ae_metrics.get("test_auc"),
        "artifact_test_precision": ae_metrics.get("test_precision"),
        "artifact_test_recall": ae_metrics.get("test_recall"),
        "artifact_test_f1": ae_metrics.get("test_f1"),
        "threshold_method": ae_threshold.get("method"),
        "threshold_value": ae_threshold.get("threshold"),
    }
    if ae_recomputed:
        ae_tbl.update({f"recomputed_{k}": v for k, v in ae_recomputed.items()})
    html.append(pd.DataFrame([ae_tbl]).to_html(index=False, escape=True))
    html.append("</div>")

    html.append("<div class='card'><h2>Project Summary</h2>")
    proj = summary.get("project", {})
    proj_tbl = {
        "services_monitored": proj.get("services_monitored"),
        "gnn_services_flagged": proj.get("gnn_services_flagged"),
        "transformer_rows_scored": proj.get("transformer_rows_scored"),
        "transformer_pred_attack": proj.get("transformer_pred_attack"),
    }
    html.append(pd.DataFrame([proj_tbl]).to_html(index=False, escape=True))
    html.append("</div>")

    html.append("</body></html>")

    metrics_html = paths.out_dir / "metrics.html"
    metrics_html.write_text("\n".join(html), encoding="utf-8")
    return metrics_html, metrics_json


def build_html(
    paths: ReportPaths,
    *,
    gnn_df: pd.DataFrame,
    transformer_df: pd.DataFrame,
    ae_df: pd.DataFrame,
    gnn_eval: Dict[str, Any],
    gnn_eval_noleak: Dict[str, Any],
    ae_metrics: Dict[str, Any],
    ae_threshold: Dict[str, Any],
    created_imgs: Dict[str, str],
    eh_pages: Dict[str, str],
) -> None:
    # Compute transformer metrics if labels are available.
    tr_metrics: Dict[str, Any] = {}
    try:
        src = pd.read_csv("kdd_preprocessed.csv", nrows=len(transformer_df))
        if "is_attack" in src.columns:
            y_true = src["is_attack"].astype(int).to_numpy()
            y_score = transformer_df["combined_risk"].astype(float).to_numpy()
            y_pred = (y_score >= 0.5).astype(int)
            tr_metrics["auc"] = _auc_roc(y_true, y_score)
            tr_metrics["precision"], tr_metrics["recall"], tr_metrics["f1"] = _precision_recall_f1(y_true, y_pred)
            tr_metrics["n_rows"] = int(len(y_true))
    except Exception:
        pass

    # Autoencoder confusion stats
    ae_stats: Dict[str, Any] = {}
    try:
        y_true = (ae_df["label"].astype(int) > 0).astype(int).to_numpy()
        y_pred = (ae_df["is_anomaly"].astype(int) > 0).astype(int).to_numpy()
        p, r, f1 = _precision_recall_f1(y_true, y_pred)
        ae_stats = {"precision": p, "recall": r, "f1": f1, "auc": _auc_roc(y_true, ae_df["anomaly_score"].astype(float).to_numpy())}
    except Exception:
        pass

    # Top findings tables
    gnn_top = gnn_df.head(15)
    tr_top = transformer_df.sort_values("combined_risk", ascending=False).head(15)

    def img_tag(name: str, alt: str) -> str:
        p = paths.assets_dir / name
        if not p.exists():
            return ""
        return f'<div class="img"><img src="assets/{name}" alt="{alt}"></div>'

    # Minimal HTML
    html = []
    html.append("<!doctype html>")
    html.append("<html><head><meta charset='utf-8'>")
    html.append("<meta name='viewport' content='width=device-width, initial-scale=1'>")
    html.append("<title>Network Threat Detection Report</title>")
    html.append(
        "<style>body{font-family:Segoe UI,Arial,sans-serif;margin:24px;}h1{margin:0 0 6px 0;}"
        ".meta{color:#444;margin-bottom:18px;}table{border-collapse:collapse;width:100%;margin:10px 0;}"
        "th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px;}th{background:#f5f5f5;text-align:left;}"
        ".grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}"
        ".card{border:1px solid #ddd;border-radius:8px;padding:12px;}"
        ".img img{max-width:100%;height:auto;border:1px solid #eee;border-radius:6px;}"
        "code{background:#f6f8fa;padding:1px 4px;border-radius:4px;}"
        "</style></head><body>"
    )

    html.append(f"<h1>Network Threat Detection Report</h1>")
    html.append(f"<div class='meta'>Generated {_now()}</div>")

    html.append("<div class='card'>")
    html.append("<h2>Artifacts</h2>")
    html.append("<ul>")
    html.append(f"<li>GNN service detections CSV: <a href='{paths.gnn_csv.name}'>{paths.gnn_csv.name}</a></li>")
    html.append(
        f"<li>Transformer flow detections CSV: <a href='{paths.transformer_csv.name}'>{paths.transformer_csv.name}</a></li>"
    )
    html.append(f"<li>UNSW AE scored CSV: <a href='{paths.ae_scored_csv.name}'>{paths.ae_scored_csv.name}</a></li>")
    metrics_html = paths.out_dir / "metrics.html"
    if metrics_html.exists():
        html.append(f"<li>All model metrics: <a href='{metrics_html.name}'>{metrics_html.name}</a> (and <a href='metrics.json'>metrics.json</a>)</li>")
    html.append("</ul>")
    html.append("</div>")

    if eh_pages:
        html.append("<div class='card'>")
        html.append("<h2>E–H Detection Pages</h2>")
        html.append("<ul>")
        for cat in EH_TAXONOMY.keys():
            f = eh_pages.get(cat)
            if f:
                html.append(f"<li><a href='{f}'>{cat}</a></li>")
        html.append("</ul>")
        html.append("</div>")

    html.append("<div class='grid'>")
    html.append("<div class='card'>")
    html.append("<h2>GNN (Service-level)</h2>")
    html.append(
        f"<p><b>Eval (current)</b>: auc={gnn_eval.get('auc'):.3f}, precision={gnn_eval.get('precision'):.3f}, recall={gnn_eval.get('recall'):.3f}, f1={gnn_eval.get('f1'):.3f} (n_services={gnn_eval.get('n_services')})</p>"
    )
    if gnn_eval_noleak:
        html.append(
            f"<p><b>Eval (no-leak)</b>: auc={gnn_eval_noleak.get('auc'):.3f}, precision={gnn_eval_noleak.get('precision'):.3f}, recall={gnn_eval_noleak.get('recall'):.3f}, f1={gnn_eval_noleak.get('f1'):.3f}</p>"
        )
    if (paths.assets_dir / "gnn_threat_dashboard.png").exists():
        html.append(img_tag("gnn_threat_dashboard.png", "GNN dashboard"))
    if "gnn_hist" in created_imgs:
        html.append(img_tag(created_imgs["gnn_hist"], "GNN threat score histogram"))
    html.append("</div>")

    html.append("<div class='card'>")
    html.append("<h2>Transformer (Flow-level)</h2>")
    if tr_metrics:
        html.append(
            f"<p>auc={tr_metrics.get('auc', float('nan')):.3f}, precision={tr_metrics.get('precision', float('nan')):.3f}, recall={tr_metrics.get('recall', float('nan')):.3f}, f1={tr_metrics.get('f1', float('nan')):.3f} (n_rows={tr_metrics.get('n_rows')})</p>"
        )
    else:
        html.append("<p>Metrics: labels not available for this run.</p>")
    if "tr_hist" in created_imgs:
        html.append(img_tag(created_imgs["tr_hist"], "Transformer combined risk histogram"))
    html.append("</div>")
    html.append("</div>")

    html.append("<div class='grid'>")
    html.append("<div class='card'>")
    html.append("<h2>UNSW Autoencoder (Unknown/Zero-day)</h2>")
    html.append(
        f"<p><b>Artifacts metrics</b>: auc={ae_metrics.get('test_auc'):.3f}, precision={ae_metrics.get('test_precision'):.3f}, recall={ae_metrics.get('test_recall'):.3f}, f1={ae_metrics.get('test_f1'):.3f}</p>"
    )
    html.append(
        f"<p><b>Threshold</b>: method={ae_threshold.get('method')} (p={ae_threshold.get('percentile')}), value={ae_threshold.get('threshold'):.6f}</p>"
    )
    if ae_stats:
        html.append(
            f"<p><b>Recomputed</b>: auc={ae_stats.get('auc', float('nan')):.3f}, precision={ae_stats.get('precision'):.3f}, recall={ae_stats.get('recall'):.3f}, f1={ae_stats.get('f1'):.3f}</p>"
        )
    if "ae_hist" in created_imgs:
        html.append(img_tag(created_imgs["ae_hist"], "Autoencoder anomaly score histogram"))
    html.append("</div>")

    html.append("<div class='card'>")
    html.append("<h2>Graphs & Explanations</h2>")
    if "service_graph" in created_imgs:
        html.append(img_tag(created_imgs["service_graph"], "Service protocol graph"))
    xtis_dir = paths.assets_dir / "x_tis_outputs"
    if xtis_dir.exists():
        html.append("<p>X-TIS outputs copied: <a href='assets/x_tis_outputs/x_tis_outputs.csv'>x_tis_outputs.csv</a></p>")
    else:
        html.append("<p>X-TIS outputs not available for this run.</p>")
    html.append("</div>")
    html.append("</div>")

    # Tables
    html.append("<div class='card'>")
    html.append("<h2>Top GNN Service Detections</h2>")
    show_cols = [c for c in ["service", "threat_score", "alert_level", "threat_group_eh", "threat_subtype_eh"] if c in gnn_top.columns]
    html.append(gnn_top[show_cols].to_html(index=False, escape=True))
    html.append("</div>")

    html.append("<div class='card'>")
    html.append("<h2>Top Transformer Flow Detections (sample)</h2>")
    show_cols = [c for c in ["protocol_type", "service", "combined_risk", "pred_attack", "category_group", "category_subtype"] if c in tr_top.columns]
    html.append(tr_top[show_cols].to_html(index=False, escape=True))
    html.append("</div>")

    html.append("</body></html>")

    paths.html_path.write_text("\n".join(html), encoding="utf-8")


def main(argv: Optional[list[str]] = None) -> None:
    import argparse

    ap = argparse.ArgumentParser(description="Run inferences + generate HTML report")
    ap.add_argument("--out_dir", type=str, default="report_assets/generated_report", help="Output report directory")
    ap.add_argument("--transformer_limit_rows", type=int, default=50000, help="Rows to run transformer inference on")
    ap.add_argument(
        "--max_rows_per_table",
        type=int,
        default=0,
        help="Max rows to render per HTML table (0 = all rows; large values may create big HTML files)",
    )
    ap.add_argument("--skip_transformer", action="store_true", help="Skip transformer inference")
    ap.add_argument("--skip_xtis", action="store_true", help="Skip x_tis explainability")
    args = ap.parse_args(argv)

    paths = _init_paths(Path(args.out_dir))

    # Load eval artifacts (already computed during training)
    gnn_eval = _read_json(Path("eval_report.json")) if Path("eval_report.json").exists() else {}
    gnn_eval_noleak = _read_json(Path("eval_report_noleak.json")) if Path("eval_report_noleak.json").exists() else {}

    print(f"[{_now()}] Running GNN service detection...")
    gnn_df = run_gnn_service_detection(paths)

    if not args.skip_xtis:
        print(f"[{_now()}] Running X-TIS explanations...")
        run_x_tis(paths, top_k=10, hop=2)
    else:
        # Keep image count minimal if X-TIS is skipped.
        xtis_assets = paths.assets_dir / "x_tis_outputs"
        if xtis_assets.exists():
            shutil.rmtree(xtis_assets, ignore_errors=True)

    transformer_df = pd.DataFrame()
    if not args.skip_transformer:
        print(f"[{_now()}] Running transformer flow detection...")
        transformer_df = run_transformer_flow_detection(paths, limit_rows=args.transformer_limit_rows)

    print(f"[{_now()}] Loading anomaly autoencoder artifacts...")
    ae_df, ae_metrics, ae_threshold = copy_anomaly_autoencoder_artifacts(paths)

    print(f"[{_now()}] Generating plots...")
    created_imgs = plot_assets(paths, gnn_df, transformer_df if not transformer_df.empty else pd.DataFrame({"combined_risk": []}), ae_df, ae_threshold)

    print(f"[{_now()}] Generating E–H subtype plots + pages...")
    max_rows_per_table = None if int(args.max_rows_per_table) == 0 else int(args.max_rows_per_table)
    subtype_plots = plot_eh_subtype_counts(
        paths,
        gnn_df=gnn_df,
        transformer_df=transformer_df if not transformer_df.empty else pd.DataFrame({"category_group": [], "category_subtype": [], "combined_risk": []}),
    )
    eh_pages = write_eh_pages(
        paths,
        gnn_df=gnn_df,
        transformer_df=transformer_df if not transformer_df.empty else pd.DataFrame({"category_group": [], "category_subtype": [], "combined_risk": []}),
        subtype_plots=subtype_plots,
        max_rows_per_table=max_rows_per_table,
    )

    print(f"[{_now()}] Writing consolidated metrics...")
    write_metrics_files(
        paths,
        gnn_eval=gnn_eval,
        gnn_eval_noleak=gnn_eval_noleak,
        gnn_df=gnn_df,
        transformer_df=transformer_df if not transformer_df.empty else pd.DataFrame({"combined_risk": [], "pred_attack": []}),
        ae_df=ae_df,
        ae_metrics=ae_metrics,
        ae_threshold=ae_threshold,
    )

    print(f"[{_now()}] Writing HTML...")
    build_html(
        paths,
        gnn_df=gnn_df,
        transformer_df=transformer_df if not transformer_df.empty else pd.DataFrame({"combined_risk": []}),
        ae_df=ae_df,
        gnn_eval=gnn_eval,
        gnn_eval_noleak=gnn_eval_noleak,
        ae_metrics=ae_metrics,
        ae_threshold=ae_threshold,
        created_imgs=created_imgs,
        eh_pages=eh_pages,
    )

    print(f"[{_now()}] Done. Open: {paths.html_path}")


if __name__ == "__main__":
    main()
