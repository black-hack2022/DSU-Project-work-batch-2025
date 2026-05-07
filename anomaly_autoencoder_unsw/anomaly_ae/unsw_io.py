from __future__ import annotations

import zipfile
from pathlib import Path

import pandas as pd

from .preprocessing import clean_columns


def read_csv_from_zip(zip_path: str, inner_name: str, *, nrows: int | None = None) -> pd.DataFrame:
    with zipfile.ZipFile(zip_path) as z:
        with z.open(inner_name) as f:
            return pd.read_csv(f, nrows=nrows)


def load_unsw_nb15(*, zip_path: str | None, data_dir: str | None, limit_rows: int | None = None) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load official UNSW-NB15 train/test CSVs.

    Provide exactly one of zip_path or data_dir.
    """

    if (zip_path is None) == (data_dir is None):
        raise ValueError("Provide exactly one of zip_path or data_dir")

    if zip_path is not None:
        train_df = read_csv_from_zip(zip_path, "UNSW_NB15_training-set.csv", nrows=limit_rows)
        test_df = read_csv_from_zip(zip_path, "UNSW_NB15_testing-set.csv", nrows=limit_rows)
    else:
        dd = Path(data_dir)
        train_df = pd.read_csv(dd / "UNSW_NB15_training-set.csv", nrows=limit_rows)
        test_df = pd.read_csv(dd / "UNSW_NB15_testing-set.csv", nrows=limit_rows)

    return clean_columns(train_df), clean_columns(test_df)
