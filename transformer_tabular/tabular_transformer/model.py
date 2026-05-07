from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import torch
import torch.nn as nn


class TransformerBlock(nn.Module):
    def __init__(self, d_token: int, n_heads: int, d_ff: int, dropout: float):
        super().__init__()
        self.ln1 = nn.LayerNorm(d_token)
        self.attn = nn.MultiheadAttention(
            embed_dim=d_token,
            num_heads=n_heads,
            dropout=dropout,
            batch_first=True,
        )
        self.drop1 = nn.Dropout(dropout)

        self.ln2 = nn.LayerNorm(d_token)
        self.ff = nn.Sequential(
            nn.Linear(d_token, d_ff),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_ff, d_token),
        )
        self.drop2 = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Pre-norm attention
        h = self.ln1(x)
        h, _ = self.attn(h, h, h, need_weights=False)
        x = x + self.drop1(h)

        # Pre-norm FFN
        h = self.ln2(x)
        h = self.ff(h)
        x = x + self.drop2(h)
        return x


class FTTransformer(nn.Module):
    def __init__(
        self,
        n_num: int,
        cat_cardinalities: List[int],
        d_token: int = 192,
        n_heads: int = 8,
        n_layers: int = 4,
        d_ff: int = 384,
        dropout: float = 0.1,
    ):
        super().__init__()
        self.n_num = int(n_num)
        self.n_cat = int(len(cat_cardinalities))
        self.d_token = int(d_token)

        # Numeric feature tokens: x * W + b (per-feature)
        if self.n_num > 0:
            self.num_weight = nn.Parameter(torch.randn(self.n_num, d_token) * 0.02)
            self.num_bias = nn.Parameter(torch.zeros(self.n_num, d_token))
        else:
            self.register_parameter("num_weight", None)
            self.register_parameter("num_bias", None)

        # Categorical embeddings (per-feature)
        self.cat_embeddings = nn.ModuleList(
            [nn.Embedding(int(card), d_token) for card in cat_cardinalities]
        )

        # CLS token
        self.cls_token = nn.Parameter(torch.zeros(1, 1, d_token))

        self.blocks = nn.ModuleList(
            [TransformerBlock(d_token, n_heads, d_ff, dropout) for _ in range(n_layers)]
        )
        self.norm = nn.LayerNorm(d_token)
        self.head = nn.Linear(d_token, 1)  # binary

    def forward(self, x_num: torch.Tensor, x_cat: torch.Tensor) -> torch.Tensor:
        # x_num: (B, n_num) float
        # x_cat: (B, n_cat) long
        B = x_cat.shape[0] if x_cat is not None else x_num.shape[0]

        tokens = []

        if self.n_num > 0:
            # (B, n_num, 1) * (n_num, d) -> (B, n_num, d)
            num_tokens = x_num.unsqueeze(-1) * self.num_weight.unsqueeze(0) + self.num_bias.unsqueeze(0)
            tokens.append(num_tokens)

        if self.n_cat > 0:
            cat_tokens = []
            for i, emb in enumerate(self.cat_embeddings):
                cat_tokens.append(emb(x_cat[:, i]))  # (B, d)
            tokens.append(torch.stack(cat_tokens, dim=1))  # (B, n_cat, d)

        if len(tokens) == 0:
            raise ValueError("FTTransformer requires at least one numeric or categorical feature.")

        x = torch.cat(tokens, dim=1)
        cls = self.cls_token.expand(B, -1, -1)
        x = torch.cat([cls, x], dim=1)

        for block in self.blocks:
            x = block(x)

        x = self.norm(x)
        cls_out = x[:, 0]
        logits = self.head(cls_out).squeeze(-1)
        return logits
