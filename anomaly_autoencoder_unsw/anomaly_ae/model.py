from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List

import numpy as np
import torch
from torch import nn


class MLPAutoencoder(nn.Module):
    def __init__(
        self,
        input_dim: int,
        hidden_dims: List[int],
        latent_dim: int,
        dropout: float = 0.0,
    ):
        super().__init__()

        if input_dim <= 0:
            raise ValueError("input_dim must be > 0")

        enc_layers: list[nn.Module] = []
        prev = input_dim
        for h in hidden_dims:
            enc_layers.append(nn.Linear(prev, h))
            enc_layers.append(nn.ReLU())
            if dropout and dropout > 0:
                enc_layers.append(nn.Dropout(dropout))
            prev = h
        enc_layers.append(nn.Linear(prev, latent_dim))
        self.encoder = nn.Sequential(*enc_layers)

        dec_layers: list[nn.Module] = []
        prev = latent_dim
        for h in reversed(hidden_dims):
            dec_layers.append(nn.Linear(prev, h))
            dec_layers.append(nn.ReLU())
            if dropout and dropout > 0:
                dec_layers.append(nn.Dropout(dropout))
            prev = h
        dec_layers.append(nn.Linear(prev, input_dim))
        self.decoder = nn.Sequential(*dec_layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        z = self.encoder(x)
        return self.decoder(z)


@dataclass
class BatchScores:
    recon_mse: np.ndarray


@torch.no_grad()
def reconstruction_mse(model: nn.Module, x: torch.Tensor, *, batch_size: int = 4096) -> np.ndarray:
    """Per-row reconstruction MSE."""

    model.eval()
    n = x.shape[0]
    out = np.empty((n,), dtype=np.float32)

    for start in range(0, n, batch_size):
        end = min(n, start + batch_size)
        xb = x[start:end]
        recon = model(xb)
        mse = torch.mean((recon - xb) ** 2, dim=1)
        out[start:end] = mse.detach().cpu().numpy().astype(np.float32)

    return out
