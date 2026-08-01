# Contract: Frontend Module Interfaces

This feature has no server API — its "interfaces" are the JS module boundaries between data
parsing, routing, and rendering, plus the URL (hash) contract users can bookmark/share. Every
function below is a pure function of its input (file text / hash string) unless noted, so it can
be unit-tested with inline fixture strings per the project's Technical Standards (no real file I/O
in unit tests).

## URL contract (deep links)

| Hash | View | Notes |
|---|---|---|
| `#/` or *(empty)* | Dashboard | Default view; all summary widgets. |
| `#/day/YYYY/MM/DD` | Day detail (Mode 0) | e.g. `#/day/2019/07/15`. |
| `#/month/YYYY/MM` | Month detail (Mode 1) | e.g. `#/month/2019/07`. |
| `#/year/YYYY` | Year detail (Mode 2) | e.g. `#/year/2019`. |
| `#/total` | Lifetime detail (Mode 3) | — |
| `#/compare` | Year-over-year comparison (Mode 4) | — |

Contract: every hash above MUST be independently loadable — a fresh page load with that hash
already in the URL (not just in-app navigation) MUST render the corresponding view directly,
without first flashing the dashboard. Unknown/malformed hashes MUST fall back to the dashboard
(data-model.md `Route` validation rule), not a blank page or thrown error.

## `src/js/router.js`

```js
/**
 * Parses the current location.hash into a Route.
 * @returns {Route} Defaults to { view: 'dashboard', params: {} } for empty/unrecognized hashes.
 */
export function parseRoute(hash) {}

/**
 * Serializes a Route back into a location.hash-compatible string (for building links).
 * @param {Route} route
 * @returns {string} e.g. '#/month/2019/07'
 */
export function formatRoute(route) {}

/**
 * Subscribes to hash changes and initial load; invokes `onRoute(route)` with the parsed Route
 * both immediately and on every subsequent `hashchange`.
 * @param {(route: Route) => void} onRoute
 * @returns {() => void} Unsubscribe function.
 */
export function onRouteChange(onRoute) {}
```

## `src/js/data/fetch-text.js`

```js
/**
 * Fetches a data file as raw text.
 * @param {string} path - Root-relative path, e.g. '/base_vars.js' or '/min250715.js'.
 * @returns {Promise<{ ok: true, text: string } | { ok: false, status: number | null }>}
 *   Never throws — network/HTTP failures resolve to `{ ok: false, status }` so callers render
 *   FR-019's error state instead of an uncaught rejection.
 */
export async function fetchText(path) {}
```

## `src/js/data/parse-lines.js`

```js
/**
 * Extracts every quoted string literal assigned via the SolarLog `arr[idx++]="..."` pattern.
 * @param {string} fileText - Raw file content.
 * @returns {string[]} One entry per matched line, in file order (source files are newest-first).
 */
export function extractAssignedStrings(fileText) {}
```

## `src/js/data/plant.js`, `min-file.js`, `aggregates.js`

```js
/** @param {string} fileText - Raw base_vars.js content. @returns {PlantMetadata} */
export function parseBaseVars(fileText) {}

/** @param {string} fileText @param {string} dateDdMmYy - 'DD.MM.YY', used for epoch lookup. @returns {DailyTrace} */
export function parseMinFile(fileText, dateDdMmYy) {}

/** @param {string} fileText - Raw days.js/days_hist*.js/daysall.js content. @returns {DailyTotal[]} */
export function parseDailyTotalsFile(fileText) {}

/** @param {string} fileText - Raw months.js content. @returns {MonthlyTotals[]} (one per record; caller selects) */
export function parseMonthsFile(fileText) {}

/** @param {string} fileText - Raw years.js content. @returns {YearlyTotals[]} */
export function parseYearsFile(fileText) {}
```

All five parsers are pure: given the same `fileText`, they always return the same structured
result, with no `fetch`/DOM access inside them — this is what makes them unit-testable with inline
fixtures (Technical Standards: "no real file I/O in unit tests").

## `src/js/charts/chart-factory.js`

```js
/**
 * Creates (or updates, if `canvas` already has a Chart instance) a Chart.js chart for one of the
 * 5 modes.
 * @param {HTMLCanvasElement} canvas
 * @param {'day' | 'month' | 'year' | 'total' | 'compare'} mode
 * @param {DailyTrace | MonthlyTotals | YearlyTotals | LifetimeSummary | YearComparisonSeries} data
 * @param {{ lang: 'de' | 'en' }} options
 * @returns {import('chart.js').Chart}
 */
export function renderChart(canvas, mode, data, options) {}
```

Contract: calling `renderChart` again on the same canvas with new `data` MUST update the existing
chart in place (destroy-and-recreate or `chart.update()`) rather than stacking multiple canvases,
so repeated hash navigation to the same view type doesn't leak Chart.js instances.

## `src/js/i18n.js`

```js
/** @returns {'de' | 'en'} Persisted selection (localStorage) or 'de' default (FR-018, FR-017). */
export function getLanguage() {}

/** @param {'de' | 'en'} lang */
export function setLanguage(lang) {}

/** @param {string} key - Dot path into the loaded string table, e.g. 'nav.yearView'. @returns {string} */
export function t(key) {}
```
