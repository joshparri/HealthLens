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

## Still To Do

- Add admin self-test positive-path tests with a mocked Supabase admin client.
- Add dashboard tests for empty Supabase data and fake synced data.
- Add browser-level screenshot checks for the Supabase dashboard charts.
- Run the fake sync script against production when `HEALTHLENS_SYNC_SECRET` is available locally.
- Build real Android Health Connect reads instead of the current placeholder button.
- Add charts for synced steps, sleep, HRV, resting HR, respiratory rate, weight, and exercise minutes.
- Build exportable report types beyond Markdown copy/download.
- Add stronger PDF lab-value extraction and clinical-document structure.

## Deployment Rule

After each major change, run:

```bash
npm test
npm run build
```

Only push after those checks pass so Vercel receives a buildable branch.
