# HealthLens Progress

Last updated: 2026-05-31

## Current Focus

The active milestone is the dependable MVP loop:

1. Upload health data.
2. Produce a deterministic, evidence-grounded Data Pack.
3. Run AI analysis with clear provider diagnostics.
4. Sync daily summaries through Supabase.
5. Show synced data in the dashboard.
6. Keep Android Health Connect as the next automation step after the web loop is stable.

## Completed In This Pass

- Fixed the `npm run fake-sync` command for modern Node by removing the invalid `--input-type=module` flag.
- Changed Supabase latest-import loading to tolerate an empty `health_sync_imports` table without treating it as a connection failure.
- Reworked ZIP parsing so an embedded Health Connect SQLite database is parsed into a structured inventory instead of being queued in a background path.
- Rebuilt SQLite worker output into a deterministic HealthLens Data Pack:
  - table counts
  - matched metric groups
  - date ranges
  - source hints
  - numeric summaries
  - candidate daily aggregates
  - data-quality warnings
  - explicit parser limitations
- Removed raw SQLite sample-row dumps from fallback parsing so binary/noisy rows are not sent to AI.
- Improved AI provider errors so Groq/OpenRouter/Anthropic failures show HTTP status, provider message, and a practical hint.
- Added prompt-size budgeting so large health files are truncated deliberately rather than causing vague provider failures.
- Updated provider model lists for currently available Groq/OpenRouter options checked during this pass.
- Added focused tests for prompt/data-pack truncation.
- Hardened the Health Connect sync endpoint positive path:
  - exported an injectable handler for tests
  - added mocked success/idempotency/cleanup tests
  - preserved legitimate zero values such as 0 steps or 0 sleep minutes
  - cleaned up the import row if summary insertion fails
- Added testable Supabase dashboard summarisation and trend chart data:
  - empty rows return a clean empty state
  - zero values stay visible
  - warnings can come back from Supabase as arrays or JSON strings
  - chart rows are prepared for steps, sleep, HRV, resting HR, weight, and exercise
- Added an "Analyse synced data" dashboard action that converts the selected Supabase range into a deterministic Data Pack for the existing AI analysis/report flow.
- Added report exports for completed analyses:
  - Markdown
  - structured JSON with evidence files, selected modes, provider/model, and medical boundary
  - browser print/save-as-PDF path
- Upgraded the Android scaffold from a dead placeholder to a manual test sender that posts one Android-style daily summary payload to the sync endpoint.
- Added in-app privacy/settings controls to clear the current upload session, IndexedDB imports, and browser-stored AI provider keys.
- Added `npm run doctor` as a one-command automation check for tests, build, live app, sync endpoint auth boundary, optional provider health checks, and optional fake production sync/cleanup.
- Added a GitHub Actions HealthLens Doctor workflow that can run the doctor manually or daily, using repository secrets when present.
- Added admin self-test positive-path tests with a mocked Supabase admin client, covering insert/query/idempotency/cleanup and blocked non-test cleanup.
- Added Playwright browser smoke tests for the Supabase dashboard charts across desktop and mobile, with mocked Supabase responses in CI.
- Removed the unused Recharts dependency after replacing dashboard trends with lightweight SVG charts.

## Still To Do

- Add a proper Reports page for saved Markdown/JSON/PDF output history.
- Replace Android manual test payloads with real Health Connect aggregate reads.
- Add Supabase server-side deletion/export controls if remote data management becomes necessary.
- Add `HEALTHLENS_SYNC_SECRET` to GitHub Actions secrets if we want unattended production fake-sync checks.
- Run the fake sync script against production when `HEALTHLENS_SYNC_SECRET` is available locally.
- Build real Android Health Connect reads instead of the current placeholder button.
- Add stronger PDF lab-value extraction and clinical-document structure.

## Minimal User Setup

To keep manual setup small:

1. Add `HEALTHLENS_SYNC_SECRET` to Vercel and GitHub Actions secrets.
2. Add at least one AI provider key in the web app, or add provider keys to GitHub Actions secrets for automated provider checks.
3. Use the Android companion's manual sync button for pipe testing until real Health Connect reads are implemented.

## Deployment Rule

After each major change, run:

```bash
npm test
npm run build
```

Only push after those checks pass so Vercel receives a buildable branch.
