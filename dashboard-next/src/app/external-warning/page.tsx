import Link from "next/link";

function safeUrl(raw: string | null): { ok: boolean; url?: URL; reason?: string } {
  if (!raw) return { ok: false, reason: "Missing 'to' query parameter" };
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, reason: "Only http/https URLs are allowed" };
    }
    return { ok: true, url: u };
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
}

export default async function ExternalWarningPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await props.searchParams) ?? {};
  const toRaw = sp.to;
  const to = Array.isArray(toRaw) ? toRaw[0] : toRaw;

  const parsed = safeUrl(to ?? null);

  return (
    <div className="p-5 flex items-start justify-center min-h-64">
      <div className="max-w-xl w-full space-y-4 rounded-lg p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">⚠</span>
          <h1 className="text-lg font-bold">Leaving IS-HAITI Dashboard</h1>
        </div>

        {!parsed.ok ? (
          <>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{parsed.reason}</p>
            <Link className="text-sm underline" href="/dashboard" style={{ color: "#3b82f6" }}>
              ← Back to dashboard
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              You are about to navigate to an external URL. Verify the destination before continuing.
            </p>
            <div
              className="rounded p-3 text-sm font-mono break-all"
              style={{ background: "rgba(0,0,0,0.4)", color: "#94a3b8", border: "1px solid var(--border)" }}
            >
              {parsed.url!.toString()}
            </div>
            <div className="flex gap-3">
              <a
                className="rounded px-4 py-2 text-sm font-medium"
                href={parsed.url!.toString()}
                target="_blank"
                rel="noreferrer noopener"
                style={{ background: "#3b82f6", color: "white" }}
              >
                Continue →
              </a>
              <Link
                className="rounded px-4 py-2 text-sm"
                href="/dashboard"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                Cancel
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
