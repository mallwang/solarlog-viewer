# Implementation Plan: Chart UDC Toggle & Per-Inverter Stacked Bars

**Branch**: `013-chart-udc-inverter-toggles` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-chart-udc-inverter-toggles/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Two independent chart enhancements, both implemented entirely inside the existing ApexCharts-based
`chart-factory.js` module and the views that call it:

1. **Day chart (Mode 0)**: add a UDC (DC string voltage, summed across inverter strings) series to
   the existing feed-in/efficiency day chart. It appears in the legend but starts hidden, using
   ApexCharts' native legend-click series toggling (`chart.hideSeries()` on mount, default
   `legend.onItemClick.toggleDataSeries` for the click-to-reveal/hide interaction) rather than any
   custom show/hide logic.
2. **Period-totals bar charts (Modes 1–3: month/year/year-months, shared by `buildBarOptions`)**:
   replace the single pre-summed `perInverter` total series with one series per inverter string
   and set `chart.stacked: true`, so each bar becomes a stacked bar. Existing `dataPointSelection`
   drill-down wiring is unaffected because it fires per data point (bar), not per series.

No data model, storage, or backend changes — both enhancements are pure rendering changes over data
the app already loads (`udcV` per reading, `perInverter` per period).

## Technical Context

**Language/Version**: JavaScript (ES2022+), native ES modules — no bundler/framework, per
constitution Technical Standards → Frontend.

**Primary Dependencies**: ApexCharts v6.7.0 (vendored at `web/vendor/apexcharts/apexcharts.esm.js`,
already the project's sole charting library per Constitution Principle V). No new dependency.

**Storage**: N/A — reads existing SolarLog `.js` data files client-side only (Constitution
Principle I); `udcV` (day readings) and `perInverter` (month/year/all-time aggregates) are already
parsed and available in the data objects passed to `renderChart`.

**Testing**: Playwright e2e (`tests/e2e/`, run via `npm test`), the project's primary quality gate
per constitution Technical Standards → Testing. `tests/e2e/detail-views.spec.js` already covers day/
month/year/total views and is the natural home for new assertions.

**Target Platform**: Browser — static site served via `browser-sync` (`npm start`); no server-side
component (Constitution Principle III).

**Project Type**: Single static web frontend (no `frontend`/`backend` split; Option 1 structure).

**Performance Goals**: No regression to existing chart render time; toggling the UDC series must
feel instant (native ApexCharts series toggle, no re-fetch or re-render of the whole chart).

**Constraints**: Client-side only, no backend (Principle III); must not alter the SolarLog `.js`
data files or their parsing (Principle I); must preserve all five existing visualization modes and
their current drill-down/tooltip behavior unchanged aside from the two described enhancements
(Principle VI).

**Scale/Scope**: Two call sites — `buildDayOptions` (new UDC series + tooltip row + legend-hidden
default) and `buildBarOptions` (shared by `buildMonthOptions`, `buildYearOptions`,
`buildYearMonthsOptions` — switch from one summed series to N per-string series + `stacked: true`).
Inverter string count is read from the data (`Object.keys(perInverter)`), not hard-coded to 2.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies? | How satisfied |
|---|---|---|
| I. Static-File Data Model is Sacred | Yes | No `.js` data file or parser touched; `udcV`/`perInverter` fields already exist in the parsed data objects and are only consumed differently by the chart layer. |
| II. Zero Historical Data Loss | Yes | Stacked bars must sum to the exact same total as today's single bar (FR-007); UDC is an additive display of already-parsed data, nothing is dropped. |
| III. No Backend Introduction | Yes | Purely client-side rendering change in `chart-factory.js`/views; no new service or endpoint. |
| IV. Responsive-First Layout | Yes | ApexCharts stacked bars and legend interactions are already responsive by default; no fixed-pixel layout introduced. |
| V. Modern Charting — No Custom Pixel Math | Yes | Uses ApexCharts' built-in stacked-bar (`chart.stacked`) and legend-toggle (`legend.onItemClick`) features exclusively; no custom pixel/show-hide logic. |
| VI. Preserve All Five Visualization Modes | Yes | Mode 0 (day) and Modes 1–3 (month/year/all-time) keep their existing series (feed-in, efficiency, drill-down) and gain additive series/segments only; no mode is dropped or merged. |
| Testing (Playwright) | Yes | New Playwright assertions added to `tests/e2e/detail-views.spec.js` for legend-click UDC toggle and for stacked-bar segment/tooltip content, per Development Workflow rule 3 (tests before implementation). |
| Documentation Standards | Yes | `README.md`/`README.de.md` and `docs/user-guide.md`/`docs/user-guide.de.md` updated to describe the UDC toggle and per-string bar breakdown, kept EN/DE consistent. |
| JSDoc / file-level docs | Yes | New/modified functions in `chart-factory.js` get JSDoc; module already carries a file-level description. |

No violations — no entry required in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/013-chart-udc-inverter-toggles/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature has no external interface (API, CLI, or wire format) — it
is a pure in-browser rendering change consumed only by the app's own views, so a contracts phase is
skipped per the Phase 1 instructions ("Skip if project is purely internal").

### Source Code (repository root)

```text
web/
├── js/
│   ├── charts/
│   │   ├── chart-factory.js       # buildDayOptions (+ UDC series), buildBarOptions (+ stacking)
│   │   └── chart-factory.test.js  # NEW — unit tests for pure per-series/stacking data shaping, if extracted as testable helpers
│   ├── views/
│   │   ├── day-view.js            # passes UDC-bearing day data into renderChart('day', ...)
│   │   ├── month-view.js          # passes perInverter breakdown into renderChart('month', ...)
│   │   ├── year-view.js           # passes perInverter breakdown into renderChart('year-months'/'year', ...)
│   │   └── total-view.js          # passes yearlyTotalsList into renderChart('year', ...)
│   ├── i18n.js                    # NEW translation keys: chart.udcAxis / chart.inverterLabel (WR1/WR2)
│   └── data/
│       └── min-file.js            # udcV already parsed per reading — read only, unchanged
docs/
├── user-guide.md                  # UPDATED — describe UDC legend toggle, per-string stacked bars
└── user-guide.de.md               # UPDATED — German equivalent, kept consistent
README.md / README.de.md           # UPDATED — feature mention if README documents chart features
tests/
└── e2e/
    └── detail-views.spec.js       # UPDATED — new assertions for both user stories
```

**Structure Decision**: Single static frontend (existing `web/` tree), Option 1-style layout already
in use by this repo (no `src/`/`backend/`/`frontend/` split — the project's own convention is
`web/js/{charts,views,data}` + `tests/e2e/`). No new top-level directories are introduced; the
feature is implemented entirely within the existing `chart-factory.js` + views + i18n + docs +
Playwright test surface listed above.

## Complexity Tracking

*No Constitution Check violations — this section is not applicable.*
