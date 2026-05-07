from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

import torch

from .model import MLPAutoencoder
from .preprocessing import TabularPreprocessor


def save_json(path: Path, obj: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2), encoding="utf-8")


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_preprocessor(path: Path, pre: TabularPreprocessor) -> None:
    save_json(path, pre.to_json_dict())


def load_preprocessor(path: Path) -> TabularPreprocessor:
    return TabularPreprocessor.from_json_dict(load_json(path))


def save_model_state(path: Path, state: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(state, path)


def load_model_state(path: Path) -> Dict[str, Any]:
    try:
        return torch.load(path, weights_only=True)
    except TypeError:
        return torch.load(path)
