# User Guide: SolarLog Viewer

English · [Deutsch](user-guide.de.md)

This guide covers how to use the deployed SolarLog Viewer dashboard. Looking to run the project
locally or work with the validation/aggregation scripts instead? See the
[README](../README.md) and [Developer Guide](developer-guide.md).

## Table of contents

1. [Dashboard navigation & charts](#dashboard-navigation--charts)
2. [Statistics page](#statistics-page)
3. [Ereignisse (events) page](#ereignisse-events-page)
4. [Dynamic sky background](#dynamic-sky-background)
5. [Global desktop info panel](#global-desktop-info-panel)
6. [Day view & welcome page auto-refresh](#day-view--welcome-page-auto-refresh)
7. [CO2 avoidance figures](#co2-avoidance-figures)
8. [Explanatory tooltips](#explanatory-tooltips)

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

| Chart element                                     | Behavior                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UDC (V) legend entry (day view)                   | Hidden by default. Click reveals a bold average line across reporting inverter strings (averaged, not summed) with a shaded min/max band; click again to hide both. Choice is remembered across reloads and other day charts. Omitted on days with no voltage data.                          |
| Day chart y-axes                                  | Feed-in (W), Wirkungsgrad (%), and UDC (V) always use the same fixed range/gridline spacing regardless of the day, so days stay visually comparable and the scale doesn't jump while paging.                                                                                                 |
| Day chart x-axis                                  | Zooms to the day's actual data by default (small padding on each side); a site administrator can switch it to always show the full 00:00–24:00 day via `DAY_CHART_AXES`, `DAY_CHART_X_AXIS_RANGE`, and `DAY_CHART_X_AXIS_PADDING_MINUTES` in `web/js/config.js`.                             |
| Gesamt / Wechselrichter toggle (month/year/total) | "Gesamt" (default) shows one combined bar per period; "Wechselrichter" stacks one segment per inverter string, with the tooltip showing the combined total plus each string's value. Remembered across reloads and shared between the three views. Drill-down-by-click works in either mode. |

## Statistics page

`#/statistics` ("Statistik" in the nav, between "Gesamt" and "Ereignisse") is a split-view page
of records and long-term trends computed entirely from the plant's already-recorded history — no
extra data is fetched beyond what a session opening month/year/total already downloads. A left
topic nav lists five topics, each its own bookmarkable/shareable link:

Two flavors of "backfilled" day come up across these topics — see Heatmaps below for the full
explanation. In short: most backfilled days kept a real, device-recorded daily total and only lost
their minute-level power curve; a narrow date range (the 2026 inverter-outage gap) instead has an
_estimated_ daily total, spread evenly across its days from a single offline meter reading.

- **Allgemein (Common)** — an 8-tile grid of records: best/worst month & year, the single highest
  daily peak power, the single highest "Ist %" day, and the single highest CO2-saving/revenue
  day. Every tile links to its source day/month/year view. The max-daily-power tile carries a
  small caveat: it's the day's recorded peak, not tied to a specific time of day. The
  worst-year tile excludes the current (still-running) year and the plant's first (commissioning)
  year — both are naturally low-yield partial years and would otherwise "win" worst-year for no
  meaningful reason — noted as a hover tooltip on that tile. The max-daily-power tile ignores every
  backfilled day (its peak reads 0 regardless of the real power that day). The Ist %/CO2/revenue
  tiles, and Best vs. Worst's daily-yield tile below, trust a backfilled day's real total and only
  ignore the narrower estimated-total range, so a day whose yield is genuinely known can still
  "win" a record.
- **Heatmaps** — a year selector above three calendar heatmaps (energy/kWh, money/€, CO2/kg), one
  cell per day, color intensity scaled to that year's own minimum/maximum. A day with no recorded
  data renders as a diagonal hatch pattern, always visually distinct from a real recorded zero. A
  backfilled day keeps its real color (it still shows a value) but also gets a black/white
  diagonal-stripe overlay and a "backfilled" legend entry; hovering it shows which of the two kinds
  it is — "backfilled, daily total is real (power curve reconstructed)" for most of them, or
  "backfilled, estimated (monthly meter reading spread evenly across days)" for the 2026
  inverter-outage gap.
- **Serien (Streaks)** — two cards: the longest run of consecutive days each yielding at least
  20 kWh ("high-yield"), and the longest run each yielding under 5 kWh ("low-yield"), each with an
  "läuft noch" (ongoing) badge when that run is still active. Every card shows a strip of the
  streak's own days (plus two days of context on each side) — hover a day for its exact yield,
  click it to jump to that day's detail view. A backfilled day's real total counts toward the
  streaks like any other recorded day; only the estimated-total range (see Heatmaps above) is
  excluded, since a run through an evenly-split estimate wouldn't reflect real day-to-day
  variation. Days from that range still show up in the context strip if they fall in it, flagged
  with their tooltip's "estimated" caption.
- **Trends** — three charts: year-over-year cumulative yield (aligned by day of year, including
  backfilled days — their real or estimated total still contributes correctly to the running sum),
  cumulative lifetime €/CO2 savings since commissioning, and per-year specific yield (kWh/kWp) —
  the last one carries a permanent caveat noting it assumes constant installed capacity with no
  weather normalization. The lifetime and specific-yield charts each extend two extra "if this
  continues" forecast years past the last actual one, shown gray/dashed to stay visually distinct
  from recorded data.
- **Bestwerte vs. Tiefstwerte (Best vs. Worst)** — the same best/worst pairs from the Common topic
  (month, year, daily yield) shown side by side, each with its own link, no toggle needed.

Heatmaps, Serien, and Trends each show a "not enough data yet" placeholder instead of an empty
chart when the plant doesn't yet have enough recorded history for that topic to be meaningful;
Allgemein and Bestwerte vs. Tiefstwerte always render, since even a few days of history produces a
meaningful "best so far".

## Ereignisse (events) page

`#/events` ("Ereignisse" in the nav, after "Gesamt") lists every recorded inverter status/fault
event as one table, most recent first — combining the historical archive
(`web/data/events.js`) with today's log (`web/data/events_day.js`) and removing exact duplicates
between the two. An event still in progress (no end time yet) shows a small pulsing "aktiv"
badge next to its start time instead of a blank end-time cell. Each row shows the combined
start–end time ("Von – Bis", end shown as just a time-of-day when it's the same calendar day as
the start), the inverter (a colored dot plus WR label), duration, a colored status pill, and the
fault/error (a muted dash when there was none, a bold red label when there was).

The Von–Bis, WR, and Dauer column headers are clickable to sort: click once to sort by that
column (an arrow in the header shows the direction), click again to reverse it. Sorting only
reorders the rows already passing the active filters — it never changes which events are shown.
On narrow screens the filter bar wraps onto multiple rows and the table scrolls horizontally
within its own frame rather than widening the page. If a filter combination matches nothing, the
table is replaced with a "Keine Ereignisse gefunden" message instead of an empty grid. The title
row's count ("401 Ereignisse" or "18 von 401 Ereignissen") always reflects how many rows the
current filters leave visible.

| Filter         | Narrows by             | Combinable | Sort target |
| -------------- | ---------------------- | ---------- | ----------- |
| Wechselrichter | Inverter (WR1, WR2, …) | Yes        | No          |
| Tag            | Calendar day           | Yes        | No          |
| Status         | Status pill value      | Yes        | No          |
| Fehler         | Fault/error code       | Yes        | No          |

Each active filter shows as a removable pill chip; "Filter zurücksetzen" clears them all at once.

## Dynamic sky background

The cloud backdrop behind the dashboard changes with the installation's real current weather
and local time of day instead of always looking the same: cloud density (sparse/moderate/dense)
reflects the current cloud cover, a sun or moon tracks a simplified day/night arc and crossfades
smoothly around sunrise/sunset, and birds/planes/balloons/a rare moon-bound rocket occasionally
cross the sky. This runs automatically — there is nothing to configure — and refreshes every 15
minutes. If weather data can't be fetched (no network, no configured location), the backdrop
simply keeps its original static appearance; nothing else on the dashboard is affected. If your
system/browser has "reduce motion" enabled, all sky animation and flying objects are suppressed
while the cloud density/sun-moon state still updates. Birds are rendered as animated silhouette
sprites rather than a plain shape — a purely visual upgrade that needs no configuration.

## Global desktop info panel

At desktop widths (768px and above), a panel in the header — visible on every view, not just
the dashboard — shows the plant's current production alongside the current weather condition
and a forecast for the installation's location. Both weather lines lead with a small decorative
icon (☀️/⛅/☁️/🌧️/❄️) matching the condition's label, e.g. "🌧️ Regen, 18°C" for the current
condition; at night, a clear-sky reading shows a moon icon and "Klar"/"Clear" instead of the
sun icon/"Sonnig"/"Sunny". The forecast line shows "Heute:" (today) plus that day's low–high
range, e.g. "Heute: ☀️ Sonnig (13°C - 19°C)", switching to "Morgen:" (tomorrow's forecast) once
it's past 18:00 local time. Production (and the "Today's yield"/"Month's yield" figures)
refreshes on the same schedule as the day view's chart (see "Day view auto-refresh" below) — one
shared setting, so the two never drift out of sync. The weather/forecast side refreshes on its
own, slower schedule (every ~10 minutes by default), since weather doesn't change meaningfully
minute to minute. A small pulsing dot next to the production value gets larger
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

## Day view & welcome page auto-refresh

When the day view (`#/day/YYYY/MM/DD`) is showing _today_, it keeps itself current on its own: it
periodically re-fetches today's readings and redraws the stats panel, the chart, and the data
table in place — so you can leave the page open for hours (e.g. on a wall display) and it will
keep showing new readings without a manual reload. A failed refresh attempt is skipped silently,
leaving the last good reading on screen rather than clearing the view. Days other than today never
auto-refresh, since their data is archived and no longer changes. The welcome page (`#/`,
"Anlageninfo") does the same for its today-chart and yield-summary stats card. All three — the
info panel's production/yield figures above, the day view, and the welcome page — use the same
refresh interval, so they always show data of the same age rather than drifting apart on separate
timers. The interval defaults to 1 minute and can be changed by a site administrator via
`DATA_REFRESH_INTERVAL_MS` in `web/js/config.js` (the info panel's weather/forecast poll has its
own separate, slower interval, `WEATHER_REFRESH_INTERVAL_MS`).

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

## Explanatory tooltips

Several stats-panel figures (day/month/year/total/welcome views) — yield in €, Soll, Soll
(auflaufend), Ist, and CO2 avoided — have a small "i" icon next to their label. On desktop, hover
or Tab to it to see a short tooltip explaining exactly how that figure is calculated (e.g. "Ist"
is the actual yield as a percentage of the Soll figure shown alongside it). On touch-only devices
(phones/tablets) the icon isn't shown at all — there's nothing useful a tap could do with it, so
it's left out entirely rather than shown inert.
