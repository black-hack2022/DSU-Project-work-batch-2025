# Paper Evaluation Outputs

This evaluation uses the existing `train`/`val` split from `service_predictions_with_split.csv`.

## Key outputs
- `paper_noleak_roc_val.png` (Our GNN ROC on validation)
- `paper_noleak_roc_compare_val.png` (Our GNN vs baselines)
- `paper_noleak_roc_all_ours.png` (Our GNN ROC on all services; descriptive)
- `paper_noleak_metrics_val.csv` and `paper_noleak_metrics_val.tex` (comparison table)
- `paper_noleak_roc_points_val.csv` (ROC points for reproducibility)

## Notes
- Random seed: 42
- Baselines trained on `train` split and evaluated on `val` split
- Our-GNN validation AUC: 1.0

## Cross-validation outputs
- `paper_noleak_metrics_cv.csv` and `paper_noleak_metrics_cv.tex` (pooled 5-fold CV metrics)
- `paper_noleak_metrics_cv_folds.csv` (per-fold AUC/accuracy)
- `paper_noleak_roc_compare_cv.png` (pooled ROC from out-of-fold scores)
