---
description: 'Task list for Website Modernization feature'
---

# Tasks: Website Modernization

**Input**: Design documents from `/specs/001-website-modernization/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/frontend-modules.md, quickstart.md

**Tests**: Included — plan.md's Testing section and quickstart.md explicitly call for Playwright e2e specs (`tests/e2e/dashboard.spec.js`, `tests/e2e/detail-views.spec.js`) and `node:test` unit tests with inline fixtures for every `src/js/data/*` parser (per CLAUDE.md's TDD requirement and the constitution's Playwright quality gate).

**Organization**: Tasks are grouped by user story (US1–US5 from spec.md, in priority order P1 → P2 → P2 → P3 → P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Every task includes an exact file path

## Path Conventions

Single project (per plan.md Structure Decision). Originally `index.html` (repo root), `src/js/`, `src/css/`, `src/i18n/`, `vendor/chart.js/`, `tests/e2e/`; as of Phase 9 (2026-08-04) the deployable tree moved to `web/index.html`, `web/js/`, `web/css/`, `web/i18n/`, `web/vendor/chart.js/` — see plan.md's Project Structure. `tests/e2e/` is unaffected. The archived `legacy-site/` directory is read-only reference and is never modified by these tasks.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new frontend's directory structure and static assets, per plan.md's Project Structure.

- [x] T001 Create directory structure per plan.md: `src/css/`, `src/js/data/`, `src/js/views/`, `src/js/charts/`, `src/i18n/`, `vendor/chart.js/`
- [x] T002 [P] Add `chart.js` as an npm devDependency (`npm install --save-dev chart.js`), then copy `node_modules/chart.js/dist/chart.esm.js` to `vendor/chart.js/chart.esm.js` and commit the vendored file (research.md §2, quickstart.md)
- [x] T003 [P] Create `src/css/tokens.css` with CSS custom properties for colour, spacing, and typography (plan.md Technical Standards)
- [x] T004 [P] Create `src/css/app.css` skeleton with a mobile-first CSS reset and base grid/flexbox layout scaffold (FR-001)
- [x] T005 Create root `index.html`: HTML5 doctype, UTF-8 meta (FR-008), responsive viewport meta, `<script type="module" src="src/js/main.js">`, and a `<noscript>` fallback message (edge case: "browser has no JavaScript")

**Checkpoint**: Directory structure and static shell exist; no behavior yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core parsing, routing, and i18n infrastructure that every user story depends on. Contracts and shapes are fixed by `contracts/frontend-modules.md` and `data-model.md`.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 [P] Write unit tests for `extractAssignedStrings` in `src/js/data/parse-lines.test.js` using inline `arr[idx++]="..."`-style fixture strings (no real file I/O), per `node:test`
- [x] T007 [P] Implement `extractAssignedStrings` in `src/js/data/parse-lines.js` per the regex contract in `contracts/frontend-modules.md` (never `eval()`, research.md §4)
- [x] T008 [P] Write unit tests for `fetchText` in `src/js/data/fetch-text.test.js`, covering the 200-OK, non-200, and network-failure cases (must never throw)
- [x] T009 [P] Implement `fetchText` in `src/js/data/fetch-text.js` returning `{ ok: true, text }` or `{ ok: false, status }` (contracts/frontend-modules.md)
- [x] T010 [P] Write unit tests for `parseBaseVars` in `src/js/data/plant.test.js` using an inline `base_vars.js`-shaped fixture (WR1/WR2, tariff, commission date)
- [x] T011 [US-shared] Implement `parseBaseVars` in `src/js/data/plant.js` producing `PlantMetadata`/`Inverter[]` (data-model.md), built on `extractAssignedStrings` from T007
- [x] T012 [P] Write unit tests for `parseRoute`/`formatRoute` in `src/js/router.test.js`, covering all 6 URL-contract hashes plus malformed/out-of-range hash fallback to dashboard
- [x] T013 Implement `src/js/router.js`: `parseRoute`, `formatRoute`, `onRouteChange` (hashchange + initial-load dispatch) per `contracts/frontend-modules.md`
- [x] T014 [P] Create `src/i18n/de.json` and `src/i18n/en.json` with an initial scaffold of nav/widget-title keys (research.md §6); full label coverage is completed in US5 (T043)
- [x] T015 Implement `src/js/i18n.js`: `getLanguage` (localStorage, defaults `'de'`), `setLanguage`, `t(key)` dot-path lookup (contracts/frontend-modules.md, FR-017/FR-018), built on T014
- [x] T016 Implement `src/js/main.js` bootstrap: fetch `base_vars.js` via `fetchText` + `parseBaseVars`, wire `onRouteChange`, mount a view-dispatch switch (depends on T009, T011, T013, T015)

**Checkpoint**: Foundation ready — parsing, routing, and i18n primitives exist. User story implementation can now begin.

---

## Phase 3: User Story 1 — View Today's Solar Production on Mobile (Priority: P1) 🎯 MVP

**Goal**: A phone user opens the site, sees a legible mobile layout, and can view today's daily power trace with tooltips, or a clear "no data" state if it's missing.

**Independent Test**: Load the site on a 375px-wide viewport, navigate to today's daily trace, confirm the chart is legible, not clipped, and tooltips show timestamp + watts.

- [x] T017 [P] [US1] Write unit tests for `parseMinFile` in `src/js/data/min-file.test.js` with inline fixtures spanning the three epoch boundaries (2006-11-03, 2007-03-28, 2013-01-04) for both WR1 and WR2 block layouts
- [x] T018 [US1] Implement `parseMinFile` in `src/js/data/min-file.js`, importing `epochFromDate`/`epochFromFieldCounts` from `scripts/utils.js` (research.md §5), producing `DailyTrace`/`Reading[]` (data-model.md)
- [x] T019 [US1] Implement `chart-factory.js`'s `renderChart()` in `src/js/charts/chart-factory.js` with the `'day'` mode branch (time-series line/area, 24h x-axis, tooltip with timestamp + watts), establishing the update-in-place contract (destroy-and-recreate or `chart.update()`) for all future mode branches
- [x] T020 [P] [US1] Implement `src/js/views/day-view.js`: mounts a canvas, calls `fetchText` + `parseMinFile` for the routed date, renders via `chart-factory.js`, and shows the "Data not available for today" state when the file 404s (FR-019, edge case)
- [x] T021 [P] [US1] Implement `src/js/views/dashboard.js` skeleton: summary-widget grid (current production, Gesamt-/Jahres-/Monats-/Tageserträge placeholders) with navigation links to each detail view
- [x] T022 [P] [US1] Extend `src/css/app.css`: mobile-first responsive rules for 320px–2560px, hamburger/accordion nav collapse below 768px (FR-001–FR-003, edge case)
- [x] T023 [US1] Wire the `'dashboard'` and `'day'` routes into `src/js/main.js`'s view-dispatch switch (depends on T016, T020, T021)
- [x] T024 [P] [US1] Write Playwright e2e `tests/e2e/dashboard.spec.js`: 375px viewport renders without horizontal scroll (SC-001), daily chart tooltip shows timestamp/watts, offline-data day shows "No data available" message (spec Acceptance Scenarios 1–4)

**Checkpoint**: User Story 1 fully functional and independently testable — mobile dashboard + day chart with error state.

---

## Phase 4: User Story 2 — Browse Historical Monthly and Yearly Totals (Priority: P2)

**Goal**: The plant owner browses per-inverter monthly bars, yearly totals, and lifetime summary (CO₂ + feed-in tariff) across the full 2006–present range.

**Independent Test**: Navigate to the monthly bar chart, select a month from 2008, confirm per-inverter kWh bars render; open the yearly view and confirm no years are silently dropped; open the lifetime view and confirm CO₂/tariff totals are visible.

- [x] T025 [P] [US2] Write unit tests for `parseDailyTotalsFile`, `parseMonthsFile`, `parseYearsFile` in `src/js/data/aggregates.test.js` using inline fixtures, including a partial year (2006, commissioned mid-March) and a full year
- [x] T026 [US2] Implement `parseDailyTotalsFile`, `parseMonthsFile`, `parseYearsFile` in `src/js/data/aggregates.js` (data-model.md `DailyTotal`/`MonthlyTotals`/`YearlyTotals`), sharing the `days.js`/`days_hist*.js`/`daysall.js` wire format parser
- [x] T027 [US2] Implement `LifetimeSummary` derivation in `src/js/data/aggregates.js`: sum all `YearlyTotals`, port the CO₂ factor and `tariffRatePerKwh`-based feed-in calculation from `legacy-site/functions.js` as-is (data-model.md, SC-008)
- [x] T028 [P] [US2] Implement `src/js/views/month-view.js` (Mode 1): per-inverter daily-energy bar chart for the routed `YYYY-MM`, using `MonthlyTotals.dailyBreakdown`
- [x] T029 [P] [US2] Implement `src/js/views/year-view.js` (Mode 2): all-years annual-total bar chart, verifying every year from `PlantMetadata.commissionedDate` to present is represented (FR-011, spec Acceptance Scenario 2)
- [x] T030 [P] [US2] Implement `src/js/views/total-view.js` (Mode 3): lifetime cumulative bar chart plus CO₂-saved and feed-in-tariff summary display (FR-012)
- [x] T031 [US2] Extend `chart-factory.js`'s `renderChart()` in `src/js/charts/chart-factory.js` with `'month'`, `'year'`, and `'total'` mode branches (grouped bar / stacked-cumulative bar), reusing the update-in-place contract from T019
- [x] T032 [US2] Wire the `'month'`, `'year'`, `'total'` routes into `src/js/main.js`'s view-dispatch switch (depends on T028–T031)
- [x] T033 [P] [US2] Wire `src/js/views/dashboard.js`'s summary widgets to real `MonthlyTotals`/`YearlyTotals`/`LifetimeSummary` data (replacing the T021 placeholders) with navigation links to each detail view (SC-003: ≤2 interactions)
- [x] T034 [P] [US2] Write Playwright e2e coverage in `tests/e2e/detail-views.spec.js` for month/year/total: select a 2008 month and confirm per-inverter bars, confirm all years render with no drops, confirm the partial 2006 year and lifetime CO₂/tariff summary render (spec Acceptance Scenarios)

**Checkpoint**: User Stories 1 AND 2 both independently functional.

---

## Phase 5: User Story 3 — Year-over-Year Daily Comparison (Priority: P2)

**Goal**: The plant owner overlays multiple years' daily production curves on a shared day-of-year axis to spot patterns or degradation.

**Independent Test**: Open the all-years comparison view and confirm at least 3 distinct years render as separate colored lines, with correct leap-year (Feb 29) alignment.

- [x] T035 [P] [US3] Write unit tests for day-of-year grouping (including Feb 29 leap-year alignment) in `src/js/views/compare-view.test.js` using inline `daysall.js`/`days_hist_0*.js`-shaped fixtures across ≥3 years
- [x] T036 [US3] Implement `src/js/views/compare-view.js` (Mode 4): fetch `daysall.js` plus `days_hist_0*.js` for early years (research.md §3 data-model.md), group into `YearComparisonSeries` (`{ year, points: [{ dayOfYear, totalWh }] }`) via `parseDailyTotalsFile` (T026), reusing the grouping logic tested in T035
- [x] T037 [US3] Extend `chart-factory.js`'s `renderChart()` in `src/js/charts/chart-factory.js` with the `'compare'` mode branch (multi-series line overlay, one distinct color per year, tooltip showing year/day/kWh)
- [x] T038 [US3] Wire the `'compare'` route into `src/js/main.js`'s view-dispatch switch (depends on T036, T037)
- [x] T039 [P] [US3] Extend Playwright e2e `tests/e2e/detail-views.spec.js`: compare view renders ≥3 distinct year lines, tooltip shows year/day/kWh on hover/tap, leap-year Feb 29 included without misaligning other years (spec Acceptance Scenarios)

**Checkpoint**: User Stories 1, 2, AND 3 independently functional.

---

## Phase 6: User Story 4 — Live Current Production Widget (Priority: P3)

**Goal**: The dashboard shows live current power output, auto-refreshing every 5 minutes from `min_cur.js`.

**Independent Test**: Open the site during daylight hours, confirm a current-output value is shown, and confirm it refreshes after 5 minutes without a page reload.

- [x] T040 [P] [US4] Write unit tests for `LiveReading` extraction (including the `0 W` edge case) in `src/js/data/min-file.test.js`, reusing `parseMinFile` against an inline `min_cur.js`-shaped fixture
- [x] T041 [US4] Implement the live-production widget in `src/js/views/dashboard.js`: fetch `min_cur.js` on mount via `fetchText` + `parseMinFile`, `setInterval` re-fetch every 5 minutes, render "0 W — not producing" instead of blank on zero (research.md §7, FR-016, spec edge case)
- [x] T042 [P] [US4] Extend Playwright e2e `tests/e2e/dashboard.spec.js`: live widget shows a wattage value or "0 W — not producing", and re-fetches on the 5-minute interval (mocked/advanced timers) (SC-005)

**Checkpoint**: User Stories 1–4 independently functional.

---

## Phase 7: User Story 5 — Multi-Language Support (Priority: P3)

**Goal**: DE (default) and EN labels are available across every view, switchable without losing the current route, and the choice persists.

**Independent Test**: Switch the language selector to English, reload, and confirm all navigation labels, chart axis labels, and the summary table are in English and the selection persisted.

- [x] T043 [P] [US5] Complete `src/i18n/de.json` and `src/i18n/en.json` with the full label set needed by every view: nav labels, all 5 chart axis/legend labels, summary-table labels, and error/empty states (research.md §6), extending the T014 scaffold
- [x] T044 [US5] Implement a language-switcher control in `src/js/views/dashboard.js` (or a shared nav module) calling `i18n.setLanguage` and re-rendering the current route without a full page reload (FR-018, SC-006)
- [x] T045 [US5] Replace hardcoded strings with `t()` calls across `src/js/views/dashboard.js`, `day-view.js`, `month-view.js`, `year-view.js`, `total-view.js`, `compare-view.js`, and axis/legend labels in `src/js/charts/chart-factory.js`
- [x] T046 [P] [US5] Extend Playwright e2e `tests/e2e/detail-views.spec.js`: switch to English and confirm nav/axis/table labels update, reload and confirm the language persists (spec Acceptance Scenarios 1–3)

**Checkpoint**: All five user stories independently functional. Feature complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup spanning all user stories.

- [x] T047 [P] Add/verify the `test:scripts` npm script runs `node --test` over every `src/js/data/*.test.js` file (package.json)
- [x] T048 [P] Run `npx eslint` and `npm run format:check` across `src/js/**`, `src/css/**`, `index.html`; fix all reported errors (CLAUDE.md linting mandate)
- [x] T049 Execute the full `quickstart.md` validation checklist manually: 375px viewport, all 5 direct-load deep links, language switch + persistence, `npm test`, `npm run test:scripts`, `npm run lint`, `npm run format:check` all green
- [x] T050 [P] Update `README.md` to describe the new `index.html` dashboard entry point and remove stale frameset-era instructions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories.
- **User Story 1 (Phase 3, P1)**: Depends only on Foundational. Delivers the MVP.
- **User Story 2 (Phase 4, P2)**: Depends only on Foundational; T033 also touches `dashboard.js` from T021 (US1) but is additive, not blocking US1's own checkpoint.
- **User Story 3 (Phase 5, P2)**: Depends only on Foundational + `aggregates.js` from US2 (T026); independently testable once T036–T038 land.
- **User Story 4 (Phase 6, P3)**: Depends only on Foundational + `parseMinFile` from US1 (T018); independently testable.
- **User Story 5 (Phase 7, P3)**: Depends only on Foundational (i18n.js from T015); touches every view file additively.
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### Within Each User Story

- Unit tests before their corresponding parser/logic implementation.
- Parsers (`data/*.js`) before views that consume them.
- `chart-factory.js` mode branch before the view that calls it.
- Route wiring in `main.js` after the view module exists.
- Playwright e2e coverage last, once the story's UI is wired end-to-end.

### Parallel Opportunities

- All Setup [P] tasks (T002–T004) run in parallel.
- All Foundational [P] tasks (T006, T008, T010, T012, T014) run in parallel; T007/T009/T011/T013/T015/T016 depend on their paired test/prior task.
- Once Foundational completes, US1, and (after T026) US2/US3/US4/US5 can proceed in parallel across developers.
- Within US1: T017 and T020–T022 marked [P] run in parallel; T018 depends on T017, T019 depends on T018.
- Within US2: T028, T029, T030, T033, T034 marked [P] run in parallel once T026/T027 land.

---

## Parallel Example: User Story 1

```bash
# Launch US1's parallelizable tasks together once Foundational (Phase 2) is done:
Task: "Write unit tests for parseMinFile in src/js/data/min-file.test.js"
Task: "Implement day-view.js in src/js/views/day-view.js"           # after parseMinFile lands
Task: "Implement dashboard.js skeleton in src/js/views/dashboard.js"
Task: "Extend src/css/app.css responsive rules"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Load a 375px viewport, confirm today's day chart renders with tooltips, confirm the offline-data error state.
5. Deploy/demo if ready — this alone satisfies SC-001 and the spec's stated single most impactful gap.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add US1 → validate independently → deploy (MVP).
3. Add US2 → validate independently → deploy.
4. Add US3 → validate independently → deploy.
5. Add US4 → validate independently → deploy.
6. Add US5 → validate independently → deploy.
7. Phase 8 Polish → final quickstart.md validation and cleanup.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- No source `.js` data file (`base_vars.js`, `min*.js`, `days.js`, `days_hist.js`, `months.js`, `years.js`, `daysall.js`) is ever modified — every task above only reads them (Constitution Principle I).
- `legacy-site/` is read-only reference and is never imported by any new module (plan.md Structure Decision).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.

---

## Phase 9: Dual Data-Source Restructuring (2026-08-04, post-launch)

**Purpose**: Move all deployable code+data under one `web/` directory for single-folder FTP
transfer to the Synology DiskStation, and support the 2026-07-29 SolarLog device replacement by
splitting historical (`web/hist/`, frozen through 2026-07-28) from live (`web/data/`) data, merging
the two wherever a query spans the boundary. See plan.md's "Post-launch restructuring" note and
data-model.md's "Dual data source" section for full rationale.

- [x] T051 `git mv index.html src/css src/js src/i18n vendor` into `web/index.html`, `web/css`, `web/js`, `web/i18n`, `web/vendor`; fix relative refs (`web/index.html`'s `css`/`js` links, `chart-factory.js`'s vendor import)
- [x] T052 Add `bs-config.cjs` (browser-sync `baseDir: 'web'`, `/legacy-site` route) and repoint `package.json`'s `start`/`lint`/`format`/`format:check`/`test:scripts` scripts at `web/`
- [x] T053 [P] Update `eslint.config.js` (`web/js/**/*.js` files block, ignore `web/data/**`/`web/hist/**`/`web/vendor/**`) and `.prettierignore` (`!web/**`, re-ignore `web/data/**`/`web/hist/**`/`web/vendor/**`)
- [x] T054 [P] Add `web/js/config.js`: `INSTALLATION_DATE`, `DATA_DIR`, `HIST_DIR`
- [x] T055 [P] Write unit tests for `sourceDirForDate`/`fetchFromBothSources` in `web/js/data/data-source.test.js`; implement `web/js/data/data-source.js`
- [x] T056 [P] Write unit tests for `mergeDailyTotals`/`mergeMonthlyTotals`/`mergeYearlyTotals` (including the installation-month/-year sum-on-overlap case) in `web/js/data/aggregates.test.js`; implement in `web/js/data/aggregates.js`
- [x] T057 Wire every fetch call site (`main.js`, `dashboard.js`, `day-view.js`, `month-view.js`, `year-view.js`, `total-view.js`, `compare-view.js`) to the new `data/`/`hist/`-prefixed paths and merge helpers (see contracts/frontend-modules.md, data-model.md)
- [x] T058 Move epoch detection (`epochFromDate`/`epochFromFieldCounts`) to `web/js/data/epoch.js` as the canonical copy (browser code cannot depend on repo-root `scripts/`, which isn't shipped to `web/`); `scripts/utils.js` re-exports from it instead of duplicating
- [x] T059 [P] Fix `web/js/i18n.js`'s stray hardcoded `src/i18n/` fetch path (missed by the initial `src/` → `web/` move; caught via Playwright console-error check)
- [x] T060 Update `specs/001-website-modernization/plan.md`, `data-model.md`, `contracts/frontend-modules.md` for the new layout and dual-source semantics (this file)
- [x] T061 Full verification (2026-08-04): `npm run test:scripts` (215 tests), `npx eslint web tests scripts`, `npm run format:check`, `npx playwright test` (all green except the `day/2019/07/15` chart test, which failed only because `web/hist/` didn't yet have individual `min*.js` files at that point — see T062)
- [x] T062 Migrate root-level data files (2026-08-06): `git mv` the 7,441 `min*.js` files dated ≤ 2026-07-28 into `web/hist/`; `git mv` the 3 files dated ≥ 2026-07-29 (`min260729.js`–`min260731.js`) into `web/data/`; `git rm` root's `min260801.js` (stale, strict subset of the already-fresher `web/data/min260801.js`) and root's `days.js`/`days_hist.js`/`months.js`/`years.js` (verified every date in root's `days_hist.js` is already covered by `web/hist/` + `web/data/` combined, which is a strict superset — no data lost)
- [x] T063 Full re-verification after T062: `npm run test:scripts` (215 tests), lint, format:check all still green; `day/2019/07/15` e2e test now passes since `web/hist/min190715.js` exists

**Note**: root now has no SolarLog data files at all — only `eslint.config.js`/`playwright.config.js`
remain. `scripts/gap-detect.js`, `scripts/validate-plausibility.js`,
`scripts/validate-min-consistency.js`, `scripts/fill-days-hist.js`, and
`scripts/regenerate-days-hist.js` still read data files by their old root-level paths and are now
broken by this migration — repointing them at the `web/hist`/`web/data` split is an open follow-up,
not yet scheduled.
