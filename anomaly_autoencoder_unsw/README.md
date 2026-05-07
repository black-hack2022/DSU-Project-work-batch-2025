# UNSW-NB15 Autoencoder Anomaly Detection (Zero-day / Unknown attacks)

This module trains an **Autoencoder on NORMAL traffic only**, then flags **unusual / out-of-distribution** flows using **reconstruction error**.

It’s designed to be **copied to a GPU machine**, trained there, then you copy back only the small `artifacts/` outputs.

## What it produces

- Per-flow anomaly scoring:
  - `anomaly_score` = reconstruction MSE
  - `is_anomaly` = `anomaly_score > threshold`
- GNN integration outputs (optional):
  - `service_stats.csv` with `attack_rate = anomaly_rate` (for your existing GNN pipeline)
  - `service_protocol_graph.gpickle`

## Folder layout

- `scripts/train_unsw_autoencoder.py` — training + threshold + metrics + `test_scored.csv`
- `scripts/score_csv.py` — score any CSV using trained artifacts
- `scripts/make_gnn_inputs_from_scored.py` — aggregate scored flows → `service_stats.csv` + graph
- `artifacts/` — where model + preprocessing + threshold are stored
- `data/` — optional place to put dataset files locally

## Dataset (UNSW-NB15)

You need the official CSVs:
- `UNSW_NB15_training-set.csv`
- `UNSW_NB15_testing-set.csv`

Put them in `data/` or pass `--data_dir` pointing to wherever they are.

In this repo, these two CSVs already exist under `transformer_tabular/archive/` and were copied into `anomaly_autoencoder_unsw/data/` so the module can be transferred as-is.

## Train on another machine (recommended)

1) Copy this whole folder to the GPU machine:
- Copy `anomaly_autoencoder_unsw/` to the other computer.

2) Create environment + install deps:

Windows PowerShell:

```powershell
python -m venv .venv
& .\.venv\Scripts\Activate.ps1
python -m pip install -U pip
pip install -r requirements.txt
```

Install an appropriate **CUDA-enabled** PyTorch build if you have GPU.

3) Train (example using extracted CSVs in `data/`):

```powershell
python scripts\train_unsw_autoencoder.py --data_dir data --out_dir artifacts\unsw_ae --epochs 50 --threshold_method p99_5 --device cuda
```

Outputs written to `artifacts/`:
- `model.pt`
- `preprocessor.json`
- `meta.json`
- `threshold.json`
- `metrics.json`
- `test_scored.csv`

4) Copy back ONLY the artifacts folder to your laptop:
- `anomaly_autoencoder_unsw/artifacts/unsw_ae/*`

Optional: zip artifacts for easy transfer:

```powershell
Compress-Archive -Path .\artifacts\unsw_ae\* -DestinationPath .\unsw_ae_artifacts.zip -Force
```

## Score flows (inference)

```bash
python scripts/score_csv.py --model_dir artifacts --input_csv path/to/new_flows.csv --output_csv scored_flows.csv
```

## Feed into your existing GNN + X-TIS pipeline

Your current GNN pipeline expects:
- `service_stats.csv`
- `service_protocol_graph.gpickle`

Build them from the scored UNSW flows:

```bash
python scripts/make_gnn_inputs_from_scored.py --scored_csv scored_flows.csv --out_dir gnn_inputs
```

Then run your existing training/inference pointing to that folder:

```bash
python ..\train_eval_gnn_noleak.py --root gnn_inputs
python ..\quick_detection.py
python ..\x_tis.py
```

(If you copy `gnn_inputs/` next to those scripts, you can also just `--root` it.)

## Notes / knobs

- Thresholding:
  - `p99_5` is a good starting point (flags ~0.5% of normal validation as anomalies)
  - Use `p99_9` for fewer alerts
- The model uses numeric z-scoring + categorical one-hot; it’s robust and portable but not the most compact.

## Quick sanity checks (recommended)

Training can be *very fast* on a GPU because the model is a small MLP and it trains only on the NORMAL subset.

To see the precision/recall trade-off for different thresholds **without retraining** (uses `test_scored.csv`):

```powershell
python scripts\eval_scored_thresholds.py --scored_csv artifacts\unsw_ae\test_scored.csv
```

If you want higher recall (catch more attacks), pick a lower percentile (more alerts). For fewer false alarms, pick a higher percentile.
