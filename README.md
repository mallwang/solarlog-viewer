# SolarLog Viewer

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/mallwang/solarlog-viewer)

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

## Dynamic sky background

The animated cloud backdrop behind the dashboard reflects the installation's real current
weather and local time of day rather than always looking the same. Coordinates are resolved
from the plant's configured address (`SKY_LOCATION_OVERRIDE` in `web/js/config.js`, or automatic
geocoding cached in `localStorage` if unset), then used to poll the free, keyless
[Open-Meteo](https://open-meteo.com) API every 15 minutes for cloud cover and sunrise/sunset:

- **Cloud density** — sparse, moderate, or dense clouds depending on the current cloud-cover
  tier (clear/partly/overcast).
- **Sun/moon position** — a sun or moon tracks a simplified day/night arc between sunrise and
  sunset, crossfading smoothly at the boundary and staying dimly visible through dense cloud.
- **Flying objects** — birds, butterflies, dragonflies, and goose V-formations cross the sky
  using animated SVG sprite sheets (realistic silhouettes, not emoji); planes, balloons, and a
  moon-bound rocket easter egg appear rarely.

Any failure (no location, no network, a failed request) falls back silently to the original
static backdrop — there is no error UI and no impact on the dashboard's PV-data functionality.
`prefers-reduced-motion: reduce` suppresses all animation and flying-object spawning while still
reflecting real conditions through static cues. See
`specs/007-dynamic-sky-weather/` for the full spec/plan.

## Global desktop info panel

A persistent panel in the header (visible at desktop widths only, `768px` and above) shows the
plant's current production, the current weather condition, and today's remaining forecast for
the installation's location — visible from every view, not just the dashboard. It polls
`data/min_cur.js` and [Open-Meteo](https://open-meteo.com) every ~10 minutes, matching the
SolarLog device's own minimum data-file update interval. A small pulsing indicator next to the
production value scales its size/speed with `currentPacW / capacityKwp` (idle near zero, most
active near the plant's configured peak output). Next to the production wattage, the panel also
shows the inverter's current efficiency (ΣPAC ÷ ΣPDC, e.g. "1234 W · 94%") whenever DC input data
is available and non-zero — omitted rather than showing a misleading 0%/∞ when it isn't. The day
detail view (`#/day/YYYY/MM/DD`) shows the same efficiency figure as a second curve on a secondary
y-axis alongside the power curve, gapped wherever PDC is zero/missing, and absent entirely for
backfilled/archived days that only have a reconstructed yield curve. Clicking the weather/forecast
area opens a wetteronline.de search for the installation's configured address in a new tab — the plant
owner's usual weather source. Production and weather/forecast each show an independent
"unavailable" state if their own data source can't be retrieved, without affecting the other.
See `specs/010-global-info-panel/` for the full spec/plan.

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

## Maintaining the CO2 emission-factor reference table

The day/month/year/total views each show a CO2 avoidance figure, computed by multiplying yield by
the German electricity grid's CO2 emission factor for the calendar year it was produced in. The
per-year factors live in `web/js/data/co2-factors.js` as a plain object
(`CO2_FACTOR_KG_PER_KWH_BY_YEAR`), sourced from the Umweltbundesamt's yearly "Entwicklung der
spezifischen Treibhausgas-Emissionen des deutschen Strommix" publication. Any calendar year not
yet in the table (the current, in-progress year, and any future year) falls back to the constant
`CO2_FALLBACK_FACTOR_KG_PER_KWH` (0.363 kg/kWh).

To add the next published year's factor once UBA releases it: convert the published g CO2/kWh
figure to kg/kWh (divide by 1000) and add it as a single new `year: factor` key to
`CO2_FACTOR_KG_PER_KWH_BY_YEAR` — no other file needs to change; every view picks it up on next
load.
