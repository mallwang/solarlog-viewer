# Phase 1 Data Model: Chart UDC Toggle & Per-Inverter Stacked Bars

No new persisted entities, storage, or data files are introduced — both enhancements read fields
already present in the data objects the app parses from the existing SolarLog `.js` files and
passes into `renderChart()`. This document describes the *shape* of that existing data as consumed
by the two chart builders being changed, not a new schema.

## Entity: Day Reading (input to `buildDayOptions`)

Already produced by `web/js/data/min-file.js`; unchanged by this feature.

| Field | Type | Notes |
|---|---|---|
| `timestamp` | ISO string | Existing — x-axis value for all day-chart series. |
| `perInverter` | `{ [inverterKey: string]: { pacW, pdcW, dailyYieldWh, udcV } }` | `udcV` already parsed (see `web/js/data/min-file.js:14,24`) but currently unused by any chart. This feature is the first consumer. |

**Derived value — UDC series point**: for each reading, `udcSum = sumPerInverter(Object.values(r.perInverter).map(inv => inv?.udcV))`, reusing the existing `sumPerInverter` helper already used for the feed-in series (present-value-only summation; `null` when no string reports a value for that point — see spec Edge Cases).

**Validation rules**: none beyond what `sumPerInverter` already enforces (ignore `null`/`undefined`, sum the rest, return `null` if none present). No new validation is introduced.

## Entity: Period Breakdown Entry (input to `buildBarOptions`, via `buildMonthOptions` / `buildYearOptions` / `buildYearMonthsOptions`)

Already produced by `web/js/data/aggregates.js`; unchanged by this feature. Three existing shapes feed the same shared `buildBarOptions`:

| Caller | Category source | Per-category entity | Per-string figure |
|---|---|---|---|
| `buildMonthOptions` | `data.dailyBreakdown[].date` | day | `perInverter[key]?.yieldWh` |
| `buildYearMonthsOptions` | `data.monthlyBreakdown[].month` | month | `perInverter[key]?.yieldWh` (Wh, entries may be `null`/missing for zero-filled months) |
| `buildYearOptions` | `yearlyTotalsList[].year` | year | `perInverter[key]` (Wh, plain number, not nested under `.yieldWh`) |

**Derived value — per-string stacked series**: for a given caller, let `stringKeys` = the union of `Object.keys(entry.perInverter)` across all categories being charted (not assumed to be `['1','2']` — see FR-010). For each `stringKeys[i]`, build one ApexCharts series `{ name: inverterLabel(key), data: categories.map(entry => figureFor(entry, key) / 1000) }`, where `figureFor` matches the existing per-caller access shown in the table above and missing/`null` values become `0` (a string that produced nothing that period contributes an empty stacked segment, per spec Edge Cases — not a gap, since ApexCharts stacked bars don't support per-segment gaps the way a line chart does).

**Validation rules**: the sum across all `stringKeys` series' values for a given category MUST equal the pre-existing combined total previously produced by `Object.values(entry.perInverter).reduce(...)` (FR-007) — this is a testable invariant, not a new constraint on the source data.

## Entity: Inverter String Label

Not previously surfaced as user-facing text (only used as an internal object key `1`/`2`). This feature introduces a small lookup used by both the day-chart UDC breakdown mention (n/a — UDC is summed, not per-string) and, primarily, the stacked-bar series names and tooltip rows (FR-011).

| Key | Label (i18n) |
|---|---|
| `"1"` | "WR1" |
| `"2"` | "WR2" |
| *(any other key present in the data)* | `"WR" + key` fallback — keeps FR-010's generalization to more than two strings meaningful in the UI, not just in the data loop. |

No persistence: this mapping is a pure display-formatting function, not a stored entity.

## State: UDC Series Visibility (day chart)

Not persisted (per spec Edge Cases — resets to hidden on every fresh render). Tracked entirely by
ApexCharts' own internal chart instance state (`w.globals.collapsedSeriesIndices`), set to
"hidden" once via `chart.hideSeries()` right after `chart.render()` in `renderChart()`'s `'day'`
branch. No new module-level or application state is introduced.
