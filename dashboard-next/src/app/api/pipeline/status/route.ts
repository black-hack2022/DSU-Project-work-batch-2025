import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

type FileStatus = {
  exists: boolean;
  mtime: string | null;
  size: number | null;
};

function stat(filePath: string): FileStatus {
  try {
    const s = fs.statSync(filePath);
    return {
      exists: true,
      mtime: s.mtime.toISOString(),
      size: s.size,
    };
  } catch {
    return { exists: false, mtime: null, size: null };
  }
}

export async function GET() {
  const repoRoot = path.resolve(process.cwd(), "..");

  const artifacts = {
    // Models
    gnn_model: stat(path.join(repoRoot, "gnn_model_noleak.pt")),
    transformer_model: stat(path.join(repoRoot, "transformer_tabular", "runs", "kdd", "best_model.pt")),
    autoencoder_model: stat(path.join(repoRoot, "anomaly_autoencoder_unsw", "artifacts", "unsw_ae", "model.pt")),

    // Preprocessed data / graph
    kdd_csv: stat(path.join(repoRoot, "kdd_preprocessed.csv")),
    service_graph: stat(path.join(repoRoot, "service_protocol_graph.gpickle")),
    service_stats: stat(path.join(repoRoot, "service_stats.csv")),

    // Pipeline scripts
    build_flows_script: stat(path.join(repoRoot, "security_stack", "build_flows.py")),
    build_gnn_inputs_script: stat(path.join(repoRoot, "security_stack", "build_gnn_inputs.py")),
    detect_eh_script: stat(path.join(repoRoot, "security_stack", "detect_eh.py")),
    pcap_capture_script: stat(path.join(repoRoot, "security_stack", "pcap_capture.py")),
    cicflowmeter_script: stat(path.join(repoRoot, "security_stack", "cicflowmeter.py")),

    // Report outputs
    gnn_detections: stat(path.join(repoRoot, "report_assets", "generated_report", "gnn_service_detections.csv")),
    transformer_detections: stat(path.join(repoRoot, "report_assets", "generated_report", "transformer_flow_detections.csv")),
    ae_scored: stat(path.join(repoRoot, "report_assets", "generated_report", "unsw_ae_test_scored.csv")),
    metrics_json: stat(path.join(repoRoot, "report_assets", "generated_report", "metrics.json")),

    // Report generator
    report_generator: stat(path.join(repoRoot, "generate_project_report.py")),
  };

  const stepsReady = {
    step1_capture: true, // always shown (manual, no artifact)
    step2_flows: artifacts.build_flows_script.exists,
    step3_gnn_inputs: artifacts.build_gnn_inputs_script.exists && artifacts.service_graph.exists,
    step4_detect_eh: artifacts.detect_eh_script.exists,
    step5_models: artifacts.gnn_model.exists && artifacts.transformer_model.exists && artifacts.autoencoder_model.exists,
    step6_detections: artifacts.gnn_detections.exists && artifacts.transformer_detections.exists,
    step7_report: artifacts.report_generator.exists && artifacts.metrics_json.exists,
  };

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    repo_root: repoRoot,
    artifacts,
    steps_ready: stepsReady,
  });
}
