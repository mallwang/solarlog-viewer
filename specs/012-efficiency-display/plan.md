# Implementation Plan: Inverter Efficiency Display (PAC/PDC)

**Branch**: `012-efficiency-display` | **Date**: 2026-08-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-efficiency-display/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a derived "Wirkungsgrad" (efficiency = ΣPAC ÷ ΣPDC, as a percentage) to two
existing surfaces, using data already parsed from `min_cur.js` /
`min{YYMMDD}.js` — no new data files, no new network requests. A small pure
module (`web/js/data/efficiency.js`) centralizes the calculation and its
"undefined when PDC is 0/missing" guard; both consumers call it:

1. **Info panel** (`info-panel-controller.js`): appends the efficiency
   percentage next to the current-production wattage.
2. **Day view chart** (`chart-factory.js`'s `buildDayOptions`): adds a second
   series (efficiency %) to the existing day power chart, using a secondary
   y-axis, and includes the value in the tooltip.

## Technical Context

**Language/Version**: JavaScript (ES2022+), native ES modules, no bundler for JS.

**Primary Dependencies**: ApexCharts (already vendored at
`web/vendor/apexcharts/apexcharts.esm.js`, no new dependency).

**Storage**: N/A — reads existing static `.js` data files (`min_cur.js`,
`min{YYMMDD}.js`) already fetched by `info-panel-controller.js` and
`day-view.js`; no new files, no persistence.

**Testing**: `node --test` unit tests for the new pure `efficiency.js` module
(`web/js/data/efficiency.test.js`), plus Playwright E2E coverage extending
`tests/e2e/info-panel.spec.js` and `tests/e2e/detail-views.spec.js` per the
constitution's testing gate.

**Target Platform**: Browser (existing static site), no platform change.

**Project Type**: Single static frontend project (existing structure).

**Performance Goals**: N/A beyond "no additional network requests" (FR/SC-004)
— efficiency is computed synchronously from data already in memory.

**Constraints**: Must not introduce a new data fetch; must degrade to "omit
value" (never 0%/Infinity/NaN) when PDC is zero or missing, per FR-003/FR-005.

**Scale/Scope**: Two UI surfaces (info panel live value, day view chart +
tooltip); no historical/month/year aggregate scope (per spec Assumptions).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Static-File Data Model is Sacred)**: PASS — no `.js` data
  file is read differently or altered; efficiency is computed at display time
  from fields (`pacW`, `pdcW`) `min-file.js` already parses.
- **Principle II (Zero Historical Data Loss)**: PASS — display-only addition;
  existing power/yield rendering paths (including the yield-only fallback for
  backfilled days) are unchanged, efficiency is additive and simply omitted
  where source data doesn't support it.
- **Principle III (No Backend Introduction)**: PASS — pure client-side
  calculation, no new fetch, no server component.
- **Principle IV (Responsive-First Layout)**: PASS — reuses existing
  responsive info-panel/chart containers; no new fixed-width markup.
- **Principle V (Modern Charting — No Custom Pixel Math)**: PASS — the
  efficiency curve is added as a second ApexCharts series on the existing
  chart instance, no custom pixel positioning introduced.
- **Principle VI (Preserve All Five Visualization Modes)**: PASS — only Mode 0
  (daily trace) gains a series; no mode is dropped, merged, or altered in kind.
- **Technical Standards / Testing**: Playwright E2E tests will be added/extended
  for both surfaces per the testing gate; `efficiency.js` gets `node --test`
  unit coverage as a pure data function, consistent with
  `production-animation.test.js`'s precedent for pure info-panel logic.
- **Documentation Standards**: README.md/README.de.md and
  docs/user-guide.md/.de.md updates are in scope for the implementation phase
  (tasks.md), not this plan.

No violations — Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/012-efficiency-display/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature has no external interface (API,
CLI schema, etc.) — it's a display-only addition to an existing static
frontend, consuming data already fetched by existing modules.

### Source Code (repository root)

```text
web/
├── js/
│   ├── data/
│   │   ├── efficiency.js         # NEW — pure PAC/PDC → % calculation, shared by both consumers
│   │   ├── efficiency.test.js    # NEW — node:test unit tests
│   │   └── min-file.js           # existing — already parses pacW/pdcW (no change needed)
│   ├── info-panel/
│   │   └── info-panel-controller.js   # MODIFIED — sum PDC, call efficiency.js, render % next to W
│   ├── charts/
│   │   └── chart-factory.js       # MODIFIED — buildDayOptions gains an efficiency series + tooltip line
│   └── views/
│       └── day-view.js            # unchanged (still calls renderChart('day', trace, ...))
├── css/                            # possible small addition for the % value's styling
└── i18n/
    ├── de.json                    # MODIFIED — no new label strings expected (value is a bare "%"
    └── en.json                    #   suffix next to the existing W value), but chart axis title needs one

tests/e2e/
├── info-panel.spec.js             # MODIFIED — assert efficiency % appears/omits correctly
└── detail-views.spec.js           # MODIFIED — assert day chart has the efficiency series
```

**Structure Decision**: Existing single-project static frontend structure
(`web/js/{data,info-panel,charts,views}`) is reused as-is; the only new file
is the small pure `efficiency.js` module (plus its test), mirroring the
existing `production-animation.js` pattern of a pure, DOM-free logic module
consumed by `info-panel-controller.js`.

## Complexity Tracking

_No Constitution Check violations — this section is intentionally empty._
