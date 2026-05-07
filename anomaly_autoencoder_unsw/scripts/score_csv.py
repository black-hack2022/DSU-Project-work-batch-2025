from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch

# Allow running this script from a copied folder without installing as a package.
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from anomaly_ae.artifacts import load_json, load_model_state, load_preprocessor
from anomaly_ae.model import MLPAutoencoder, reconstruction_mse
from anomaly_ae.preprocessing import one_hot_cats


def _ensure_cols(df: pd.DataFrame, cols: list[str], fill_value) -> pd.DataFrame:
    df = df.copy()
    for c in cols:
        if c not in df.columns:
            df[c] = fill_value
    return df


def main() -> None:
    ap = argparse.ArgumentParser(description="Score a CSV with the trained UNSW Autoencoder anomaly model")
    ap.add_argument("--model_dir", type=str, required=True, help="Folder containing model.pt/preprocessor.json/threshold.json")
    ap.add_argument("--input_csv", type=str, required=True)
    ap.add_argument("--output_csv", type=str, required=True)
    ap.add_argument("--batch_size", type=int, default=4096)
    ap.add_argument("--device", type=str, default=None)
    ap.add_argument("--threshold", type=float, default=None, help="Override threshold (else uses threshold.json)")
    args = ap.parse_args()

    model_dir = Path(args.model_dir)
    pre = load_preprocessor(model_dir / "preprocessor.json")
    threshold_info = load_json(model_dir / "threshold.json")
    thr = float(args.threshold) if args.threshold is not None else float(threshold_info["threshold"])

    state = load_model_state(model_dir / "model.pt")
    arch = state["arch"]

    model = MLPAutoencoder(
        input_dim=int(arch["input_dim"]),
        hidden_dims=list(arch["hidden_dims"]),
        latent_dim=int(arch["latent_dim"]),
        dropout=float(arch.get("dropout", 0.0)),
    )
    model.load_state_dict(state["state_dict"])

    device = torch.device(args.device) if args.device else torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    model.eval()

    df = pd.read_csv(args.input_csv)

    # Keep only columns the preprocessor expects; create missing columns
    xdf = df.copy()
    xdf = _ensure_cols(xdf, pre.cat_cols, "")
    xdf = _ensure_cols(xdf, pre.num_cols, 0.0)
    xdf = xdf[pre.num_cols + pre.cat_cols]

    x_num, x_cat = pre.transform(xdf)
    cards = pre.cat_cardinalities()
    x_cat_oh = one_hot_cats(x_cat, cards)
    x = np.concatenate([x_num, x_cat_oh], axis=1).astype(np.float32)

    xt = torch.from_numpy(x).to(device)
    scores = reconstruction_mse(model, xt, batch_size=int(args.batch_size))
    flags = (scores > thr).astype(np.int32)

    out = df.copy()
    out["anomaly_score"] = scores
    out["is_anomaly"] = flags

    Path(args.output_csv).parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.output_csv, index=False)

    print(f"Wrote scored CSV: {args.output_csv}")


if __name__ == "__main__":
    main()
