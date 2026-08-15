# SolarLog Viewer

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/mallwang/solarlog-viewer)

Static viewer for SolarLog data exports (HTML/JS/CSS). `web/` is the single directory FTP'd to
the Synology DiskStation — `web/index.html` is a single-page dashboard (vanilla ES modules,
Tailwind CSS compiled to a static file, ApexCharts) showing current production plus the four
summary totals (today/month/year/lifetime), with hash-routed detail views for daily, monthly,
yearly, lifetime, and year-over-year comparison charts (`#/day/YYYY/MM/DD`, `#/month/YYYY/MM`,
`#/year/YYYY`, `#/total`, `#/compare`), plus an "Ereignisse" (events) page (`#/events`) listing
every inverter status/fault event from `web/data/events.js`/`web/data/events_day.js`, filterable
by inverter/day/status/error and sortable by start time/inverter/duration — see
[Ereignisse (events) page](#ereignisse-events-page) below. All views share one Tailwind-based
visual design in both light and dark mode. A responsive navigation menu lists all views and
highlights the active one — persistent at desktop widths, a hamburger-triggered menu below
~768px, usable from 320px to 2560px wide with no horizontal scrolling. DE/EN language selection
persists across reloads. The previous frameset-based site is preserved read-only under
`legacy-site/`.

SolarLog data is split across `web/hist/` (frozen historical data through 2026-07-28, from the
original device) and `web/data/` (the current device's live, continuously-overwritten output
since its 2026-07-29 installation); the app merges the two wherever a query spans that boundary
— see `specs/001-website-modernization/data-model.md`. The month/year/total/dashboard/welcome
views and the info panel all load their `months.js`/`years.js`/`days_hist.js` aggregates through
one shared helper (`fetchFromBothSources`, `web/js/data/data-source.js`), which caches each file
in memory (`web/js/data/fetch-cache.js`) instead of re-fetching on every navigation: `hist/*` is
cached for the page's lifetime since it never changes, `data/*` for `DATA_REFRESH_INTERVAL_MS`
since the live device only rewrites it once a day at boot. A full reload starts the cache over.

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
`data/min_cur.js` (plus `days.js`/`months.js` for the yield figures) every
`DATA_REFRESH_INTERVAL_MS` (`web/js/config.js`, default 1 minute) — the same constant the day
detail view's own auto-refresh uses (see below), so the nav bar and the day chart never drift out
of sync with each other. [Open-Meteo](https://open-meteo.com) polls separately on its own, slower
`WEATHER_REFRESH_INTERVAL_MS` (default 10 minutes) — weather doesn't change meaningfully minute to
minute, so polling it as often as the PV data would just waste requests. A small pulsing indicator
next to the
production value scales its size/speed with `currentPacW / capacityKwp` (idle near zero, most
active near the plant's configured peak output). Next to the production wattage, the panel also
shows the inverter's current efficiency (ΣPAC ÷ ΣPDC, e.g. "1234 W · 94%") whenever DC input data
is available and non-zero — omitted rather than showing a misleading 0%/∞ when it isn't. The day
detail view (`#/day/YYYY/MM/DD`) shows the same efficiency figure as a second curve on a secondary
y-axis alongside the power curve, gapped wherever PDC is zero/missing, and absent entirely for
backfilled/archived days that only have a reconstructed yield curve. The day chart also carries a
single "UDC" (DC string voltage) legend entry with its own right-hand axis, drawn as a bold average
line (averaged rather than summed across reporting strings — a sum would produce an implausible
reading above 1000 V) with a soft shaded band behind it spanning that point's min/max across
strings; internally these are two ApexCharts series (a rangeArea band plus a line), but the band's
own legend row is hidden (via a CSS rule keyed to its runtime legend index — see
`hideUdcRangeLegendEntry` in `web/js/charts/chart-factory.js`) and its visibility is kept in
lockstep with the line's on every click, so the pair behaves as one activation point. Hidden by
default and revealed via a click on the legend entry, omitted entirely on days with no voltage
data. That shown/hidden choice is remembered (`localStorage`) and applied to the next day chart
opened. The tooltip shows the average in bold with a "Min: … / Max: …" detail line beneath whenever
UDC is visible. The day chart's three y-axes (feed-in W, Wirkungsgrad %, UDC V) use fixed
ranges/tick steps rather than scaling to
each day's own data, so days are visually comparable at a glance and the scale doesn't jump around
while paging between days; the x-axis defaults to spanning just that day's actual data (padded a
configurable number of minutes on each side so the line's start/end aren't flush against the plot
edge) but can be switched to always span the full 00:00–24:00 day instead — all configurable via
`DAY_CHART_AXES`, `DAY_CHART_X_AXIS_RANGE`, and `DAY_CHART_X_AXIS_PADDING_MINUTES` in
`web/js/config.js`. The month/year/total (lifetime) bar charts offer a persisted "Gesamt" /
"Wechselrichter" toggle above the chart: "Gesamt" (default) shows the single combined bar exactly
as before this feature; switching to "Wechselrichter" stacks one segment per inverter string
instead, with the tooltip then showing the combined total plus each string's value. The selection
is remembered (`localStorage`) across reloads and between the three views. Drill-down-by-click
still works on any bar/segment in either mode. Clicking the weather/forecast area opens a
wetteronline.de search for the installation's configured address in a new tab — the plant owner's
usual weather source. Production and weather/forecast each show an independent "unavailable" state
if their own data source can't be retrieved, without affecting the other. See
`specs/010-global-info-panel/` for the full spec/plan.

The day detail view (`#/day/YYYY/MM/DD`) auto-refreshes itself the same way when it's showing
_today_: every `DATA_REFRESH_INTERVAL_MS` (the same constant the info panel uses, above) it
re-fetches `min_day.js` and redraws the stats panel, the chart, and the data table in place — so
the page can be left open for hours (e.g. on a wall display) and keep reflecting new
readings without a manual reload. Past days don't poll, since their min files are static once
archived. A failed refresh is skipped silently, leaving the last good reading on screen rather than
clearing the view. The welcome page (`#/`, "Anlageninfo") auto-refreshes its today-chart and
yield-summary stats card on the same `DATA_REFRESH_INTERVAL_MS` cycle, so all three "live" surfaces
— nav bar, day chart, welcome page — always agree on how current their figures are.

## Ereignisse (events) page

`#/events` renders every inverter status/fault event as one deduplicated, most-recent-first
table, combining the historical archive (`web/data/events.js`) and the current day's log
(`web/data/events_day.js`) — an event still without an end time (today's most recent one) shows
a pulsing "aktiv" badge instead of a blank cell. Status/error codes are decoded per-inverter via
`StatusCodes[]`/`FehlerCodes[]` in `web/data/base_vars.js` (the same numeric code means different
things on WR1 vs. WR2); an out-of-range status code falls back to "Offline", an out-of-range
error code shows its raw numeric code. Four dropdown filters (Wechselrichter/Tag/Status/Fehler,
combinable, with removable chips and a reset button) narrow the table without re-fetching; the
Von–Bis/WR/Dauer column headers sort (click to toggle direction) within whatever the filters
currently show. See `web/js/data/events.js` (parsing/merge/dedupe/label-resolution, no DOM) and
`web/js/views/events-view.js` (rendering + filter/sort state).

## Dev server

```bash
npm install
npm run start
npm run open
```

Starts the dev server at http://localhost:3000 — entry point is `web/index.html`. `npm start` runs
the Tailwind CLI in `--watch` mode alongside `browser-sync`, so CSS changes hot-reload too.
Run `npm run open` to open the viewer in your default browser.

`bs-config.cjs` proxies every `/data/*` and `/hist/*` request straight through to the live
SolarLog device at `https://wolfsbach.synology.me` instead of serving `web/data/`/`web/hist/`
from disk, so the dev server always shows current readings without a manual sync. `web/data/`
and `web/hist/` are themselves untracked (`.gitignore`) — they're the device's own live/frozen
data mirror, not versioned source — so a fresh clone starts with them empty; run the `sync-ftp`
skill (or `scripts/ftp-sync.js --apply --yes --direction download`) to populate them before using
anything that isn't served through `npm start`. This proxying only applies to `npm start` —
scripts that read `web/data/`/`web/hist/` from the filesystem (backfill, `gap:detect`,
`validate:plausibility`, sqlite sync, the `sync-ftp` skill) still need the local files kept in
sync separately.

`npm run build:css` compiles `web/css/tailwind.css` into the committed `web/css/tailwind.generated.css`
static file used in production — no CDN/runtime script.

## Production build & deploy

`npm run build` (`scripts/build.js`) produces `dist/`, the tree that actually gets FTP'd —
`web/` itself is deploy-only in the sense that it's the dev-server-served source, not what ships.
The build bundles+minifies the whole JS import graph into one `js/main-<sha>.js` and the three
stylesheets into one `css/styles-<sha>.css` (`<sha>` = the current git short SHA), and rewrites
`dist/index.html` to reference them — this is the cache-busting fix: every deploy gets fresh,
never-before-seen asset URLs, so browsers can no longer serve a stale cached copy after an update.
`i18n/*.json`, `img/plant/*.jpg`, and `vendor/*.svg` are copied through unchanged but cache-busted
with a `?v=<sha>` query string instead of a renamed file, since those paths are referenced at
runtime rather than known at build time. `dist/data`/`dist/hist` are symlinks to `web/data`/`web/hist`
(the SolarLog device's own live/frozen data mirror — untouched by the build). Run `npm run build`
before syncing; `scripts/ftp-sync.js` (and the `sync-ftp` skill) diff/upload `dist/`, not `web/`.

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
