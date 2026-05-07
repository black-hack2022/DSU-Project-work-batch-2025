from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from tabular_transformer.dataset import TabularDataset, load_split
from tabular_transformer.metrics import binary_metrics
from tabular_transformer.model import FTTransformer
from tabular_transformer.utils import get_device, write_json


@torch.no_grad()
def eval_split(model: nn.Module, loader: DataLoader, device: torch.device) -> Dict[str, float]:
    model.eval()
    ys = []
    logits = []
    for batch in loader:
        x_num = batch["x_num"].to(device)
        x_cat = batch["x_cat"].to(device)
        y = batch["y"].to(device)
        out = model(x_num=x_num, x_cat=x_cat)
        ys.append(y.detach().cpu().numpy())
        logits.append(out.detach().cpu().numpy())

    y_true = np.concatenate(ys)
    y_logit = np.concatenate(logits)
    return binary_metrics(y_true, y_logit)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data_dir", type=str, required=True)
    ap.add_argument("--checkpoint", type=str, required=True)
    ap.add_argument("--device", type=str, default=None)
    ap.add_argument("--out", type=str, default=None, help="Optional metrics json output path")
    ap.add_argument("--split", type=str, default="test", choices=["val", "test"])
    args = ap.parse_args()

    device = get_device(args.device)

    split_tensors, meta = load_split(Path(args.data_dir) / args.split)

    ckpt = torch.load(args.checkpoint, map_location=device)
    if isinstance(ckpt, dict) and "model" in ckpt:
        state = ckpt["model"]
        ckpt_meta = ckpt.get("meta", meta)
        ckpt_cfg = ckpt.get("config", {})
    else:
        state = ckpt
        ckpt_meta = meta
        ckpt_cfg = {}

    model = FTTransformer(
        n_num=ckpt_meta["n_num"],
        cat_cardinalities=ckpt_meta.get("cat_cardinalities", []),
        d_token=int(ckpt_cfg.get("d_token", 192)),
        n_heads=int(ckpt_cfg.get("n_heads", 8)),
        n_layers=int(ckpt_cfg.get("n_layers", 4)),
        d_ff=int(ckpt_cfg.get("d_ff", 384)),
        dropout=float(ckpt_cfg.get("dropout", 0.1)),
    ).to(device)

    model.load_state_dict(state)

    loader = DataLoader(TabularDataset(split_tensors), batch_size=4096, shuffle=False)
    m = eval_split(model, loader, device)

    if args.out:
        write_json(args.out, m)

    print(m)


if __name__ == "__main__":
    main()
