# Josh Health Lens

A local-first health data analysis MVP for messy wearable and health exports.

It can ingest:

- Health Connect SQLite `.db` files in-browser via sql.js CDN where browser memory allows
- CSV daily metrics exports
- JSON arrays/records
- PDF/text/Markdown reports with cautious light extraction
- ZIP files are listed but should be unpacked before upload

It produces:

- File inventory
- Source/date/metric coverage
- Data quality warnings
- Trend dashboard
- Analysis lenses: plain-English, medical boundary, sleep, recovery, exercise, longevity, ADHD/regulation, family/work sustainability, faith, Blue Zones, Blueprint, correlations, anomalies
- Practical experiment suggestions
- Markdown report export

## Important safety note

This is personal health pattern analysis, not medical advice. Discuss medical concerns, symptoms, pathology results, ECG findings, chest pain, fainting, palpitations, abnormal breathlessness, or medication decisions with a GP or qualified clinician.

## Run locally

Because this is a static app, you can open `index.html` directly. For best results, run a local server:

```bash
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

## Health Connect extraction fallback

Large Health Connect databases may be too heavy for browser parsing. A local Python extraction tool is included:

```bash
python tools/extract_health_connect.py /path/to/health_connect_export.db daily_metrics.csv
```

Then upload the generated `daily_metrics.csv` into the app.

## Deploy

The app is static and works on GitHub Pages or Vercel. See `docs/deployment.md`.

## Privacy

Do not commit raw health exports. `.gitignore` blocks common private health data file types.
