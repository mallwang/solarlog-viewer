# Data Model: Tailwind CSS Dashboard Redesign

**Feature**: 005-tailwind-css-dashboard-ui | **Date**: 2026-08-06

This feature is presentation/navigation-only (FR-007): no SolarLog data entity, parsing format, or
storage changes. The "entities" below are **UI-state/view-model** concepts introduced or extended
for the redesign — not persisted data — and map to the spec's Key Entities section.

## NavItem

Represents one entry in the navigation menu.

| Field      | Type                                                                | Notes                                                             |
| ---------- | ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `view`     | `'dashboard' \| 'day' \| 'month' \| 'year' \| 'total' \| 'compare'` | Matches `router.js` route `view` values; the six existing views.  |
| `labelKey` | `string`                                                            | i18n key resolved via `t()` (existing `i18n.js`); human-readable. |
| `href`     | `string`                                                            | Produced by `formatRoute()`; hash-based, no page reload (FR-011). |
| `isActive` | `boolean`                                                           | Derived at render time from `currentRoute.view === item.view`.    |

**Validation rules**: `view` MUST be one of the six routes `router.js` recognizes; unknown routes
fall back to `dashboard` (existing `parseRoute()` behavior, unchanged by this feature).

**State transitions**: `isActive` recomputes on every `dispatch(route)` call (existing pattern in
`main.js`); no persisted state — purely derived from `location.hash` on each navigation event.

**Relationships**: A `NavigationMenu` (below) contains an ordered list of `NavItem`s, one per view.

## NavigationMenu

Represents the always-reachable nav shown on every screen (FR-002, FR-003, FR-004).

| Field        | Type                            | Notes                                                                                  |
| ------------ | ------------------------------- | -------------------------------------------------------------------------------------- |
| `items`      | `NavItem[]`                     | All six views, fixed order, human-readable labels (FR-002).                            |
| `layoutMode` | `'persistent' \| 'collapsible'` | Derived from viewport width via CSS breakpoint (Tailwind `md:`), not JS-tracked state. |
| `isOpen`     | `boolean`                       | Only meaningful when `layoutMode === 'collapsible'`; toggled by a hamburger button.    |

**Validation rules**: `items.length` MUST equal the number of routes in `router.js`'s view set
(currently 6); adding/removing a view requires updating both `router.js` and this list together.

**State transitions**:

- `isOpen: false → true` on hamburger click (narrow viewport only).
- `isOpen: true → false` on nav-item selection or outside click/Escape (accessibility).
- `layoutMode` switches automatically via CSS media query — no JS re-render needed for the
  breakpoint itself, only for `isOpen`.

**Relationships**: Rendered into the existing `#app-nav` element by an extended `renderNav()` in
`main.js`; consumes the same `NAV_ITEMS` array and `currentRoute` already present in that file.

## SummaryStat (stat/card)

Represents one visually distinct numeric metric display (FR-005): current power, daily/monthly/
yearly/lifetime energy totals.

| Field      | Type                                     | Notes                                                                 |
| ---------- | ---------------------------------------- | --------------------------------------------------------------------- |
| `labelKey` | `string`                                 | i18n key for the metric name (e.g. "current power", "monthly total"). |
| `value`    | `number \| null`                         | `null` when data unavailable (renders empty state, FR-009).           |
| `unit`     | `string`                                 | e.g. `"W"`, `"kWh"` — existing formatting helpers, unchanged.         |
| `status`   | `'producing' \| 'idle' \| 'unavailable'` | Drives icon/text (not color-only) per FR-010.                         |

**Validation rules**: `value === null` MUST always pair with `status: 'unavailable'` and render the
FR-009 empty/placeholder state, never a blank card. `status` MUST render a non-color indicator
(icon + text label) alongside any color coding, per FR-010.

**State transitions**: Recomputed each time the underlying view module fetches/derives its data
(existing `plant`/data-fetch flow in `main.js` and view modules) — no new async flow introduced.

**Relationships**: Zero or more `SummaryStat`s are rendered per view (e.g. `dashboard` shows
current power + today's total; `total-view` shows lifetime totals); purely a rendering concern
layered over existing computed values already produced by `web/js/data/aggregates.js` and view
modules.

## ChartRenderRequest

Represents the input to the ApexCharts rendering layer (replaces the Chart.js config object built
by the current `chart-factory.js`), scoped to FR-013.

| Field        | Type                                                 | Notes                                                                                 |
| ------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `mode`       | `'day' \| 'month' \| 'year' \| 'total' \| 'compare'` | Matches the five visualization modes (Constitution Principle VI).                     |
| `container`  | `HTMLElement`                                        | DOM node ApexCharts mounts into (replaces the `<canvas>` element).                    |
| `series`     | `{ name: string, data: (number \| null)[] }[]`       | Per-inverter/per-year series, built from existing parsed data unchanged.              |
| `categories` | `string[]`                                           | X-axis labels (times, days, months, years) — same source data as today.               |
| `colors`     | `string[]`                                           | Sourced from `--chart-color-*` CSS variables (existing token set), unchanged palette. |

**Validation rules**: `series`/`categories` MUST come from the same parsed SolarLog data structures
`chart-factory.js` already consumes (`aggregates.js`, `min-file.js`, etc.) — this feature does not
add or change a data-parsing entity, only the rendering call shape (FR-007, FR-008).

**State transitions**: One `ChartRenderRequest` built and handed to ApexCharts per view-mount, and
destroyed/re-created on navigation away (mirrors the existing `charts` `WeakMap` cleanup pattern in
`chart-factory.js`, adapted to ApexCharts' `chart.destroy()` API instead of Chart.js's).

**Relationships**: Each of the five view modules (`day-view.js`, `month-view.js`, `year-view.js`,
`total-view.js`, `compare-view.js`) constructs one `ChartRenderRequest` and passes it to the
rewritten `chart-factory.js`, which is the sole module that imports the vendored ApexCharts build
(Constitution Principle V/VI).
