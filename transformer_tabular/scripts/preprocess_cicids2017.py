from __future__ import annotations

import argparse
import sys
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import torch

sys.path.append(str(Path(__file__).resolve().parents[1]))

from tabular_transformer.preprocessing import (
    TabularPreprocessor,
    binary_labels_from_string,
    clean_columns,
    stratified_split,
)
from tabular_transformer.utils import ensure_dir


def read_first_csv_from_zip(zip_path: str, nrows: int | None = None) -> pd.DataFrame:
    with zipfile.ZipFile(zip_path) as z:
        names = [n for n in z.namelist() if n.lower().endswith('.csv')]
        if not names:
            raise FileNotFoundError("No CSV found inside zip")
        with z.open(names[0]) as f:
            return pd.read_csv(f, nrows=nrows)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip_path", type=str, default=None, help="Optional path to zip containing combinenew.csv")
    ap.add_argument(
        "--data_dir",
        type=str,
        default=None,
        help="Optional extracted directory containing combinenew.csv",
    )
    ap.add_argument(
        "--csv_path",
        type=str,
        default=None,
        help="Optional direct path to combinenew.csv (overrides --data_dir)",
    )
    ap.add_argument("--out_dir", type=str, required=True)
    ap.add_argument("--label_col", type=str, default="Label")
    ap.add_argument("--val_size", type=float, default=0.15)
    ap.add_argument("--test_size", type=float, default=0.15)
    ap.add_argument("--limit_rows", type=int, default=None, help="Optional row limit for quick debug runs")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    ensure_dir(out_dir)

    if args.csv_path is not None:
        df = pd.read_csv(args.csv_path, nrows=args.limit_rows, low_memory=False)
    else:
        if (args.zip_path is None) == (args.data_dir is None):
            raise SystemExit("Provide exactly one of --zip_path or --data_dir (or use --csv_path)")
        if args.zip_path is not None:
            df = read_first_csv_from_zip(args.zip_path, nrows=args.limit_rows)
        else:
            df = pd.read_csv(Path(args.data_dir) / "combinenew.csv", nrows=args.limit_rows, low_memory=False)
    df = clean_columns(df)

    # Some CICIDS dumps have leading spaces in the label column name; clean_columns() strips them.
    if args.label_col not in df.columns:
        candidates = [c for c in df.columns if c.lower() == args.label_col.strip().lower()]
        if candidates:
            label_col = candidates[0]
        else:
            raise KeyError(f"Label column '{args.label_col}' not found. Available: {list(df.columns)[:10]} ...")
    else:
        label_col = args.label_col

    y = binary_labels_from_string(df[label_col], benign_value="BENIGN")
    X = df.drop(columns=[label_col])

    # Treat all features as numeric; coerce non-numeric to NaN.
    # If any string columns exist, they'll become NaN and get median-imputed.
    pre = TabularPreprocessor.from_dataframe(X, cat_cols=[], label_col=None)

    (X_train, y_train), (X_val, y_val), test_split = stratified_split(
        X, y, val_size=args.val_size, test_size=args.test_size, seed=args.seed
    )
    assert test_split is not None
    X_test, y_test = test_split

    pre.fit(X_train)

    xnum_tr, xcat_tr = pre.transform(X_train)
    xnum_va, xcat_va = pre.transform(X_val)
    xnum_te, xcat_te = pre.transform(X_test)

    meta = {
        "dataset": "cicids2017",
        "task": "binary",
        "num_cols": pre.num_cols,
        "cat_cols": pre.cat_cols,
        "cat_cardinalities": pre.cat_cardinalities() if len(pre.cat_cols) else [],
        "n_num": int(xnum_tr.shape[1]),
        "n_cat": int(xcat_tr.shape[1]),
    }

    for split, xnum, xcat, y_ in [
        ("train", xnum_tr, xcat_tr, y_train),
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
                "y": torch.from_numpy(y_.astype(np.float32)),
            },
            sd / "tensors.pt",
        )

    print(f"Wrote processed CICIDS2017 to: {out_dir}")


if __name__ == "__main__":
    main()
