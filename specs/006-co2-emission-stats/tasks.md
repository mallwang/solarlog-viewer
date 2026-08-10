---
description: 'Task list for CO2 Emission Avoidance Statistics'
---

# Tasks: CO2 Emission Avoidance Statistics

**Input**: Design documents from `/specs/006-co2-emission-stats/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (no `contracts/` — purely internal computation, per plan.md's Project Structure note)

**Tests**: Included — the constitution's Testing standard (referenced in plan.md) requires unit tests for new/changed logic and Playwright coverage for every visible UI change; quickstart.md enumerates the exact assertions expected.

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task includes its exact file path(s)

## Path Conventions

Existing single-project `web/` tree (see plan.md's Project Structure) — no new top-level directory. Test files sit next to the module they cover (`*.test.js`, run via `node --test`); Playwright specs live in `tests/e2e/`.

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before touching any file — no new dependencies or project scaffolding are needed (plan.md: "No new runtime dependency").

- [x] T001 Run `npm run test:scripts` and `npx eslint web/js tests` to confirm the pre-change baseline is green (verification only, no file changes)

**Checkpoint**: Baseline confirmed clean; safe to start Foundational work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared reference-data module and formatting helper that every user story (total, day/month/year, and future maintenance) depends on. No stats row can be built without these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Create `web/js/data/co2-factors.js` exporting `CO2_FACTOR_KG_PER_KWH_BY_YEAR` (2006–2025, kg/kWh values converted from research.md R1's g/kWh table, `÷ 1000`), `CO2_FALLBACK_FACTOR_KG_PER_KWH = 0.363`, and `co2FactorForYear(year)` (returns the table entry or the fallback, per data-model.md's `??` lookup) — per FR-003/FR-005/FR-006
- [x] T003 [P] Create `web/js/data/co2-factors.test.js` (node:test) asserting: a historical year returns its exact factor (e.g. 2020 → 0.365, 2006 → 0.608, 2025 → 0.344), a year with no entry (e.g. 2026, 1990) returns the fallback 0.363, and the table's boundary years (2006, 2025) resolve correctly
- [x] T004 [P] Add `formatCo2(valueKg, opts)` export to `web/js/format.js`, porting the legacy kg/tonne threshold exactly (< 10,000 kg → `"{n} kg"` with locale decimal convention and 0 decimals via `Math.floor`-equivalent rounding; ≥ 10,000 kg → `"{n} t"` with 2 decimals) per FR-007/research.md R3
- [x] T005 [P] Add `formatCo2` test cases to `web/js/format.test.js`: one value below the 10,000 kg threshold (kg output), one at/above it (tonne output, "t" suffix, 2 decimals), and one case per locale (de comma / en period decimal)

**Checkpoint**: `co2FactorForYear()` and `formatCo2()` exist, are unit-tested, and are ready to be consumed by every view.

---

## Phase 3: User Story 1 - See avoided CO2 in the lifetime/total view (Priority: P1) 🎯 MVP

**Goal**: The total/lifetime statistics view shows a CO2 avoidance figure computed by summing each year's yield times that year's own emission factor — not one flat factor over the combined total.

**Independent Test**: Open the total/lifetime view (`#/total`) and confirm a CO2-avoidance figure is displayed and differs from `totalYieldKwh * 0.7` (the old flat-rate approximation).

### Tests for User Story 1

- [x] T006 [P] [US1] Extend the "Lifetime (total) view" `test.describe` block in `tests/e2e/detail-views.spec.js` to assert the stats panel's CO2 row is present (via the new `total.stats.co2` label) in addition to the existing kg/€ regex checks

### Implementation for User Story 1

