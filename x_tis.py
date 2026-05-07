import pickle
from pathlib import Path
import json

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import networkx as nx
import torch


class SimpleGCN(torch.nn.Module):
    def __init__(self, in_dim, hid_dim, out_dim):
        super().__init__()
        self.w0 = torch.nn.Linear(in_dim, hid_dim, bias=False)
        self.w1 = torch.nn.Linear(hid_dim, out_dim, bias=False)

    def forward(self, x, A_hat):
        x = self.w0(x)
        x = torch.matmul(A_hat, x)
        x = torch.relu(x)
        x = self.w1(x)
        x = torch.matmul(A_hat, x)
        return x


def load_data():
    root = Path('.')
    stats_path = root / 'service_stats.csv'
    graph_path = root / 'service_protocol_graph.gpickle'
    model_path = root / 'gnn_model.pt'
    assert stats_path.exists()
    assert graph_path.exists()
    assert model_path.exists()

    service_stats = pd.read_csv(stats_path, index_col=0)
    services = list(service_stats.index)
    X = service_stats[['src_bytes_mean', 'dst_bytes_mean', 'attack_rate']].values.astype(np.float32)
    y = (service_stats['attack_rate'] > 0).astype(int).values.astype(np.int64)

    with open(graph_path, 'rb') as fh:
        G = pickle.load(fh)

    return services, X, y, G, model_path


def normalize_adj(A):
    A = A + np.eye(A.shape[0], dtype=A.dtype)
    deg = A.sum(axis=1)
    deg_inv_sqrt = np.where(deg > 0, 1.0 / np.sqrt(deg), 0.0)
    D_inv_sqrt = np.diag(deg_inv_sqrt)
    return D_inv_sqrt @ A @ D_inv_sqrt


def build_service_adj_from_bipartite(G, services):
    svc_set = set(services)
    prot_to_services = {}
    for s in services:
        if s not in G:
            continue
        for nbr in G.neighbors(s):
            if nbr not in svc_set:
                prot_to_services.setdefault(nbr, set()).add(s)
    n = len(services)
    idx = {s: i for i, s in enumerate(services)}
    A = np.zeros((n, n), dtype=np.float32)
    import itertools
    for prot, svcs in prot_to_services.items():
        for a, b in itertools.combinations(sorted(svcs), 2):
            i, j = idx[a], idx[b]
            A[i, j] = 1.0
            A[j, i] = 1.0
    return A


def explain_topk(k=10, hop=2):
    services, X, y, G, model_path = load_data()
    A = build_service_adj_from_bipartite(G, services)
    A_hat = normalize_adj(A)

    x = torch.tensor(X, requires_grad=True)
    A_hat_t = torch.tensor(A_hat, dtype=torch.float32)

    model = SimpleGCN(in_dim=x.shape[1], hid_dim=16, out_dim=2)
    model.load_state_dict(torch.load(model_path))
    model.eval()

    with torch.no_grad():
        out = model(x, A_hat_t)
        probs = torch.softmax(out, dim=1)[:, 1].numpy()
        preds = out.argmax(dim=1).numpy()

    idx_sorted = np.argsort(-probs)
    top_idx = idx_sorted[:k]

    outputs = []
    out_dir = Path('x_tis_outputs')
    out_dir.mkdir(exist_ok=True)

    for i in top_idx:
        service = services[i]
        prob = float(probs[i])
        pred = int(preds[i])
        true = int(y[i])

        # gradient-based importance
        x_req = x.clone().detach().requires_grad_(True)
        logits = model(x_req, A_hat_t)
        score = logits[i, 1]
        model.zero_grad()
        score.backward(retain_graph=False)
        grad = x_req.grad[i].abs().numpy()
        # attribute = grad * feature magnitude
        attr = grad * np.abs(X[i])
        feature_names = ['src_bytes_mean', 'dst_bytes_mean', 'attack_rate']
        feat_imp = sorted(list(zip(feature_names, attr)), key=lambda x: -x[1])

        # extract k-hop ego graph around service
        ego = nx.ego_graph(G, service, radius=hop)
        fig_path = out_dir / f'{service}_subgraph.png'
        plt.figure(figsize=(6, 6))
        pos = nx.spring_layout(ego, seed=42)
        node_colors = []
        for n in ego.nodes():
            if n == service:
                node_colors.append('red')
            elif n in services:
                node_colors.append('orange')
            else:
                node_colors.append('lightblue')
        nx.draw(ego, pos, with_labels=True, node_color=node_colors, node_size=300)
        plt.title(f'Subgraph around {service} (hop={hop})')
        plt.tight_layout()
        plt.savefig(fig_path, dpi=150)
        plt.close()

        # textual explanation
        top_feats = ', '.join([f'{n} ({v:.3f})' for n, v in feat_imp])
        neighbors = [n for n in ego.nodes() if n != service]
        explanation = f"Service {service} predicted risky (p={prob:.3f}). Top features: {top_feats}. Neighbors in subgraph: {neighbors}"

        # make serializable (convert numpy types to native Python)
        feat_imp_serializable = [(n, float(v)) for n, v in feat_imp]
        outputs.append({
            'service': service,
            'prob': float(prob),
            'pred': int(pred),
            'true': int(true),
            'top_features': feat_imp_serializable,
            'neighbors': list(neighbors),
            'explanation': explanation,
            'subgraph_png': str(fig_path)
        })

    # save CSV and JSON
    df_out = pd.DataFrame([{'service': o['service'], 'prob': o['prob'], 'pred': o['pred'], 'true': o['true'], 'explanation': o['explanation'], 'subgraph_png': o['subgraph_png']} for o in outputs])
    df_out.to_csv(out_dir / 'x_tis_outputs.csv', index=False)
    with open(out_dir / 'x_tis_outputs.json', 'w') as fh:
        json.dump(outputs, fh, indent=2)
    print('Saved X-TIS outputs to', out_dir)


