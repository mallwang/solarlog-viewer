# Phase 1 Data Model: Website Modernization

All entities below are in-memory JS objects produced by parsing the source `.js` files at fetch
time (research.md §4) — nothing is persisted; every reload re-derives these from the source files,
satisfying FR-006 ("derive inverter count, string count, and plant metadata dynamically ... on
every load"). Source formats referenced below are documented in `docs/data-format.md` and
`docs/data-format-daily.md`; this file only maps them to the shapes the UI consumes.

## `PlantMetadata`

Parsed from `base_vars.js` (Key Entity: Plant).

| Field | Type | Source | Notes |
|---|---|---|---|
| `title` | string | `HPTitel` | Page title / dashboard header. |
| `location` | string | `HPStandort` | Displayed on the detail/info area. |
| `operator` | string | `HPBetreiber` | — |
| `capacityKwp` | number | `AnlagenKWP` | Installed capacity. |
| `commissionedDate` | ISO date string | `HPInbetrieb` | 2006-03-15 for this plant; drives earliest selectable date. |
| `tariffRatePerKwh` | number | `Verguetung` | Feed-in tariff, EEG — used by the Gesamterträge summary (Constitution Data Preservation Constraints). |
| `inverters` | `Inverter[]` | `WRInfo[]` | See below; MUST be re-read every load, never hard-coded (FR-006). |

## `Inverter`

One entry per physical inverter (Key Entity: Inverter (WR)), parsed from `WRInfo[]` in
`base_vars.js`.

| Field | Type | Notes |
|---|---|---|
| `index` | number | 1-based position as declared in `base_vars.js` (WR1, WR2, ...). |
| `model` | string | e.g. `SB 4200 TL`. |
| `stringCount` | number | Number of DC strings (`String` sub-entities); currently WR1=2, WR2=1. |

Validation: `stringCount` MUST match the field layout actually observed when parsing that
inverter's block in `min*.js` records for the current epoch (cross-check, not a separate fetch) —
mismatches surface as a parse warning, never a silent zero (Constitution: "missing data is not
shown as zero unless the data file explicitly records zero").

## `DailyTrace` (Mode 0)

Parsed from `min{YYMMDD}.js` (historical) or `min_cur.js` (today), reusing
`scripts/utils.js`'s `epochFromDate`/`epochFromFieldCounts` to resolve block layout
(research.md §5).

| Field | Type | Notes |
|---|---|---|
| `date` | ISO date string | From the file name / record date. |
| `epoch` | 1 \| 2 \| 3 | Which block layout produced these readings (diagnostic). |
| `readings` | `Reading[]` | Up to 288 five-minute samples, chronological order (source file is newest-first; UI sorts ascending for charting). |

### `Reading`

| Field | Type | Notes |
|---|---|---|
| `timestamp` | ISO datetime string | `DD.MM.YY HH:MM:SS` converted to ISO. |
| `perInverter` | `{ [inverterIndex: number]: { pacW: number, pdcW: number[], dailyYieldWh: number, udcV: number[] \| null } }` | Keyed by inverter identity (not block position — Constitution Data Preservation Constraints), one entry per configured inverter. `pdcW`/`udcV` are arrays with one element per string. |

Edge case: a day with no `min{YYMMDD}.js` file (plant offline / gap) produces no `DailyTrace` —
`day-view.js` renders the FR-019/edge-case "Data not available for today" state rather than a
zero-filled chart.

## `MonthlyTotals` (Mode 1)

Parsed from `months.js` (current + recent months) — one record selected per requested `YYYY-MM`.

| Field | Type | Source | Notes |
|---|---|---|---|
| `month` | `YYYY-MM` string | Record date (always the 1st) | — |
| `perInverter` | `{ [inverterIndex: number]: number }` | `WRn_yield_Wh` | Whole-month total per inverter, watt-hours. |
| `dailyBreakdown` | `DailyTotal[]` | Derived from `days_hist*.js`/`daysall.js` filtered to this month | Powers the per-day bars within the monthly chart (FR-010: "daily energy totals per inverter for that month"). |

### `DailyTotal`

Shared shape used by both `MonthlyTotals.dailyBreakdown` and `YearComparisonSeries` below —
parsed from `days.js` / `days_hist*.js` / `daysall.js`, all of which share one wire format
(`DD.MM.YY|WR1_yield;WR1_peak|WR2_yield;WR2_peak`).

| Field | Type | Notes |
|---|---|---|
| `date` | ISO date string | — |
| `perInverter` | `{ [inverterIndex: number]: { yieldWh: number, peakW: number } }` | — |

## `YearlyTotals` (Mode 2)

Parsed from `years.js` — one record per calendar year.

| Field | Type | Source | Notes |
|---|---|---|---|
| `year` | number | Record date (`01.01.YY`) | — |
| `perInverter` | `{ [inverterIndex: number]: number }` | `WRn_yield_Wh` | Whole-year total, watt-hours. |

Edge case (spec): a partial year (e.g. 2006, commissioned mid-March; or the current in-progress
year) is rendered with its actual partial total — never padded or estimated to a full year.

## `LifetimeSummary` (Mode 3)

Derived by summing all `YearlyTotals` records (not a separate source file beyond `years.js`).

| Field | Type | Notes |
|---|---|---|
| `totalYieldWh` | number | Sum across all years/inverters. |
| `co2SavedKg` | number | Existing `functions.js` CO₂ factor, ported as-is (Constitution: "CO₂ conversion factor ... should be preserved as-is"). |
| `feedInTotal` | number | `totalYieldWh/1000 * PlantMetadata.tariffRatePerKwh` (Verguetung), matching the original site's calculation (SC-008). |
| `byYear` | `YearlyTotals[]` | For the bar rendering. |

## `YearComparisonSeries` (Mode 4)

Parsed from `daysall.js` (plus, per `docs/data-format.md`, the `days_hist_0?.js` files loaded
alongside it for the earliest years), grouped by year.

| Field | Type | Notes |
|---|---|---|
| `year` | number | — |
| `points` | `{ dayOfYear: number, totalWh: number }[]` | `dayOfYear` 1–366; leap-year Feb 29 included without shifting other years' alignment (spec Acceptance Scenario). |

## `LiveReading` (User Story 4 widget)

Parsed from `min_cur.js` on load and every 5-minute refresh (research.md §7).

| Field | Type | Notes |
|---|---|---|
| `timestamp` | ISO datetime string | Latest 5-minute sample. |
| `totalPacW` | number | Sum of all inverters' current AC power; `0` renders as "0 W — not producing" (spec edge case), never blank. |

## `Route` (client-side routing state)

Not derived from any data file — parsed from `location.hash` by `router.js` (research.md §3).

| Field | Type | Values |
|---|---|---|
| `view` | string | `'dashboard' \| 'day' \| 'month' \| 'year' \| 'total' \| 'compare'` |
| `params` | `{ year?: number, month?: number, day?: number }` | Present only for `day`/`month`/`year` views. |

Validation: an unparseable or out-of-range hash (e.g. a date before `PlantMetadata.commissionedDate`)
falls back to `dashboard` rather than rendering a broken detail view.
