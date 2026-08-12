# Phase 1 Data Model: Chart UDC Toggle & Per-Inverter Stacked Bars

No new persisted entities, storage, or data files are introduced — both enhancements read fields
already present in the data objects the app parses from the existing SolarLog `.js` files and
passes into `renderChart()`. This document describes the _shape_ of that existing data as consumed
by the two chart builders being changed, not a new schema.

## Entity: Day Reading (input to `buildDayOptions`)

Already produced by `web/js/data/min-file.js`; unchanged by this feature.

| Field         | Type                                                            | Notes                                                                                                                              |
| ------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `timestamp`   | ISO string                                                      | Existing — x-axis value for all day-chart series.                                                                                  |
| `perInverter` | `{ [inverterKey: string]: { pacW, pdcW, dailyYieldWh, udcV } }` | `udcV` already parsed (see `web/js/data/min-file.js:14,24`) but currently unused by any chart. This feature is the first consumer. |

**Derived value — UDC series point**: for each reading, `udcSum = sumPerInverter(Object.values(r.perInverter).map(inv => inv?.udcV))`, reusing the existing `sumPerInverter` helper already used for the feed-in series (present-value-only summation; `null` when no string reports a value for that point — see spec Edge Cases).

**Validation rules**: none beyond what `sumPerInverter` already enforces (ignore `null`/`undefined`, sum the rest, return `null` if none present). No new validation is introduced.

## Entity: Period Breakdown Entry (input to `buildBarOptions`, via `buildMonthOptions` / `buildYearOptions` / `buildYearMonthsOptions`)

Already produced by `web/js/data/aggregates.js`; unchanged by this feature. Three existing shapes feed the same shared `buildBarOptions`:

| Caller                   | Category source                 | Per-category entity | Per-string figure                                                                      |
| ------------------------ | ------------------------------- | ------------------- | -------------------------------------------------------------------------------------- |
| `buildMonthOptions`      | `data.dailyBreakdown[].date`    | day                 | `perInverter[key]?.yieldWh`                                                            |
| `buildYearMonthsOptions` | `data.monthlyBreakdown[].month` | month               | `perInverter[key]?.yieldWh` (Wh, entries may be `null`/missing for zero-filled months) |
| `buildYearOptions`       | `yearlyTotalsList[].year`       | year                | `perInverter[key]` (Wh, plain number, not nested under `.yieldWh`)                     |

**Derived value — per-string stacked series**: for a given caller, let `stringKeys` = the union of `Object.keys(entry.perInverter)` across all categories being charted (not assumed to be `['1','2']` — see FR-010). For each `stringKeys[i]`, build one ApexCharts series `{ name: inverterLabel(key), data: categories.map(entry => figureFor(entry, key) / 1000) }`, where `figureFor` matches the existing per-caller access shown in the table above and missing/`null` values become `0` (a string that produced nothing that period contributes an empty stacked segment, per spec Edge Cases — not a gap, since ApexCharts stacked bars don't support per-segment gaps the way a line chart does).

**Validation rules**: the sum across all `stringKeys` series' values for a given category MUST equal the pre-existing combined total previously produced by `Object.values(entry.perInverter).reduce(...)` (FR-007) — this is a testable invariant, not a new constraint on the source data.

## Entity: Inverter String Label

Not previously surfaced as user-facing text (only used as an internal object key `1`/`2`). This feature introduces a small lookup used by both the day-chart UDC breakdown mention (n/a — UDC is summed, not per-string) and, primarily, the stacked-bar series names and tooltip rows (FR-011).

| Key                                   | Label (i18n)                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `"1"`                                 | "WR1"                                                                                                                           |
| `"2"`                                 | "WR2"                                                                                                                           |
| _(any other key present in the data)_ | `"WR" + key` fallback — keeps FR-010's generalization to more than two strings meaningful in the UI, not just in the data loop. |

No persistence: this mapping is a pure display-formatting function, not a stored entity.

## State: Bar-Chart Breakdown Mode (month/year/total views)

**Persisted** (unlike UDC's visibility state below): a single shared `'total' | 'inverters'`
value in `localStorage` (`solarlog-chart-breakdown`, see `web/js/settings.js`'s
`getChartBreakdownMode`/`setChartBreakdownMode`), read by all three totals views on every render
and defaulting to `'total'` when nothing has been persisted yet — matching the single combined
bar these charts rendered before this feature (FR-006a). Changing it via the toggle (see
`web/js/views/chart-breakdown-toggle.js`) re-renders the already-mounted chart in place (no page
navigation) and immediately persists the new value, so it also applies the next time any of the
three views is opened (FR-012).

**Derived value — bar series by mode**: `'total'` mode keeps the pre-existing single series
(`{ name: t('chart.total'), data: totalData }`, `totalData` computed exactly as before this
feature); `'inverters'` mode uses the per-string `stringSeries` derivation described above under
"Period Breakdown Entry" with `chart.stacked: true`. The tooltip differs by mode too: `'total'`
mode uses the default per-series `y.formatter`; `'inverters'` mode uses a custom tooltip that adds
a "Gesamt" row (the same sum as `totalData` for that category) above the per-string rows (FR-008).

## State: UDC Series Visibility (day chart)

**Persisted** (per spec Edge Cases — the user's last shown/hidden choice is remembered across day
charts and page reloads, the same way the month/year/total breakdown mode is). Stored as a single
shared boolean under a dedicated `localStorage` key (`solarlog-day-udc-visible`) via
`settings.js`'s `isDayUdcVisible()` / `setDayUdcVisible()`, defaulting to `false` (hidden) when
nothing has been persisted yet — matching the pre-existing default so a day chart with no
persisted choice renders exactly as it did before this state existed.

Two places keep this in sync with ApexCharts' own internal chart instance state
(`w.globals.collapsedSeriesIndices`):

- **Initial render** (`renderChart()`'s `'day'` branch): `chart.hideSeries()` is called right
  after `chart.render()` only when `isDayUdcVisible()` is `false`; when `true`, the series is left
  in ApexCharts' own default (shown) state.
- **User toggle** (`buildDayOptions()`'s `chart.events.legendClick` handler): fires on every
  legend click, guarded to the UDC series index; reads the resulting
  `collapsedSeriesIndices` state one tick after the click (after ApexCharts' own default toggle
  has applied) and persists it via `setDayUdcVisible()`.

No new module-level application state is introduced beyond the `localStorage` key itself.