def integrated_gradients(model, x, A_hat_t, target_idx, target_class=1, baseline=None, steps=50):
    if baseline is None:
        baseline = torch.zeros_like(x)
    assert x.shape == baseline.shape
    # Scale inputs and accumulate gradients
    scaled_inputs = [baseline + (float(i) / steps) * (x - baseline) for i in range(1, steps + 1)]
    total_grad = torch.zeros_like(x)
    for inp in scaled_inputs:
        inp = inp.clone().requires_grad_(True)
        logits = model(inp, A_hat_t)
        score = logits[target_idx, target_class]
        # use torch.autograd.grad to get gradients for non-leaf tensors
        grad = torch.autograd.grad(score, inp, retain_graph=False)[0]
        total_grad += grad.detach()
    avg_grad = total_grad / steps
    attributions = (x - baseline) * avg_grad
    return attributions.detach().numpy()[target_idx]


def run_integrated_gradients_topk(services, X, y, G, model_path, top_k=10, hop=2):
    out_dir = Path('x_tis_outputs')
    out_dir.mkdir(exist_ok=True)
    A = build_service_adj_from_bipartite(G, services)
    A_hat = normalize_adj(A)
    x = torch.tensor(X, requires_grad=True)
    A_hat_t = torch.tensor(A_hat, dtype=torch.float32)

    model = SimpleGCN(in_dim=x.shape[1], hid_dim=16, out_dim=2)
    model.load_state_dict(torch.load(model_path))
    model.eval()

    with torch.no_grad():
        out = model(x, A_hat_t)
        probs = torch.softmax(out, dim=1)[:, 1].numpy()

    idx_sorted = np.argsort(-probs)
    top_idx = idx_sorted[:top_k]

    ig_outputs = []
    for i in top_idx:
        ig_attr = integrated_gradients(model, x, A_hat_t, i, target_class=1, baseline=torch.zeros_like(x), steps=50)
        feature_names = ['src_bytes_mean', 'dst_bytes_mean', 'attack_rate']
        feat_imp = sorted(list(zip(feature_names, [float(abs(v)) for v in ig_attr])), key=lambda x: -x[1])
        service = services[i]
        prob = float(probs[i])
        true = int(y[i])

        ego = nx.ego_graph(G, service, radius=hop)
        fig_path = out_dir / f'{service}_subgraph_ig.png'
        plt.figure(figsize=(6, 6))
        pos = nx.spring_layout(ego, seed=42)
        node_colors = []
        for n in ego.nodes():
            if n == service:
                node_colors.append('red')
            elif n in services:
                node_colors.append('orange')
            else:
                node_colors.append('lightblue')
        nx.draw(ego, pos, with_labels=True, node_color=node_colors, node_size=500)
        plt.title(f'IG Subgraph around {service} (hop={hop})')
        plt.tight_layout()
        plt.savefig(fig_path, dpi=150)
        plt.close()

        ig_outputs.append({'service': service, 'prob': prob, 'true': true, 'ig_top_features': feat_imp, 'subgraph_png': str(fig_path)})

    pd.DataFrame([{'service': o['service'], 'prob': o['prob'], 'true': o['true'], 'ig_top_features': str(o['ig_top_features']), 'subgraph_png': o['subgraph_png']} for o in ig_outputs]).to_csv(out_dir / 'x_tis_outputs_ig.csv', index=False)
    with open(out_dir / 'x_tis_outputs_ig.json', 'w') as fh:
        json.dump(ig_outputs, fh, indent=2)
    print('Saved Integrated Gradients outputs to', out_dir)


