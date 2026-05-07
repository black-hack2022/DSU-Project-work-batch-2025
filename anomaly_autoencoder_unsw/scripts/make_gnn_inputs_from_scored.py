from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow running this script from a copied folder without installing as a package.
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from anomaly_ae.gnn_adapter import write_gnn_inputs_from_scored_flows


def main() -> None:
    ap = argparse.ArgumentParser(description="Build GNN inputs (service_stats.csv + graph) from scored UNSW flows")
    ap.add_argument("--scored_csv", type=str, required=True, help="CSV containing is_anomaly column")
    ap.add_argument("--out_dir", type=str, required=True)
    ap.add_argument("--anomaly_flag_col", type=str, default="is_anomaly")
    args = ap.parse_args()

    out_dir = write_gnn_inputs_from_scored_flows(
        scored_csv=Path(args.scored_csv),
        out_dir=Path(args.out_dir),
        anomaly_flag_col=str(args.anomaly_flag_col),
    )
    print(f"Wrote GNN inputs to: {out_dir}")


if __name__ == "__main__":
    main()
