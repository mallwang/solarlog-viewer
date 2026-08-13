# Contracts: Welcome Page (Default Landing View)

This project has no network/API surface (constitution Principle III — static site, no server). The
"contracts" that matter here are the internal JS module interfaces new code must honor so it
plugs into the existing router/view/chart-factory machinery without changes to their calling
conventions.

## `router.js`

```js
// Existing signature, unchanged. Only the *return value* of defaultRoute() changes internally.
export function parseRoute(hash: string): { view: string, params: object };
export function formatRoute(route: { view: string, params: object }): string;
export function onRouteChange(onRoute: (route) => void): () => void;
```

- `parseRoute('')` and `parseRoute('#/anything-unrecognized')` MUST both return
  `{ view: 'welcome', params: {} }`.
- `parseRoute('#/day/2026/08/13')` etc. MUST be unaffected (FR-002) — this feature adds no new
  branch to the `day`/`month`/`year`/`total` parsing paths.
- `formatRoute({ view: 'welcome', params: {} })` MUST return `'#/'` (so the existing
  `href="#/"` brand link in `index.html` needs no change).

## `main.js` view registry

```js
const viewModules = {
  welcome: () => import('./views/welcome-view.js'), // NEW entry
  day: () => import('./views/day-view.js'),
  // ...unchanged
};
```

Every view module exports:

```js
/**
 * @param {HTMLElement} container - mounted into #app-main by dispatch().
 * @param {{ plant: PlantMetadata | null, route: { view: string, params: object } }} ctx
 * @returns {(() => void) | void} optional cleanup, called by dispatch() before the next route.
 */
export async function render(container, ctx);
```

`welcome-view.js` MUST conform to this exact signature (matches every existing view module) — no
special-casing in `dispatch()`.

## `chart-factory.js`

```js
/**
 * @param {HTMLElement} container
 * @param {'day' | 'day-yield' | 'month' | 'year-months' | 'year' | 'day-total'} mode  // + 'day-total'
 * @param {{ readings: object[] }} data - same day-view trace shape already used by mode 'day'.
 * @param {object} [config] - unused by 'day-total' (no breakdown/click-through applicable).
 * @returns {import('apexcharts')}
 */
export function renderChart(container, mode, data, config);
```

- `renderChart(el, 'day-total', { readings }, undefined)` MUST render exactly one series (today's
  combined feed-in total) on the existing `DAY_CHART_AXES.feedInW` fixed range — no Wirkungsgrad
  series, no UDC series, no legend entries for either (FR-014, FR-015, FR-016).
- `renderChart(el, 'day-total', { readings: [] }, undefined)` — the welcome view is expected to
  intercept the empty case itself (see data-model.md's "Failure mode") and render
  `emptyStateBody(...)` instead of calling `renderChart` at all, mirroring how `day-view.js`
  already branches on `hasPowerData` before calling `renderChart`.

## `config.js`

```js
/** @type {string[]} Filenames under web/img/plant/, in carousel display order. Empty = no photos (FR-008). */
export const PLANT_PHOTOS = [];
```

- Consumed only by `welcome-view.js` / `photo-carousel.js`. No other module reads it.

## `plant-details-panel.js` (new)

```js
/**
 * @param {import('../data/plant.js').PlantMetadata | null} plant
 * @returns {string} HTML markup — emptyStateBody(...) markup when plant is null (FR-013).
 */
export function plantDetailsMarkup(plant);
```

## `photo-carousel.js` (new)

```js
/**
 * @param {string[]} photoSrcs - resolved img/plant/... URLs, already in display order.
 * @returns {string} HTML markup for the carousel region — placeholder markup when photoSrcs is
 *   empty (FR-008); no prev/next controls rendered when photoSrcs.length === 1 (FR-009).
 */
export function carouselMarkup(photoSrcs);

/**
 * Wires auto-rotation/manual controls for a carousel previously mounted via carouselMarkup().
 * No-op (returns a no-op cleanup) when there are 0 or 1 photos.
 * @param {HTMLElement} carouselEl
 * @returns {() => void} cleanup — clears any interval/listeners; called by welcome-view.js's own
 *   returned cleanup.
 */
export function initCarousel(carouselEl);
```
