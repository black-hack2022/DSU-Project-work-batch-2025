from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split


def clean_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    return df


def _safe_numeric_frame(df: pd.DataFrame, cols: List[str]) -> pd.DataFrame:
    num = df[cols].apply(pd.to_numeric, errors="coerce")
    num = num.replace([np.inf, -np.inf], np.nan)
    return num


def split_normal_only(
    df: pd.DataFrame,
    *,
    label_col: str = "label",
    normal_value: int | float = 0,
    val_size: float = 0.2,
    seed: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series | None]:
    """Return (train_normal_df, val_normal_df, y_all).

    If label_col exists, y_all is returned for later eval; otherwise y_all=None.
    """

    df = df.copy()
    y_all: pd.Series | None = None
    if label_col in df.columns:
        y_all = df[label_col]
        normal_mask = df[label_col].astype(float) == float(normal_value)
        df = df.loc[normal_mask].drop(columns=[label_col])
    else:
        # Unlabeled: treat everything as normal.
        df = df

    if len(df) < 10:
        raise ValueError(f"Not enough normal rows to train: {len(df)}")

    tr, va = train_test_split(df, test_size=val_size, random_state=seed)
    return tr.reset_index(drop=True), va.reset_index(drop=True), y_all


@dataclass
class TabularPreprocessor:
    """Simple numeric standardization + categorical integer encoding.

    - Numeric: median-impute NaNs then z-score using train stats.
    - Categorical: map strings to ints; 0 reserved for UNK.

    This is intentionally light-weight and JSON-serializable.
    """

    cat_cols: List[str]
    num_cols: List[str]

    num_mean: Optional[np.ndarray] = None
    num_std: Optional[np.ndarray] = None
    num_median: Optional[np.ndarray] = None

    cat_maps: Optional[Dict[str, Dict[str, int]]] = None

    @classmethod
    def from_dataframe(
        cls,
        df: pd.DataFrame,
        *,
        cat_cols: Optional[List[str]] = None,
        drop_cols: Optional[List[str]] = None,
    ) -> "TabularPreprocessor":
        if drop_cols:
            df = df.drop(columns=[c for c in drop_cols if c in df.columns])

        inferred_cat = [c for c in df.columns if df[c].dtype == object]
        use_cat = list(cat_cols) if cat_cols is not None else inferred_cat
        use_num = [c for c in df.columns if c not in use_cat]
        return cls(cat_cols=use_cat, num_cols=use_num)

    def fit(self, df_train: pd.DataFrame) -> None:
        df_train = df_train.copy()

        num = _safe_numeric_frame(df_train, self.num_cols)
        self.num_median = np.nanmedian(num.to_numpy(dtype=np.float64, copy=True), axis=0)
        self.num_median = np.where(np.isnan(self.num_median), 0.0, self.num_median)

        filled = num.to_numpy(dtype=np.float64, copy=True)
        inds = np.isnan(filled)
        filled[inds] = np.take(self.num_median, np.where(inds)[1])

        self.num_mean = filled.mean(axis=0)
        self.num_std = filled.std(axis=0)
        self.num_mean = np.where(np.isnan(self.num_mean), 0.0, self.num_mean)
        self.num_std = np.where(np.isnan(self.num_std) | (self.num_std < 1e-12), 1.0, self.num_std)

        maps: Dict[str, Dict[str, int]] = {}
        for col in self.cat_cols:
            vals = df_train[col].astype(str).fillna("").str.strip()
            uniq = sorted(set(vals.tolist()))
            mapping = {"__UNK__": 0}
            for i, v in enumerate(uniq, start=1):
                mapping[v] = i
            maps[col] = mapping
        self.cat_maps = maps

    def transform(self, df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        if self.num_mean is None or self.num_std is None or self.num_median is None or self.cat_maps is None:
            raise RuntimeError("Preprocessor must be fit() before transform().")

        df = df.copy()

        num = _safe_numeric_frame(df, self.num_cols)
        x_num = num.to_numpy(dtype=np.float64, copy=True)
        inds = np.isnan(x_num)
        x_num[inds] = np.take(self.num_median, np.where(inds)[1])
        x_num = (x_num - self.num_mean) / self.num_std
        x_num = x_num.astype(np.float32)

        if len(self.cat_cols) == 0:
            x_cat = np.zeros((len(df), 0), dtype=np.int64)
        else:
            mats = []
            for col in self.cat_cols:
                mapping = self.cat_maps[col]
                vals = df[col].astype(str).fillna("").str.strip().tolist()
                encoded = [mapping.get(v, 0) for v in vals]
                mats.append(np.array(encoded, dtype=np.int64))
            x_cat = np.stack(mats, axis=1)

        return x_num, x_cat

    def cat_cardinalities(self) -> List[int]:
        if self.cat_maps is None:
            raise RuntimeError("Preprocessor must be fit() before cat_cardinalities().")
        return [max(m.values()) + 1 for m in (self.cat_maps[c] for c in self.cat_cols)]

    def to_json_dict(self) -> Dict[str, Any]:
        if self.num_mean is None or self.num_std is None or self.num_median is None or self.cat_maps is None:
            raise RuntimeError("Preprocessor must be fit() before serialization.")
        return {
            "cat_cols": list(self.cat_cols),
            "num_cols": list(self.num_cols),
            "num_mean": np.asarray(self.num_mean, dtype=np.float64).tolist(),
            "num_std": np.asarray(self.num_std, dtype=np.float64).tolist(),
            "num_median": np.asarray(self.num_median, dtype=np.float64).tolist(),
            "cat_maps": {str(c): {str(k): int(v) for k, v in m.items()} for c, m in self.cat_maps.items()},
        }

    @classmethod
    def from_json_dict(cls, state: Dict[str, Any]) -> "TabularPreprocessor":
        pre = cls(cat_cols=list(state["cat_cols"]), num_cols=list(state["num_cols"]))
        pre.num_mean = np.array(state["num_mean"], dtype=np.float64)
        pre.num_std = np.array(state["num_std"], dtype=np.float64)
        pre.num_median = np.array(state["num_median"], dtype=np.float64)
        pre.cat_maps = {str(c): {str(k): int(v) for k, v in m.items()} for c, m in state["cat_maps"].items()}
        return pre


def one_hot_cats(x_cat: np.ndarray, cardinalities: List[int]) -> np.ndarray:
    """One-hot encode categorical integer matrix.

    x_cat: (N, C) with values in [0, cardinality-1]
    Returns: (N, sum(cardinalities)) float32
    """

    if x_cat.size == 0:
        return np.zeros((x_cat.shape[0], 0), dtype=np.float32)

    if x_cat.shape[1] != len(cardinalities):
        raise ValueError(f"x_cat has {x_cat.shape[1]} cols but {len(cardinalities)} cardinalities provided")

    parts: list[np.ndarray] = []
    for j, card in enumerate(cardinalities):
        col = x_cat[:, j]
        oh = np.zeros((x_cat.shape[0], card), dtype=np.float32)
        valid = (col >= 0) & (col < card)
        rows = np.arange(x_cat.shape[0])[valid]
        oh[rows, col[valid]] = 1.0
        parts.append(oh)

    return np.concatenate(parts, axis=1)
