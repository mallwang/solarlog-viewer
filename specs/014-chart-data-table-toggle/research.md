# Phase 0 Research: Chart Data Table Toggle

No `NEEDS CLARIFICATION` markers remained in the Technical Context — this app's stack, storage,
and testing conventions are already fully established by prior features (013, 012, 009). The
research below documents the decisions made by following existing precedent rather than
introducing anything new.

## Decision: Derive table rows from the ApexCharts `options` object, not raw parsed data

**Rationale**: Each view module (`day-view.js`, `month-view.js`, `year-view.js`, `total-view.js`)
already calls `renderChart(mount, mode, data, config)` in `chart-factory.js`, which internally
builds an ApexCharts `options` object (`{ series: [{ name, data }], xaxis: { categories | type:
'datetime' } }`) specific to the active breakdown mode and visualization mode. Reading rows
straight from that same object guarantees the table always shows exactly what the chart shows —
including which series are present (e.g. per-inverter columns only when `breakdown: 'inverters'`
is active) — with no separate data-shaping logic to keep in sync (spec FR-003, FR-007, edge case
on multi-series charts).

**Alternatives considered**:

- _Re-derive rows independently from the raw parsed `data` each view already has_ (e.g.
  `monthTotal.dailyBreakdown`). Rejected: doubles the per-mode formatting logic that
  `chart-factory.js` already encapsulates (date/label formatting, per-inverter key naming, unit
  conversion), and risks the table silently diverging from the chart if one is updated without the
  other.
- _Export a new "tabular data" function from `chart-factory.js` per mode._ Considered as a
  refinement of the chosen approach; deferred to the data-model/contracts phase since it may be
  simpler to expose `buildOptions()`'s result (or a thin wrapper) than to add five new per-mode
  functions.

## Decision: Persist as a single boolean app-wide `localStorage` key via `settings.js`

**Rationale**: Matches the exact existing pattern for `solarlog-transparency`,
`solarlog-chart-breakdown`, and `solarlog-day-udc-visible` in `web/js/settings.js` — a plain
string key read with a safe default and an explicit setter. The spec (FR-004, FR-006) calls for a
single app-wide switch, consistent with how `chart-breakdown-toggle.js` already treats
`chart-breakdown-mode` as shared across all bar-chart views.

**Alternatives considered**: Per-view-type keys (e.g. separate day/month/year/total toggles) —
rejected per spec's explicit "for the whole app" requirement and to avoid surprising users who
expect one on/off switch, as confirmed in the spec's Assumptions section.

## Decision: Reuse the `chart-breakdown-toggle.js` module shape for the new toggle button

**Rationale**: `chart-breakdown-toggle.js` already establishes the exact pattern needed: a markup
function returning a small `<div>` with `aria-pressed` buttons, and an `init...(container,
onChange)` function that syncs state from `settings.js` and wires click handlers. The new
`chart-table-toggle.js` differs only in being a single on/off button (not two mutually exclusive
buttons) positioned top-right of `.chart-container` instead of above the chart body — same
architecture, new markup/CSS placement.

**Alternatives considered**: A checkbox/switch input styled to match. Rejected in favor of a single
`<button aria-pressed>` for consistency with the existing toggle's accessibility pattern (screen
readers already handle `aria-pressed` toggle buttons well; no new interaction pattern to document).

## Decision: Condensed table styling via Tailwind utility classes + `.chart-table` CSS hook

**Rationale**: The user named "the tailwind table 'With condensed content'" — Tailwind UI's dense
table pattern (small text, tight `py-2`/`px-3` cell padding, `divide-y` row separators). The
existing `.summary-table` in `stats-panel.js` already mixes inline Tailwind utility classes
(`w-full border-collapse`) with a few custom-property-driven CSS rules in `app.css` for what
Tailwind doesn't cover (cell borders/padding) — the new table follows the same split: Tailwind
utilities for layout/spacing/typography, a small `.chart-table` block in `app.css` for
theme-token-driven borders/colors, wrapped in an `overflow-x-auto` container per constitution
Principle IV (no horizontal page overflow at 320px).

**Alternatives considered**: A fully custom (non-Tailwind) table, matching pre-005 CSS
conventions. Rejected — Tailwind is the approved, already-in-use framework for exactly this kind
of dashboard chrome (constitution's Tailwind exception), and the user explicitly asked for a
Tailwind table pattern.

## Open questions resolved without needing spec clarification

- **Which column set for the day view (5-minute trace)?** Uses whatever series the day chart's
  `options.series` currently contains — feed-in (total or per-inverter), Wirkungsgrad, and UDC
  when shown — timestamp-labeled rows, consistent with FR-003's "one column per series shown in
  the chart."
- **Row label formatting**: reuse `chart-factory.js`'s existing label formatting already present in
  `options.xaxis.categories` (bar charts) or derivable from each datetime series' `[timestamp,
value]` pairs (day chart), rather than reinventing date formatting in the new table module.
