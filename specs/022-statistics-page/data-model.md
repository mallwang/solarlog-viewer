# Data Model: Statistics Page

All entities below are computed in `web/js/data/statistics.js` from data the app already parses
(`web/js/data/aggregates.js` types) — no new fetch, no new wire format. Each function is pure:
`(alreadyParsedData, plant) => result`, no DOM/fetch, mirroring `yield-stats.js`'s style, so each
is directly unit-testable with inline fixtures per project convention.

## Inputs (already-existing types, unchanged)

- `DailyTotal[]` — from `parseDailyTotalsFile` (aggregates.js): `{ date: 'YYYY-MM-DD',
perInverter: { [i]: { yieldWh, peakW } } }`. The full-history series used throughout this
  feature is `mergeDailyTotals(parseDailyTotalsFile(hist['days_hist.js']),
parseDailyTotalsFile(data['days_hist.js']))` plus today's live entry from `data/days.js`
  (research.md R1) — referred to below as `fullDailyHistory`.
- `MonthlyTotal[]` — from `parseMonthsFile`: `{ month: 'YYYY-MM', asOfDate, perInverter,
dailyBreakdown }`. Statistics uses `mergeMonthlyTotals(hist, data)` — `fullMonthlyHistory`.
- `YearlyTotal[]` — from `parseYearsFile`: `{ year, perInverter }`. Statistics uses
  `mergeYearlyTotals(hist, data)` — `fullYearlyHistory`.
- `PlantMetadata` — from `parseBaseVars` (plant.js): `capacityKwp`, `commissionedDate`,
  `tariffRatePerKwh`, `sollYearKwp`, `sollMonth[]`.

Every entity below sums Wh across `perInverter` the same way `yield-stats.js`/`aggregates.js`
already do (`Object.values(perInverter).reduce(...)`), converts to kWh by `/1000`, and computes
€/CO2 via the existing `co2FactorForYear`/`tariffRatePerKwh` — no new conversion logic.

## Stat tile (Common topic, FR-002/003/011)

| Field    | Type                                                 | Notes                                                                                                                                                                                                       |
| -------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`  | string (i18n key)                                    | e.g. `statistics.common.bestMonth`                                                                                                                                                                          |
| `value`  | string (pre-formatted via `format.js`)               | `formatKwh`/`formatCurrency`/`formatCo2`/plain `W`/`%`, matching existing view formatters.                                                                                                                  |
| `period` | string                                               | Date/period it occurred, localized via `format.js` — `formatDate` for a day (`'DD.MM.YYYY'` de / `'MM/DD/YYYY'` en), `formatMonthYear` for a month (`'Month YYYY'`), or the plain year number as a string.  |
| `route`  | `{ view: 'day'\|'month'\|'year', params }` \| `null` | Fed straight to `formatRoute()` (router.js); `null` only if genuinely no source view applies.                                                                                                               |
| `caveat` | string (i18n key) \| `null`                          | Set on the max-daily-power tile (FR-011's "no time-of-day" note) and on the worst-year tile (excluded-years note, see below); rendered as a hover tooltip (and, for max-daily-power, also as visible text). |

Computed by one function per stat, each taking the relevant already-merged series:

- `bestWorstMonth(fullMonthlyHistory)` → `{ best: StatTile, worst: StatTile }` (compares summed kWh per month).
- `bestWorstYear(fullYearlyHistory, currentYear?, plant?)` → `{ best: StatTile, worst: StatTile }`.
  `currentYear` defaults to the real current year; when `plant` is given, its `commissionedDate`
  year is used too. Both the current (still-running) and commissioning (partial) years are
  excluded from the **worst** pick only — a partial year is naturally low-yield and would
  otherwise near-permanently "win" worst-year for no meaningful reason. Neither exclusion applies
  to **best**, since a strong partial year is still a genuine record. The worst tile always
  carries `caveat: 'statistics.commonTiles.worstYearCaveat'` explaining this.
- `maxDailyPower(fullDailyHistory)` → `StatTile` — **caveat**: `perInverter[i].peakW` is
  `days.js`/`days_hist.js`'s own daily peak-power field (already present, no minute-file read
  needed), so "max daily power" is a genuine per-day max, not derived from `maxDailyPowerW`
  (yield-stats.js), which needs a day's minute trace and is out of scope per FR-010/FR-011.
- `maxIstPercent(fullDailyHistory, plant)` → `StatTile` — day's yield ÷ that day's `dailySollKwh`
  (yield-stats.js, reused unchanged per spec.md Assumptions).
- `maxDailyCo2(fullDailyHistory)` → `StatTile` — day's kWh × `co2FactorForYear(year of that day)`.
- `maxDailyEuro(fullDailyHistory, plant)` → `StatTile` — day's kWh × `plant.tariffRatePerKwh`.

## Topic

A purely structural/routing concept (no computed fields): one of `'common' | 'heatmaps' |
'streaks' | 'trends' | 'best-worst'`, each mapped to a renderer module under
`web/js/views/statistics/`. See router.js changes in plan.md.

## Calendar heatmap (Heatmaps topic, FR-004/005/015)

| Field    | Type                                    | Notes                                                                                |
| -------- | --------------------------------------- | ------------------------------------------------------------------------------------ |
| `metric` | `'energyKwh' \| 'moneyEuro' \| 'co2Kg'` | One heatmap instance per metric.                                                     |
| `year`   | number                                  | Selected year (in-page state, not routed — research.md R4).                          |
| `cells`  | `HeatmapCell[]`                         | One entry per calendar day of `year` (365 or 366, `daysInYear` from yield-stats.js). |

`HeatmapCell`: `{ date: 'YYYY-MM-DD', value: number | null, relativeIntensity: number | null }`.
`value` is `null` when `fullDailyHistory` has no entry for that date (FR-005's "distinguishable
from a real zero" — a real recorded zero is `value: 0`, `relativeIntensity` computed normally).
`relativeIntensity` is `(value - yearMin) / (yearMax - yearMin)`, clamped `[0, 1]`, computed once
per metric per year over only that year's non-null values (FR-015's per-year relative scale); `0`
when `yearMax === yearMin` (e.g. a single data point).

Computed by `buildCalendarHeatmap(fullDailyHistory, year, metric, plant)` — `metric` selects which
per-day value to extract (`energyKwh` sums `perInverter[i].yieldWh`/1000; `moneyEuro` multiplies
that by `plant.tariffRatePerKwh`; `co2Kg` multiplies by `co2FactorForYear(year)`).

## Streak (Streaks topic, FR-006)

| Field        | Type           | Notes                                                                                                                                                                         |
| ------------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lengthDays` | number         | Longest run of consecutive days each ≥ `STREAK_THRESHOLD_KWH` (research.md R5).                                                                                               |
| `startDate`  | `'YYYY-MM-DD'` | —                                                                                                                                                                             |
| `endDate`    | `'YYYY-MM-DD'` | —                                                                                                                                                                             |
| `isOngoing`  | boolean        | True when `endDate` is the most recent date in `fullDailyHistory` (Edge Case: open streak; ties with the historical record also count as `isOngoing` per spec.md Edge Cases). |

