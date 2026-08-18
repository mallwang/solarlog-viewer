# Contract: `web/js/data/statistics.js`

This is a static site with no external API — the interface contract that matters here is the
boundary between the pure computation module (`statistics.js`, unit-tested with inline fixtures)
and the view layer (`web/js/views/statistics/*.js`, which owns fetching/DOM/routing). Documented
as a function contract so topic renderers can be built/tested against it independently of the
data-fetch plumbing, the same separation `yield-stats.js` already has from `month-view.js`/
`year-view.js`.

## Exported functions

All functions are pure (no fetch, no DOM, no i18n) and synchronous; every parameter is data the
caller already has in memory (typically the module-level cache `statistics-view.js` builds once
per page load — see quickstart.md).

```js
// Common topic (FR-002, FR-003, FR-011) — data-model.md "Stat tile"
bestWorstMonth(fullMonthlyHistory: MonthlyTotal[]): { best: StatTile, worst: StatTile }
// currentYear defaults to the real current year (test-overridable); plant is optional - when
// given, its commissionedDate's year is excluded too. Both the current (still-running) and
// commissioning (partial) years are excluded from the "worst" pick only, never "best".
bestWorstYear(fullYearlyHistory: YearlyTotal[], currentYear?: number, plant?: PlantMetadata): { best: StatTile, worst: StatTile }
maxDailyPower(fullDailyHistory: DailyTotal[]): StatTile
maxIstPercent(fullDailyHistory: DailyTotal[], plant: PlantMetadata): StatTile
maxDailyCo2(fullDailyHistory: DailyTotal[]): StatTile
maxDailyEuro(fullDailyHistory: DailyTotal[], plant: PlantMetadata): StatTile

// Heatmaps topic (FR-004, FR-005, FR-015) — data-model.md "Calendar heatmap"
buildCalendarHeatmap(
  fullDailyHistory: DailyTotal[],
  year: number,
  metric: 'energyKwh' | 'moneyEuro' | 'co2Kg',
  plant: PlantMetadata,
): { metric, year, cells: HeatmapCell[] }

// Streaks topic (FR-006) — data-model.md "Streak"
computeLongestStreak(fullDailyHistory: DailyTotal[]): Streak

// Trends topic (FR-007, FR-008) — data-model.md "Trend series"
computeYoyCumulative(fullDailyHistory: DailyTotal[]): YoySeries[]
computeLifetimeCumulative(fullYearlyHistory: YearlyTotal[], plant: PlantMetadata): LifetimePoint[]
computeSpecificYieldTrend(fullYearlyHistory: YearlyTotal[], plant: PlantMetadata): YieldTrendPoint[]

// Best vs. Worst topic (FR-009, FR-016) — data-model.md "Best/worst pair"
bestWorstPairs(
  fullDailyHistory: DailyTotal[],
  fullMonthlyHistory: MonthlyTotal[],
  fullYearlyHistory: YearlyTotal[],
  plant?: PlantMetadata,
): BestWorstPair[]

// Shared gating (FR-012, SC-005) — data-model.md "Not-enough-data gating"
hasEnoughHistory(
  fullDailyHistory: DailyTotal[],
  fullYearlyHistory: YearlyTotal[],
  topic: 'heatmaps' | 'streaks' | 'trends',
): boolean
```

Types (`StatTile`, `HeatmapCell`, `Streak`, `YoySeries`, `LifetimePoint`, `YieldTrendPoint`,
`BestWorstPair`, and the `DailyTotal`/`MonthlyTotal`/`YearlyTotal`/`PlantMetadata` inputs) are
defined in [data-model.md](../data-model.md).

## Consumer contract: `web/js/charts/chart-factory.js`

Three new `renderChart(container, mode, data, config)` modes, additive to the existing switch
(no change to existing mode behavior):

| `mode`                   | `data` shape                            | Drill-down (`onDataPointClick`)              |
| ------------------------ | --------------------------------------- | -------------------------------------------- |
| `'yoy-cumulative'`       | `YoySeries[]` (one line per year)       | None — informational overlay only.           |
| `'lifetime-cumulative'`  | `LifetimePoint[]` (dual-axis line)      | Point → `#/year/YYYY` for that point's year. |
| `'specific-yield-trend'` | `YieldTrendPoint[]` (bar, one per year) | Bar → `#/year/YYYY` for that bar's year.     |

## Router contract: `web/js/router.js`

`parseRoute('#/statistics/heatmaps')` → `{ view: 'statistics', params: { topic: 'heatmaps' } }`.
An unrecognized/missing topic segment (`#/statistics`, `#/statistics/bogus`) resolves to
`{ view: 'statistics', params: { topic: 'common' } }` (default topic — mirrors `defaultRoute()`'s
existing fallback style, never a broken/blank route). `formatRoute({ view: 'statistics', params:
{ topic } })` → `#/statistics/${topic}`.
