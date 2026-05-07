import json
from pathlib import Path
import ast

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pandas as pd


def load_shap_outputs(out_dir='x_tis_outputs'):
    out_dir = Path(out_dir)
    jpath = out_dir / 'x_tis_outputs_shap.json'
    csvpath = out_dir / 'x_tis_outputs_shap.csv'
    if jpath.exists():
        with open(jpath, 'r') as fh:
            data = json.load(fh)
        return data
    if csvpath.exists():
        df = pd.read_csv(csvpath)
        rows = []
        for _, r in df.iterrows():
            # shap_top_features is stored as string repr -> try ast.literal_eval
            try:
                feats = ast.literal_eval(r['shap_top_features'])
            except Exception:
                feats = []
            rows.append({'service': r['service'], 'prob': float(r['prob']), 'true': int(r['true']), 'shap_top_features': feats, 'subgraph_png': r['subgraph_png']})
        return rows
    raise FileNotFoundError('No SHAP outputs found in ' + str(out_dir))


def make_annotated_png(entry, out_dir='x_tis_outputs', fontsize=10):
    out_dir = Path(out_dir)
    service = entry['service']
    prob = entry.get('prob', None)
    true = entry.get('true', None)
    shap_feats = entry.get('shap_top_features', [])
    subgraph_png = Path(entry.get('subgraph_png', ''))

    fig = plt.figure(figsize=(10, 5))
    gs = fig.add_gridspec(1, 2, width_ratios=[1.2, 1])

    # left: subgraph image
    ax0 = fig.add_subplot(gs[0])
    try:
        img = plt.imread(subgraph_png)
        ax0.imshow(img)
    except Exception:
        ax0.text(0.5, 0.5, 'Subgraph image not found', ha='center', va='center')
    ax0.axis('off')
    ax0.set_title(f'{service} (p={prob:.3f})', fontsize=fontsize+2)

    # right: bar chart of SHAP importances and explanation text
    ax1 = fig.add_subplot(gs[1])
    feat_names = [f[0] for f in shap_feats]
    feat_vals = [abs(float(f[1])) for f in shap_feats]
    if len(feat_names) > 0 and sum(feat_vals) > 0:
        y_pos = range(len(feat_names))
        ax1.barh(y_pos, feat_vals, color='C1')
        ax1.set_yticks(y_pos)
        ax1.set_yticklabels(feat_names)
        ax1.invert_yaxis()
        ax1.set_xlabel('SHAP abs value')
    else:
        ax1.text(0.5, 0.6, 'No SHAP importances', ha='center')

    # add explanation text box below chart
    explanation = entry.get('explanation') or ''
    expl_text = f"Top features: {', '.join([f'{n} ({v:.3f})' for n, v in shap_feats])}\nTrue label: {true}\nProb: {prob:.3f}\n\n{explanation}"
    fig.text(0.55, 0.05, expl_text, wrap=True, fontsize=fontsize)

    out_path = out_dir / f'annotated_shap_{service}.png'
    plt.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    return out_path


def run_all(out_dir='x_tis_outputs'):
    entries = load_shap_outputs(out_dir)
    out_dir = Path(out_dir)
    annotated = []
    for e in entries:
        p = make_annotated_png(e, out_dir=out_dir)
        annotated.append(str(p))
    # write a summary CSV
    summary = []
    for e in entries:
        summary.append({'service': e['service'], 'prob': e.get('prob'), 'true': e.get('true'), 'top_shap': ';'.join([f'{n}:{v:.4f}' for n, v in e.get('shap_top_features', [])])})
    pd.DataFrame(summary).to_csv(Path(out_dir) / 'x_tis_shap_readable_summary.csv', index=False)
    print('Created', len(annotated), 'annotated PNGs in', out_dir)
    return annotated


if __name__ == '__main__':
    annotated = run_all('x_tis_outputs')
    print('Example annotated files:', annotated[:5])