Computed by `computeLongestStreak(fullDailyHistory)` — single pass building consecutive-date runs
(gap-tolerant only in the sense that a missing date breaks the run, matching "consecutive
_recorded_ days"), keeping the max by length, ties broken by most-recent (so an ongoing run tying
the record is reported, satisfying the ongoing-tie Edge Case).

## Best/worst pair (Best vs. Worst topic, FR-009/016)

`{ label: string (i18n key), best: StatTile, worst: StatTile }` — one per paired metric (month,
year; daily-yield best/worst is included as a natural pairing derivable from `fullDailyHistory`
the same way `bestWorstMonth`/`bestWorstYear` are, extending the Common topic's set). Built by
`bestWorstPairs(fullDailyHistory, fullMonthlyHistory, fullYearlyHistory, plant?)`, composing the same
per-metric functions the Common topic uses (no duplicate logic — FR-016's "shown by default" is a
rendering property of `best-worst-topic.js`, not a separate data shape).

## Trend series (Trends topic, FR-007/008)

- **Year-over-year cumulative yield**: `computeYoyCumulative(fullDailyHistory)` →
  `{ year: number, points: { dayOfYear: number, cumulativeKwh: number }[] }[]` — one series per
  year present in `fullDailyHistory`, `dayOfYear` 1–366 (Feb 29 included, matching the corrected
  `YearComparisonSeries` precedent in `specs/001-website-modernization/data-model.md`), running
  sum reset at each year boundary. Fed to `chart-factory.js`'s new `'yoy-cumulative'` mode.
- **Lifetime cumulative savings**: `computeLifetimeCumulative(fullYearlyHistory, plant)` →
  `{ year: number, cumulativeEuro: number, cumulativeCo2Kg: number }[]` — running totals since
  `plant.commissionedDate`'s year, one point per year (dual-axis line in chart-factory).
- **Specific-yield trend**: `computeSpecificYieldTrend(fullYearlyHistory, plant)` →
  `{ year: number, specificYieldKwhPerKwp: number }[]` — `specificYieldKwhPerKwp` per year via
  `yield-stats.js`'s existing `specificYieldKwhPerKwp(yearKwh, plant.capacityKwp)`, unchanged
  formula (FR-008's caveat is static UI copy, not a data field — no "confidence"/"normalized"
  field is computed, since the system cannot detect capacity changes per spec.md Assumptions).

## Not-enough-data gating (FR-012, SC-005)

A single shared helper, `hasEnoughHistory(fullDailyHistory, topic)`, returns a boolean per topic:

| Topic                  | Threshold                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `heatmaps`             | At least one calendar year with ≥1 recorded day (a heatmap still renders for a partial year — missing days already show as hatched per FR-005; "not enough data" only fires when `fullDailyHistory` is empty).                                                                                                                                                                                       |
| `streaks`              | At least `STREAK_THRESHOLD_KWH`-qualifying data exists at all, i.e. `fullDailyHistory` non-empty.                                                                                                                                                                                                                                                                                                    |
| `trends`               | Year-over-year comparison needs ≥2 distinct years in `fullDailyHistory`; lifetime/degradation need ≥1 full calendar year in `fullYearlyHistory`. Each of the three trend charts gates independently — a plant with exactly one year shows the lifetime + degradation charts (1 data point is still meaningful) but the YoY comparison's "not enough data" state, rather than hiding the whole topic. |
| `common`, `best-worst` | Never gated (spec.md: "even a few days of history produces a meaningful 'best so far'").                                                                                                                                                                                                                                                                                                             |
