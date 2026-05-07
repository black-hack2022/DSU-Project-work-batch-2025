from __future__ import annotations

from typing import Dict

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    average_precision_score,
)


def binary_metrics(y_true: np.ndarray, logits: np.ndarray) -> Dict[str, float]:
    y_true = y_true.astype(int)
    prob = 1.0 / (1.0 + np.exp(-logits))
    pred = (prob >= 0.5).astype(int)

    out: Dict[str, float] = {
        "accuracy": float(accuracy_score(y_true, pred)),
        "precision": float(precision_score(y_true, pred, zero_division=0)),
        "recall": float(recall_score(y_true, pred, zero_division=0)),
        "f1": float(f1_score(y_true, pred, zero_division=0)),
    }

    # AUCs can fail if only 1 class present
    try:
        out["roc_auc"] = float(roc_auc_score(y_true, prob))
    except Exception:
        out["roc_auc"] = float("nan")

    try:
        out["pr_auc"] = float(average_precision_score(y_true, prob))
    except Exception:
        out["pr_auc"] = float("nan")

    return out
