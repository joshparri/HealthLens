# Deployment notes

## GitHub Pages

This is a static app. It can be hosted from the repository root or a subfolder.

If deployed from a repo root:
1. Upload all files to the repo root.
2. Go to Settings → Pages.
3. Source: Deploy from branch.
4. Branch: `main`, folder `/root`.

If deployed from a subfolder such as `josh-health-lens/`, the app should work at:
`https://<username>.github.io/<repo>/josh-health-lens/`

## Vercel

Import the GitHub repo into Vercel.

For a standalone repo:
- Framework preset: Other
- Build command: leave blank
- Output directory: leave blank/root

For a subfolder deployment:
- Set Vercel Root Directory to `josh-health-lens`
- Build command: leave blank
- Output directory: leave blank/root

## Privacy

Do not commit real health exports, `.db`, `.sqlite`, `.zip`, pathology PDFs, ECG PDFs, or private generated reports. `.gitignore` blocks common raw health export file types.
