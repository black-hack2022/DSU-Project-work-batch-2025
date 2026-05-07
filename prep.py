import pandas as pd
from pathlib import Path


def load_df(filename: str = 'KDDTrain+.txt') -> pd.DataFrame:
	"""Load the KDD training file and return a DataFrame.

	Uses comma as separator (this dataset uses comma-separated values).
	"""
	p = Path(filename)
	if not p.exists():
		raise FileNotFoundError(f"Input file not found: {p.resolve()}")
	df = pd.read_csv(p, sep=',', header=None)
	return df


if __name__ == '__main__':
	df = load_df()
	print("Shape:", df.shape)
	print(df.head())

