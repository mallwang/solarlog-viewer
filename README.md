# SolarLog Viewer

Static viewer for SolarLog data exports (HTML/JS/CSS). `web/` is the single directory FTP'd to
the Synology DiskStation — `web/index.html` is a single-page dashboard (vanilla ES modules,
Tailwind CSS compiled to a static file, ApexCharts) showing current production plus the four
summary totals (today/month/year/lifetime), with hash-routed detail views for daily, monthly,
yearly, lifetime, and year-over-year comparison charts (`#/day/YYYY/MM/DD`, `#/month/YYYY/MM`,
`#/year/YYYY`, `#/total`, `#/compare`). All six views share one Tailwind-based visual design in
both light and dark mode. A responsive navigation menu lists all six views and highlights the
active one — persistent at desktop widths, a hamburger-triggered menu below ~768px, usable from
320px to 2560px wide with no horizontal scrolling. DE/EN language selection persists across
reloads. The previous frameset-based site is preserved read-only under `legacy-site/`.

SolarLog data is split across `web/hist/` (frozen historical data through 2026-07-28, from the
original device) and `web/data/` (the current device's live, continuously-overwritten output
since its 2026-07-29 installation); the app merges the two wherever a query spans that boundary
— see `specs/001-website-modernization/data-model.md`.

## Dev server

```bash
npm install
npm run start
npm run open
```

Starts the dev server at http://localhost:3000 — entry point is `web/index.html`. `npm start` runs
the Tailwind CLI in `--watch` mode alongside `browser-sync`, so CSS changes hot-reload too.
Run `npm run open` to open the viewer in your default browser.

`npm run build:css` compiles `web/css/tailwind.css` into the committed `web/css/tailwind.generated.css`
static file used in production — no CDN/runtime script.

## Frontend tests

```bash
npm test               # Playwright e2e — tests/e2e/*.spec.js
npm run test:scripts   # node:test unit tests for web/js/data/* parsers and web/js/**
npm run lint
npm run format:check
```

## Data files

The `min*.js` files (one per day, ~7000+ files) contain the raw solar yield data exported from the SolarLog device. The `days*.js` and `days_hist*.js` files contain aggregated daily/monthly summaries.

## Validation & Aggregation Scripts

Run from the repo root with Node.js 22+.

**Detect missing daily files (scans `min*.js` filenames):**

```bash
node scripts/gap-detect.js
node scripts/gap-detect.js --since 2020-01-01
node scripts/gap-detect.js --output json --out-file gap-report.json
```

**Detect missing entries in `days_hist.js`:**

```bash
node scripts/gap-detect.js --source days_hist
node scripts/gap-detect.js --source days_hist --since 2020-01-01
```

**Cross-check min file totals against `days_hist.js`:**

```bash
node scripts/validate-plausibility.js
node scripts/validate-plausibility.js --tolerance 10
```

**Fill missing entries in `days_hist.js` for a month (two-pass: days files → min file):**

```bash
node scripts/fill-days-hist.js 2026-06 --dry-run
node scripts/fill-days-hist.js 2026-06 --force
```

**Regenerate a monthly total in `months.js`:**

```bash
node scripts/fill-months.js 2026-06 --dry-run
node scripts/fill-months.js 2026-06 --force
```

**Regenerate an annual total in `years.js`:**

```bash
node scripts/fill-years.js 2026 --dry-run
node scripts/fill-years.js 2026 --force
```

**Agentic skills (Claude Code):**

```
/backfill-days-hist 2026-06
/backfill-months 2026-06
/backfill-years 2026
```