def run_shap_topk(services, X, y, G, model_path, top_k=10, hop=2):
    try:
        import shap
    except Exception:
        print('shap not installed — SKIPPING SHAP run')
        return

    # create model predict function
    x = torch.tensor(X, dtype=torch.float32)
    A = build_service_adj_from_bipartite(G, services)
    A_hat = normalize_adj(A)
    A_hat_t = torch.tensor(A_hat, dtype=torch.float32)

    model = SimpleGCN(in_dim=x.shape[1], hid_dim=16, out_dim=2)
    model.load_state_dict(torch.load(model_path))
    model.eval()

    
    out_dir = Path('x_tis_outputs')
    shap_outputs = []
    num_features = X.shape[1]
    baseline_row = np.zeros((1, num_features), dtype=float)

    def make_predict_fn_for_target(target_idx):
        def predict_fn(X_input):
            # X_input: (nsamples, num_features)
            nsamples = X_input.shape[0]
            probs = np.zeros(nsamples, dtype=float)
            for si in range(nsamples):
                row = X_input[si]
                # construct full input using baseline, replace target row
                X_full = np.zeros((len(services), num_features), dtype=float)
                X_full[:] = baseline_row
                X_full[target_idx] = row
                X_t = torch.tensor(X_full, dtype=torch.float32)
                with torch.no_grad():
                    out = model(X_t, A_hat_t)
                    p = torch.softmax(out, dim=1)[:, 1].numpy()[target_idx]
                probs[si] = float(p)
            return probs
        return predict_fn

    # explain each top node individually
    probs_all = None
    # compute base probabilities for ranking
    with torch.no_grad():
        out_all = model(torch.tensor(X, dtype=torch.float32), A_hat_t)
        probs_all = torch.softmax(out_all, dim=1)[:, 1].numpy()
    idx_sorted = np.argsort(-probs_all)
    top_idx = idx_sorted[:top_k]

    for i in top_idx:
        predict_fn = make_predict_fn_for_target(i)
        explainer = shap.KernelExplainer(predict_fn, baseline_row)
        # explain the actual feature vector for the target node
        try:
            shap_vals = explainer.shap_values(np.array([X[i]]), nsamples=100)
        except Exception as e:
            print('SHAP explainer failed for', services[i], 'error:', e)
            continue
        # shap_vals may be array or list depending on SHAP version
        if isinstance(shap_vals, list):
            sv = np.array(shap_vals)[-1][0]
        else:
            sv = np.array(shap_vals)[0]

        feature_names = ['src_bytes_mean', 'dst_bytes_mean', 'attack_rate']
        feat_imp = sorted(list(zip(feature_names, [float(abs(v)) for v in sv])), key=lambda x: -x[1])
        service = services[i]
        prob = float(probs_all[i])
        true = int(y[i])
        ego = nx.ego_graph(G, service, radius=hop)
        fig_path = out_dir / f'{service}_subgraph_shap.png'
        plt.figure(figsize=(6, 6))
        pos = nx.spring_layout(ego, seed=42)
        node_colors = []
        for n in ego.nodes():
            if n == service:
                node_colors.append('red')
            elif n in services:
                node_colors.append('orange')
            else:
                node_colors.append('lightblue')
        nx.draw(ego, pos, with_labels=True, node_color=node_colors, node_size=500)
        plt.title(f'SHAP Subgraph around {service} (hop={hop})')
        plt.tight_layout()
        plt.savefig(fig_path, dpi=150)
        plt.close()
        shap_outputs.append({'service': service, 'prob': prob, 'true': true, 'shap_top_features': feat_imp, 'subgraph_png': str(fig_path)})

    pd.DataFrame([{'service': o['service'], 'prob': o['prob'], 'true': o['true'], 'shap_top_features': str(o['shap_top_features']), 'subgraph_png': o['subgraph_png']} for o in shap_outputs]).to_csv(out_dir / 'x_tis_outputs_shap.csv', index=False)
    with open(out_dir / 'x_tis_outputs_shap.json', 'w') as fh:
        json.dump(shap_outputs, fh, indent=2)
    print('Saved SHAP outputs to', out_dir)


def create_subgraphs_pdf(out_dir='x_tis_outputs', pdf_name='x_tis_subgraphs.pdf', max_images=20):
    from matplotlib.backends.backend_pdf import PdfPages
    out_dir = Path(out_dir)
    pngs = sorted([f for f in out_dir.iterdir() if f.suffix == '.png'])[:max_images]
    pdf_path = out_dir / pdf_name
    with PdfPages(pdf_path) as pp:
        for p in pngs:
            img = plt.imread(p)
            fig = plt.figure(figsize=(8, 8))
            plt.imshow(img)
            plt.axis('off')
            pp.savefig(fig, bbox_inches='tight')
            plt.close(fig)
    print('Saved combined PDF to', pdf_path)


if __name__ == '__main__':
    # run original gradient-based explainer
    explain_topk(k=10, hop=2)
    # then run integrated gradients
    services, X, y, G, model_path = load_data()
    run_integrated_gradients_topk(services, X, y, G, model_path, top_k=10, hop=2)
    # attempt SHAP
    run_shap_topk(services, X, y, G, model_path, top_k=10, hop=2)
    # bundle PNGs into a PDF for slides
    create_subgraphs_pdf()


if __name__ == '__main__':
    explain_topk(k=10, hop=2)
