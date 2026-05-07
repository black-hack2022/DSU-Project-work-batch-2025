"""
Real-time Malicious Service Detection - Console Version
"""

import pickle
import json
from datetime import datetime
import numpy as np
import pandas as pd
import torch

from network_threats.threat_taxonomy_eh import categorize_service_e_to_h, findings_to_tags, pick_primary_finding


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


def main():
    print("\n" + "="*100)
    print(" 🛡️  MALICIOUS SERVICE DETECTION SYSTEM - REAL-TIME MONITORING 🛡️ ".center(100))
    print("="*100 + "\n")
    
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"Scan Initiated: {timestamp}")
    print(f"Detection Threshold: 0.70 (70%)")
    print("\nInitializing neural threat detector...")
    
    # Load data
    service_stats = pd.read_csv('service_stats.csv', index_col=0)
    services = list(service_stats.index)
    X = service_stats[['src_bytes_mean', 'dst_bytes_mean', 'attack_rate']].values.astype(np.float32)
    
    with open('service_protocol_graph.gpickle', 'rb') as fh:
        G = pickle.load(fh)
    
    print(f"✓ Loaded network topology: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
    print(f"✓ Monitoring {len(services)} services")
    
    # Build adjacency
    A = build_service_adj_from_bipartite(G, services)
    A_hat = normalize_adj(A)
    
    # Load model
    model = SimpleGCN(in_dim=X.shape[1], hid_dim=16, out_dim=2)
    model.load_state_dict(torch.load('gnn_model.pt'))
    model.eval()
    
    print(f"✓ AI model loaded (GCN Architecture)")
    print("\n" + "-"*100)
    print("RUNNING DEEP SCAN...".center(100))
    print("-"*100 + "\n")
    
    # Run detection
    x = torch.tensor(X, dtype=torch.float32)
    A_hat_t = torch.tensor(A_hat, dtype=torch.float32)
    
    with torch.no_grad():
        out = model(x, A_hat_t)
        probs = torch.softmax(out, dim=1)[:, 1].numpy()
        preds = out.argmax(dim=1).numpy()
    
    # Create detection results
    results = pd.DataFrame({
        'service': services,
        'threat_score': probs,
        'is_malicious': preds,
        'src_bytes': X[:, 0],
        'dst_bytes': X[:, 1],
        'attack_rate': X[:, 2]
    }).sort_values('threat_score', ascending=False)

    # Attach E–H taxonomy (best-effort proxy labels)
    stats_by_service = service_stats.reset_index().set_index('service')

    def _tax_row(svc: str, score: float):
        try:
            sr = stats_by_service.loc[svc].to_dict()
        except Exception:
            sr = {}
        finds = categorize_service_e_to_h(svc, sr, threat_score=float(score))
        primary = pick_primary_finding(finds)
        if primary is None:
            return ('', '', '', '')
        return (primary.group, primary.subtype, primary.reason, findings_to_tags(finds))

    tax = results.apply(lambda r: _tax_row(str(r['service']), float(r['threat_score'])), axis=1, result_type='expand')
    tax.columns = ['threat_group_eh', 'threat_subtype_eh', 'threat_reason_eh', 'threat_tags_eh']
    results = pd.concat([results, tax], axis=1)
    
    # Generate alerts
    critical = results[results['threat_score'] >= 0.95]
    high = results[(results['threat_score'] >= 0.70) & (results['threat_score'] < 0.95)]
    medium = results[(results['threat_score'] >= 0.50) & (results['threat_score'] < 0.70)]
    low = results[results['threat_score'] < 0.50]
    
    print("="*100)
    print(" 📊 THREAT DETECTION SUMMARY ".center(100))
    print("="*100)
    print(f"  Total Services Scanned: {len(results)}")
    print(f"  🔴 CRITICAL Threats (≥95%): {len(critical)} detected")
    print(f"  🟠 HIGH Risk (70-95%): {len(high)} detected")
    print(f"  🟡 MEDIUM Risk (50-70%): {len(medium)} detected")
    print(f"  🟢 LOW Risk (<50%): {len(low)} detected")
    print(f"\n  Malicious Detection Rate: {(preds==1).sum() / len(preds) * 100:.1f}%")
    print("="*100 + "\n")
    
    # Show critical threats
    if len(critical) > 0:
        print("🚨 " + " CRITICAL THREATS DETECTED - IMMEDIATE ACTION REQUIRED ".center(98) + " 🚨")
        print("="*100)
        
        for idx, row in critical.head(20).iterrows():
            print(f"\n┌─ [ALERT #{critical.index.get_loc(idx)+1}] Service: {row['service'].upper()}")
            print(f"│  ├─ 🎯 Threat Score: {row['threat_score']:.2%}")
            print(f"│  ├─ ⚠️  Classification: {'MALICIOUS' if row['is_malicious'] else 'BENIGN'}")
            if str(row.get('threat_subtype_eh') or '').strip():
                print(f"│  ├─ 🧭 E–H Category: {row.get('threat_group_eh','')} / {row.get('threat_subtype_eh','')}")
            print(f"│  ├─ 📤 Avg Source Traffic: {row['src_bytes']:.2f} bytes")
            print(f"│  ├─ 📥 Avg Dest Traffic: {row['dst_bytes']:.2f} bytes")
            print(f"│  └─ 📊 Historical Attack Rate: {row['attack_rate']:.2%}")
            print(f"└─ RECOMMENDATION: BLOCK/ISOLATE THIS SERVICE IMMEDIATELY")
            
        print("\n" + "="*100)
    
    # Show high risk
    if len(high) > 0:
        print("\n⚠️  HIGH RISK SERVICES - MONITOR CLOSELY".center(100))
        print("-"*100)
        for idx, row in high.head(10).iterrows():
            print(f"  • {row['service']:20s} | Threat: {row['threat_score']:6.2%} | "
                  f"Src: {row['src_bytes']:8.1f} | Dst: {row['dst_bytes']:8.1f} | "
                  f"Attack Rate: {row['attack_rate']:6.2%}")
        print("-"*100)
    
    # Save report
    report_file = 'detection_report.txt'
    results.to_csv('live_detection_results.csv', index=False)
    
    with open(report_file, 'w') as f:
        f.write("="*100 + "\n")
        f.write(f"MALICIOUS SERVICE DETECTION REPORT\n".center(100))
        f.write(f"Generated: {timestamp}\n".center(100))
        f.write("="*100 + "\n\n")
        
        f.write(f"SUMMARY:\n")
        f.write(f"  Total Services: {len(results)}\n")
        f.write(f"  Critical: {len(critical)}\n")
        f.write(f"  High Risk: {len(high)}\n")
        f.write(f"  Medium Risk: {len(medium)}\n")
        f.write(f"  Low Risk: {len(low)}\n\n")
        
        f.write("TOP 20 THREATS:\n")
        f.write("-"*100 + "\n")
        for idx, row in results.head(20).iterrows():
            f.write(f"{row['service']:15s} | Score: {row['threat_score']:.4f} | "
                   f"Attack Rate: {row['attack_rate']:.2%}\n")
    
    print("\n" + "="*100)
    print(" ✅ DETECTION COMPLETE ".center(100))
    print("="*100)
    print(f"\nOutputs Generated:")
    print(f"  • {report_file} - Full detection report")
    print(f"  • live_detection_results.csv - Complete scan data")
    print(f"\nRecommended Actions:")
    print(f"  1. Immediately isolate CRITICAL threat services")
    print(f"  2. Review firewall rules for HIGH risk services")
    print(f"  3. Enable enhanced monitoring on flagged services")
    print(f"  4. Update intrusion detection signatures")
    print("="*100 + "\n")


if __name__ == '__main__':
    main()
