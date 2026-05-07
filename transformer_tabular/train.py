from __future__ import annotations

import argparse
import time
from pathlib import Path
from typing import Dict

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from tqdm import tqdm

from tabular_transformer.dataset import TabularDataset, load_split
from tabular_transformer.metrics import binary_metrics
from tabular_transformer.model import FTTransformer
from tabular_transformer.utils import ensure_dir, get_device, set_seed, write_json


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
    ap.add_argument("--data_dir", type=str, required=True, help="Processed dataset dir (contains train/val/test)")
    ap.add_argument("--run_dir", type=str, required=True)

    ap.add_argument("--epochs", type=int, default=10)
    ap.add_argument("--batch_size", type=int, default=2048)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--weight_decay", type=float, default=1e-5)

    ap.add_argument("--d_token", type=int, default=192)
    ap.add_argument("--n_heads", type=int, default=8)
    ap.add_argument("--n_layers", type=int, default=4)
    ap.add_argument("--d_ff", type=int, default=384)
    ap.add_argument("--dropout", type=float, default=0.1)

    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--device", type=str, default=None)
    ap.add_argument("--amp", action="store_true", help="Use CUDA autocast if available")

    args = ap.parse_args()

    set_seed(args.seed)
    device = get_device(args.device)

    run_dir = Path(args.run_dir)
    ensure_dir(run_dir)

    train_tensors, meta = load_split(Path(args.data_dir) / "train")
    val_tensors, _ = load_split(Path(args.data_dir) / "val")
    test_tensors, _ = load_split(Path(args.data_dir) / "test")

    model = FTTransformer(
        n_num=meta["n_num"],
        cat_cardinalities=meta.get("cat_cardinalities", []),
        d_token=args.d_token,
        n_heads=args.n_heads,
        n_layers=args.n_layers,
        d_ff=args.d_ff,
        dropout=args.dropout,
    ).to(device)

    train_loader = DataLoader(
        TabularDataset(train_tensors),
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,
        pin_memory=(device.type == "cuda"),
    )
    val_loader = DataLoader(
        TabularDataset(val_tensors),
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=(device.type == "cuda"),
    )
    test_loader = DataLoader(
        TabularDataset(test_tensors),
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=(device.type == "cuda"),
    )

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    loss_fn = nn.BCEWithLogitsLoss()

    scaler = torch.cuda.amp.GradScaler(enabled=(args.amp and device.type == "cuda"))

    best_val_auc = -1.0
    best_path = run_dir / "best_model.pt"

    config = {
        "data_dir": str(args.data_dir),
        "dataset": meta.get("dataset"),
        "device": str(device),
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "lr": args.lr,
        "weight_decay": args.weight_decay,
        "d_token": args.d_token,
        "n_heads": args.n_heads,
        "n_layers": args.n_layers,
        "d_ff": args.d_ff,
        "dropout": args.dropout,
        "seed": args.seed,
        "amp": bool(args.amp),
        "timestamp": int(time.time()),
    }
    write_json(run_dir / "config.json", config)

    for epoch in range(1, args.epochs + 1):
        model.train()
        pbar = tqdm(train_loader, desc=f"epoch {epoch}/{args.epochs}")
        running = 0.0
        for batch in pbar:
            x_num = batch["x_num"].to(device)
            x_cat = batch["x_cat"].to(device)
            y = batch["y"].to(device)

            opt.zero_grad(set_to_none=True)

            with torch.cuda.amp.autocast(enabled=(args.amp and device.type == "cuda")):
                logits = model(x_num=x_num, x_cat=x_cat)
                loss = loss_fn(logits, y)

            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()

            running += float(loss.item())
            pbar.set_postfix(loss=running / max(1, pbar.n))

        val_m = eval_split(model, val_loader, device)
        write_json(run_dir / "metrics_val.json", {"epoch": epoch, **val_m})

        val_auc = val_m.get("roc_auc")
        if val_auc is not None and not np.isnan(val_auc) and val_auc > best_val_auc:
            best_val_auc = float(val_auc)
            torch.save({"model": model.state_dict(), "meta": meta, "config": config}, best_path)

    # Final test eval using best checkpoint (if present)
    if best_path.exists():
        ckpt = torch.load(best_path, map_location=device)
        model.load_state_dict(ckpt["model"])

    test_m = eval_split(model, test_loader, device)
    write_json(run_dir / "metrics_test.json", test_m)

    print(f"Done. Best val roc_auc={best_val_auc:.4f}. Checkpoint: {best_path}")


if __name__ == "__main__":
    main()
