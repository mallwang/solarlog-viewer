# Tasks: Statistics Page

**Input**: Design documents from `/specs/022-statistics-page/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/statistics-module.md, quickstart.md

**Tests**: Explicitly requested — quickstart.md names `node --test` unit-test files and a
Playwright spec as the constitution-mandated quality gate. Every implementation task below has a
matching test task written first.

**Organization**: Tasks are grouped by user story (US1–US4) per spec.md priorities, after a
Setup/Foundational phase shared by all stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps task to US1/US2/US3/US4
- File paths are exact, per plan.md's Project Structure section

## Path Conventions

Single static web app — all paths relative to repo root: `web/js/data/`, `web/js/views/`,
`web/js/charts/`, `web/js/`, `web/i18n/`, `tests/e2e/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new files/directories every user story writes into; no logic yet.

- [ ] T001 Create `web/js/views/statistics/` directory with an empty `statistics-view.js` shell
      (route entry point, no rendering logic yet — see plan.md's Project Structure).
- [ ] T002 [P] Create empty `web/js/data/statistics.js` with a file-level JSDoc comment describing
      it as the pure computation module per contracts/statistics-module.md (no exports yet).
- [ ] T003 [P] Add empty `statistics` key namespaces to `web/i18n/de.json` and `web/i18n/en.json`
      (placeholder objects to be filled per-story below).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Routing, nav entry, and the page shell that fetches the merged full-history data
once — every topic (US1–US4) depends on this being in place before it can render anything.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Add the `'statistics'` route to `parseRoute`/`formatRoute` in `web/js/router.js`:
      `#/statistics/:topic` with `topic ∈ common|heatmaps|streaks|trends|best-worst`, defaulting to
      `topic: 'common'` when the segment is missing/invalid (per contracts/statistics-module.md's
      Router contract). Mirror the existing `month`/`year` route-parsing style in the same file.
- [ ] T005 [P] Add router test coverage for the new route in `web/js/router.test.js` (or create it
      if it doesn't exist — check first): valid topics, missing topic, invalid topic, and
      `formatRoute` round-trip.
- [ ] T006 Add the "Statistik" entry to `NAV_ITEMS` in `web/js/main.js` (after `total`, before
      `events`, per design.md's nav ordering) and register `statistics: () =>
    import('./views/statistics/statistics-view.js')` in `viewModules`.
- [ ] T007 Implement `statistics-view.js`'s page shell in
      `web/js/views/statistics/statistics-view.js`: on mount, fetch `hist/days_hist.js` +
      `data/days_hist.js` via `fetchFromBothSources`, merge with `mergeDailyTotals`, fold in
      today's live entry from `data/days.js` (research.md R1), plus `months.js`/`years.js` merged
      via `mergeMonthlyTotals`/`mergeYearlyTotals`, plus `plant` (already available via the
      `render(viewMain, { plant, route })` contract every other view uses — see total-view.js).
      Render the left topic nav (five topics, active-topic accent bar per design.md) and mount the
      active topic renderer into the right content area based on `route.params.topic`, without
      refetching when the topic changes within the same page load (SC-004).
- [ ] T008 [P] Add `web/js/views/statistics/statistics-view.test.js` covering: the shell fetches
      each source file exactly once even when the topic changes twice, the correct topic renderer
      is mounted per `route.params.topic`, and an invalid topic falls back to `common`.
- [ ] T009 [P] Add shared markup helpers used by every topic (stat-tile card, "worst"
      diagonal-stripe treatment, empty-state wiring) to `web/js/views/statistics/statistics-view.js`
      or a small co-located helper, reusing `web/js/views/empty-state.js` and `stats-panel.js`
      patterns per design.md's "Shared states" section — exported so topic modules can import them.
- [ ] T010 [P] Implement `hasEnoughHistory(fullDailyHistory, fullYearlyHistory, topic)` in
      `web/js/data/statistics.js` per data-model.md's "Not-enough-data gating" table (FR-012).
- [ ] T011 [P] Add `web/js/data/statistics.test.js` covering `hasEnoughHistory` for each gated
      topic (`heatmaps`, `streaks`, `trends`) and the two ungated topics (`common`, `best-worst`
      always `true`), per quickstart.md's expected coverage.

**Checkpoint**: Foundation ready — `#/statistics/common` (etc.) routes correctly, the shell fetches
merged history once and mounts a (still-empty) topic area. User story implementation can now begin.

---

## Phase 3: User Story 1 - Common overview (Priority: P1) 🎯 MVP

**Goal**: The "Common" topic renders 8 stat tiles (best/worst month & year, max daily power, max
Ist %, max daily CO2, max daily €), each linking to its source day/month/year view.

**Independent Test**: Navigate to `#/statistics` (or `#/statistics/common`); verify each of the 8
tiles shows a value + period and that the best-month tile navigates to `#/month/YYYY/MM`.

### Tests for User Story 1

- [ ] T012 [P] [US1] Unit tests for `bestWorstMonth`/`bestWorstYear` in
      `web/js/data/statistics.test.js`: correct extremum picked, months/years with zero entries
      ignored, `route`/`period` fields populated per data-model.md's Stat tile shape.
- [ ] T013 [P] [US1] Unit tests for `maxDailyPower`/`maxIstPercent`/`maxDailyCo2`/`maxDailyEuro` in
      `web/js/data/statistics.test.js`: correct day picked from `fullDailyHistory`, `peakW` used
      directly (no minute-file derivation), `caveat` set only on `maxDailyPower`.
- [ ] T014 [P] [US1] Playwright test in `tests/e2e/statistics-view.spec.js` (create file): open
      `#/statistics/common`, assert all 8 tiles render with a value + period, click the best-month
      tile and assert navigation to the correct `#/month/YYYY/MM`.

### Implementation for User Story 1

- [ ] T015 [US1] Implement `bestWorstMonth(fullMonthlyHistory)` and
      `bestWorstYear(fullYearlyHistory)` in `web/js/data/statistics.js` per
      contracts/statistics-module.md, summing kWh per month/year the same way
      `yield-stats.js`/`aggregates.js` already do (depends on T010 file existing).
- [ ] T016 [US1] Implement `maxDailyPower(fullDailyHistory)`,
      `maxIstPercent(fullDailyHistory, plant)`, `maxDailyCo2(fullDailyHistory)`, and
      `maxDailyEuro(fullDailyHistory, plant)` in `web/js/data/statistics.js` per data-model.md's
      per-function notes (peakW direct read, dailySollKwh division, co2FactorForYear, tariffRatePerKwh).
- [ ] T017 [US1] Create `web/js/views/statistics/common-topic.js`: renders the 8-tile grid (4 cols
      desktop / 2 cols mobile per design.md) using the shared stat-tile markup from T009, each tile
      linking via `formatRoute(tile.route)`, max-daily-power tile showing its caveat text (FR-011).
- [ ] T018 [US1] Wire `common-topic.js` into `statistics-view.js`'s topic-mounting switch (from
      T007) for `topic === 'common'`.
- [ ] T019 [P] [US1] Add `statistics.common.*` and `statistics.commonTiles.*` i18n keys (labels,
      caveat text, "not enough" n/a) to `web/i18n/de.json` and `web/i18n/en.json`.

**Checkpoint**: User Story 1 fully functional and independently testable — this is the MVP.

---

## Phase 4: User Story 2 - Calendar heatmaps (Priority: P2)

**Goal**: The "Heatmaps" topic shows a year selector and three CSS-grid calendar heatmaps
(energy/money/CO2), color-scaled per-year, with missing days visually distinct from real zeros.

**Independent Test**: Select "Heatmaps", pick a year with data; verify three heatmaps render one
cell per day, a missing-data cell is visually distinct from a zero-value cell, and changing the
year re-renders all three.

### Tests for User Story 2

- [ ] T020 [P] [US2] Unit tests for `buildCalendarHeatmap` in `web/js/data/statistics.test.js`:
      absent dates yield `value: null` (not `0`), `relativeIntensity` scaled to that year's own
      min/max (not global), `relativeIntensity: 0` when `yearMax === yearMin`, correct `cells`
      length for leap vs. non-leap years (per quickstart.md).
- [ ] T021 [P] [US2] Playwright test in `tests/e2e/statistics-view.spec.js`: open
      `#/statistics/heatmaps`, pick a year with data, assert three heatmap grids render with one
      cell per calendar day; assert a known-missing day's cell carries a distinct hatch class/style
      from a real-zero day; change year and assert all three heatmaps re-render.

### Implementation for User Story 2

- [ ] T022 [US2] Implement `buildCalendarHeatmap(fullDailyHistory, year, metric, plant)` in
      `web/js/data/statistics.js` per data-model.md's Calendar heatmap entity (energyKwh/moneyEuro/
      co2Kg extraction, per-year relative scale, `daysInYear` from `yield-stats.js`).
- [ ] T023 [US2] Create `web/js/views/statistics/heatmaps-topic.js`: year `<select>` (defaulting to
      most recent year with data per research.md R4, in-page state only — not routed), three
      stacked CSS-grid heatmap blocks (7×~53) per metric with `--v` custom property driving
      `color-mix()`, hatch pattern for `value === null` cells, and a legend, per design.md /
      mockup.html's approved treatment.
- [ ] T024 [US2] Wire `heatmaps-topic.js` into `statistics-view.js` for `topic === 'heatmaps'`,
      including the `hasEnoughHistory(..., 'heatmaps')` gate from T010 rendering the shared
      empty-state (T009) when ungated data is empty.
- [ ] T025 [P] [US2] Add `statistics.heatmaps.*` i18n keys (year selector label, three metric
      labels, legend text) to `web/i18n/de.json` and `web/i18n/en.json`.

**Checkpoint**: User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Streaks and trends (Priority: P3)

**Goal**: "Streaks" shows the longest above-threshold consecutive-day run; "Trends" shows YoY
cumulative yield, lifetime cumulative €/CO2, and specific-yield degradation, each via
`chart-factory.js`.

**Independent Test**: Select "Streaks", verify streak length + start/end dates (+ ongoing badge
when applicable); select "Trends", verify all three charts render with plausible values.

### Tests for User Story 3

- [ ] T026 [P] [US3] Unit tests for `computeLongestStreak` in `web/js/data/statistics.test.js`:
      correct longest run identified, a gap breaks the run, an ongoing streak (`endDate` = fixture's
      last date) is `isOngoing: true`, a tie with the historical record is also `isOngoing: true`
      (per data-model.md's tie-breaking note).
- [ ] T027 [P] [US3] Unit tests for `computeYoyCumulative`, `computeLifetimeCumulative`, and
      `computeSpecificYieldTrend` in `web/js/data/statistics.test.js`: YoY aligns Feb 29 without
      shifting later day-of-year values in non-leap years (mirrors the existing Mode 4 precedent),
      lifetime cumulative runs from `plant.commissionedDate`'s year, specific-yield trend uses
      `specificYieldKwhPerKwp` unchanged (per quickstart.md).
- [ ] T028 [P] [US3] Unit tests for the three new `chart-factory.js` modes
      (`yoy-cumulative`/`lifetime-cumulative`/`specific-yield-trend`) in
      `web/js/charts/chart-factory.test.js` (create if it doesn't exist — check first): each
      produces a valid ApexCharts option object, same assertion style as existing mode tests;
      `lifetime-cumulative`/`specific-yield-trend` points wire `onDataPointClick` to `#/year/YYYY`.
- [ ] T029 [P] [US3] Playwright test in `tests/e2e/statistics-view.spec.js`: open
      `#/statistics/streaks`, assert streak length + date range render (and an ongoing badge when
      the fixture's streak is open); open `#/statistics/trends`, assert all three chart blocks
      render and the degradation caveat text is present in the DOM (not hover-only).

### Implementation for User Story 3

- [ ] T030 [US3] Determine and hardcode `STREAK_THRESHOLD_KWH` in `web/js/data/statistics.js` per
      research.md R5 (≈10% of the plant's average historical daily yield in the Mar–Sep season,
      computed once from the merged full daily history's median at implementation time).
- [ ] T031 [US3] Implement `computeLongestStreak(fullDailyHistory)` in `web/js/data/statistics.js`
      per data-model.md's Streak entity (single-pass consecutive-date runs, max-by-length, ties
      broken by most-recent). Depends on T030.
- [ ] T032 [US3] Implement `computeYoyCumulative(fullDailyHistory)`,
      `computeLifetimeCumulative(fullYearlyHistory, plant)`, and
      `computeSpecificYieldTrend(fullYearlyHistory, plant)` in `web/js/data/statistics.js` per
      data-model.md's Trend series entity.
- [ ] T033 [US3] Add the `'yoy-cumulative'` mode (multi-series line, aligned by day-of-year) to
      `web/js/charts/chart-factory.js`'s `buildOptions` switch, following the existing
      `year`/`year-months` builder pattern (research.md R3); informational only, no
      `onDataPointClick`.
- [ ] T034 [US3] Add the `'lifetime-cumulative'` mode (dual-axis €/CO2 line, point →
      `#/year/YYYY`) to `web/js/charts/chart-factory.js`.
- [ ] T035 [US3] Add the `'specific-yield-trend'` mode (per-year bar, bar → `#/year/YYYY`) to
      `web/js/charts/chart-factory.js`.
- [ ] T036 [US3] Create `web/js/views/statistics/streaks-topic.js`: oversized streak-length stat
      card, threshold framing, start–end date range, "läuft noch"/ongoing pill badge when
      `isOngoing`, and the recent-days highlight strip, per design.md's Streaks topic.
- [ ] T037 [US3] Create `web/js/views/statistics/trends-topic.js`: three stacked chart blocks via
      `renderChart(container, mode, data, config)` for the three new modes, with the
      always-visible degradation caveat line under the specific-yield chart (FR-008).
- [ ] T038 [US3] Wire `streaks-topic.js` and `trends-topic.js` into `statistics-view.js` for
      `topic === 'streaks'`/`'trends'`, each gated by `hasEnoughHistory(..., topic)` — Trends gates
      the YoY chart independently from the lifetime/degradation charts per data-model.md's gating
      table (a plant with exactly one year still shows lifetime + degradation).
- [ ] T039 [P] [US3] Add `statistics.streaks.*` and `statistics.trends.*` i18n keys (including the
      degradation caveat copy) to `web/i18n/de.json` and `web/i18n/en.json`.

**Checkpoint**: User Stories 1, 2, AND 3 all work independently.

---

## Phase 6: User Story 4 - Best vs. worst comparison (Priority: P4)

**Goal**: The "Best vs. Worst" topic pairs every Common-topic stat that has a best/worst
counterpart (month, year, daily yield) side by side, no separate toggle.

**Independent Test**: Select "Best vs. Worst"; verify each paired stat shows both values with
independent source-view links.

### Tests for User Story 4

- [ ] T040 [P] [US4] Unit tests for `bestWorstPairs` in `web/js/data/statistics.test.js`: composes
      `bestWorstMonth`/`bestWorstYear` and a daily-yield best/worst pair without duplicating logic,
      returns one `BestWorstPair` per metric.
- [ ] T041 [P] [US4] Playwright test in `tests/e2e/statistics-view.spec.js`: open
      `#/statistics/best-worst`, assert every paired stat renders both best and worst values with
      distinct, correct navigation links (no toggle needed to reveal "worst", per FR-016).

### Implementation for User Story 4

- [ ] T042 [US4] Implement `bestWorstPairs(fullDailyHistory, fullMonthlyHistory,
    fullYearlyHistory)` in `web/js/data/statistics.js` per data-model.md's Best/worst pair
      entity, composing the Common-topic functions (T015/T016) rather than duplicating them.
- [ ] T043 [US4] Create `web/js/views/statistics/best-worst-topic.js`: label/best/worst
      three-column row per paired metric, worst-tile stripe treatment reused from T009, each side
      linking to its own source view, per design.md's Best vs. Worst topic.
- [ ] T044 [US4] Wire `best-worst-topic.js` into `statistics-view.js` for `topic === 'best-worst'`
      (ungated per data-model.md — always renders).
- [ ] T045 [P] [US4] Add `statistics.bestWorst.*` i18n keys to `web/i18n/de.json` and
      `web/i18n/en.json`.

**Checkpoint**: All four user stories independently functional — full feature scope complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Responsive layout verification, documentation, and final quality gate per
quickstart.md's "Constitution gate".

- [ ] T046 [P] Verify/adjust responsive CSS for the topic nav (sticky vertical → horizontal
      wrapping row), tile grids (4 → 2 columns), and heatmap/chart blocks at 320px and 2560px per
      design.md's "Mobile" section and constitution Principle IV (no horizontal scroll).
- [ ] T047 [P] Playwright responsive test in `tests/e2e/statistics-view.spec.js`: resize to 320px
      and 2560px, assert no horizontal scroll and the topic nav collapses to a button row on
      mobile (quickstart.md step 6).
- [ ] T048 [P] Playwright edge-case test in `tests/e2e/statistics-view.spec.js`: with a
      fixture/test plant under one year of history, assert Heatmaps/Streaks/Trends each show the
      "not enough data yet" empty state while Common/Best vs. Worst still render normally
      (FR-012, SC-005, quickstart.md step 5).
- [ ] T049 [P] Update `docs/user-guide.md` and `docs/user-guide.de.md` with a Statistics page
      section (topics, what each shows) per Documentation Standards.
- [ ] T050 [P] Update `README.md` and `README.de.md`'s feature/view list to mention the new
      Statistics page.
- [ ] T051 Run `npm run lint`, `npm run format:check`, `node --test web/js/data/statistics.test.js
    web/js/charts/chart-factory.test.js`, and `npx playwright test
    tests/e2e/statistics-view.spec.js --reporter=line` — fix any failures.
- [ ] T052 Update `**Status**` in spec.md from `Draft` to `Implemented` (only once every task above
      is checked off).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001–T003). BLOCKS all user stories (T012+).
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2). No dependency on other stories.
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2). Independent of US1 (different
  topic module/data functions), though both plug into the same `statistics-view.js` switch from T007.
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2). Independent of US1/US2.
- **User Story 4 (Phase 6)**: Depends on Foundational (Phase 2) **and** the Common-topic functions
  from US1 (T015/T016), which `bestWorstPairs` (T042) composes rather than duplicates — the only
  cross-story dependency in this feature.
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### Within Each User Story

