# Implementation Plan: Chart Data Table Toggle

**Branch**: `014-chart-data-table-toggle` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-chart-data-table-toggle/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a per-chart "show data as table" toggle button (top-right of each `.chart-container`) that
renders a condensed, Tailwind-styled `<table>` directly below the chart, listing the same
categories/series the chart currently plots. The shown/hidden state is one boolean persisted in
`localStorage` under a new `solarlog-chart-table` key (mirroring the existing
`solarlog-transparency` / `solarlog-chart-breakdown` pattern in `settings.js`) and applied
app-wide across all four chart views (day, month, year, total) and on every page load. The table
is derived generically from the ApexCharts `options` object each view already builds via
`renderChart()` — a new small module reads `options.series` and `options.xaxis` rather than each
view re-deriving rows from raw parsed data, so the table can never drift out of sync with what the
chart itself is showing (including which breakdown mode — total vs. per-inverter — is active).

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2022+), native ES modules — no bundler, no framework
(per constitution Technical Standards → Frontend).

**Primary Dependencies**: ApexCharts (already vendored at `web/vendor/apexcharts/`, used via
`chart-factory.js`); Tailwind CSS (compiled offline via `npm run build:css` into
`web/css/tailwind.generated.css`, per the constitution's approved Tailwind exception).

**Storage**: Browser `localStorage`, one new boolean key (`solarlog-chart-table`), read/written via
a new pair of functions in `web/js/settings.js` alongside the existing
`isTransparencyEnabled`/`getChartBreakdownMode`/`isDayUdcVisible` helpers.

**Testing**: `node --test` for pure helper functions (row-extraction logic); Playwright
(`npx playwright test --reporter=line`) for the visible toggle behavior and cross-page persistence,
per constitution Testing standard (every visible UI change needs a Playwright test).

**Target Platform**: Static site served to any modern browser (desktop + mobile, 320px–2560px),
no server component — table markup and toggle logic run entirely client-side.

**Project Type**: Single static web app (`web/`) — no frontend/backend split.

**Performance Goals**: Table render/toggle must be visually instantaneous (<200ms, per SC-001);
trivial given it's a synchronous DOM insert from data already held in memory (no additional
network fetch).

**Constraints**: No new runtime dependency; no change to the five preserved visualization modes'
chart rendering; must not alter the SolarLog `.js` data files or introduce any server-side
processing (constitution Principles I, III, V, VI).

**Scale/Scope**: Up to ~366 rows for a full-year day-comparison-style table (year chart's yearly
list is small; the largest case is a month view's 28–31 daily rows, or a day view's 5-minute
readings — up to ~288 rows for a full day). Table must stay compact/scrollable at that scale
(SC-003).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Static-File Data Model is Sacred)** — PASS. No `.js` data file is read
  differently; the table reuses data already parsed/aggregated for the chart.
- **Principle III (No Backend Introduction)** — PASS. Table generation and persistence are
  entirely client-side (DOM + localStorage).
- **Principle IV (Responsive-First Layout)** — PASS (design obligation carried into Phase 1): table
  must not introduce horizontal page overflow at 320px; condensed styling plus a horizontally
  scrollable wrapper satisfies this.
- **Principle V (Modern Charting — No Custom Pixel Math)** — PASS. No chart-rendering change; the
  table is plain HTML/CSS, not a chart.
- **Principle VI (Preserve All Five Visualization Modes)** — PASS. All modes keep rendering via
  `chart-factory.js` unchanged; the table is an additive, optional companion view of the same data.
- **Technical Standards → Frontend** — PASS. Vanilla JS ES modules; styling via Tailwind utility
  classes (already an approved exception) plus existing CSS custom properties for anything Tailwind
  doesn't cover, matching the `.summary-table` precedent.
- **Testing standard** — Carried into Phase 2: a Playwright test covering toggle show/hide and
  cross-page persistence is required before this feature is considered done.

No violations requiring the Complexity Tracking table.

## Project Structure

### Documentation (this feature)

```text
specs/014-chart-data-table-toggle/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
web/
├── css/
│   └── app.css                        # + .chart-table styles (condensed row padding, borders,
│                                         scroll wrapper) alongside existing .summary-table block
├── js/
│   ├── settings.js                    # + isChartTableVisible() / setChartTableVisible()
│   ├── charts/
│   │   └── chart-factory.js           # (unchanged) source of the ApexCharts `options` the new
│   │                                     table module reads
│   ├── views/
│   │   ├── chart-table-toggle.js      # NEW — mirrors chart-breakdown-toggle.js: markup for the
│   │   │                                 top-right button + init/wiring against settings.js
│   │   ├── chart-data-table.js        # NEW — pure function(s): ApexCharts `options` → table rows,
│   │   │                                 plus a render function that (re)builds the <table> markup
│   │   │                                 into a `.chart-table` mount below `.chart-mount`
│   │   ├── stats-panel.js             # chartWithStatsLayoutMarkup() gains a `.chart-table` mount
│   │   │                                 element and wires in the toggle button (top-right)
│   │   ├── day-view.js                # calls chart-data-table's render alongside renderChart()
│   │   ├── month-view.js              # same
│   │   ├── year-view.js               # same
│   │   └── total-view.js              # same
│   └── i18n.js                        # (unchanged) t() lookups for new keys below
├── i18n/
│   ├── de.json                        # + chart.tableToggleLabel / chart.tableColumn* strings
│   └── en.json                        # + same keys, English
tests/
└── e2e/
    └── chart-data-table.spec.js       # NEW — Playwright: toggle shows/hides table, table content
                                          matches chart data, preference persists across a page
                                          navigation and a reload
web/js/views/chart-data-table.test.js  # NEW — node:test unit tests for the pure row-extraction
                                          function(s) in chart-data-table.js (co-located per
                                          existing convention, e.g. period-nav.test.js)
```

**Structure Decision**: Follows the existing `web/js/views/` + `web/js/charts/` split exactly as
established by the `chart-breakdown-toggle.js` / `chart-factory.js` precedent (feature 013). No
new top-level directory is introduced; the toggle button and table are two new sibling modules in
`web/js/views/`, wired into each of the four existing view modules the same way
`initChartBreakdownToggle` already is.

## Complexity Tracking

_No violations — table not needed._