- [x] T007 [US1] Update `deriveLifetimeSummary` in `web/js/data/aggregates.js` to import `co2FactorForYear` from `./co2-factors.js` and compute `co2SavedKg` as `Σ (yearlyYieldKwh * co2FactorForYear(year))` over `yearlyTotals`, replacing the flat `CO2_KG_PER_KWH = 0.7` constant (remove the now-unused constant) — per FR-002/FR-008
- [x] T008 [P] [US1] Update `web/js/data/aggregates.test.js`'s `deriveLifetimeSummary` CO2 assertion to use multi-year fixture data spanning at least two different factor years, and assert `co2SavedKg` equals the per-year sum (not `totalKwh * one factor`) — per SC-005
- [x] T009 [US1] Add a CO2 avoidance row to `totalStatsRows()` in `web/js/views/total-view.js` using `formatCo2(summary.co2SavedKg)` and a new `total.stats.co2` i18n key, placed alongside the existing yield/€ rows
- [x] T010 [P] [US1] Add the `total.stats.co2` label key to `web/i18n/de.json` ("Vermiedenes CO2") and `web/i18n/en.json` ("CO2 avoided") under the existing `total.stats` object

**Checkpoint**: Total/lifetime view independently shows an accurate, per-year-weighted CO2 figure (User Story 1 fully functional and testable on its own).

---

## Phase 4: User Story 2 - See avoided CO2 broken down by day, month, and year (Priority: P2)

**Goal**: Day, month, and year views each show a CO2 avoidance figure consistent with the yield shown for that period and the emission factor of the year it falls in (including the fallback constant for the current, in-progress year).

**Independent Test**: Navigate to a day, month, and year view within the same historical year and confirm all three use that year's factor; navigate to the current year and confirm the fallback constant (0.363) is used instead.

### Tests for User Story 2

- [x] T011 [P] [US2] Add/extend `test.describe` blocks in `tests/e2e/detail-views.spec.js` covering: (a) a historical year (e.g. `#/year/2020`, `#/month/2020/06`, `#/day/2020/06/15`) all show a CO2 row, and (b) the current year's view (`#/year/<current>`) shows a CO2 row consistent with the fallback factor — per quickstart.md scenarios 2–4

### Implementation for User Story 2

- [x] T012 [P] [US2] Add a CO2 avoidance row to `dayStatsRows()` in `web/js/views/day-view.js`, computed as `yieldKwh * co2FactorForYear(params.year)` via `formatCo2()`, with a new `day.stats.co2` i18n key
- [x] T013 [P] [US2] Add a CO2 avoidance row to `monthStatsRows()` in `web/js/views/month-view.js`, computed as `yieldKwh * co2FactorForYear(params.year)` via `formatCo2()`, with a new `month.stats.co2` i18n key
- [x] T014 [P] [US2] Add a CO2 avoidance row to `yearStatsRows()` in `web/js/views/year-view.js`, computed as `yieldKwh * co2FactorForYear(year)` via `formatCo2()`, with a new `year.stats.co2` i18n key
- [x] T015 [P] [US2] Add `day.stats.co2`, `month.stats.co2`, `year.stats.co2` label keys to `web/i18n/de.json` and `web/i18n/en.json` under their respective `.stats` objects

**Checkpoint**: All four views (day, month, year, total) show consistent, year-correct CO2 figures — User Story 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Maintain the emission factor reference data over time (Priority: P3)

**Goal**: The maintainer can add next year's published UBA factor as a single, self-contained data edit with no calculation-logic changes, and this workflow is documented.

**Independent Test**: Add a placeholder yearly factor entry to the local reference data and confirm all views immediately reflect the change on next load, with no other code touched.

### Implementation for User Story 3

- [x] T016 [US3] Document the yearly-factor maintenance workflow (where `web/js/data/co2-factors.js` lives, how to add a newly published UBA year, no other code change required) in `README.md` and `README.de.md` — per FR-006/SC-004
- [x] T017 [P] [US3] Document the CO2 avoidance figure from a user-facing perspective (what it means, its UBA grid-mix source, the fallback-constant behavior for the current year) in `docs/user-guide.md` and `docs/user-guide.de.md`
- [x] T018 [US3] Manually validate the maintenance workflow per quickstart.md step 6: add a placeholder entry to `CO2_FACTOR_KG_PER_KWH_BY_YEAR` in `web/js/data/co2-factors.js`, reload the corresponding year/month/day views to confirm the new factor takes effect with no other code touched, then revert the placeholder

**Checkpoint**: All user stories independently functional; reference-data maintenance path is documented and proven to work.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final gates across all stories (Linting/Testing standards from the Constitution Check in plan.md).

