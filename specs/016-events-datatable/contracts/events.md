# Contract: Ereignisse (Events) Datatable

**Feature**: 016-events-datatable | **Consumers**: `web/js/views/events-view.js`, `web/js/main.js`
(nav + route registration), `web/js/router.js`, Playwright tests.

Additive only: no existing contract (`chart-factory.md`, `navigation.md`, `chart-data-table.md`)
is modified. `plant.js`'s existing public shape gains two new fields (`statusCodes`,
`errorCodes`) — every existing consumer of `PlantMetadata` keeps working unchanged, since they
simply ignore fields they don't read.

## Module contract: `web/js/data/plant.js` (changed)

```js
/**
 * Parses base_vars.js into PlantMetadata (existing fields unchanged) plus:
 * @returns {{ ...existing fields..., statusCodes: string[][], errorCodes: string[][] }}
 *   statusCodes[i]/errorCodes[i] = inverter i's (0-based) comma-split label list, parsed from
 *   `StatusCodes[i] = "..."` / `FehlerCodes[i] = "..."` lines. Missing/absent for an inverter
 *   index → empty array (never undefined), so callers can safely index without a null check.
 */
export function parseBaseVars(rawFileText);
```

- 0-based inverter indexing here matches the event lines' `WR` field directly — no off-by-one
  translation needed, unlike `inverters[].index` (1-based, existing convention, unaffected).

## Module contract: `web/js/data/events.js` (new)

```js
/**
 * Splits one events.js/events_day.js line (already extracted via parse-lines.js's
 * extractAssignedStrings) into its 5 raw fields.
 * @param {string} line - e.g. "13.08.26 06:37:30;13.08.26 06:37:44;0;6;0"
 * @returns {{ startRaw: string, endRaw: string, inverterIdx: number, statusCode: number,
 *   errorCode: number, dedupeKey: string } | null} `null` for a malformed line (FR-009) —
 *   caller filters these out, never throws.
 */
export function parseEventLine(line);

/**
 * Parses a full events.js/events_day.js file's text into RawEventLine-shaped records
 * (parseEventLine applied to every extractAssignedStrings() result), skipping malformed lines.
 * @param {string} fileText
 * @returns {ReturnType<typeof parseEventLine>[]} Never null entries — malformed lines are
 *   already filtered out.
 */
export function parseEventsFile(fileText);

/**
 * Combines the historical (events.js) and today's (events_day.js) raw records into one
 * deduplicated list (FR-008, research.md R5) — exact-string dedup on dedupeKey, history-file
 * entries kept over duplicate day-file entries (order doesn't otherwise matter since duplicates
 * are byte-identical).
 * @param {ReturnType<typeof parseEventsFile>} historyRecords
 * @param {ReturnType<typeof parseEventsFile>} todayRecords
 * @returns {ReturnType<typeof parseEventsFile>}
 */
export function mergeAndDedupeEvents(historyRecords, todayRecords);

/**
 * Enriches one raw record into the UI-facing Event shape (see data-model.md) — timestamp
 * parsing, ongoing/duration derivation, per-inverter status/error label resolution with
 * fallbacks (research.md R3/R4).
 * @param {ReturnType<typeof parseEventLine>} rawRecord
 * @param {{ statusCodes: string[][], errorCodes: string[][] }} codes - plant.statusCodes/
 *   plant.errorCodes (see plant.js contract above).
 * @returns {import('./events.js').Event} See data-model.md's Event table.
 */
export function enrichEvent(rawRecord, codes);
```

- All four functions are pure (no DOM, no fetch) — fully covered by `events.test.js` without a
  browser, per constitution Testing standard's node:test allowance for pure parsing logic.
- Callers (`events-view.js`) are responsible for the two `fetchText()` calls
  (`data/events.js`, `data/events_day.js`) and for handling a fetch failure of either file
  independently (an unreachable `events_day.js` still lets the historical list render, and vice
  versa) — this module never fetches.

## Module contract: `web/js/views/events-view.js` (new)

```js
/**
 * Mounts the Ereignisse page: fetches events.js + events_day.js + (reuses the already-fetched)
 * plant.statusCodes/errorCodes, renders the filter bar + sortable table, wires filter/sort
 * interaction. Mirrors the existing view module shape (day-view.js/month-view.js/total-view.js):
 * called by main.js's dispatch() after the module is dynamically imported.
 * @param {HTMLElement} container
 * @param {{ plant: object | null, route: { view: 'events', params: {} } }} ctx
 * @returns {Promise<(() => void) | void>} Optional cleanup callback (matches the existing
 *   `currentViewCleanup` contract in main.js) — used here only if any listener needs explicit
 *   teardown beyond what replacing container.innerHTML on the next dispatch already clears.
 */
export async function render(container, { plant, route });

/**
 * Filters an enriched Event[] by the given FilterState (data-model.md) — pure, DOM-free, so
 * it's independently unit-testable from the fetch/render glue above.
 * @param {import('../data/events.js').Event[]} events
 * @param {{ inverter: number | 'all', day: string | 'all', status: string | 'all', error: string | 'all' }} filters
 * @returns {import('../data/events.js').Event[]}
 */
export function filterEvents(events, filters);

/**
 * Sorts an Event[] by the given SortState (data-model.md) — pure, stable (equal keys keep their
 * relative order), never mutates the input array.
 * @param {import('../data/events.js').Event[]} events
 * @param {{ column: 'start' | 'inverter' | 'duration', direction: 'asc' | 'desc' }} sort
 * @returns {import('../data/events.js').Event[]} A new sorted array.
 */
export function sortEvents(events, sort);

/**
 * Derives each filter dropdown's available options from the *currently filtered* event set (User
 * Story 2 acceptance scenario 1 — selecting one filter narrows what the others offer), keyed by
 * dimension.
 * @param {import('../data/events.js').Event[]} events
 * @returns {{ inverters: number[], days: string[], statuses: string[], errors: string[] }}
 *   Each array de-duplicated; `days` sorted most-recent-first; `inverters` ascending.
 */
export function buildFilterOptions(events);
```

## Module contract: `web/js/router.js` (changed)

```js
// parseRoute(hash): new recognized shape, no params:
//   '#/events' -> { view: 'events', params: {} }
// formatRoute({ view: 'events' }): -> '#/events'
```

- Mirrors the existing `'total'` branch exactly (both are param-less routes) — see research.md R8.

## i18n contract: `web/i18n/{de,en}.json` (changed)

New top-level `events` namespace (exact keys are an implementation detail of `events-view.js`,
not fixed by this contract, but MUST exist in both files with matching key sets — constitution
Documentation/i18n convention already enforced elsewhere in this codebase) plus one new
`nav.eventsView` key for the nav label ("Ereignisse" / "Events").

## Playwright contract: `tests/e2e/events-view.spec.js` (new)

Must cover, at minimum (constitution Testing standard):

1. Navigating to `#/events` renders a table with rows.
2. An event with no end time shows the ongoing indicator.
3. Selecting an inverter filter narrows the visible rows to that inverter only.
4. Clicking a sortable column header changes row order; clicking again reverses it.
5. A filter combination with zero matches shows the empty state (design.md's empty-state layout).
6. Mobile viewport: filter bar wraps, table remains reachable via horizontal scroll, no
   horizontal _page_ scroll (constitution Principle IV).
