# User Guide: Validation & Aggregation Workflow

This guide describes how to detect data gaps, validate totals, and repair aggregated files using the scripts in `scripts/`.

## Dashboard navigation & charts

`web/index.html` lists all six views (dashboard, day, month, year, total, compare) in the nav bar
at the top of the page. At desktop widths (768px and above) the nav is always visible; below that
it collapses behind a hamburger button — tap it to open the list, tap a link (or click outside, or
press Escape) to close it again. The current view is always highlighted in the list.

Charts on the day/month/year/total/compare views are rendered with ApexCharts: hover any bar or
line to see a tooltip with the exact value and its unit (W for the day view, kWh elsewhere).
Charts resize with the browser window, and the whole layout — nav included — stays usable from
320px-wide phones up to 2560px-wide monitors with no horizontal scrolling.

The day, month, and year views each have a row above the chart with prev/next links, a "jump to
current period" link (e.g. "Heute"/"Dieser Monat"), and a link to zoom out to the next-larger
period (day → month → year → total) — e.g. from a day view, click "Monat" to jump straight to
that day's month view. The total view has no such link since it's the top of the hierarchy.

## Dynamic sky background

The cloud backdrop behind the dashboard changes with the installation's real current weather
and local time of day instead of always looking the same: cloud density (sparse/moderate/dense)
reflects the current cloud cover, a sun or moon tracks a simplified day/night arc and crossfades
smoothly around sunrise/sunset, and birds/planes/balloons/a rare moon-bound rocket occasionally
cross the sky. This runs automatically — there is nothing to configure — and refreshes every 15
minutes. If weather data can't be fetched (no network, no configured location), the backdrop
simply keeps its original static appearance; nothing else on the dashboard is affected. If your
system/browser has "reduce motion" enabled, all sky animation and flying objects are suppressed
while the cloud density/sun-moon state still updates.

## Global desktop info panel

At desktop widths (768px and above), a panel in the header — visible on every view, not just
the dashboard — shows the plant's current production alongside the current weather condition
and today's remaining forecast for the installation's location. It refreshes both every ~10
minutes (matching the SolarLog device's own minimum update interval, so a faster refresh
wouldn't find newer data anyway). A small pulsing dot next to the production value gets larger
and pulses faster the closer current output is to the plant's configured peak capacity, and
calms to idle near zero (e.g. at night). Click or tap the weather/forecast area to open a
wetteronline.de search for the installation's address in a new tab. If production or weather
data can't be retrieved, that side of the panel shows "Unavailable" while the other side keeps
working normally. The panel is hidden entirely below 768px — it contributes no extra space to
the mobile layout.

## CO2 avoidance figures

The day, month, year, and total (lifetime) views each show a "CO2 avoided" figure in the stats
panel next to the chart. It estimates the CO2 emissions avoided by generating solar power instead
of drawing that same amount of electricity from the German grid, using the Umweltbundesamt's
published yearly emission factor for the German electricity grid mix (kg CO2 per kWh) for the
calendar year the yield was produced in — a multi-year total (the lifetime view) sums each year's
own contribution rather than applying one flat factor to the whole total. Values below 10,000 kg
are shown in kg; at or above that they switch to tonnes ("t"). For the current, still-in-progress
year (and any future year), no published factor exists yet, so a fixed fallback factor
(0.363 kg/kWh) is used instead until UBA publishes that year's figure. This figure is computed
entirely from data already on the page — no additional network request is made for it.

## Prerequisites

- Node.js 22+
- Run all commands from the **repo root** (where `days_hist.js`, `months.js`, `years.js`, and `min*.js` files live)

---

## Step 1 — Detect gaps in archive data

`gap-detect.js` can check two data sources:

**Min files** (default) — scans `min*.js` filenames for missing calendar days:

```bash
node scripts/gap-detect.js
node scripts/gap-detect.js --since 2020-01-01
node scripts/gap-detect.js --output json --out-file gap-report.json
```

**`days_hist.js`** — checks for missing entries in the aggregated history file:

```bash
node scripts/gap-detect.js --source days_hist
node scripts/gap-detect.js --source days_hist --since 2020-01-01
```

Both modes produce the same output format: a human-readable list of missing date ranges, or "No gaps detected." The `--since`, `--output json`, and `--out-file` flags work with both sources.

---

## Step 2 — Validate daily totals against days_hist.js

```bash
node scripts/validate-plausibility.js
```

Compares each `minYYMMDD.js` first-line Wh total against the matching entry in `days_hist.js`. Days that differ by more than ±1 Wh (default tolerance) are flagged with per-inverter deltas.

Override the tolerance:

```bash
node scripts/validate-plausibility.js --tolerance 10
```

JSON output:

```bash
node scripts/validate-plausibility.js --output json --out-file validation.json
```

---

## Step 3 — Fill gaps in days_hist.js

For a month where entries are missing in `days_hist.js`:

Preview without writing:

```bash
node scripts/fill-days-hist.js 2026-06 --dry-run
```

Apply (confirms before writing):

```bash
node scripts/fill-days-hist.js 2026-06
```

Apply without prompt:

```bash
node scripts/fill-days-hist.js 2026-06 --force
```

The script uses a two-pass strategy per missing day:

- **Pass 1**: looks for the date in any `days*.js` file and copies Wh and feed values verbatim
- **Pass 2**: if not found in days files, reads the first line of `minYYMMDD.js` for Wh totals (feed set to 0)

Dates with no source in either pass are reported as unfillable.

---

## Step 4 — Regenerate monthly totals

```bash
node scripts/fill-months.js 2026-06 --dry-run
node scripts/fill-months.js 2026-06 --force
```

Reads all `min2606*.js` files, sums WR1 and WR2 Wh totals, and writes or updates the `mo[mx++]=` entry for that month in `months.js`.

---

## Step 5 — Regenerate annual totals

```bash
node scripts/fill-years.js 2026 --dry-run
node scripts/fill-years.js 2026 --force
```

Reads all `min26*.js` files for the year and writes or updates the `ye[yx++]=` entry in `years.js`.

---

## Agentic skills (Claude Code)

If you use Claude Code, the following skills wrap the fill scripts with a dry-run → confirm → apply flow:

```
/backfill-days-hist 2026-06
/backfill-months 2026-06
/backfill-years 2026
```

Each skill shows a preview first, asks for confirmation, then applies the change and reports a summary.

---

## Typical workflow

```
gap-detect → validate-plausibility → fill-days-hist → fill-months → fill-years
```

Run in order: detect what is missing, validate what is present, then fill from the bottom up.
