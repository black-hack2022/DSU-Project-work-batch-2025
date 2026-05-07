from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from .model import MLPAutoencoder, reconstruction_mse


@dataclass
class TrainConfig:
    epochs: int = 50
    batch_size: int = 2048
    lr: float = 1e-3
    weight_decay: float = 1e-5
    hidden_dims: Tuple[int, ...] = (256, 128)
    latent_dim: int = 32
    dropout: float = 0.0
    seed: int = 42
    device: str | None = None


def _device_from_config(cfg: TrainConfig) -> torch.device:
    if cfg.device:
        return torch.device(cfg.device)
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def train_autoencoder(
    x_train: np.ndarray,
    x_val: np.ndarray,
    *,
    cfg: TrainConfig,
) -> tuple[nn.Module, Dict[str, float]]:
    torch.manual_seed(cfg.seed)
    np.random.seed(cfg.seed)

    device = _device_from_config(cfg)

    xtr = torch.from_numpy(x_train).to(device)
    xva = torch.from_numpy(x_val).to(device)

    model = MLPAutoencoder(
        input_dim=x_train.shape[1],
        hidden_dims=list(cfg.hidden_dims),
        latent_dim=cfg.latent_dim,
        dropout=cfg.dropout,
    ).to(device)

    opt = torch.optim.AdamW(model.parameters(), lr=cfg.lr, weight_decay=cfg.weight_decay)
    loss_fn = nn.MSELoss(reduction="mean")

    dl = DataLoader(TensorDataset(xtr), batch_size=cfg.batch_size, shuffle=True, drop_last=False)

    best_val = float("inf")
    best_state = None

    for epoch in range(1, cfg.epochs + 1):
        model.train()
        running = 0.0
        n_seen = 0
        for (xb,) in dl:
            opt.zero_grad(set_to_none=True)
            recon = model(xb)
            loss = loss_fn(recon, xb)
            loss.backward()
            opt.step()
            running += float(loss.detach().cpu()) * xb.shape[0]
            n_seen += xb.shape[0]

        train_loss = running / max(1, n_seen)

        model.eval()
        with torch.no_grad():
            recon_val = model(xva)
            val_loss = float(loss_fn(recon_val, xva).detach().cpu())

        if val_loss < best_val - 1e-8:
            best_val = val_loss
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

        if epoch == 1 or epoch % 5 == 0 or epoch == cfg.epochs:
            print(f"Epoch {epoch:03d} | train={train_loss:.6f} | val={val_loss:.6f}")

    if best_state is not None:
        model.load_state_dict(best_state)

    metrics = {"best_val_loss": float(best_val)}
    return model, metrics


def choose_threshold(scores_normal: np.ndarray, *, method: str = "p99_5") -> Dict[str, float]:
    scores = np.asarray(scores_normal, dtype=np.float64)

    if method.startswith("p"):
        # e.g. p99_5 => 99.5
        pct_str = method[1:].replace("_", ".")
        pct = float(pct_str)
        thr = float(np.percentile(scores, pct))
        return {"method": method, "percentile": pct, "threshold": thr}

    if method == "mean_plus_3std":
        mu = float(scores.mean())
        sd = float(scores.std())
        thr = mu + 3.0 * sd
        return {"method": method, "mean": mu, "std": sd, "threshold": float(thr)}

    raise ValueError(f"Unknown threshold method: {method}")


def score_array(model: nn.Module, x: np.ndarray, *, device: torch.device, batch_size: int = 4096) -> np.ndarray:
    xt = torch.from_numpy(x).to(device)
    return reconstruction_mse(model, xt, batch_size=batch_size)
