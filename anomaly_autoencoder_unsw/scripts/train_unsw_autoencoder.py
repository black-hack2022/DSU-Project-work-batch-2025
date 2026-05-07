from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import precision_recall_fscore_support, roc_auc_score

# Allow running this script from a copied folder without installing as a package.
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from anomaly_ae.artifacts import save_json, save_model_state, save_preprocessor
from anomaly_ae.model import MLPAutoencoder
from anomaly_ae.preprocessing import TabularPreprocessor, one_hot_cats, split_normal_only
from anomaly_ae.training import TrainConfig, choose_threshold, score_array, train_autoencoder
from anomaly_ae.unsw_io import load_unsw_nb15


def _ensure_cols(df: pd.DataFrame, cols: list[str], fill_value) -> pd.DataFrame:
    df = df.copy()
    for c in cols:
        if c not in df.columns:
            df[c] = fill_value
    return df


def main() -> None:
    ap = argparse.ArgumentParser(description="Train UNSW-NB15 autoencoder anomaly detector (train on normal only)")

    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--zip_path", type=str, default=None, help="archive.zip containing UNSW_NB15_training-set.csv + testing")
    src.add_argument("--data_dir", type=str, default=None, help="directory containing UNSW_NB15_training-set.csv + testing")

    ap.add_argument("--out_dir", type=str, required=True, help="Where to write artifacts")
    ap.add_argument("--val_size", type=float, default=0.2)
    ap.add_argument("--limit_rows", type=int, default=None, help="Optional row limit for debugging")
    ap.add_argument("--seed", type=int, default=42)

    # Model/training
    ap.add_argument("--epochs", type=int, default=50)
    ap.add_argument("--batch_size", type=int, default=2048)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--weight_decay", type=float, default=1e-5)
    ap.add_argument("--hidden_dims", type=str, default="256,128", help="Comma-separated")
    ap.add_argument("--latent_dim", type=int, default=32)
    ap.add_argument("--dropout", type=float, default=0.0)
    ap.add_argument("--device", type=str, default=None, help="e.g. cuda, cuda:0, cpu")

    # Thresholding
    ap.add_argument(
        "--threshold_method",
        type=str,
        default="p99_5",
        help="p99_5, p99_9, mean_plus_3std",
    )

    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    train_df, test_df = load_unsw_nb15(zip_path=args.zip_path, data_dir=args.data_dir, limit_rows=args.limit_rows)

    # Keep labels for eval if present
    y_train = train_df["label"].astype(np.float32).to_numpy() if "label" in train_df.columns else None
    y_test = test_df["label"].astype(np.float32).to_numpy() if "label" in test_df.columns else None

    drop_cols = [c for c in ["label", "attack_cat"] if c in train_df.columns]

    # Known categorical columns for UNSW
    base_cat_cols = [c for c in ["proto", "service", "state"] if c in train_df.columns]

    # Train on NORMAL ONLY from training split
    train_norm_df = train_df.copy()
    if "label" in train_norm_df.columns:
        train_norm_df = train_norm_df[train_norm_df["label"].astype(float) == 0.0]

    # Preprocessor should be fit on normal data only
    pre = TabularPreprocessor.from_dataframe(train_norm_df, cat_cols=base_cat_cols, drop_cols=drop_cols)

    # Ensure required cols exist (defensive)
    train_norm_df = train_norm_df.drop(columns=drop_cols, errors="ignore")
    test_X = test_df.drop(columns=drop_cols, errors="ignore")

    train_norm_df = _ensure_cols(train_norm_df, pre.cat_cols, "")
    train_norm_df = _ensure_cols(train_norm_df, pre.num_cols, 0.0)
    test_X = _ensure_cols(test_X, pre.cat_cols, "")
    test_X = _ensure_cols(test_X, pre.num_cols, 0.0)

    # Split normal into train/val
    tr_df, va_df, _ = split_normal_only(
        pd.concat([train_norm_df], axis=1),
        label_col="__no_label__",  # label already removed
        val_size=float(args.val_size),
        seed=int(args.seed),
    )

    pre.fit(tr_df)
    xnum_tr, xcat_tr = pre.transform(tr_df)
    xnum_va, xcat_va = pre.transform(va_df)
    xnum_te, xcat_te = pre.transform(test_X)

    cards = pre.cat_cardinalities()
    xcat_tr_oh = one_hot_cats(xcat_tr, cards)
    xcat_va_oh = one_hot_cats(xcat_va, cards)
    xcat_te_oh = one_hot_cats(xcat_te, cards)

    x_tr = np.concatenate([xnum_tr, xcat_tr_oh], axis=1).astype(np.float32)
    x_va = np.concatenate([xnum_va, xcat_va_oh], axis=1).astype(np.float32)
    x_te = np.concatenate([xnum_te, xcat_te_oh], axis=1).astype(np.float32)

    cfg = TrainConfig(
        epochs=int(args.epochs),
        batch_size=int(args.batch_size),
        lr=float(args.lr),
        weight_decay=float(args.weight_decay),
        hidden_dims=tuple(int(x) for x in str(args.hidden_dims).split(",") if x.strip()),
        latent_dim=int(args.latent_dim),
        dropout=float(args.dropout),
        seed=int(args.seed),
        device=args.device,
    )

    model, train_metrics = train_autoencoder(x_tr, x_va, cfg=cfg)

    device = torch.device(args.device) if args.device else torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)

    # Threshold from validation NORMAL scores
    val_scores = score_array(model, x_va, device=device)
    thr_info = choose_threshold(val_scores, method=str(args.threshold_method))
    thr = float(thr_info["threshold"])

    # Evaluate on test (labeled if available)
    test_scores = score_array(model, x_te, device=device)
    test_flags = (test_scores > thr).astype(np.int32)

    metrics: dict[str, float | int | str] = {
        "n_train_normal": int(x_tr.shape[0]),
        "n_val_normal": int(x_va.shape[0]),
        "n_test": int(x_te.shape[0]),
        "input_dim": int(x_tr.shape[1]),
        "best_val_loss": float(train_metrics.get("best_val_loss", 0.0)),
        "threshold": thr,
        "threshold_method": str(args.threshold_method),
    }

    if y_test is not None:
        try:
            auc = float(roc_auc_score(y_test, test_scores))
        except Exception:
            auc = 0.0

        prec, rec, f1, _ = precision_recall_fscore_support(y_test, test_flags, average="binary", zero_division=0)
        metrics.update({
            "test_auc": float(auc),
            "test_precision": float(prec),
            "test_recall": float(rec),
            "test_f1": float(f1),
        })

    # Save artifacts
    save_preprocessor(out_dir / "preprocessor.json", pre)

    model_state = {
        "arch": {
            "input_dim": int(x_tr.shape[1]),
            "hidden_dims": [int(x) for x in cfg.hidden_dims],
            "latent_dim": int(cfg.latent_dim),
            "dropout": float(cfg.dropout),
        },
        "state_dict": {k: v.detach().cpu() for k, v in model.state_dict().items()},
    }
    save_model_state(out_dir / "model.pt", model_state)

    meta = {
        "dataset": "unsw_nb15",
        "cat_cols": pre.cat_cols,
        "num_cols": pre.num_cols,
        "cat_cardinalities": cards,
        "n_num": int(xnum_tr.shape[1]),
        "n_cat_onehot": int(xcat_tr_oh.shape[1]),
        "input_dim": int(x_tr.shape[1]),
    }
    save_json(out_dir / "meta.json", meta)
    save_json(out_dir / "threshold.json", thr_info)
    save_json(out_dir / "metrics.json", metrics)

    # Write a scored test CSV for inspection
    scored = test_df.copy()
    scored["anomaly_score"] = test_scores
    scored["is_anomaly"] = test_flags
    scored.to_csv(out_dir / "test_scored.csv", index=False)

    print(f"\nWrote artifacts to: {out_dir}")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
