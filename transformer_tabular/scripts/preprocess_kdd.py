from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch

sys.path.append(str(Path(__file__).resolve().parents[1]))

from tabular_transformer.preprocessing import TabularPreprocessor, clean_columns, stratified_split
from tabular_transformer.utils import ensure_dir


def invert_mapping(m: dict[str, int]) -> dict[int, str]:
    return {int(v): str(k) for k, v in m.items()}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv_path", type=str, default="kdd_preprocessed.csv")
    ap.add_argument("--out_dir", type=str, required=True)
    ap.add_argument("--val_size", type=float, default=0.15)
    ap.add_argument("--test_size", type=float, default=0.15)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--limit_rows", type=int, default=None)
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    ensure_dir(out_dir)

    df = pd.read_csv(args.csv_path, nrows=args.limit_rows)
    df = clean_columns(df)

    if "is_attack" not in df.columns:
        raise KeyError("Expected column 'is_attack' in kdd_preprocessed.csv")

    y = df["is_attack"].astype(np.float32).to_numpy()

    drop_cols = [c for c in ["label", "difficulty", "is_attack"] if c in df.columns]
    X = df.drop(columns=drop_cols)

    cat_cols = [c for c in ["protocol_type", "service", "flag"] if c in X.columns]
    pre = TabularPreprocessor.from_dataframe(X, cat_cols=cat_cols)

    (X_train, y_train), (X_val, y_val), test_split = stratified_split(
        X,
        y,
        val_size=args.val_size,
        test_size=args.test_size,
        seed=args.seed,
    )
    assert test_split is not None
    X_test, y_test = test_split

    pre.fit(X_train)

    # Save fitted preprocessor for reuse on new CSVs
    # Prefer JSON (avoids torch.load pickling restrictions in newer PyTorch)
    (out_dir / "preprocessor.json").write_text(
        json.dumps(pre.to_json_dict(), indent=2),
        encoding="utf-8",
    )
    # Back-compat: keep the .pt variant if existing scripts rely on it
    torch.save(pre.to_state_dict(), out_dir / "preprocessor.pt")

    xnum_tr, xcat_tr = pre.transform(X_train)
    xnum_va, xcat_va = pre.transform(X_val)
    xnum_te, xcat_te = pre.transform(X_test)

    meta = {
        "dataset": "kdd",
        "task": "binary",
        "num_cols": pre.num_cols,
        "cat_cols": pre.cat_cols,
        "cat_cardinalities": pre.cat_cardinalities(),
        "n_num": int(xnum_tr.shape[1]),
        "n_cat": int(xcat_tr.shape[1]),
        "seed": int(args.seed),
        "val_size": float(args.val_size),
        "test_size": float(args.test_size),
    }

    # Save a vocab so we can decode service/protocol ids later.
    vocab = {}
    if pre.cat_maps is not None:
        for col, mapping in pre.cat_maps.items():
            inv = invert_mapping(mapping)
            vocab[col] = {str(k): v for k, v in sorted(inv.items(), key=lambda kv: kv[0])}

    (out_dir / "vocab.json").write_text(json.dumps(vocab, indent=2), encoding="utf-8")

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

    print(f"Wrote processed KDD to: {out_dir}")


if __name__ == "__main__":
    main()
