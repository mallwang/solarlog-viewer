# Contract: `web/js/charts/chart-factory.js` (`renderChart`)

**Feature**: 005-tailwind-css-dashboard-ui | **Consumers**: `dashboard.js`, `day-view.js`,
`month-view.js`, `year-view.js`, `total-view.js`, `compare-view.js`

This is the internal module contract between the five view modules and the chart-rendering layer.
It is the seam FR-013 (ApexCharts swap) crosses: the five call sites below MUST NOT need to change
beyond the mount-element type, per the "presentation/rendering-engine-only change" scope (FR-007).

## Current contract (Chart.js — pre-existing, for reference)

```js
/**
 * @param {HTMLCanvasElement} canvas
 * @param {'day' | 'month' | 'year' | 'total' | 'compare'} mode
 * @param {object} data
 * @returns {import('chart.js').Chart}
 */
export function renderChart(canvas, mode, data)
```

## New contract (ApexCharts)

```js
/**
 * Creates (or updates, if `container` already hosts a chart) an ApexCharts chart for one of the
 * 5 visualization modes. Calling again on the same container with new data updates the existing
 * chart in place rather than mounting a second chart.
 * @param {HTMLElement} container - A plain `<div>` (was `<canvas>` under Chart.js); ApexCharts
 *   renders an inline SVG into it.
 * @param {'day' | 'month' | 'year' | 'total' | 'compare'} mode
 * @param {object} data - Same shape per mode as today (readings/dailyBreakdown/yearlyTotalsList/
 *   lifetimeSummary/yearComparisonSeries) — no data-shape change, only the render target.
 * @returns {import('apexcharts')} The ApexCharts instance (for tests/cleanup); replaces the
 *   Chart.js instance previously returned.
 */
export function renderChart(container, mode, data)
```

### Behavioral requirements (unchanged from Chart.js version)

- **Idempotent remount**: calling `renderChart` again on the same `container` MUST destroy the
  previous chart instance (`chart.destroy()`) before creating a new one — no stacked/duplicate
  charts (mirrors the existing `charts` `WeakMap` cleanup keyed by DOM node).
- **Mode coverage**: `mode` MUST support all five values; an unrecognized mode MUST throw, exactly
  as `buildConfig`'s `default` case does today.
- **Responsive**: charts MUST resize with their container with no horizontal overflow at any
  viewport 320px–2560px (FR-004, FR-013's "equivalent or better... responsiveness").
- **Tooltips**: hovering a data point MUST show the series label and formatted value with correct
  unit (`W` for day mode, `kWh` for month/year/total/compare) — matches today's `tooltip.callbacks`
  behavior (FR-013's "equivalent or better... tooltip/hover behavior").
- **Color source**: series colors MUST come from the existing `--chart-color-1..6` CSS custom
  properties (`INVERTER_COLORS` today) — no new hard-coded palette (ties to research.md §2).
- **i18n**: axis titles/legend text MUST be resolved via the existing `t()` i18n helper at render
  time, so switching language (existing `setLanguage()` flow in `main.js`) and re-rendering the
  current view updates chart text — matches current behavior.
- **Empty data**: when the input `data` has zero readings/entries for the selected period, the
  chart function MUST render a legible empty chart (or the caller MUST render the FR-009
  placeholder instead of calling `renderChart` at all) — exact split decided at implementation
  time, but a broken/blank chart is never acceptable.

### DOM change required at call sites

Each view module currently creates/obtains a `<canvas>` element and passes it to `renderChart`.
Under this contract they instead create/obtain a `<div>`. This is the only call-site change
required by the engine swap; the `mode` and `data` arguments are unchanged.

### Compatibility note

`node:test` unit tests that import view modules for their pure helper exports (not `chart-factory`
itself) continue to work unmodified: `chart-factory.js` keeps the existing `typeof window !==
'undefined'` guard pattern so it does not throw when imported in a DOM-less test environment.
