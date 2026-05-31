# HealthLens

A personal health data analysis app powered by Groq, OpenRouter, or Anthropic. Upload wearable exports, pathology reports, and health CSVs for evidence-grounded personal health insights.

> ⚕️ **Not medical advice** — for personal reflection only.

## Features

- **Upload anything**: CSV, PDF, JSON, ZIP archives, SQLite .db (Health Connect), plain text
- **9 analysis modes**: Quick summary, deep patterns, clinical review, sleep, movement, HRV/recovery, nutrition, 90-day action plan, period comparison
- **Streaming AI analysis** via Groq, OpenRouter, or Anthropic
- **Follow-up chat**: Ask questions about your data after analysis
- **Download results** as Markdown, JSON evidence bundle, or print/PDF
- **API key stored locally** — never leaves your browser

## One-command automation check

Run the HealthLens doctor whenever you want AI to check the boring plumbing:

```bash
npm run doctor
```

It runs tests/build, checks the live app, verifies the sync endpoint auth boundary, and tests provider keys if these env vars are present:

- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `ANTHROPIC_API_KEY`

To also send and clean up one fake production sync row:

```bash
HEALTHLENS_SYNC_SECRET=your_secret_here npm run doctor -- --sync --cleanup
```

The script never prints secret values.

For browser-level dashboard smoke tests:

```bash
npm run test:browser
```

This starts the Vite app with mocked Supabase data and checks the synced dashboard charts on desktop and mobile Chromium.

## Minimal setup path

For the most automated setup, do these once:

1. Add the Vercel environment variables listed below so the deployed app can read/write Supabase safely.
2. Add the same `HEALTHLENS_SYNC_SECRET` to GitHub Actions secrets so the scheduled Doctor workflow can test live sync automatically.
3. Add at least one AI provider key in the web app settings, or add provider keys to GitHub Actions secrets if you want the Doctor workflow to check providers too.

After that, normal updates are: Codex changes code, runs tests/build, pushes to GitHub, and Vercel deploys.

## Deploy on Vercel (recommended)

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Framework: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy — done.

### Environment variables for Supabase

To enable the live Supabase dashboard, configure these Vercel environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`
- `HEALTHLENS_SYNC_SECRET` (for secure sync and admin cleanup)

## Supabase live dashboard

The app now reads real synced data from Supabase and includes a Sync Status dashboard section for `daily_health_summary`.

If no synced health rows exist, it shows:

> “No synced health data yet. Use Android HealthLens Sync or manual upload.”

## Admin endpoint safety

The admin endpoint at `/api/admin/self-test` is secured for system checks and cleanup.
It requires bearer auth via `HEALTHLENS_SYNC_SECRET`, does not expose secrets, and only operates on explicit test imports.

## Android sync app

A minimal Android app lives in `android/HealthLensSync`. It can send a manual fake daily summary to the production sync endpoint and is being extended for real Health Connect reads.

## Fake sync test

Run the built-in fake sync test script locally with the environment variables set:

```bash
HEALTHLENS_SYNC_SECRET=your_secret_here npm run fake-sync
```

To clean up the test rows, use:

```bash
HEALTHLENS_SYNC_SECRET=your_secret_here npm run fake-sync -- --delete-test-data
```

## Deploy on GitHub Pages

```bash
npm run build
# Then use gh-pages branch or GitHub Actions to serve /dist
```

## License & Contributing

This project is licensed under the [MIT License](LICENSE). Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Local Development

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## How to use

1. Connect Groq, OpenRouter, or Anthropic
2. Upload health data files
3. Select analysis modes
4. Click Analyse
5. Read results, ask follow-up questions in chat

## Supported file types

| Type | Use case |
|------|----------|
| `.db` | Health Connect SQLite export |
| `.csv` | Fitbit, Garmin, wearable exports |
| `.pdf` | Pathology reports, blood tests |
| `.zip` | Withings, Garmin bulk exports |
| `.json` | App exports (Oura, etc.) |
| `.txt/.md` | Notes, reports |

## Tech stack

- React 18 + Vite
- Tailwind CSS
- Groq/OpenRouter/Anthropic AI providers
- sql.js (SQLite in-browser)
- JSZip (ZIP parsing)
- pdfjs-dist (PDF text extraction)
- react-dropzone
- react-markdown
- recharts (Health data visualization)

## Privacy

- All file parsing happens in your browser
- Only extracted Data Packs are sent to the AI provider you choose
- API key stored in localStorage — clear browser data to remove it
- Local imports can be cleared from Settings

## Automation: GitHub Actions

This repository includes GitHub Actions workflows to help automate CI, production checks, and optional doc formatting:

- `.github/workflows/ci.yml` — runs on `push` and `pull_request`, installing dependencies and running lint/test/build steps.
- `.github/workflows/healthlens-doctor.yml` — runs manually or once daily, executing `npm run doctor -- --sync --cleanup` against the live Vercel app. Add the optional repository secrets below to turn on provider checks and production fake-sync checks.
- `.github/workflows/dispatch-apply.yml` — a manually-triggered workflow (`workflow_dispatch`) that runs `.github/scripts/apply_changes.sh` to format docs and commit changes back to `main` when there are updates.
