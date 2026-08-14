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

The day view's chart legend includes a single "UDC (V)" entry for the DC string voltage, with its
own right-hand axis — clicking it reveals a bold average line (averaged across all reporting
inverter strings, not summed — a sum would read as an implausible reading above 1000 V) with a soft
shaded band behind it, spanning that point's lowest-to-highest string reading, so you can see how
much the strings varied at a glance as well as the average. It's hidden by default so the chart
isn't cluttered; clicking it again hides both the line and the band together. Hovering the chart
while it's visible shows the average in the tooltip in bold with a "Min: … V / Max: … V" line
beneath it. That shown/hidden choice is remembered across page reloads and other day charts, so a
revealed UDC line stays revealed until you hide it again. Days with no recorded voltage data (e.g.
backfilled/archived days that only show the reconstructed yield curve) don't offer the UDC legend
entry at all, since there's nothing to plot. The day chart's three
y-axes (feed-in W, Wirkungsgrad %, UDC V) always use the same fixed range and gridline spacing
regardless of the day, so a low-yield day doesn't visually stretch to look as strong as a
high-yield one, and the scale doesn't jump around as you page between days. The x-axis normally
zooms to just the times that day actually has data for (with a small pad on each side so the line
doesn't start/end flush against the plot edge, which also makes those points easier to hover); a
site administrator can switch it to always show the full 00:00–24:00 day instead — see
`DAY_CHART_AXES`, `DAY_CHART_X_AXIS_RANGE`, and `DAY_CHART_X_AXIS_PADDING_MINUTES` in
`web/js/config.js`. The month, year, and total (lifetime) views show a "Gesamt" / "Wechselrichter"
toggle above the chart: "Gesamt" (the default) shows the single combined bar per period exactly
as before, while switching to "Wechselrichter" breaks each bar into one stacked segment per
inverter string (WR1, WR2, …), with the tooltip then showing the combined total alongside each
string's individual value. The chosen mode is remembered (stored in the browser) and applied
again automatically the next time any of these three views is opened. Clicking any part of a bar,
in either mode, still drills into the next-finer view exactly as before.

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
and today's remaining forecast for the installation's location. Production (and the "Today's
yield"/"Month's yield" figures) refreshes on the same schedule as the day view's chart (see "Day
view auto-refresh" below) — one shared setting, so the two never drift out of sync. The weather/
forecast side refreshes on its own, slower schedule (every ~10 minutes by default), since weather
doesn't change meaningfully minute to minute. A small pulsing dot next to the production value gets larger
and pulses faster the closer current output is to the plant's configured peak capacity, and
calms to idle near zero (e.g. at night). Next to the production wattage, the panel shows the
inverter's current efficiency (AC output ÷ DC input, e.g. "1234 W · 94%") whenever DC input is
available and non-zero — hidden rather than showing a misleading 0%/∞ when it isn't. The day
view (`#/day/YYYY/MM/DD`) shows the same efficiency figure as a second curve alongside the power
curve, gapped wherever DC input is zero or missing, and not shown at all for backfilled/archived
days that only have a reconstructed yield curve. Click or tap the weather/forecast area to open a
wetteronline.de search for the installation's address in a new tab. If production or weather
data can't be retrieved, that side of the panel shows "Unavailable" while the other side keeps
working normally. The panel is hidden entirely below 768px — it contributes no extra space to
the mobile layout.

## Day view auto-refresh

When the day view (`#/day/YYYY/MM/DD`) is showing _today_, it keeps itself current on its own: it
periodically re-fetches today's readings and redraws the stats panel, the chart, and the data
table in place — so you can leave the page open for hours (e.g. on a wall display) and it will
keep showing new readings without a manual reload. A failed refresh attempt is skipped silently,
leaving the last good reading on screen rather than clearing the view. Days other than today never
auto-refresh, since their data is archived and no longer changes. This uses the same refresh
interval as the info panel's production/yield figures above — one setting for both, so the nav bar
and the day chart always show data of the same age. The interval defaults to 1 minute and can be
changed by a site administrator via `DATA_REFRESH_INTERVAL_MS` in `web/js/config.js` (the info
panel's weather/forecast poll has its own separate, slower interval,
`WEATHER_REFRESH_INTERVAL_MS`).

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
