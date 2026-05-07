# Threat Intelligence Dashboard (Next.js)

This Next.js dashboard reads the existing project report artifacts (metrics, E–H detection pages, module reports) and exposes:

- A–H dashboard landing
- Metrics viewer (from `metrics.json`)
- E–H detection pages (embedded)
- URL check (local lexical scoring)
- External URL warning interstitial

## Run

From `d:\majoproj\dashboard-next`:

```bash
npm run dev
```

Open http://localhost:3000

## Artifact paths

By default it looks for artifacts in this order:

1) `DASHBOARD_ARTIFACTS_BASE` (if set)
2) `..\\..\\deliverables\\final_bundle\\report_assets\\`
3) `..\\..\\report_assets\\`

If your artifacts are somewhere else, set:

```bat
set DASHBOARD_ARTIFACTS_BASE=D:\\majoproj\\deliverables\\final_bundle\\report_assets
```

## Notes

- The `/api/url/check` endpoint is intentionally offline and safe. It uses local lexical heuristics.
- For the full URL detector outputs, use the bundled module reports under `report_assets/module_reports/`.