- [x] T019 [P] Run `npx eslint web/js/data/co2-factors.js web/js/data/co2-factors.test.js web/js/data/aggregates.js web/js/data/aggregates.test.js web/js/format.js web/js/format.test.js web/js/views/day-view.js web/js/views/month-view.js web/js/views/year-view.js web/js/views/total-view.js` and fix all errors (Linting standard)
- [x] T020 [P] Run `npm run format:check` and resolve any formatting diffs across all files touched by this feature
- [x] T021 Run `npm run test:scripts` and confirm all unit tests pass, including the new `co2-factors.test.js` and the updated `aggregates.test.js`/`format.test.js`
- [x] T022 Run `npx playwright test --reporter=line` and confirm all e2e specs pass, including the extended `tests/e2e/detail-views.spec.js`
- [x] T023 Perform quickstart.md's network check (step 5): with DevTools' Network tab open, reload each of the four statistics views and confirm zero requests are attributable to CO2/emission-factor lookup — per FR-004/SC-003

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories (co2-factors.js and formatCo2 are consumed by every story)
- **User Story 1 (Phase 3)**: Depends on Foundational — no dependency on US2/US3
- **User Story 2 (Phase 4)**: Depends on Foundational — no dependency on US1/US3 (independently testable, though it reuses the same `co2FactorForYear`/`formatCo2` helpers as US1)
- **User Story 3 (Phase 5)**: Depends on Foundational only — documents/validates a workflow that Foundational's data structure already supports; does not require US1/US2's view changes to be complete first, though validating "all views reflect the change" (T018) is more meaningful once Phases 3–4 are done
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational — no dependency on other stories
- **User Story 2 (P2)**: Can start after Foundational — independent of US1 (different view files), though both read the same Foundational helpers
- **User Story 3 (P3)**: Can start after Foundational — independent of US1/US2 code-wise; T018's validation step is most useful after US1/US2 land

### Within Each User Story

- Tests (e2e) before/alongside implementation, per constitution Testing standard ("a failing Playwright test MUST exist before implementation, then pass after")
- `aggregates.js`/view-file changes before i18n key additions is not a hard ordering — both are needed together, but i18n keys are marked `[P]` since they're a different file with no code dependency

### Parallel Opportunities

- T002–T005 (Foundational) can all run in parallel — two different new files, each independent
- T008 and T010 (US1) can run in parallel with each other, but T007 (aggregates.js logic) should land before T008's test assertions are finalized
- T012, T013, T014, T015 (US2) can all run in parallel — three different view files plus the i18n files
- T017 (US3 user-guide docs) can run in parallel with T016 (README docs)
- T019 and T020 (Polish) can run in parallel

---

## Parallel Example: User Story 2

```bash
# Once Foundational (Phase 2) is done, launch all US2 view edits together:
Task: "Add CO2 row to dayStatsRows() in web/js/views/day-view.js"
Task: "Add CO2 row to monthStatsRows() in web/js/views/month-view.js"
Task: "Add CO2 row to yearStatsRows() in web/js/views/year-view.js"
Task: "Add day.stats.co2/month.stats.co2/year.stats.co2 keys to web/i18n/de.json and en.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (co2-factors.js + formatCo2, CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (total/lifetime view)
4. **STOP and VALIDATE**: Open `#/total`, confirm the CO2 row appears and matches a manual per-year calculation (SC-005)
5. Ship — the highest-visibility regression (the dormant, unrendered legacy CO2 figure) is now fixed and improved

### Incremental Delivery

1. Setup + Foundational → shared helpers ready
2. Add User Story 1 → validate independently → ship (MVP)
3. Add User Story 2 → validate independently → ship (day/month/year drill-down parity)
4. Add User Story 3 → validate independently → ship (documented maintenance workflow)
5. Phase 6 Polish gates the final merge

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No `contracts/` directory and no test tasks for it — this feature exposes no external interface (plan.md's Project Structure)
- Verify e2e tests fail (or the assertion is meaningfully new) before implementing each story's view change
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Avoid: vague tasks, same-file conflicts within a `[P]` group, cross-story dependencies that break independence
