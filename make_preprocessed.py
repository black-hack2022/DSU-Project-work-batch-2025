from first1 import load_df
from col import apply_columns


def main():
    df = load_df('KDDTrain+.txt')
    df = apply_columns(df)
    df['is_attack'] = (df['label'] != 'normal').astype(int)
    out = 'kdd_preprocessed.csv'
    df.to_csv(out, index=False)
    print(f'Saved {out} ({len(df)} rows)')


if __name__ == '__main__':
    main()
