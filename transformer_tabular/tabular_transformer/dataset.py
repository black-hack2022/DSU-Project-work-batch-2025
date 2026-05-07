from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Tuple

import torch
from torch.utils.data import Dataset


@dataclass
class TabularTensors:
    x_num: torch.Tensor  # float32 (N, n_num)
    x_cat: torch.Tensor  # int64 (N, n_cat)
    y: torch.Tensor      # float32 (N,) for binary


class TabularDataset(Dataset):
    def __init__(self, tensors: TabularTensors):
        self.tensors = tensors

    def __len__(self) -> int:
        return self.tensors.y.shape[0]

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        return {
            "x_num": self.tensors.x_num[idx],
            "x_cat": self.tensors.x_cat[idx],
            "y": self.tensors.y[idx],
        }


def load_split(split_dir: str | Path) -> Tuple[TabularTensors, Dict]:
    split_dir = Path(split_dir)
    meta = torch.load(split_dir / "meta.pt")
    tensors = torch.load(split_dir / "tensors.pt")
    return TabularTensors(**tensors), meta
