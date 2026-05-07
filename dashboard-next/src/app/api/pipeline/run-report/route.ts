import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

export async function POST() {
  const repoRoot = path.resolve(process.cwd(), "..");
  const scriptPath = path.join(repoRoot, "generate_project_report.py");

  if (!fs.existsSync(scriptPath)) {
    return NextResponse.json(
      { error: "generate_project_report.py not found", path: scriptPath },
      { status: 404 }
    );
  }

  // Try venv python first, fall back to system python
  const venvPython = path.join(repoRoot, ".venv", "Scripts", "python.exe");
  const pythonExe = fs.existsSync(venvPython) ? venvPython : "python";

  return new Promise<NextResponse>((resolve) => {
    let stdout = "";
    let stderr = "";

    const proc = spawn(pythonExe, [scriptPath], {
      cwd: repoRoot,
      env: { ...process.env },
      timeout: 120_000,
    });

    proc.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

    proc.on("close", (code) => {
      resolve(
        NextResponse.json({
          exit_code: code,
          stdout: stdout.slice(-4000),
          stderr: stderr.slice(-2000),
          success: code === 0,
        })
      );
    });

    proc.on("error", (err) => {
      resolve(
        NextResponse.json(
          { error: err.message, stdout, stderr },
          { status: 500 }
        )
      );
    });
  });
}
