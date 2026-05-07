from __future__ import annotations

import argparse
import sys
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import torch

sys.path.append(str(Path(__file__).resolve().parents[1]))

from tabular_transformer.preprocessing import TabularPreprocessor, clean_columns, stratified_split
from tabular_transformer.utils import ensure_dir


def read_csv_from_zip(zip_path: str, inner_name: str, usecols=None, nrows: int | None = None) -> pd.DataFrame:
    with zipfile.ZipFile(zip_path) as z:
        with z.open(inner_name) as f:
            return pd.read_csv(f, usecols=usecols, nrows=nrows)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip_path", type=str, default=None, help="Optional path to archive.zip containing UNSW-NB15 CSVs")
    ap.add_argument(
        "--data_dir",
        type=str,
        default=None,
        help="Optional extracted directory containing UNSW_NB15_training-set.csv and UNSW_NB15_testing-set.csv",
    )
    ap.add_argument("--out_dir", type=str, required=True)
    ap.add_argument("--val_size", type=float, default=0.2)
    ap.add_argument("--limit_rows", type=int, default=None, help="Optional row limit for quick debug runs")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    ensure_dir(out_dir)

    if (args.zip_path is None) == (args.data_dir is None):
        raise SystemExit("Provide exactly one of --zip_path or --data_dir")

    if args.zip_path is not None:
        train_df = read_csv_from_zip(args.zip_path, "UNSW_NB15_training-set.csv", nrows=args.limit_rows)
        test_df = read_csv_from_zip(args.zip_path, "UNSW_NB15_testing-set.csv", nrows=args.limit_rows)
    else:
        data_dir = Path(args.data_dir)
        train_df = pd.read_csv(data_dir / "UNSW_NB15_training-set.csv", nrows=args.limit_rows)
        test_df = pd.read_csv(data_dir / "UNSW_NB15_testing-set.csv", nrows=args.limit_rows)

    train_df = clean_columns(train_df)
    test_df = clean_columns(test_df)

    # Binary target
    y_train = train_df["label"].astype(np.float32).to_numpy()
    y_test = test_df["label"].astype(np.float32).to_numpy()

    drop_cols = [c for c in ["label", "attack_cat"] if c in train_df.columns]

    X_train_full = train_df.drop(columns=drop_cols)
    X_test = test_df.drop(columns=drop_cols)

    # Known categorical cols in UNSW
    cat_cols = [c for c in ["proto", "service", "state"] if c in X_train_full.columns]

    pre = TabularPreprocessor.from_dataframe(X_train_full, cat_cols=cat_cols)

    (X_train, y_train2), (X_val, y_val), _ = stratified_split(
        X_train_full, y_train, val_size=args.val_size, test_size=0.0, seed=args.seed
    )

    pre.fit(X_train)

    xnum_tr, xcat_tr = pre.transform(X_train)
    xnum_va, xcat_va = pre.transform(X_val)
    xnum_te, xcat_te = pre.transform(X_test)

    meta = {
        "dataset": "unsw_nb15",
        "task": "binary",
        "num_cols": pre.num_cols,
        "cat_cols": pre.cat_cols,
        "cat_cardinalities": pre.cat_cardinalities(),
        "n_num": int(xnum_tr.shape[1]),
        "n_cat": int(xcat_tr.shape[1]),
    }

    for split, xnum, xcat, y in [
        ("train", xnum_tr, xcat_tr, y_train2),
        ("val", xnum_va, xcat_va, y_val),
        ("test", xnum_te, xcat_te, y_test),
    ]:
        sd = out_dir / split
        ensure_dir(sd)
        torch.save(meta, sd / "meta.pt")
        torch.save(
            {
                "x_num": torch.from_numpy(xnum),
                "x_cat": torch.from_numpy(xcat),
                "y": torch.from_numpy(y.astype(np.float32)),
            },
            sd / "tensors.pt",
        )

    print(f"Wrote processed UNSW-NB15 to: {out_dir}")


if __name__ == "__main__":
    main()
