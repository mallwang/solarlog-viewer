# Implementation Plan: CO2 Emission Avoidance Statistics

**Branch**: `006-co2-emission-stats` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-co2-emission-stats/spec.md`

## Summary

Replace the site's single flat CO2-avoidance factor (currently a dormant, unrendered
`0.7 kg/kWh` constant in `aggregates.js`) with a static, locally-stored table of yearly UBA
emission factors for the German electricity grid mix (2006–latest published year), falling back
to a `0.363 kg/kWh` constant for any year without a published entry (current/future years). Every
statistics view that shows yield (day, month, year, total/lifetime) gains a CO2-avoidance stats
row, computed by multiplying each calendar year's yield by that year's own factor and summing —
never a single flat factor applied to a multi-year total. No network request is introduced; the
reference table ships as a plain ES module.

## Technical Context

**Language/Version**: JavaScript (ES2022+), native ES modules — matches the existing `web/js/`
codebase; no new runtime dependency.

**Primary Dependencies**: None new. Reuses `web/js/format.js` (unit-suffixed number formatting
pattern), `web/js/i18n.js` (`t()` string lookup), and the existing `web/js/data/aggregates.js` /
`web/js/data/yield-stats.js` yield-derivation functions.

**Storage**: A new static JS module (`web/js/data/co2-factors.js`), a plain object literal —
same "local reference data" pattern as the rest of the codebase (no localStorage, no IndexedDB,
no fetched JSON).

**Testing**: `node --test` unit tests (new `co2-factors.test.js`; extend existing
`aggregates.test.js` and `format.test.js`) plus Playwright e2e per the constitution's Testing
standard, extending `tests/e2e/` to assert the new stats-panel row appears and is consistent
across day/month/year/total views.

**Target Platform**: Browser (static site), unchanged — same deployment target as the rest of
`web/`.

**Project Type**: Single web project (existing `web/` tree); no new top-level project.

**Performance Goals**: Negligible — factor lookup is an O(1) object-key read and the summation
is over at most ~20 years of data; must add no perceptible rendering delay (SC-003).

**Constraints**: Zero network requests attributable to emission-factor lookup (FR-004, SC-003);
must preserve the legacy kg/tonne 10,000 kg display threshold (FR-007); adding a new year's
factor must be a single self-contained data edit with no calculation-logic changes elsewhere
(FR-006, SC-004).

**Scale/Scope**: One new data module (~20-30 entries), one new `format.js` export, four view
modules gain one stats row each (`day-view.js`, `month-view.js`, `year-view.js`,
`total-view.js`), `aggregates.js`'s `deriveLifetimeSummary` changes its CO2 calculation, two i18n
JSON files (`de.json`, `en.json`) gain one label key each per view.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle / Standard                      | Applies?       | How satisfied                                                                                                                                                                                                                          |
| ----------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Static-File Data Model is Sacred       | Yes (adjacent) | This feature adds a new, separate static JS reference module; it does not read, write, or reinterpret any SolarLog `.js` data file format.                                                                                             |
| II. Zero Historical Data Loss             | No             | No historical yield/aggregate data is modified, dropped, or reprocessed — CO2 is a purely derived display value computed on top of existing, unchanged yield aggregates.                                                               |
| III. No Backend Introduction              | Yes            | Factor lookup and CO2 calculation run entirely client-side from the bundled ES module; FR-004 explicitly forbids any network request for this data, verified via SC-003 and quickstart.md step 5.                                      |
| IV. Responsive-First Layout               | Yes (adjacent) | The new stats row reuses the existing `statsPanelMarkup`/`statsRow` table markup (`stats-panel.js`), already responsive — no new layout introduced.                                                                                    |
| V. Modern Charting — No Custom Pixel Math | No             | No chart changes; this is a stats-panel text row, not a chart element.                                                                                                                                                                 |
| VI. Preserve All Five Visualization Modes | No             | No visualization mode is added, removed, or altered.                                                                                                                                                                                   |
| Technical Standards → Frontend            | Yes            | Vanilla ES module, no framework/bundler; CSS untouched.                                                                                                                                                                                |
| Testing standard                          | Yes            | Unit tests for the new module + updated `aggregates.js`/`format.js` logic; Playwright coverage extended for all four views per the "every visible UI change" rule.                                                                     |
| Linting / Formatting                      | Yes            | `npm run lint` / `npm run format:check` gate, as for any change.                                                                                                                                                                       |
| Documentation Standards                   | Yes            | README.md/README.de.md and docs/user-guide.md/.de.md updated to describe the new CO2 figures (per Documentation Standards, applies after every feature implementation — tracked as an implementation task, not a planning-phase gate). |

No violations requiring justification — Complexity Tracking section is empty/not applicable.

## Project Structure

### Documentation (this feature)

```text
specs/006-co2-emission-stats/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature exposes no external interface (API, CLI, wire format) —
it is purely an internal computation feeding existing in-browser stats-panel markup, so contracts
are skipped per the Phase 1 instructions ("skip if project is purely internal").

### Source Code (repository root)

```text
web/
├── js/
│   ├── data/
│   │   ├── co2-factors.js       # NEW: yearly factor table + co2FactorForYear() lookup
│   │   ├── co2-factors.test.js  # NEW: unit tests (node:test)
│   │   ├── aggregates.js        # MODIFIED: deriveLifetimeSummary uses per-year factors (FR-002/FR-008)
│   │   ├── aggregates.test.js   # MODIFIED: updated/added CO2 assertions
│   │   └── yield-stats.js       # unchanged; yield figures reused as-is
│   ├── views/
│   │   ├── day-view.js          # MODIFIED: dayStatsRows() gains a CO2 row
│   │   ├── month-view.js        # MODIFIED: monthStatsRows() gains a CO2 row
│   │   ├── year-view.js         # MODIFIED: yearStatsRows() gains a CO2 row
│   │   └── total-view.js        # MODIFIED: totalStatsRows() gains a CO2 row
│   └── format.js                # MODIFIED: new formatCo2() export (kg/tonne threshold, FR-007)
│   └── format.test.js           # MODIFIED: formatCo2() test cases
├── i18n/
│   ├── de.json                  # MODIFIED: co2 label key under day/month/year/total .stats
│   └── en.json                  # MODIFIED: same keys, English strings
tests/e2e/
└── (existing spec files)        # MODIFIED/NEW: assert CO2 row presence per view
README.md / README.de.md          # MODIFIED: document the CO2 figure (Documentation Standards)
docs/user-guide.md / .de.md       # MODIFIED: document the CO2 figure from a user perspective
```

**Structure Decision**: Extends the existing single-project `web/` layout in place — no new
top-level directory. `co2-factors.js` sits alongside its sibling data modules
(`aggregates.js`, `yield-stats.js`) in `web/js/data/`, following that directory's existing
module-per-concern convention.

## Complexity Tracking

_No Constitution Check violations — section intentionally left empty._
