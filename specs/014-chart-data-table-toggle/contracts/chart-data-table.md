# Contract: Chart Data Table Toggle & Rendering

**Feature**: 014-chart-data-table-toggle | **Consumers**: `web/js/views/day-view.js`,
`month-view.js`, `year-view.js`, `total-view.js` (each existing chart-rendering view module),
`web/js/views/stats-panel.js` (layout markup), `web/css/app.css`, Playwright tests.

This is additive: no existing contract (`chart-factory.md`, `navigation.md`) is modified. The new
table module reads the same ApexCharts `options` object `chart-factory.js` already builds; it does
not change `chart-factory.js`'s public API.

## Module contract: `web/js/settings.js` (additions)

```js
/** @returns {boolean} Persisted chart-data-table visibility (localStorage) or `false` default. */
export function isChartTableVisible();

/**
 * Persists the chart-data-table visibility selection, app-wide.
 * @param {boolean} visible
 * @returns {void}
 */
export function setChartTableVisible(visible);
```

- Mirrors `isTransparencyEnabled()` / `setTransparencyEnabled()` exactly (same
  read-string-compare-to-`'true'` / write-`String(value)` shape).
- `localStorage` key: `solarlog-chart-table`, values `"true"` / `"false"` (see `data-model.md`).
- If `localStorage` throws (unavailable/disabled), `isChartTableVisible()` MUST catch and return
  `false`; `setChartTableVisible()` MUST catch and no-op, still allowing the current page's table
  to toggle in memory for that render (FR-009) — the toggle module (below) keeps its own in-memory
  fallback state for this case, not `settings.js`.

## Module contract: `web/js/views/chart-table-toggle.js` (new)

```js
/**
 * Markup for the "show as table" toggle button shown top-right of a chart-container.
 * @returns {string}
 */
export function chartTableToggleMarkup();

/**
 * Wires the toggle button rendered by chartTableToggleMarkup() inside `container`: syncs its
 * `aria-pressed` state with the persisted app-wide selection, and on click persists the new
 * selection and calls `onChange(visible)` so the caller can show/hide its table in place.
 * @param {HTMLElement} container - Element containing the toggle markup (e.g. `.chart-container`).
 * @param {(visible: boolean) => void} onChange
 * @returns {void}
 */
export function initChartTableToggle(container, onChange);
```

- Shape mirrors `chart-breakdown-toggle.js`'s `chartBreakdownToggleMarkup()` /
  `initChartBreakdownToggle()` exactly, but with a single `<button aria-pressed>` instead of two
  mutually exclusive buttons.
- `onChange` fires on every click, including from a page that has multiple charts mounted at once
  (dashboard) — each mounted chart's own `initChartTableToggle` call reacts independently so all
  visible tables stay in sync with the one shared preference (FR-006).

## Module contract: `web/js/views/chart-data-table.js` (new)

```js
/**
 * Extracts condensed table rows from an ApexCharts `options` object as already built by
 * chart-factory.js's buildOptions() for the chart currently on screen.
 * @param {import('apexcharts').ApexOptions} options
 * @returns {{ columns: string[], rows: { label: string, values: (string|number|null)[] }[] }}
 */
export function extractTableData(options);

/**
 * Renders (or replaces) the condensed data table into `mount` from the given ApexCharts options.
 * @param {HTMLElement} mount - A `.chart-table` element (see stats-panel.js's layout markup).
 * @param {import('apexcharts').ApexOptions} options - Same options passed to chart-factory's
 *   renderChart() for the currently displayed chart.
 * @returns {void}
 */
export function renderChartTable(mount, options);
```

- `extractTableData()` is pure (no DOM access) so it is unit-testable via `node:test` without a
  browser — the co-located `chart-data-table.test.js` covers both xaxis shapes (`categories` for
  bar charts, datetime `[x,y]` series pairs for the day chart) and the empty-data case.
