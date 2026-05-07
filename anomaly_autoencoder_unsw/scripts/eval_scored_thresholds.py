from __future__ import annotations

import argparse
from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.metrics import precision_recall_fscore_support, roc_auc_score


@dataclass(frozen=True)
class Row:
    name: str
    threshold: float
    alert_rate: float
    precision: float
    recall: float
    f1: float


def _parse_percentiles(s: str) -> list[float]:
    out: list[float] = []
    for part in s.split(","):
        part = part.strip()
        if not part:
            continue
        out.append(float(part))
    if not out:
        raise ValueError("No percentiles provided")
    return out


def main() -> None:
    ap = argparse.ArgumentParser(
        description=(
            "Evaluate a scored CSV across multiple thresholds. "
            "By default thresholds are chosen as percentiles of NORMAL scores (label==0)."
        )
    )
    ap.add_argument("--scored_csv", type=str, required=True, help="CSV containing anomaly_score and (optionally) label")
    ap.add_argument("--score_col", type=str, default="anomaly_score")
    ap.add_argument("--label_col", type=str, default="label")
    ap.add_argument(
        "--percentiles",
        type=str,
        default="99,99.5,99.7,99.9",
        help="Comma-separated percentiles used to set threshold from NORMAL scores",
    )
    ap.add_argument(
        "--thresholds",
        type=str,
        default=None,
        help="Optional explicit thresholds (comma-separated). If set, ignores --percentiles.",
    )
    args = ap.parse_args()

    df = pd.read_csv(args.scored_csv)
    if args.score_col not in df.columns:
        raise SystemExit(f"Missing score column: {args.score_col}")

    scores = df[args.score_col].astype(np.float64).to_numpy()

    has_labels = args.label_col in df.columns
    y = None
    if has_labels:
        y = df[args.label_col].astype(np.int32).to_numpy()

    # Threshold candidates
    thresholds: list[tuple[str, float]] = []
    if args.thresholds:
        for i, t in enumerate(_parse_percentiles(args.thresholds)):
            thresholds.append((f"thr_{i}", float(t)))
    else:
        if not has_labels:
            raise SystemExit(
                f"{args.label_col} column not found; cannot compute NORMAL percentiles. "
                "Pass --thresholds instead."
            )
        normal_scores = scores[y == 0]
        if normal_scores.size == 0:
            raise SystemExit("No normal rows found (label==0)")
        for p in _parse_percentiles(args.percentiles):
            thr = float(np.percentile(normal_scores, p))
            thresholds.append((f"p{str(p).replace('.', '_')}", thr))

    rows: list[Row] = []
    for name, thr in thresholds:
        flags = (scores > thr).astype(np.int32)
        alert_rate = float(flags.mean())

        if has_labels and y is not None:
            prec, rec, f1, _ = precision_recall_fscore_support(y, flags, average="binary", zero_division=0)
            rows.append(Row(name=name, threshold=thr, alert_rate=alert_rate, precision=float(prec), recall=float(rec), f1=float(f1)))
        else:
            rows.append(Row(name=name, threshold=thr, alert_rate=alert_rate, precision=float("nan"), recall=float("nan"), f1=float("nan")))

    print(f"Rows: {len(df):,}")
    if has_labels and y is not None:
        try:
            auc = float(roc_auc_score(y, scores))
        except Exception:
            auc = float("nan")
        print(f"AUC (threshold-free): {auc:.6f}")

    out_df = pd.DataFrame([r.__dict__ for r in rows])
    # Pretty formatting
    out_df["alert_rate"] = out_df["alert_rate"].map(lambda x: f"{x*100:.3f}%")
    for c in ["threshold", "precision", "recall", "f1"]:
        out_df[c] = out_df[c].map(lambda x: f"{x:.6f}" if np.isfinite(float(x)) else "-")

    print("\nThreshold sweep (higher recall = more alerts):")
    print(out_df.to_string(index=False))


if __name__ == "__main__":
    main()
