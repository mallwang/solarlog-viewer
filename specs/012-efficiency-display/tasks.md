# Tasks: Inverter Efficiency Display (PAC/PDC)

**Input**: Design documents from `/specs/012-efficiency-display/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — plan.md's Testing section and the constitution's testing gate explicitly
require `node --test` unit coverage for `efficiency.js` and Playwright E2E coverage for both
consumers.

**Organization**: Tasks are grouped by user story (US1 = info panel live value, US2 = day view
chart curve) per spec.md's priorities.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Paths are relative to the repository root (`/home/markus/projects/solarlog-viewer`)

---

## Phase 1: Setup

No project initialization needed — existing static frontend structure is reused as-is (per
plan.md's Structure Decision). No setup tasks required.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared pure calculation both user stories depend on. Per research.md/data-model.md
this MUST exist before either consumer is wired up.

**⚠️ CRITICAL**: Both user stories import from `efficiency.js` — it must be implemented and
passing its own tests before Phase 3/4 work begins.

- [X] T001 Write `node --test` unit tests for `efficiencyPercent(perInverter)` in
  `web/js/data/efficiency.test.js`, covering: normal ratio (e.g. 900/1000 → 90), `sumPdc === 0` →
  `null`, missing/empty `pdcW` arrays → `null`, non-finite sums → `null`, `sumPac > sumPdc`
  (>100%, returned uncapped, not clamped), and multi-inverter/multi-string summing (per
  data-model.md's derivation table and FR-001/003/005/008)
- [X] T002 Implement `efficiencyPercent(perInverter)` in `web/js/data/efficiency.js` — a pure
  function that sums `pacW` across all inverters and every element of every inverter's `pdcW`
  array, returning `(sumPac / sumPdc) * 100` when `sumPdc > 0` and both sums are finite, else
  `null` (no rounding/clamping inside — see research.md); make T001 pass

**Checkpoint**: `node --test web/js/data/efficiency.test.js` passes — both user stories can now
start.

---

## Phase 3: User Story 1 - Live efficiency in the info panel (Priority: P1) 🎯 MVP

**Goal**: The info panel (desktop + mobile variants) shows the current efficiency percentage next
to the existing current-production wattage, omitting it whenever PDC is zero/missing/unavailable.

**Independent Test**: Load the site while the plant is producing and confirm a percentage appears
next to the current production wattage in both info panel variants, updating on the existing
~10-minute poll cycle; confirm it's absent when idle, unavailable, or PDC = 0.

### Tests for User Story 1

- [X] T003 [P] [US1] Add Playwright cases to `tests/e2e/info-panel.spec.js`: efficiency %
  rendered next to the wattage when PAC>0 and PDC>0 (e.g. `1234 W · 94%`), no `%` shown when idle
  (PAC=0/PDC=0), no `%` shown when PDC=0/missing but PAC>0, no `%` shown on fetch failure
  (`data-available="false"`) — per spec.md US1 Acceptance Scenarios 1-4; must fail before T005

### Implementation for User Story 1

- [X] T004 [US1] In `web/js/info-panel/info-panel-controller.js`'s `fetchCurrentProduction()`,
  also return the reading's `perInverter` map (or the computed `efficiencyPercent` result) so
  `renderProduction` can access it without re-fetching, keeping `available: false` unchanged when
  the fetch/parse fails
- [X] T005 [US1] In `web/js/info-panel/info-panel-controller.js`, import
  `efficiencyPercent` from `../data/efficiency.js`, call it from `productionValueText()` (or a
  sibling helper), and append the rounded (`formatNumber(value, { decimals: 0, lang })`) `%`
  value to the existing wattage text (e.g. `` `${totalPacW} W · ${rounded}%` ``) only when the
  result is non-null; leave the plain wattage text unchanged when `efficiencyPercent` returns
  `null` (depends on T004)
- [X] T006 [P] [US1] Add/verify `data-role="production-value"` styling in `web/css/app.css` near
  `.info-panel__production` (app.css:788) needs no layout change for the appended `%` text; add a
  minor style only if the combined text wraps/overflows in the mobile bar — verify visually via
  `npm start`, no changes if unnecessary

**Checkpoint**: `npx playwright test tests/e2e/info-panel.spec.js --reporter=line` passes; User
Story 1 is independently functional and testable (MVP).

---

## Phase 4: User Story 2 - Efficiency curve in the day view (Priority: P2)

**Goal**: The day view chart (Mode 0) shows an efficiency % curve alongside the existing power
curve, on a secondary y-axis, gapped where PDC is zero/missing, absent entirely for
yield-only-fallback days, with the tooltip showing both values.

**Independent Test**: Open a day with recorded power data and confirm an efficiency curve is
visible alongside the power curve, with correct values at a few sampled points cross-checked
against raw PAC/PDC data; confirm gaps at zero-PDC points and absence on yield-only-fallback days.

### Tests for User Story 2

- [X] T007 [P] [US2] Add Playwright cases to `tests/e2e/detail-views.spec.js`: day view
  (`?mode=0&...`) for a day with power data shows a second chart series/axis for efficiency,
  hovering a daytime point's tooltip contains both the W value and a `%` value, hovering a
  pre-sunrise/post-sunset point (PDC=0) shows the power series but gaps the efficiency series, and
  a backfilled/yield-only day (`day.powerUnavailable` fallback) shows no efficiency series — per
  spec.md US2 Acceptance Scenarios 1-4 and FR-004/005/006/007; must fail before T009

### Implementation for User Story 2

- [X] T008 [P] [US2] Add `chart.efficiencyAxis` (or reuse `powerAxis`/a new label, e.g. "Efficiency
  (%)" / "Wirkungsgrad (%)") to `web/i18n/en.json` and `web/i18n/de.json` under the existing
  `chart` key, for the new secondary y-axis title
- [X] T009 [US2] In `web/js/charts/chart-factory.js`'s `buildDayOptions()`, import
  `efficiencyPercent` from `../data/efficiency.js`, add a second series (e.g. named via
  `t('chart.efficiencyAxis')`) mapping each reading to `efficiencyPercent(r.perInverter)`
  (`null`-gapped, uncapped — no `Math.min`/clamp), attach it to a second `yaxis` entry (opposite
  side, e.g. `{ seriesName: ..., opposite: true, title: { text: t('chart.efficiencyAxis') } }`
  alongside the existing power `yaxis`), and give the tooltip a `tooltip.custom` renderer so the
  power series keeps its `W` suffix, the new series formats with a `%` suffix plus an
  "AC: … / DC: …" breakdown sub-line from `efficiencySums()`, and both still render `'—'` for
  `null` — per data-model.md's Consumers section and research.md's "Day chart rendering approach"
  decision; do NOT touch `buildDayYieldOptions()` (FR-006 — yield-only fallback days must show no
  efficiency curve)
- [X] T010 [US2] Verify `buildDayYieldOptions()` in `web/js/charts/chart-factory.js` is unmodified
  and confirm (via T007's Playwright case) that yield-only/backfilled days render only the
  existing Wh series, no efficiency curve (FR-006)

**Checkpoint**: `npx playwright test tests/e2e/detail-views.spec.js --reporter=line` passes; User
Stories 1 AND 2 both work independently.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final validation across both stories.

- [X] T011 [P] Update `README.md`/`README.de.md` and `docs/user-guide.md`/`docs/user-guide.de.md`
  to mention the new efficiency (Wirkungsgrad) display in the info panel and day view, per
  plan.md's Documentation Standards note
- [X] T012 Run `npm run test:scripts`, `npm run lint`, and `npm run format:check`; fix any
  failures
- [X] T013 Run the full quickstart.md validation end-to-end (`npm start`, manual checks for both
  user stories, both automated Playwright suites) and confirm all "Done criteria" pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — skipped, no tasks.
- **Foundational (Phase 2)**: No dependencies — BLOCKS Phase 3 and Phase 4 (both consumers import
  `efficiency.js`).
- **User Story 1 (Phase 3)**: Depends on Phase 2 only. No dependency on US2.
- **User Story 2 (Phase 4)**: Depends on Phase 2 only. No dependency on US1 (can be built/tested
  in parallel with Phase 3 by a second developer).
- **Polish (Phase 5)**: Depends on both Phase 3 and Phase 4 being complete.

### Within Each User Story

- Tests (T003 / T007) MUST be written and FAIL before their story's implementation tasks.
- T004 before T005 (info panel: data plumbing before render logic) within US1.
- T008 before T009 (i18n label before chart code references it) within US2.

### Parallel Opportunities

- T001 (tests) and T002 (implementation) are sequential (TDD), not parallel, despite touching
  different files — T002 must make T001 pass.
- Once Phase 2 completes, US1 (Phase 3) and US2 (Phase 4) can proceed fully in parallel (different
  files: `info-panel-controller.js`/`info-panel.spec.js` vs.
  `chart-factory.js`/`detail-views.spec.js`/i18n files).
- T003 and T006 within US1 can run in parallel with each other (and with T004/T005 for T003, since
  it's the pre-existing-failing-test step).
- T007 and T008 within US2 can run in parallel.
- T011 (docs) can run in parallel with T012 (lint/test run).

---

## Parallel Example: Foundation → Both Stories

```bash
# Phase 2 (sequential, TDD):
Task: "Write efficiencyPercent unit tests in web/js/data/efficiency.test.js"       # T001
Task: "Implement efficiencyPercent in web/js/data/efficiency.js"                    # T002

# After Phase 2 completes, launch both stories together:
Task: "US1: info panel Playwright tests + implementation"   # T003-T006
Task: "US2: day view chart Playwright tests + implementation" # T007-T010
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (`efficiency.js` + its tests).
2. Complete Phase 3: User Story 1 (info panel live %).
3. **STOP and VALIDATE**: `npx playwright test tests/e2e/info-panel.spec.js --reporter=line`.
4. Ship — the live efficiency value is a complete, independently valuable increment.

### Incremental Delivery

1. Foundational → `efficiency.js` ready and unit-tested.
2. Add User Story 1 → validate → ship (MVP).
3. Add User Story 2 → validate → ship.
4. Phase 5 polish (docs, lint, full quickstart pass) → done.

### Parallel Team Strategy

With two developers: both start after Phase 2 lands — Developer A takes Phase 3 (US1, info panel),
Developer B takes Phase 4 (US2, day view chart); no file overlap, so both can merge independently.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Verify each story's Playwright test fails before implementing (T003 before T004/T005; T007
  before T009/T010).
- Commit after each task or logical group.
- Stop at either checkpoint to validate a story independently before moving on.
- No month/year/dashboard aggregate work is in scope — per spec.md's Assumptions, only US1 and
  US2's two surfaces.
