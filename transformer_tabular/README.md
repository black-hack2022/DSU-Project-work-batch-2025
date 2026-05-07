# Tabular Transformer training (CICIDS2017 + UNSW-NB15)

This folder is self-contained and intended to be copied to a GPU machine.

## 1) Install

```bash
python -m venv .venv
# Windows
.\.venv\Scripts\activate

# Install CUDA-enabled PyTorch (pick one index URL).
# For most modern NVIDIA drivers, cu124 works well.
pip install --index-url https://download.pytorch.org/whl/cu124 torch torchvision torchaudio

pip install -r requirements.txt

python check_env.py
```

## 2) Preprocess from the provided zip archives

These scripts can read directly from the zip files (no manual extraction required).

They can also read from extracted folders (useful if you already unzipped them).

### UNSW-NB15 (binary label)

From the repo root (where `archive.zip` exists):

```bash
python transformer_tabular/scripts/preprocess_unsw_nb15.py --zip_path archive.zip --out_dir transformer_tabular/data/processed/unsw_nb15
```

If extracted under `transformer_tabular/archive/`:

```bash
python transformer_tabular/scripts/preprocess_unsw_nb15.py --data_dir transformer_tabular/archive --out_dir transformer_tabular/data/processed/unsw_nb15
```

### CICIDS2017 (binary: BENIGN vs ATTACK)

From the repo root (where `archive (1).zip` exists):

```bash
python transformer_tabular/scripts/preprocess_cicids2017.py --zip_path "archive (1).zip" --out_dir transformer_tabular/data/processed/cicids2017
```

If extracted under `transformer_tabular/archive (1)/combinenew.csv`:

```bash
python transformer_tabular/scripts/preprocess_cicids2017.py --data_dir "transformer_tabular/archive (1)" --out_dir transformer_tabular/data/processed/cicids2017
```

## 3) Train FT-Transformer

```bash
python transformer_tabular/train.py --data_dir transformer_tabular/data/processed/unsw_nb15 --run_dir transformer_tabular/runs/unsw_nb15
python transformer_tabular/train.py --data_dir transformer_tabular/data/processed/cicids2017 --run_dir transformer_tabular/runs/cicids2017
```

## 4) Evaluate

```bash
python transformer_tabular/evaluate.py --data_dir transformer_tabular/data/processed/unsw_nb15 --checkpoint transformer_tabular/runs/unsw_nb15/best_model.pt
```

## 5) Fusion: Transformer + GNN (UNSW service graph)

This uses the trained Transformer to generate per-flow attack probabilities, aggregates them into per-`service` node features, builds a service graph via shared `proto`, and trains a small GCN to classify risky services.

```bash
python transformer_tabular/fusion_gnn_unsw.py \
	--data_dir transformer_tabular/data/processed/unsw_nb15 \
	--transformer_ckpt transformer_tabular/runs/unsw_nb15/best_model.pt \
	--out_dir transformer_tabular/runs/fusion_unsw_gnn
```

## 6) KDD: Train Transformer and fuse with GNN

This is the most direct way to combine the Transformer with the original service/protocol GNN workflow.

### 6.1 Preprocess KDD

From repo root (expects `kdd_preprocessed.csv`):

```bash
python transformer_tabular/scripts/preprocess_kdd.py --csv_path kdd_preprocessed.csv --out_dir transformer_tabular/data/processed/kdd
```

### 6.2 Train KDD Transformer

```bash
python transformer_tabular/train.py --data_dir transformer_tabular/data/processed/kdd --run_dir transformer_tabular/runs/kdd --epochs 10 --batch_size 2048 --amp
```

### 6.3 Fuse Transformer + GNN (service graph)

```bash
python transformer_tabular/fusion_gnn_kdd.py \
	--data_dir transformer_tabular/data/processed/kdd \
	--vocab_json transformer_tabular/data/processed/kdd/vocab.json \
	--transformer_ckpt transformer_tabular/runs/kdd/best_model.pt \
	--out_dir transformer_tabular/runs/fusion_kdd_gnn
```

## 7) KDD threat detection (risk + category)

This generates a per-row detection CSV using:
- Transformer per-flow probability
- Optional fusion GNN per-service probability (if available)
- Best-effort category mapping for network-flow threats (C–H style categories)

Note: Spam/phishing and malicious URL detection (A–B) require email/content and URL/domain telemetry and are not inferable from KDD flow/service features alone.

```bash
python transformer_tabular/detect_kdd_threats.py \
	--input_csv kdd_preprocessed.csv \
	--processed_dir transformer_tabular/data/processed/kdd \
	--transformer_ckpt transformer_tabular/runs/kdd/best_model.pt \
	--fusion_service_preds transformer_tabular/runs/fusion_kdd_gnn/fusion_service_predictions.csv \
	--out_csv transformer_tabular/runs/kdd_threat_detections.csv
```

## Notes

- Default task is **binary classification**.
- Training uses `cuda` automatically if available.
- Outputs: model checkpoint + `metrics_val.json` / `metrics_test.json` in the run directory.
