"""
Real-time Malicious Service Detection System
Loads trained GNN model and detects risky network services in real-time
"""

import pickle
from pathlib import Path
import json
from datetime import datetime

import numpy as np
import pandas as pd
import torch
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

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


class MaliciousServiceDetector:
    def __init__(self, model_path='gnn_model.pt', stats_path='service_stats.csv', 
                 graph_path='service_protocol_graph.gpickle', threshold=0.7):
        """Initialize the detector with trained model and data"""
        self.threshold = threshold
        self.model_path = Path(model_path)
        self.stats_path = Path(stats_path)
        self.graph_path = Path(graph_path)
        
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Initializing Malicious Service Detector...")
        print(f"  Model: {self.model_path}")
        print(f"  Threat threshold: {self.threshold}")
        
        # Load data
        self.service_stats = pd.read_csv(self.stats_path, index_col=0)
        self.services = list(self.service_stats.index)
        self.X = self.service_stats[['src_bytes_mean', 'dst_bytes_mean', 'attack_rate']].values.astype(np.float32)
        
        with open(self.graph_path, 'rb') as fh:
            self.G = pickle.load(fh)
        
        # Build adjacency
        A = build_service_adj_from_bipartite(self.G, self.services)
        self.A_hat = normalize_adj(A)
        
        # Load model
        self.model = SimpleGCN(in_dim=self.X.shape[1], hid_dim=16, out_dim=2)
        self.model.load_state_dict(torch.load(self.model_path))
        self.model.eval()
        
        print(f"  ✓ Loaded model and monitoring {len(self.services)} services")
        print(f"  ✓ Graph structure: {self.G.number_of_nodes()} nodes, {self.G.number_of_edges()} edges")
    
    def detect(self):
        """Run detection on all services and return results"""
        x = torch.tensor(self.X, dtype=torch.float32)
        A_hat_t = torch.tensor(self.A_hat, dtype=torch.float32)
        
        with torch.no_grad():
            out = self.model(x, A_hat_t)
            probs = torch.softmax(out, dim=1)[:, 1].numpy()
            preds = out.argmax(dim=1).numpy()
        
        # Create detection results
        results = pd.DataFrame({
            'service': self.services,
            'threat_score': probs,
            'is_malicious': preds,
            'src_bytes_mean': self.X[:, 0],
            'dst_bytes_mean': self.X[:, 1],
            'attack_rate': self.X[:, 2]
        })
        
        # Sort by threat score
        results = results.sort_values('threat_score', ascending=False)
        
        # Flag high-risk services
        results['alert_level'] = results['threat_score'].apply(
            lambda x: 'CRITICAL' if x >= 0.95 else 'HIGH' if x >= self.threshold else 'MEDIUM' if x >= 0.5 else 'LOW'
        )

        # Attach E–H taxonomy (best-effort proxy labels)
        # We use the full service_stats row (not just model input features).
        stats_by_service = self.service_stats.reset_index().set_index('service')

        def _tax_row(svc: str, score: float):
            try:
                sr = stats_by_service.loc[svc].to_dict()
            except Exception:
                sr = {}
            finds = categorize_service_e_to_h(svc, sr, threat_score=float(score))
            primary = pick_primary_finding(finds)
            if primary is None:
                return pd.Series({'threat_group_eh': '', 'threat_subtype_eh': '', 'threat_reason_eh': '', 'threat_tags_eh': ''})
            return pd.Series(
                {
                    'threat_group_eh': primary.group,
                    'threat_subtype_eh': primary.subtype,
                    'threat_reason_eh': primary.reason,
                    'threat_tags_eh': findings_to_tags(finds),
                }
            )

        tax = results.apply(lambda r: _tax_row(str(r['service']), float(r['threat_score'])), axis=1)
        results = pd.concat([results, tax], axis=1)
        
        return results
    
    def generate_alert_report(self, results, output_path='detection_report.txt'):
        """Generate a detailed alert report"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        critical = results[results['alert_level'] == 'CRITICAL']
        high = results[results['alert_level'] == 'HIGH']
        
        report = []
        report.append("=" * 80)
        report.append(f"MALICIOUS SERVICE DETECTION REPORT".center(80))
        report.append(f"{timestamp}".center(80))
        report.append("=" * 80)
        report.append("")
        
        report.append("DETECTION SUMMARY:")
        report.append(f"  Total Services Monitored: {len(results)}")
        report.append(f"  🔴 CRITICAL Threats Detected: {len(critical)}")
        report.append(f"  🟠 HIGH Risk Services: {len(high)}")
        report.append(f"  ⚠️  Total Malicious Detections: {(results['is_malicious']==1).sum()}")
        report.append("")
        
        if len(critical) > 0:
            report.append("=" * 80)
            report.append("🚨 CRITICAL THREATS - IMMEDIATE ACTION REQUIRED 🚨")
            report.append("=" * 80)
            for idx, row in critical.head(15).iterrows():
                report.append(f"\n[ALERT] Service: {row['service']}")
                report.append(f"  ├─ Threat Score: {row['threat_score']:.4f}")
                report.append(f"  ├─ Status: {'MALICIOUS' if row['is_malicious'] else 'CLEAN'}")
                if 'threat_subtype_eh' in row and str(row.get('threat_subtype_eh') or '').strip():
                    report.append(f"  ├─ E–H Category: {row.get('threat_group_eh', '')} / {row.get('threat_subtype_eh', '')}")
                report.append(f"  ├─ Avg Source Bytes: {row['src_bytes_mean']:.2f}")
                report.append(f"  ├─ Avg Dest Bytes: {row['dst_bytes_mean']:.2f}")
                report.append(f"  └─ Historical Attack Rate: {row['attack_rate']:.2%}")
        
        if len(high) > 0:
            report.append("\n" + "=" * 80)
            report.append("⚠️  HIGH RISK SERVICES - MONITOR CLOSELY")
            report.append("=" * 80)
            for idx, row in high.head(10).iterrows():
                report.append(f"  • {row['service']}: Threat={row['threat_score']:.3f}")
        
        report.append("\n" + "=" * 80)
        report.append("RECOMMENDED ACTIONS:")
        report.append("  1. Block or isolate services marked as CRITICAL")
        report.append("  2. Review network traffic for HIGH risk services")
        report.append("  3. Update firewall rules to restrict access")
        report.append("  4. Monitor attack patterns in real-time")
        report.append("=" * 80)
        
        report_text = "\n".join(report)
        
        # Save to file
        with open(output_path, 'w') as f:
            f.write(report_text)
        
        print(report_text)
        return report_text
    
    def visualize_threats(self, results, output_path='threat_detection_dashboard.png'):
        """Create visual dashboard of detected threats"""
        fig = plt.figure(figsize=(16, 10))
        gs = fig.add_gridspec(3, 2, hspace=0.3, wspace=0.3)
        
        # 1. Threat Score Distribution
        ax1 = fig.add_subplot(gs[0, 0])
        critical = results[results['threat_score'] >= 0.95]
        high = results[(results['threat_score'] >= 0.7) & (results['threat_score'] < 0.95)]
        medium = results[(results['threat_score'] >= 0.5) & (results['threat_score'] < 0.7)]
        low = results[results['threat_score'] < 0.5]
        
        categories = ['CRITICAL\n(≥0.95)', 'HIGH\n(0.7-0.95)', 'MEDIUM\n(0.5-0.7)', 'LOW\n(<0.5)']
        counts = [len(critical), len(high), len(medium), len(low)]
        colors = ['#d32f2f', '#f57c00', '#fbc02d', '#388e3c']
        
        bars = ax1.bar(categories, counts, color=colors, edgecolor='black', linewidth=2)
        ax1.set_ylabel('Number of Services', fontsize=12, fontweight='bold')
        ax1.set_title('Threat Level Distribution', fontsize=14, fontweight='bold')
        ax1.set_ylim(0, max(counts) * 1.2)
        
        for bar, count in zip(bars, counts):
            height = bar.get_height()
            ax1.text(bar.get_x() + bar.get_width()/2., height,
                    f'{int(count)}', ha='center', va='bottom', fontsize=14, fontweight='bold')
        
        # 2. Top 15 Malicious Services
        ax2 = fig.add_subplot(gs[0, 1])
        top_threats = results.head(15)
        y_pos = np.arange(len(top_threats))
        colors_bar = ['#d32f2f' if x >= 0.95 else '#f57c00' if x >= 0.7 else '#fbc02d' 
                      for x in top_threats['threat_score']]
        
        ax2.barh(y_pos, top_threats['threat_score'], color=colors_bar, edgecolor='black', linewidth=1.5)
        ax2.set_yticks(y_pos)
        ax2.set_yticklabels(top_threats['service'], fontsize=10)
        ax2.set_xlabel('Threat Score', fontsize=12, fontweight='bold')
        ax2.set_title('Top 15 Malicious Services', fontsize=14, fontweight='bold', color='#d32f2f')
        ax2.set_xlim(0, 1.05)
        ax2.invert_yaxis()
        ax2.grid(axis='x', alpha=0.3)
        
        # Add threshold line
        ax2.axvline(x=0.7, color='red', linestyle='--', linewidth=2, label='Threat Threshold')
        ax2.legend()
        
        # 3. Detection Summary Box
        ax3 = fig.add_subplot(gs[1, :])
        ax3.axis('off')
        
        summary_text = f"""
        🔍 REAL-TIME DETECTION SUMMARY
        
        Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        Total Services Monitored: {len(results)}
        
        🔴 CRITICAL Threats (Score ≥ 0.95): {len(critical)} services
        🟠 HIGH Risk (Score 0.7-0.95): {len(high)} services
        🟡 MEDIUM Risk (Score 0.5-0.7): {len(medium)} services
        🟢 LOW Risk (Score < 0.5): {len(low)} services
        
        Detection Rate: {(results['is_malicious']==1).sum() / len(results) * 100:.1f}%
        Model Confidence: {results['threat_score'].mean():.2%}
        """
        
        bbox_props = dict(boxstyle='round,pad=1', facecolor='#f5f5f5', edgecolor='black', linewidth=2)
        ax3.text(0.5, 0.5, summary_text, transform=ax3.transAxes,
                fontsize=13, verticalalignment='center', horizontalalignment='center',
                bbox=bbox_props, family='monospace', fontweight='bold')
        
        # 4. Feature Analysis
        ax4 = fig.add_subplot(gs[2, 0])
        malicious = results[results['is_malicious'] == 1]
        benign = results[results['is_malicious'] == 0]
        
        ax4.scatter(benign['src_bytes_mean'], benign['dst_bytes_mean'], 
                   c='green', s=100, alpha=0.6, label='Benign', edgecolors='black')
        ax4.scatter(malicious['src_bytes_mean'], malicious['dst_bytes_mean'],
                   c='red', s=150, alpha=0.8, label='Malicious', marker='X', edgecolors='black', linewidths=2)
        
        ax4.set_xlabel('Avg Source Bytes', fontsize=11, fontweight='bold')
        ax4.set_ylabel('Avg Destination Bytes', fontsize=11, fontweight='bold')
        ax4.set_title('Traffic Pattern Analysis', fontsize=13, fontweight='bold')
        ax4.legend(fontsize=11)
        ax4.grid(alpha=0.3)
        
        # 5. Timeline/Alert Status
        ax5 = fig.add_subplot(gs[2, 1])
        threat_levels = results['alert_level'].value_counts()
        colors_pie = {'CRITICAL': '#d32f2f', 'HIGH': '#f57c00', 'MEDIUM': '#fbc02d', 'LOW': '#388e3c'}
        pie_colors = [colors_pie.get(level, '#999999') for level in threat_levels.index]
        
        wedges, texts, autotexts = ax5.pie(threat_levels.values, labels=threat_levels.index,
                                            autopct='%1.1f%%', startangle=90,
                                            colors=pie_colors, textprops={'fontsize': 11, 'fontweight': 'bold'})
        ax5.set_title('Alert Level Breakdown', fontsize=13, fontweight='bold')
        
        # Main title
        fig.suptitle('🛡️ MALICIOUS SERVICE DETECTION DASHBOARD 🛡️', 
                    fontsize=18, fontweight='bold', y=0.98)
        
        plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='white')
        plt.close()
        
        print(f"\n✓ Saved threat visualization: {output_path}")
        return output_path


def main():
    """Main detection routine"""
    print("\n" + "="*80)
    print("INITIATING MALICIOUS SERVICE DETECTION SYSTEM".center(80))
    print("="*80 + "\n")
    
    # Initialize detector
    detector = MaliciousServiceDetector(threshold=0.7)
    
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Running detection scan...")
    
    # Run detection
    results = detector.detect()
    
    # Generate alert report
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Generating alert report...")
    detector.generate_alert_report(results)
    
    # Create visual dashboard
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Creating threat dashboard...")
    detector.visualize_threats(results)
    
    # Save detailed results
    results.to_csv('live_detection_results.csv', index=False)
    print(f"\n✓ Saved detailed results: live_detection_results.csv")
    
    # Summary statistics
    print("\n" + "="*80)
    print("DETECTION COMPLETE".center(80))
    print("="*80)
    print(f"\nTotal Malicious Services Detected: {(results['is_malicious']==1).sum()} / {len(results)}")
    print(f"Critical Threats: {len(results[results['alert_level']=='CRITICAL'])}")
    print(f"High Risk: {len(results[results['alert_level']=='HIGH'])}")
    print("\nFiles Generated:")
    print("  • detection_report.txt - Detailed alert report")
    print("  • threat_detection_dashboard.png - Visual dashboard")
    print("  • live_detection_results.csv - Full detection data")
    print("\n" + "="*80 + "\n")


if __name__ == '__main__':
    main()
