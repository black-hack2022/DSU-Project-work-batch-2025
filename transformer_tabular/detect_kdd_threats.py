from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import torch

try:
    # Shared E–H taxonomy used across the repo
    from network_threats.threat_taxonomy_eh import categorize_flow_e_to_h, pick_primary_finding
except Exception:  # pragma: no cover
    categorize_flow_e_to_h = None
    pick_primary_finding = None

try:
    # When executed as a module: python -m transformer_tabular.detect_kdd_threats
    from .tabular_transformer.model import FTTransformer
    from .tabular_transformer.preprocessing import TabularPreprocessor, clean_columns
except ImportError:  # pragma: no cover
    # Fallback for running as a script from within the transformer_tabular folder
    from tabular_transformer.model import FTTransformer
    from tabular_transformer.preprocessing import TabularPreprocessor, clean_columns


def load_transformer(ckpt_path: Path, meta: Dict, device: torch.device) -> FTTransformer:
    ckpt = torch.load(ckpt_path, map_location=device)
    cfg = ckpt.get("config", {}) if isinstance(ckpt, dict) else {}
    ckpt_meta = ckpt.get("meta", meta) if isinstance(ckpt, dict) else meta

    model = FTTransformer(
        n_num=int(ckpt_meta["n_num"]),
        cat_cardinalities=ckpt_meta.get("cat_cardinalities", []),
        d_token=int(cfg.get("d_token", 192)),
        n_heads=int(cfg.get("n_heads", 8)),
        n_layers=int(cfg.get("n_layers", 4)),
        d_ff=int(cfg.get("d_ff", 384)),
        dropout=float(cfg.get("dropout", 0.1)),
    ).to(device)

    state = ckpt["model"] if isinstance(ckpt, dict) and "model" in ckpt else ckpt
    model.load_state_dict(state)
    model.eval()
    return model


@torch.no_grad()
def infer_probs(
    model: FTTransformer,
    x_num: torch.Tensor,
    x_cat: torch.Tensor,
    batch_size: int,
    device: torch.device,
) -> np.ndarray:
    probs: List[np.ndarray] = []
    x_num = x_num.to(device)
    x_cat = x_cat.to(device)

    for i in range(0, x_num.shape[0], batch_size):
        logits = model(x_num=x_num[i : i + batch_size], x_cat=x_cat[i : i + batch_size])
        p = torch.sigmoid(logits).detach().cpu().numpy()
        probs.append(p)

    return np.concatenate(probs)


