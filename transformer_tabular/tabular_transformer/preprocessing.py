from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split


def clean_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    return df


def binary_labels_from_string(series: pd.Series, benign_value: str = "BENIGN") -> np.ndarray:
    s = series.astype(str).str.strip().str.upper()
    benign = benign_value.strip().upper()
    y = (s != benign).astype(np.float32).to_numpy()
    return y


def stratified_split(
    X: pd.DataFrame,
    y: np.ndarray,
    val_size: float,
    test_size: float = 0.0,
    seed: int = 42,
) -> Tuple[Tuple[pd.DataFrame, np.ndarray], Tuple[pd.DataFrame, np.ndarray], Optional[Tuple[pd.DataFrame, np.ndarray]]]:
    if test_size > 0:
        X_train, X_tmp, y_train, y_tmp = train_test_split(
            X, y, test_size=val_size + test_size, random_state=seed, stratify=y
        )
        rel_test = test_size / (val_size + test_size)
        X_val, X_test, y_val, y_test = train_test_split(
            X_tmp, y_tmp, test_size=rel_test, random_state=seed, stratify=y_tmp
        )
        return (X_train, y_train), (X_val, y_val), (X_test, y_test)

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=val_size, random_state=seed, stratify=y
    )
    return (X_train, y_train), (X_val, y_val), None


@dataclass
class TabularPreprocessor:
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
        cat_cols: Optional[List[str]] = None,
        label_col: Optional[str] = None,
    ) -> "TabularPreprocessor":
        if label_col is not None and label_col in df.columns:
            df = df.drop(columns=[label_col])
        inferred_cat = [c for c in df.columns if df[c].dtype == object]
        use_cat = cat_cols if cat_cols is not None else inferred_cat
        use_num = [c for c in df.columns if c not in use_cat]
        return cls(cat_cols=list(use_cat), num_cols=list(use_num))

    def fit(self, df_train: pd.DataFrame) -> None:
        df_train = df_train.copy()

        # Numeric stats
        num = df_train[self.num_cols].apply(pd.to_numeric, errors="coerce")
        num = num.replace([np.inf, -np.inf], np.nan)
        self.num_median = np.nanmedian(num.to_numpy(dtype=np.float64, copy=True), axis=0)
        # If a column is entirely NaN, nanmedian returns NaN; fall back to 0.
        self.num_median = np.where(np.isnan(self.num_median), 0.0, self.num_median)

        filled = num.to_numpy(dtype=np.float64, copy=True)
        inds = np.isnan(filled)
        filled[inds] = np.take(self.num_median, np.where(inds)[1])
        self.num_mean = filled.mean(axis=0)
        self.num_std = filled.std(axis=0)
        self.num_mean = np.where(np.isnan(self.num_mean), 0.0, self.num_mean)
        self.num_std = np.where(np.isnan(self.num_std) | (self.num_std < 1e-12), 1.0, self.num_std)

        # Categorical maps (0 reserved for UNK)
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

        # Numeric
        num = df[self.num_cols].apply(pd.to_numeric, errors="coerce")
        num = num.replace([np.inf, -np.inf], np.nan)
        x_num = num.to_numpy(dtype=np.float64, copy=True)
        inds = np.isnan(x_num)
        x_num[inds] = np.take(self.num_median, np.where(inds)[1])
        x_num = (x_num - self.num_mean) / self.num_std
        x_num = x_num.astype(np.float32)

        # Categorical
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

    def to_state_dict(self) -> Dict:
        if self.num_mean is None or self.num_std is None or self.num_median is None or self.cat_maps is None:
            raise RuntimeError("Preprocessor must be fit() before serialization.")
        return {
            "cat_cols": list(self.cat_cols),
            "num_cols": list(self.num_cols),
            "num_mean": self.num_mean.astype(np.float64),
            "num_std": self.num_std.astype(np.float64),
            "num_median": self.num_median.astype(np.float64),
            "cat_maps": self.cat_maps,
        }

    def to_json_dict(self) -> Dict:
        state = self.to_state_dict()
        # Convert numpy arrays to plain lists for safe JSON serialization
        state["num_mean"] = np.asarray(state["num_mean"], dtype=np.float64).tolist()
        state["num_std"] = np.asarray(state["num_std"], dtype=np.float64).tolist()
        state["num_median"] = np.asarray(state["num_median"], dtype=np.float64).tolist()
        # Ensure cat_maps is JSON-friendly (ints + strings)
        cat_maps = {}
        for col, mapping in state["cat_maps"].items():
            cat_maps[str(col)] = {str(k): int(v) for k, v in mapping.items()}
        state["cat_maps"] = cat_maps
        return state

    @classmethod
    def from_state_dict(cls, state: Dict) -> "TabularPreprocessor":
        pre = cls(cat_cols=list(state["cat_cols"]), num_cols=list(state["num_cols"]))
        pre.num_mean = np.array(state["num_mean"], dtype=np.float64)
        pre.num_std = np.array(state["num_std"], dtype=np.float64)
        pre.num_median = np.array(state["num_median"], dtype=np.float64)
        pre.cat_maps = state["cat_maps"]
        return pre

    @classmethod
    def from_json_dict(cls, state: Dict) -> "TabularPreprocessor":
        # cat_maps keys are strings; values are int ids
        state = dict(state)
        state["cat_maps"] = {str(c): {str(k): int(v) for k, v in m.items()} for c, m in state["cat_maps"].items()}
        return cls.from_state_dict(state)
        