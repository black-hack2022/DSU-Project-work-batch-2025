import path from "path";
import fs from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { resolveArtifactBases } from "@/lib/artifactPaths";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".csv": "text/csv",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const bases = resolveArtifactBases();
  // slug is relative to baseDir (covers both generated_report/ and module_reports/)
  const relative = slug.join("/");
  const filePath = path.join(bases.baseDir, relative);

  // Prevent path traversal
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(path.normalize(bases.baseDir))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let data: Buffer;
  try {
    data = await fs.readFile(normalized);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(normalized).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=60",
    },
  });
}
