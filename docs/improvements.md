# Improvements & Roadmap

This document lists 10 actionable improvements to HealthLens, with suggested next steps and priorities.

1. Automated Health Connect importer (High)
   - Build ZIP upload extractor that reads `health_connect_export.db`.
   - Map tables into a normalized schema and produce daily summaries.
   - Priority: implement as a web-worker task to avoid blocking UI.

2. Android companion for daily sync (High)
   - Create a lightweight Android app to request Health Connect permissions and send daily summaries to HealthLens via a secure endpoint or local file export.
   - Start with a prototype that exports ZIPs to a watched Drive folder.

3. Normalized local storage (Medium)
   - Implement IndexedDB (e.g., `dexie.js`) schema matching `daily_health_summary`, `sleep_sessions`, `lab_results`, etc.
   - Store source provenance, file hash, and import metadata for auditability.

4. Robust PDF & lab-parser (Medium)
   - Add targeted parsers for pathology PDFs using `pdfjs` + heuristic lab-value extraction.
   - Add confidence scores and flag uncertain parses for manual review.

5. UI: Import preview + history (High)
   - Add an Import page with drag-and-drop, preview, detected date range, warnings, and import history.
   - Allow cancel/revert of imports and show provenance per row.

6. Privacy & export controls (High)
   - Add clear privacy UI, export-delete-all-data controls, and an encrypted local backup option.
   - Do not auto-send PDFs to third-party AI; always ask and show what will be sent.

7. Performance: parsing in web workers (Medium)
   - Move large parsing (ZIP/SQLite/PDF) into web workers and use streaming parsing for large files.
   - Use `sql.js` in a worker for SQLite reads.

8. Tests & CI (Medium)
   - Add unit tests for parsers and core mapping logic.
   - Add GitHub Actions to run lint, build, and tests on PRs.

9. Visual dashboards & comparisons (Medium)
   - Add charts for last 7/30/90 days: sleep, steps, resting HR, HRV by source.
   - Add period comparison and anomaly detection highlights.

10. Connector roadmap & automation (Low→Medium)
   - Add staged connectors: Drive folder watcher (serverless), Fitbit OAuth, Withings OAuth.
   - Document automation options and required secrets (do not store tokens client-side insecurely).

Current progress
- SQLite parsing now runs through a worker and produces an evidence-grounded Data Pack instead of raw sample rows.
- Provider errors now include the actual HTTP status/message and practical hints.
- Supabase sync/dashboard plumbing exists; sync endpoint positive-path tests now cover success, idempotency, zero values, and summary-insert cleanup.
- Supabase dashboard summaries now have test coverage for empty data, zero values, mixed warning payloads, and chart-ready rows.
- Synced Supabase rows can now be converted into a Data Pack for the existing AI analysis flow.
- Completed analyses now export Markdown, structured JSON evidence bundles, and browser print/save-as-PDF output.
- Android scaffold can now send a manual fake daily summary payload to the production sync endpoint for on-device pipe testing.
- In-app settings now include local session/import clearing and provider-key clearing.

Next steps
- Add admin self-test positive-path tests with a mocked Supabase admin client.
- Add browser-level screenshot checks for the Supabase dashboard charts.
- Build the real Android Health Connect reader after the web sync loop is proven.