- Tests written first, must fail before implementation (T012–T014 before T015–T019, etc.).
- Data-layer functions (`statistics.js`) before the topic view module that consumes them.
- Topic view module before wiring it into `statistics-view.js`'s switch.
- i18n keys can land in parallel with implementation (same-file edits, but independent content).

### Parallel Opportunities

- T002, T003 (Setup) in parallel.
- T005, T008, T009, T010, T011 (Foundational, distinct files) in parallel once T004/T007 land.
- Within each user story, all `[P]`-marked test tasks run in parallel; i18n tasks (`[P]`) run in
  parallel with implementation tasks in the same story.
- US1, US2, US3 can be implemented in parallel by different developers once Phase 2 is done; US4
  must wait for US1's T015/T016.
- All Phase 7 tasks except T051/T052 marked `[P]`.

---

## Parallel Example: User Story 1

```bash
# Tests together:
Task: "Unit tests for bestWorstMonth/bestWorstYear in web/js/data/statistics.test.js"
Task: "Unit tests for maxDailyPower/maxIstPercent/maxDailyCo2/maxDailyEuro in web/js/data/statistics.test.js"
Task: "Playwright test for Common topic in tests/e2e/statistics-view.spec.js"

# i18n alongside implementation:
Task: "Add statistics.common.* i18n keys to web/i18n/de.json and web/i18n/en.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (routing, nav entry, page shell, `hasEnoughHistory`).
3. Complete Phase 3: User Story 1 (Common topic — 8 tiles).
4. **STOP and VALIDATE**: `#/statistics/common` shows all 8 tiles correctly, links navigate
   correctly (quickstart.md US1 steps).
5. Deploy/demo if ready — this alone satisfies SC-001/SC-002 for the "Common" topic.

### Incremental Delivery

1. Setup + Foundational → routing/shell ready.
2. US1 (Common) → validate independently → MVP.
3. US2 (Heatmaps) → validate independently.
4. US3 (Streaks + Trends) → validate independently.
5. US4 (Best vs. Worst) → validate independently (needs US1's stat functions).
6. Polish → responsive check, docs, full quality gate.

### Parallel Team Strategy

1. Team completes Setup + Foundational together.
2. Once Foundational is done: Developer A → US1, Developer B → US2, Developer C → US3.
3. US4 starts once US1's T015/T016 land (small task, can go to whichever developer frees up first).
4. Polish once all four stories are complete.

---

## Notes

- `[P]` tasks touch different files, or the same file in a way that doesn't conflict (e.g. two
  `de.json`/`en.json` key-additions land in parallel commits are still a merge risk — coordinate
  if genuinely parallelized by multiple people).
- `[Story]` label maps every user-story-phase task to US1/US2/US3/US4 for traceability.
- FR-010's aggregate-file-only constraint applies to every data-layer task in every story — no
  task in this list introduces a per-day minute-file fetch.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
