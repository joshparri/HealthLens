# Improvements & Roadmap

This document lists 10 actionable improvements to HealthLens, with suggested next steps and priorities.

1. Automated Health Connect importer (Done)
   - Build ZIP upload extractor that reads `health_connect_export.db`.
   - Map tables into a normalized schema and produce daily summaries.
   - Priority: implement as a web-worker task to avoid blocking UI.

2. Android companion for daily sync (Done - Scaffold & Reading logic)
   - Create a lightweight Android app to request Health Connect permissions and send daily summaries to HealthLens via a secure endpoint or local file export.
   - Android scaffold and Health Connect reading logic implemented in `android/HealthLensSync/`.

3. Normalized local storage (Done)
   - Implement IndexedDB (e.g., `dexie.js`) schema matching `daily_health_summary`, `sleep_sessions`, `lab_results`, etc.
   - Store source provenance, file hash, and import metadata for auditability.
   - Source priority and deduplication implemented.

4. Robust PDF & lab-parser (Medium)
   - Add targeted parsers for pathology PDFs using `pdfjs` + heuristic lab-value extraction.
   - Add confidence scores and flag uncertain parses for manual review.

5. UI: Import preview + history (Done)
   - Add an Import page with drag-and-drop, preview, detected date range, warnings, and import history.
   - Allow cancel/revert of imports and show provenance per row.

6. Privacy & export controls (High)
   - Add clear privacy UI, export-delete-all-data controls, and an encrypted local backup option.
   - Do not auto-send PDFs to third-party AI; always ask and show what will be sent.

7. Performance: parsing in web workers (Done)
   - Move large parsing (ZIP/SQLite/PDF) into web workers and use streaming parsing for large files.
   - Use `sql.js` in a worker for SQLite reads.

8. Tests & CI (Done)
   - Add unit tests for parsers and core mapping logic.
   - Add GitHub Actions to run lint, build, and tests on PRs.

9. Visual dashboards & comparisons (In Progress)
   - Add charts for last 7/30/90 days: sleep, steps, resting HR, HRV by source.
   - Supabase dashboard implemented for daily summaries.

10. Connector roadmap & automation (In Progress)
   - Add staged connectors: Drive folder watcher (serverless), Fitbit OAuth, Withings OAuth.
   - Sync endpoint `/api/sync/health-connect` and fake sync script implemented.

Next steps
- Create `docs/improvements.md` (this file).
- Update `README.md` and `docs/plan.md` to reference this roadmap.
- Implement the Health Connect importer as the first code task.