- `renderChartTable()` is the only function that writes into `mount`; it clears any prior content
  before writing (mirrors `renderChart()`'s destroy-before-recreate pattern in `chart-factory.js`)
  so repeated calls (e.g. on period navigation) never leave stale rows behind (FR-007).
- Column order: chart's own series order (`options.series[].name`), so it matches the chart's
  legend/color order exactly.
- Empty state: when `options.series` has no data points, renders one row using the existing
  `empty-state.js` "no data" copy instead of an empty `<tbody>` (spec Edge Cases).

## DOM/CSS contract

```html
<div class="chart-container lg:flex-[7]">
  <div class="chart-container__header flex items-center justify-between gap-sm">
    <!-- existing breakdown toggle markup, if any, stays where it is -->
    <div class="chart-table-toggle"><!-- chartTableToggleMarkup() output --></div>
  </div>
  <div class="chart-body"><div class="chart-mount"></div></div>
  <div class="chart-table overflow-x-auto">
    <!-- renderChartTable() output, empty when hidden -->
  </div>
</div>
```

- `chartWithStatsLayoutMarkup()` (`stats-panel.js`) gains the `.chart-table-toggle` button (always
  present, top-right) and an always-present `.chart-table` mount element positioned directly below
  `.chart-body` (FR-001, FR-002); when the preference is `false`, `.chart-table` is rendered empty
  / `hidden` rather than omitted, so `initChartTableToggle`'s `onChange` has a stable mount to fill
  on the first click.
- `.chart-table` visibility itself is controlled by a `hidden` attribute (not by omitting markup),
  toggled by `initChartTableToggle`'s `onChange` callback — consistent with how `transparency-mode`
  toggles a document-level attribute rather than removing DOM.
- No changes to `.chart-mount`/`.chart-body`'s existing flex/height contract from
  `chart-factory.md` / `stats-panel.js`'s own doc comment.

### CSS rules (in `web/css/app.css`, alongside the existing `.summary-table` block)

```css
.chart-table table {
  /* Tailwind utilities applied inline for width/border-collapse/text-size/spacing (mirrors
     .summary-table's convention); this block only carries what Tailwind's utility classes don't
     cover: theme-token-driven borders/colors so the table matches app.css's design tokens. */
}
.chart-table th,
.chart-table td {
  border-bottom: 1px solid var(--color-border);
}
.chart-table[hidden] {
  display: none;
}
```

(Exact utility classes are an implementation detail decided during `/speckit-tasks`/implementation;
this contract only fixes the CSS hook names and the "Tailwind utilities inline + token-driven CSS
for the rest" split already established by `.summary-table`.)

## Behavioral requirements

- **Button placement (FR-001)**: toggle button renders top-right of every `.chart-container`,
  across all four view modules, with no per-view opt-out.
- **Show/hide (FR-002)**: clicking toggles `.chart-table[hidden]` synchronously in the same click
  handler — no reload, no route change (mirrors transparency-mode's FR-007 precedent).
- **Column/row fidelity (FR-003)**: `extractTableData()` MUST reflect exactly the series/categories
  present in the `options` passed to it — no independent recomputation from raw data.
- **App-wide persistence (FR-004, FR-005, FR-006)**: `setChartTableVisible()` MUST write to
  `localStorage` before or in the same tick as toggling `.chart-table[hidden]`, so a refresh or
  navigation immediately after toggling reflects the latest choice on every chart.
- **Stays in sync with period navigation (FR-007)**: every view module MUST call
  `renderChartTable()` again (with the freshly built `options`) each time it calls `renderChart()`
  for the same mount, whether or not the table is currently visible — cheap since it's a pure
  synchronous DOM write, and avoids a stale table flashing on next reveal.
- **Visible pressed state (FR-008)**: button's `aria-pressed` MUST reflect
  `isChartTableVisible()` on initial sync and after every click.
- **Graceful localStorage failure (FR-009)**: chart rendering and the button itself MUST keep
  working even if `localStorage` throws; only cross-page/cross-reload persistence is lost.

## Test hooks for Playwright (`tests/e2e/chart-data-table.spec.js`)

- Assert `.chart-table` starts `hidden` on first visit (no stored preference) on at least two
  routes (e.g. `#/month/...` and `#/year`).
- Click the toggle button; assert `.chart-table` loses `hidden`, its rows count matches the chart's
  visible data-point count, and the button's `aria-pressed` becomes `"true"`.
- Navigate to a different chart route without reloading; assert its `.chart-table` is shown too
  (FR-006), reflecting the shared preference.
- `page.reload()`; assert the table is still shown (`localStorage.getItem('solarlog-chart-table')
=== 'true'`) (SC-002).
- Toggle per-inverter breakdown mode (existing `chart-breakdown-toggle`) while the table is shown;
  assert the table's columns update to match (FR-003, edge case).
