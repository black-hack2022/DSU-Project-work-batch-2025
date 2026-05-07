# Paper Tables (No-Leak)

## 5-Fold Cross-Validation (pooled)

| model        |   accuracy |   precision |   recall |    f1 |   auc |
|:-------------|-----------:|------------:|---------:|------:|------:|
| Our-GNN      |      0.929 |       1     |    0.924 | 0.961 | 0.962 |
| NaiveBayes   |      0.7   |       0.979 |    0.697 | 0.814 | 0.826 |
| KNN          |      0.943 |       0.943 |    1     | 0.971 | 0.794 |
| SVM-RBF      |      0.943 |       0.943 |    1     | 0.971 | 0.784 |
| RandomForest |      0.957 |       0.97  |    0.985 | 0.977 | 0.748 |
| LogReg       |      0.943 |       0.943 |    1     | 0.971 | 0.742 |

## Held-out Validation Split

| model        |   accuracy |   precision |   recall |    f1 |   auc |
|:-------------|-----------:|------------:|---------:|------:|------:|
| Our-GNN      |      1     |       1     |     1    | 1     | 1     |
| NaiveBayes   |      0.762 |       1     |     0.75 | 0.857 | 1     |
| LogReg       |      0.952 |       0.952 |     1    | 0.976 | 0.95  |
| KNN          |      0.952 |       0.952 |     1    | 0.976 | 0.95  |
| RandomForest |      0.905 |       0.95  |     0.95 | 0.95  | 0.725 |
| SVM-RBF      |      0.952 |       0.952 |     1    | 0.976 | 0.3   |
