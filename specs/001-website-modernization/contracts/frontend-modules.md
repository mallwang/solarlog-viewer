# Contract: Frontend Module Interfaces

This feature has no server API — its "interfaces" are the JS module boundaries between data
parsing, routing, and rendering, plus the URL (hash) contract users can bookmark/share. Every
function below is a pure function of its input (file text / hash string) unless noted, so it can
be unit-tested with inline fixture strings per the project's Technical Standards (no real file I/O
in unit tests).

## URL contract (deep links)

| Hash               | View                               | Notes                              |
| ------------------ | ---------------------------------- | ---------------------------------- |
| `#/` or _(empty)_  | Dashboard                          | Default view; all summary widgets. |
| `#/day/YYYY/MM/DD` | Day detail (Mode 0)                | e.g. `#/day/2019/07/15`.           |
| `#/month/YYYY/MM`  | Month detail (Mode 1)              | e.g. `#/month/2019/07`.            |
| `#/year/YYYY`      | Year detail (Mode 2)               | e.g. `#/year/2019`.                |
| `#/total`          | Lifetime detail (Mode 3)           | —                                  |
| `#/compare`        | Year-over-year comparison (Mode 4) | —                                  |

Contract: every hash above MUST be independently loadable — a fresh page load with that hash
already in the URL (not just in-app navigation) MUST render the corresponding view directly,
without first flashing the dashboard. Unknown/malformed hashes MUST fall back to the dashboard
(data-model.md `Route` validation rule), not a blank page or thrown error.

## `web/js/router.js`

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

## `web/js/data/fetch-text.js`

```js
/**
 * Fetches a data file as raw text.
 * @param {string} path - Page-relative path (no leading slash), e.g. 'data/base_vars.js' or
 *   'hist/min250715.js', so it resolves correctly whether the site is served from the domain
 *   root or a subpath.
 * @returns {Promise<{ ok: true, text: string } | { ok: false, status: number | null }>}
 *   Never throws — network/HTTP failures resolve to `{ ok: false, status }` so callers render
 *   FR-019's error state instead of an uncaught rejection.
 */
export async function fetchText(path) {}
```

## `web/js/config.js`

```js
/** ISO date the new SolarLog device was installed; >= this date reads from DATA_DIR. */
export const INSTALLATION_DATE = '2026-07-29';
/** Directory holding the live device's continuously-overwritten output. */
export const DATA_DIR = 'data';
/** Directory holding the frozen historical archive through the day before INSTALLATION_DATE. */
export const HIST_DIR = 'hist';
```

## `web/js/data/data-source.js`

```js
/**
 * Picks which source directory a given date's data lives in — a day is never split across both.
 * @param {string} dateIso - 'YYYY-MM-DD'.
 * @returns {'hist' | 'data'}
 */
export function sourceDirForDate(dateIso) {}

/**
 * Fetches the same filename from both HIST_DIR and DATA_DIR in parallel, for aggregate files
 * (days_hist.js/months.js/years.js) that may hold data on both sides of the installation date.
 * @param {string} filename - e.g. 'months.js'.
 * @returns {Promise<{ hist: Awaited<ReturnType<typeof fetchText>>, data: Awaited<ReturnType<typeof fetchText>> }>}
 */
export async function fetchFromBothSources(filename) {}
```

## `web/js/data/parse-lines.js`

```js
/**
 * Extracts every quoted string literal assigned via the SolarLog `arr[idx++]="..."` pattern.
 * @param {string} fileText - Raw file content.
 * @returns {string[]} One entry per matched line, in file order (source files are newest-first).
 */
export function extractAssignedStrings(fileText) {}
```

## `web/js/data/plant.js`, `epoch.js`, `min-file.js`, `aggregates.js`

```js
/** @param {string} fileText - Raw base_vars.js content. @returns {PlantMetadata} */
export function parseBaseVars(fileText) {}

/** @param {string} ddmmyy - 'DD.MM.YY'. @returns {EpochDescriptor | null} */
export function epochFromDate(ddmmyy) {}

/** @param {number} b0Len @param {number} b1Len @returns {EpochDescriptor | null} */
export function epochFromFieldCounts(b0Len, b1Len) {}

/** @param {string} fileText @param {string} dateDdMmYy - 'DD.MM.YY', used for epoch lookup. @returns {DailyTrace} */
export function parseMinFile(fileText, dateDdMmYy) {}

/** @param {string} fileText - Raw days.js/days_hist.js content. @returns {DailyTotal[]} */
export function parseDailyTotalsFile(fileText) {}

/** @param {string} fileText - Raw months.js content. @returns {MonthlyTotals[]} (one per record; caller selects) */
export function parseMonthsFile(fileText) {}

/** @param {string} fileText - Raw years.js content. @returns {YearlyTotals[]} */
export function parseYearsFile(fileText) {}

/**
 * Merges hist/data DailyTotal[] into one ascending-by-date series. Concatenates (no date is
 * expected in both — HIST_DIR/DATA_DIR split is date-exclusive); data-side wins defensively on
 * a collision.
 * @param {DailyTotal[]} histEntries @param {DailyTotal[]} dataEntries @returns {DailyTotal[]}
 */
export function mergeDailyTotals(histEntries, dataEntries) {}

/**
 * Merges hist/data MonthlyTotals[] into one ascending-by-month series, summing perInverter Wh
 * for a month present on both sides (the installation month has real production in both).
 * @param {MonthlyTotals[]} histEntries @param {MonthlyTotals[]} dataEntries @returns {MonthlyTotals[]}
 */
export function mergeMonthlyTotals(histEntries, dataEntries) {}

/**
 * Merges hist/data YearlyTotals[] into one ascending-by-year series, summing perInverter Wh
 * for a year present on both sides (the installation year has real production in both).
 * @param {YearlyTotals[]} histEntries @param {YearlyTotals[]} dataEntries @returns {YearlyTotals[]}
 */
export function mergeYearlyTotals(histEntries, dataEntries) {}
```

All parsers and merge functions are pure: given the same input, they always return the same
structured result, with no `fetch`/DOM access inside them — this is what makes them unit-testable
with inline fixtures (Technical Standards: "no real file I/O in unit tests"). `epoch.js` is the
canonical source for epoch detection; `scripts/utils.js` (Node-side tooling, never shipped to the
browser) re-exports from it rather than duplicating the epoch table.

## `web/js/charts/chart-factory.js`

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

## `web/js/i18n.js`

```js
/** @returns {'de' | 'en'} Persisted selection (localStorage) or 'de' default (FR-018, FR-017). */
export function getLanguage() {}

/** @param {'de' | 'en'} lang */
export function setLanguage(lang) {}

/** @param {string} key - Dot path into the loaded string table, e.g. 'nav.yearView'. @returns {string} */
export function t(key) {}
```
