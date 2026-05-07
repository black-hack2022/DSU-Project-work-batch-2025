import { NextRequest, NextResponse } from "next/server";

// Simulates the MLP Autoencoder reconstruction error scoring
// Based on UNSW-NB15 feature patterns from the codebase

const UNSW_NORMAL_MEANS: Record<string, number> = {
  dur: 0.023,
  spkts: 4.2,
  dpkts: 4.1,
  sbytes: 312,
  dbytes: 741,
  rate: 68.4,
  sload: 24800,
  dload: 41200,
  sloss: 0.05,
  dloss: 0.04,
  sinpkt: 0.018,
  dinpkt: 0.019,
  sjit: 0.0003,
  djit: 0.0003,
  swin: 248,
  dwin: 248,
  tcprtt: 0.0025,
  synack: 0.0012,
  ackdat: 0.0013,
};

const UNSW_NORMAL_STDS: Record<string, number> = {
  dur: 0.15,
  spkts: 8.3,
  dpkts: 8.1,
  sbytes: 892,
  dbytes: 2140,
  rate: 145.2,
  sload: 68400,
  dload: 112000,
  sloss: 0.22,
  dloss: 0.20,
  sinpkt: 0.035,
  dinpkt: 0.037,
  sjit: 0.0015,
  djit: 0.0016,
  swin: 14,
  dwin: 14,
  tcprtt: 0.0082,
  synack: 0.0041,
  ackdat: 0.0043,
};

// Threshold from training (p99.5 on normal training set)
const MSE_THRESHOLD = 0.0842;

function computeReconMse(input: Record<string, number>): {
  mse: number;
  per_feature: Record<string, number>;
  z_scores: Record<string, number>;
} {
  const per_feature: Record<string, number> = {};
  const z_scores: Record<string, number> = {};
  let total = 0;
  let count = 0;

  for (const [feat, mean] of Object.entries(UNSW_NORMAL_MEANS)) {
    const std = UNSW_NORMAL_STDS[feat] ?? 1;
    const val = input[feat] ?? 0;

    // Normalize the value
    const normalized = (val - mean) / (std + 1e-8);

    // Simulate reconstruction error: autoencoder can't reconstruct anomalies well
    // For normal values (|z| < 2), reconstruction is good (low error)
    // For anomalous values (|z| > 2), large reconstruction error
    const z = Math.abs(normalized);
    z_scores[feat] = normalized;
    let reconError: number;
    if (z < 1.5) {
      reconError = 0.004 + z * 0.008;
    } else if (z < 3) {
      reconError = 0.016 + (z - 1.5) * 0.024;
    } else {
      reconError = 0.052 + (z - 3) * 0.03;
    }

    if (["sbytes", "dbytes", "sload", "dload", "rate"].includes(feat)) {
      reconError *= 1.05;
    }

    per_feature[feat] = reconError;
    total += reconError;
    count++;
  }

  return {
    mse: count > 0 ? total / count : 0,
    per_feature,
    z_scores,
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Record<string, number>;

  const { mse, per_feature, z_scores } = computeReconMse(body);

  // Remove randomness for determinism — use consistent values
  const recon_mse = parseFloat(mse.toFixed(6));
  const is_anomaly = recon_mse > MSE_THRESHOLD;

  // Normalize anomaly score to 0-1 range
  const anomaly_score = Math.min(1, recon_mse / (MSE_THRESHOLD * 3));

  const risk =
    recon_mse >= MSE_THRESHOLD * 2.5
      ? "critical"
      : recon_mse >= MSE_THRESHOLD * 1.5
      ? "high"
      : recon_mse >= MSE_THRESHOLD
      ? "medium"
      : "low";

  // Top anomalous features by contribution
  const top_anomalous_features = Object.entries(per_feature)
    .map(([feature, contribution]) => ({
      feature,
      contribution: parseFloat(contribution.toFixed(6)),
      z_score: parseFloat((z_scores[feature] ?? 0).toFixed(3)),
    }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 6);

  // Infer possible attack categories from anomalous features
  const possible_categories: string[] = [];
  if (is_anomaly) {
    if (per_feature["sload"] > 0.05 || per_feature["sbytes"] > 0.05) {
      possible_categories.push("F — Data Exfiltration");
    }
    if (per_feature["rate"] > 0.04 && per_feature["spkts"] > 0.04) {
      possible_categories.push("E — Botnet / C2 Beacon");
    }
    if (per_feature["djit"] > 0.03 || per_feature["sjit"] > 0.03) {
      possible_categories.push("G — Malware Behavior");
    }
    if (possible_categories.length === 0) {
      possible_categories.push("H — Multi-stage / Unknown (Zero-day)");
    }
  }

  return NextResponse.json({
    recon_mse,
    threshold: MSE_THRESHOLD,
    is_anomaly,
    anomaly_score: parseFloat(anomaly_score.toFixed(4)),
    risk,
    top_anomalous_features,
    possible_categories,
  });
}
