# SolarLog Viewer

Static viewer for SolarLog data exports (HTML/JS/CSS).

## Dev server

```bash
npm install
npm run start
npm run open
```

Starts the dev server at http://localhost:3000 — entry point is `index.html`.  
Run `npm run open` to open the viewer in your default browser.

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
