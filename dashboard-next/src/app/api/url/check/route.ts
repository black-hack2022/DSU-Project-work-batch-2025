import { NextResponse } from "next/server";
import { scoreUrl } from "@/lib/urlScoring";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const url =
    typeof body === "object" &&
    body !== null &&
    "url" in body &&
    typeof (body as { url?: unknown }).url === "string"
      ? String((body as { url: string }).url)
      : "";
  const result = scoreUrl(url);
  return NextResponse.json(result);
}