def categorize_network_threat(row: pd.Series) -> Tuple[str, str, str]:
    """Best-effort mapping of KDD-like flow features to your network threat list.

    Returns: (group, subtype, reason)

    Notes (important for report honesty):
    - Some items like "Pass-the-Hash" / "Pass-the-Ticket" require Windows authentication telemetry.
      KDD-like flow records do not contain those logs, so we only emit them as *proxies* when
      we see strong SMB/NetBIOS + compromise indicators.
    """

    def f(key: str) -> float:
        v = row.get(key, 0)
        try:
            if v is None or (isinstance(v, float) and np.isnan(v)):
                return 0.0
        except Exception:
            pass
        try:
            return float(v)
        except Exception:
            return 0.0

    proto = str(row.get("protocol_type", "") or "").strip().lower()
    service = str(row.get("service", "") or "").strip().lower()

    # Core KDD temporal features
    count = f("count")
    srv_count = f("srv_count")
    same_srv_rate = f("same_srv_rate")
    diff_srv_rate = f("diff_srv_rate")
    srv_diff_host_rate = f("srv_diff_host_rate")
    dst_host_count = f("dst_host_count")
    dst_host_srv_count = f("dst_host_srv_count")
    dst_host_diff_srv_rate = f("dst_host_diff_srv_rate")
    dst_host_srv_diff_host_rate = f("dst_host_srv_diff_host_rate")

    # Auth / compromise-ish signals (KDD fields)
    num_failed_logins = f("num_failed_logins")
    logged_in = f("logged_in")
    num_compromised = f("num_compromised")
    root_shell = f("root_shell")
    su_attempted = f("su_attempted")
    num_root = f("num_root")

    # Error rates (handy for auth/connection abuse patterns)
    serror_rate = f("serror_rate")
    rerror_rate = f("rerror_rate")

    # ---------------------------------------------------------------------
    # D) Lateral Movement & Internal Attacks (highest priority if SMB/NetBIOS)
    # ---------------------------------------------------------------------
    is_netbios = service.startswith("netbios")
    is_smbish = service in {"microsoft-ds", "smb", "smbgs", "netbios_ssn"} or is_netbios

    if is_smbish:
        # Pass-the-Hash proxy (SMB/NetBIOS + strong compromise indicators)
        if (logged_in >= 1.0) and (num_compromised > 0.0 or num_root > 0.0 or root_shell > 0.0 or su_attempted > 0.0):
            return (
                "D. Lateral Movement & Internal Attacks",
                "Pass-the-Hash behavior",
                f"proxy: service={service}, logged_in=1 with compromise indicators (num_compromised={num_compromised:.0f}, num_root={num_root:.0f}, root_shell={root_shell:.0f})",
            )

        # Pass-the-Ticket (Kerberos) isn't present in KDD; keep for future datasets
        if "kerberos" in service or "krb" in service:
            return (
                "D. Lateral Movement & Internal Attacks",
                "Pass-the-Ticket behavior",
                f"service={service}",
            )

        # Split SMB vs NetBIOS subtypes
        if service == "netbios_ssn" or service in {"microsoft-ds", "smb", "smbgs"}:
            return (
                "D. Lateral Movement & Internal Attacks",
                "SMB lateral movement",
                f"service={service}",
            )

        return (
            "D. Lateral Movement & Internal Attacks",
            "NetBIOS attacks",
            f"service={service}",
        )

    # East–West / pivoting proxies (no IPs available in KDD)
    if service == "private" and count >= 30 and srv_diff_host_rate >= 0.5:
        return (
            "D. Lateral Movement & Internal Attacks",
            "Internal pivoting",
            f"service=private with broad host spread (count={count:.0f}, srv_diff_host_rate={srv_diff_host_rate:.2f})",
        )

    internal_lateral_services = {
        "private",
        "ssh",
        "ftp",
        "telnet",
        "auth",
        "netbios_ssn",
        "netbios_ns",
        "netbios_dgm",
        "microsoft-ds",
        "smb",
        "smbgs",
    }

    if (
        service in internal_lateral_services
        and dst_host_count >= 90
        and dst_host_srv_count >= 50
        and same_srv_rate >= 0.8
        and count >= 50
        and (srv_diff_host_rate >= 0.3 or dst_host_srv_diff_host_rate >= 0.3)
    ):
        return (
            "D. Lateral Movement & Internal Attacks",
            "East–West traffic abuse",
            "proxy: repeated internal-service access with host spread "
            f"(service={service}, dst_host_count={dst_host_count:.0f}, dst_host_srv_count={dst_host_srv_count:.0f}, "
            f"same_srv_rate={same_srv_rate:.2f}, srv_diff_host_rate={srv_diff_host_rate:.2f})",
        )

    # ---------------------------------
    # C) Network-Based Attacks (scans/auth)
    # ---------------------------------
    if (count >= 50 and diff_srv_rate >= 0.5) or (dst_host_count >= 80 and dst_host_diff_srv_rate >= 0.5):
        return (
            "C. Network-Based Attacks",
            "Port scanning",
            f"high connection fan-out (count={count:.0f}, diff_srv_rate={diff_srv_rate:.2f}, dst_host_diff_srv_rate={dst_host_diff_srv_rate:.2f})",
        )

    if count >= 30 and diff_srv_rate >= 0.3:
        return (
            "C. Network-Based Attacks",
            "Service enumeration",
            f"multiple services probed (count={count:.0f}, diff_srv_rate={diff_srv_rate:.2f})",
        )

    if proto == "icmp" and (count >= 5 or dst_host_count >= 50):
        return (
            "C. Network-Based Attacks",
            "Network reconnaissance",
            f"icmp with elevated activity (count={count:.0f}, dst_host_count={dst_host_count:.0f})",
        )

    if num_failed_logins >= 5 and logged_in < 1.0:
        return (
            "C. Network-Based Attacks",
            "Brute-force login attacks",
            f"failed logins={num_failed_logins:.0f} (service={service or 'unknown'}, logged_in=0)",
        )

    if num_failed_logins >= 3 and count >= 20 and diff_srv_rate >= 0.2 and logged_in < 1.0:
        return (
            "C. Network-Based Attacks",
            "Credential stuffing",
            f"proxy: repeated auth failures + multi-service attempts (failed_logins={num_failed_logins:.0f}, count={count:.0f}, diff_srv_rate={diff_srv_rate:.2f})",
        )

    if service == "ssh" and (num_failed_logins >= 1 or serror_rate >= 0.5 or rerror_rate >= 0.5):
        return (
            "C. Network-Based Attacks",
            "SSH attacks",
            f"service=ssh with auth/connection errors (failed_logins={num_failed_logins:.0f}, serror_rate={serror_rate:.2f}, rerror_rate={rerror_rate:.2f})",
        )

    if "rdp" in service or service in {"ms-wbt-server"}:
        return (
            "C. Network-Based Attacks",
            "RDP attacks",
            f"service={service}",
        )

    # (Keep legacy heuristic below for other categories, when C/D do not match)

    # E–H: shared taxonomy (adds DNS tunneling / DGA / fast-flux support when DNS fields exist)
    if categorize_flow_e_to_h is not None and pick_primary_finding is not None:
        findings = categorize_flow_e_to_h(row)
        primary = pick_primary_finding(findings)
        if primary is not None:
            return primary.group, primary.subtype, primary.reason

    # Fallback (should be rare): minimal unknown
    return (
        "H. Multi-Stage / Unknown Attacks",
        "Previously unseen (unknown) attack patterns",
        "E–H taxonomy unavailable",
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input_csv", type=str, default="kdd_preprocessed.csv")
    ap.add_argument("--processed_dir", type=str, default="transformer_tabular/data/processed/kdd")
    ap.add_argument("--transformer_ckpt", type=str, default="transformer_tabular/runs/kdd/best_model.pt")
    ap.add_argument(
        "--fusion_service_preds",
        type=str,
        default="transformer_tabular/runs/fusion_kdd_gnn/fusion_service_predictions.csv",
        help="Optional: per-service gnn risk to attach to each row",
    )
    ap.add_argument("--out_csv", type=str, default="kdd_threat_detections.csv")
    ap.add_argument("--batch_size", type=int, default=4096)
    ap.add_argument("--device", type=str, default=None)
    ap.add_argument("--limit_rows", type=int, default=None)
    args = ap.parse_args()

    device = torch.device(args.device) if args.device else torch.device("cuda" if torch.cuda.is_available() else "cpu")

    processed_dir = Path(args.processed_dir)
    pre_json = processed_dir / "preprocessor.json"
    pre_pt = processed_dir / "preprocessor.pt"
    if pre_json.exists():
        pre_state = json.loads(pre_json.read_text(encoding="utf-8"))
        pre = TabularPreprocessor.from_json_dict(pre_state)
    else:
        # Fallback for older runs. This uses pickle: only do this for trusted local files.
        pre_state = torch.load(pre_pt, map_location="cpu", weights_only=False)
        pre = TabularPreprocessor.from_state_dict(pre_state)

    meta = torch.load(processed_dir / "train" / "meta.pt")

    df = pd.read_csv(args.input_csv, nrows=args.limit_rows)
    df = clean_columns(df)

    # Preserve string cols for categorization output
    for col in ["protocol_type", "service", "flag"]:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()

    # Build feature frame
    drop_cols = [c for c in ["label", "difficulty", "is_attack"] if c in df.columns]
    X = df.drop(columns=drop_cols)

    # Apply same column ordering as training
    X = X[pre.cat_cols + pre.num_cols]

    x_num_np, x_cat_np = pre.transform(X)
    x_num = torch.from_numpy(x_num_np)
    x_cat = torch.from_numpy(x_cat_np)

    model = load_transformer(Path(args.transformer_ckpt), meta, device)
    probs = infer_probs(model, x_num, x_cat, args.batch_size, device)

    # Optional: attach service-level risk (fusion GNN)
    svc_risk = None
    fusion_path = Path(args.fusion_service_preds)
    if fusion_path.exists() and "service" in df.columns:
        sdf = pd.read_csv(fusion_path)
        if "service" in sdf.columns and "gnn_prob" in sdf.columns:
            m = dict(zip(sdf["service"].astype(str), sdf["gnn_prob"].astype(float)))
            svc_risk = df["service"].astype(str).map(m).fillna(0.0).to_numpy(dtype=np.float32)

    transformer_prob = probs.astype(np.float32)
    if svc_risk is not None:
        combined_risk = 0.7 * transformer_prob + 0.3 * svc_risk
    else:
        combined_risk = transformer_prob

    pred_attack = (combined_risk >= 0.5).astype(int)

    groups = []
    subtypes = []
    reasons = []
    for _, r in df.iterrows():
        g, s, reason = categorize_network_threat(r)
        groups.append(g)
        subtypes.append(s)
        reasons.append(reason)

    out = pd.DataFrame(
        {
            "row_id": np.arange(len(df)),
            "protocol_type": df.get("protocol_type"),
            "service": df.get("service"),
            "flag": df.get("flag"),
            "transformer_prob": transformer_prob,
            "service_gnn_prob": svc_risk if svc_risk is not None else np.nan,
            "combined_risk": combined_risk,
            "pred_attack": pred_attack,
            "category_group": groups,
            "category_subtype": subtypes,
            "reason": reasons,
        }
    )

    Path(args.out_csv).parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.out_csv, index=False)

    summary = {
        "n_rows": int(len(out)),
        "n_pred_attack": int(out["pred_attack"].sum()),
        "out_csv": str(args.out_csv),
        "note": "This categorization is best-effort from flow/service features (network-focused categories).",
    }
    (Path(args.out_csv).with_suffix(".summary.json")).write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
