---
description: 'Task list for Welcome Page (Default Landing View)'
---

# Tasks: Welcome Page (Default Landing View)

**Input**: Design documents from `/specs/015-welcome-page-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/module-contracts.md, quickstart.md

**Tests**: Playwright E2E is this project's mandatory quality gate for UI-visible changes (constitution Testing standard, plan.md Testing) — one new spec plus updates to specs whose assumptions this feature changes. `node --test` unit tests are added for the new pure-logic module (`photo-carousel.js`'s markup builder) following the project's co-located-test convention.

**Organization**: Tasks are grouped by user story (US1/US2/US3 map to spec.md's three priorities) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1/US2/US3)
- File paths are exact, relative to repo root

## Path Conventions

Single static web app — see plan.md's Project Structure. New/changed files live under `web/img/plant/`, `web/js/{config.js,router.js,main.js,charts/chart-factory.js,views/}`, `web/i18n/`, `web/css/app.css`, `tests/e2e/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the static asset location and config entry point every user story's photos depend on.

- [x] T001 Create `web/img/plant/` directory (with a `.gitkeep` or a first operator-provided photo if available) so the path referenced by `PLANT_PHOTOS` resolves; no code in this directory (plan.md Structure Decision).
- [x] T002 [P] Add `PLANT_PHOTOS: string[]` (default `[]`) to `web/js/config.js`, documented per the `module-contracts.md` `config.js` contract (JSDoc: filenames under `web/img/plant/`, carousel display order, empty = FR-008 placeholder).

**Checkpoint**: Config surface exists; no behavior changes yet (`PLANT_PHOTOS` unused until US2).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire the new `welcome` route/view/chart-mode plumbing that every user story's content renders inside. Must complete before any user story is independently testable, since US1 already requires the route to exist and something to mount into.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Add i18n keys for the welcome page (`welcome.*`: e.g. `welcome.title`, `welcome.plantDetailsUnavailable`, `welcome.chartUnavailable`, `welcome.carouselPlaceholder`, `welcome.carouselPrev`, `welcome.carouselNext`, plant-detail field labels) to `web/i18n/de.json` and `web/i18n/en.json`, mirroring the existing `day`/`month` key-group structure.
- [x] T004 Change `defaultRoute()` in `web/js/router.js` to return `{ view: 'welcome', params: {} }` (research.md §1); add a `'welcome'` case to `formatRoute()` returning `'#/'` (matches `index.html`'s existing `href="#/"` brand link — no HTML change needed). `parseRoute('')` and `parseRoute('#/anything-unrecognized')` MUST both resolve to `{ view: 'welcome', params: {} }`; every `day`/`month`/`year`/`total` branch stays untouched (FR-002, module-contracts.md).
- [x] T005 [P] Create `web/js/views/welcome-view.js` exporting `async function render(container, ctx)` per the exact view-module signature in `module-contracts.md` (`{ plant, route }` in, optional cleanup out). Initial skeleton: renders the FR-003 two-region layout shell (`grid grid-cols-1 gap-md lg:grid-cols-3`, primary region spanning `lg:col-span-2`) with empty mount points for the carousel, plant-details panel, and chart — content wired in by US1–US3 tasks below.
- [x] T006 Register the new view in `web/js/main.js`'s `viewModules` map: `welcome: () => import('./views/welcome-view.js')` (module-contracts.md `main.js` contract). NAV_ITEMS unchanged (brand link already points at `#/`).
- [x] T007 [P] Add the `'day-total'` mode to `web/js/charts/chart-factory.js`: a new `buildDayTotalOptions(data, colors, config)` function that reuses `sumPerInverter`, `dayXAxisRange`, and `fixedAxisRange(DAY_CHART_AXES.feedInW)` to build exactly one series (summed total feed-in) and one y-axis (the feed-in axis) — no Wirkungsgrad/UDC series, axes, or legend entries (research.md §3, FR-014/015/016). Add `'day-total'` to `buildOptions()`'s switch and to `renderChart`'s mode JSDoc union.

**Checkpoint**: `#/` now dispatches to an (empty-shell) welcome view; explicit day/month/year/total routes are unaffected; `renderChart(el, 'day-total', ...)` is callable. User story implementation can now begin.

---

## Phase 3: User Story 1 - First-time visitor gets a fast plant overview (Priority: P1) 🎯 MVP

**Goal**: Opening the base URL (empty/unrecognized hash) shows the welcome page — carousel + plant details on the left two-thirds, today's total-generation chart on the right third — responsive down to mobile, each region rendering independently of the others' failures.

**Independent Test**: Open the base URL in a fresh session; confirm the welcome page (not a day chart) renders with all three regions, in a 2/3+1/3 split on desktop and a single stacked column on mobile.

### Implementation for User Story 1

- [x] T008 [P] [US1] Create `web/js/views/plant-details-panel.js` exporting `plantDetailsMarkup(plant)` per `module-contracts.md`: renders title/location/operator/capacity(kWp)/commissioned-date plus the per-inverter list (model, string count) from `PlantMetadata` (data-model.md); returns `emptyStateBody('welcome.plantDetailsUnavailable')` markup when `plant` is `null` (FR-011, FR-012, FR-013).
- [x] T009 [US1] In `web/js/views/welcome-view.js`, mount `plantDetailsMarkup(ctx.plant)` into the primary region below the carousel mount point, wrapped in its own try/catch so a rendering failure here doesn't blank the carousel or chart regions (FR-013, SC-004).
- [x] T010 [US1] In `web/js/views/welcome-view.js`, fetch today's trace the same way `day-view.js` does (`fetchText` + `sourceDirForDate`/`DATA_DIR`/`min_day.js` for today, `parseMinFile`) and call `renderChart(mount, 'day-total', trace, undefined)` into the secondary region when readings exist; render `emptyStateBody('welcome.chartUnavailable')` when the fetch fails or `trace.readings.length === 0` (FR-017, data-model.md "Failure mode"), wrapped in its own try/catch (SC-004).
- [x] T011 [US1] In `web/js/views/welcome-view.js`, apply the FR-004/FR-005 responsive grid: `grid-cols-1` (stacked: carousel → plant details → chart) below `lg`, `lg:grid-cols-3` with the primary region at `lg:col-span-2` and secondary region at `lg:col-span-1` at `lg` and above, using Tailwind utilities per the existing `dashboard.js`/detail-view grid pattern (no new CSS needed unless a gap emerges).
- [x] T012 [US1] Give the welcome page's heading/section a title sourced from `welcome.title` (or the plant's own title when set) so the view has the same `h2.view-title` structural element other views have, for layout/test consistency — while not duplicating the header's existing production/yield summary (FR-018).
- [x] T013 [P] [US1] Create `tests/e2e/welcome-page.spec.js` covering User Story 1's acceptance scenarios: base URL renders the welcome page (not a day chart) with all three regions present; desktop viewport shows the 2/3+1/3 split (bounding-box width check); a narrow viewport (375px) shows the three regions stacked in carousel→details→chart order with no horizontal scroll (SC-003); explicit routes (`#/day/...`, `#/month/...`, `#/year/...`, `#/total`) still render their own view, not the welcome page (FR-002/SC-002 regression, per quickstart.md).
- [x] T014 [US1] Update `tests/e2e/dashboard.spec.js`'s `Day detail view` block if any of its assertions relied on `'/'` resolving to the day view (search for `page.goto('/')` there and elsewhere in that file); this feature makes `'/'` the welcome page, so any such assertion must be repointed to an explicit `#/day/...` route instead of removed, since the day view itself is unaffected (FR-002).

**Checkpoint**: User Story 1 is fully functional and independently testable — welcome page renders all three regions responsively; explicit routes are unaffected.

---

## Phase 4: User Story 2 - Visitor browses plant photos (Priority: P2)

**Goal**: The carousel region shows a neutral placeholder with zero photos, a single non-interactive image with exactly one, and is browsable (auto-rotation and/or manual controls) with two or more.

**Independent Test**: With `PLANT_PHOTOS` set to 0/1/2+ entries, load the welcome page and confirm the carousel's placeholder/single-image/multi-image behavior independently of the plant-details panel and chart.

### Tests for User Story 2

- [x] T015 [P] [US2] Add `scripts` — actually co-located — unit tests in `web/js/views/photo-carousel.test.js` (`node:test`) for `carouselMarkup(photoSrcs)`: empty array → placeholder markup (no `<img>`); one entry → single `<img>`, no prev/next controls in the markup; 2+ entries → prev/next controls present. Written before the implementation (T016) per this project's TDD convention; confirm they fail first.

### Implementation for User Story 2

- [x] T016 [US2] Create `web/js/views/photo-carousel.js` exporting `carouselMarkup(photoSrcs)` and `initCarousel(carouselEl)` per `module-contracts.md`: placeholder markup for 0 photos (FR-008); single `<img>` with no dead next/prev controls for 1 photo (FR-009); auto-rotation via `setInterval` and/or prev/next button wiring for 2+ photos (FR-010), returning a cleanup function that clears any interval/listeners; `initCarousel` no-ops (returns a no-op cleanup) for 0/1 photos (research.md §5).
- [x] T017 [US2] In `web/js/views/welcome-view.js`, resolve `PLANT_PHOTOS` (config.js) into `img/plant/${fileName}` URLs in config order, mount `carouselMarkup(photoSrcs)` into the primary region above the plant-details panel, call `initCarousel()` after mount, and fold its returned cleanup into the view's own returned cleanup (data-model.md relationships diagram) — wrapped in its own try/catch (SC-004).
- [x] T018 [P] [US2] Add carousel crossfade/slide transition CSS to `web/css/app.css` only if `carouselMarkup`'s structure needs styling Tailwind utilities can't express directly (e.g. an absolutely-positioned crossfade) — skip this task if `initCarousel`'s implementation only needs Tailwind classes (research.md §5 leaves this an implementation-time call).
- [x] T019 [US2] Extend `tests/e2e/welcome-page.spec.js` with User Story 2's acceptance scenarios: 2+ configured photos → more than one image reachable (auto-rotation elapsed via `page.clock` and/or visible prev/next controls); exactly 1 photo → single image shown, no disabled/dead next-arrow in the DOM; 0 photos (default `PLANT_PHOTOS`) → neutral placeholder present, no broken `<img>` or empty gap (quickstart.md US2 steps).

**Checkpoint**: User Stories 1 AND 2 both work independently — carousel behavior is correct for every photo count without affecting the details panel or chart.

---

## Phase 5: User Story 3 - Visitor checks today's generation at a glance (Priority: P2)

**Goal**: The secondary region's chart shows exactly one line (today's combined total feed-in) on the same fixed y-axis as the existing day chart, with a neutral empty state when today has no data yet.

**Independent Test**: Load the welcome page on a day with recorded `min{yymmdd}.js` data; confirm the chart shows a single total-feed-in line on the `DAY_CHART_AXES.feedInW` axis, comparable to the existing day view's own axis, independent of the carousel/plant-details panel.

> **Note**: The `day-total` chart-factory mode itself (T007) and its wiring into `welcome-view.js` (T010) were already built in the Foundational phase and User Story 1, since US1's Acceptance Scenario 2 already requires _a_ working chart region. This phase adds the scenarios that specifically pin down US3's _content_ requirements (single series only, axis parity, empty state) with their own test coverage — the phase is a test/validation increment on already-built code, not new production code, consistent with `research.md §3`'s decision to build `day-total` once, not per-story.

### Tests for User Story 3

- [x] T020 [US3] Extend `tests/e2e/welcome-page.spec.js` with User Story 3's acceptance scenarios: on a date with recorded data (mock `min_day.js`/route today's fetch), the chart shows exactly one series (no WR1/WR2 legend entries, no Wirkungsgrad %, no UDC V — assert legend entry count/text); the y-axis max/tick values match `DAY_CHART_AXES.feedInW` (`{ max: 6000, step: 1000 }`) — e.g. by reading the rendered axis labels or comparing against the equivalent `#/day/...` view's axis; with today's fetch blocked/empty, the chart region shows `.empty-state` and no console/page error (quickstart.md US3 steps, FR-014/015/016/017).

### Implementation for User Story 3

- [x] T021 [US3] Verify (and adjust if a gap is found by T020) that `buildDayTotalOptions` (T007) never includes efficiency/UDC series/axes even when the underlying readings contain UDC data — i.e. it must not reuse any code path that conditionally adds them, since FR-015 requires their total absence, not just default-hidden (research.md §3 rationale).

**Checkpoint**: All three user stories are independently functional and covered by Playwright tests.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Repo-wide consistency and the mandatory quality gates.

- [x] T022 [P] Run `npx playwright test --reporter=line` (full suite) — confirms `welcome-page.spec.js` passes and no other existing spec (e.g. `detail-views.spec.js`, `navigation.spec.js`, `dashboard.spec.js`) regressed from the `defaultRoute()` change (quickstart.md "Automated tests").
- [x] T023 [P] Run `node --test web/js/views/photo-carousel.test.js` (and the full `node --test` unit suite) to confirm the new carousel unit tests pass.
- [x] T024 Run `npm run lint` and `npm run format:check`; fix any errors (constitution Development Workflow gate 5, mandatory before commit).
- [x] T025 Manually walk through quickstart.md's "Failure isolation (SC-004)" section (block `data/base_vars.js`, empty `PLANT_PHOTOS`, block/empty today's `min{yymmdd}.js`) confirming the other two regions render normally in each case.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T002's `PLANT_PHOTOS` constant, though not consumed until US2, is a natural sibling edit to T004's router change) — BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational — delivers the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational; extends `welcome-view.js` from US1 (T017 mounts into the primary region US1's T009/T011 already established) — implement after US1 for a working base to extend, though the carousel module itself (T015/T016) has no US1 dependency and could be built in parallel.
- **User Story 3 (Phase 5)**: Depends on Foundational (T007/T010 already satisfy its core); its own tasks are test/validation additions layered on US1's chart wiring — implement after US1.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### Within Each User Story

- Tests before/alongside implementation where TDD is used (US2's carousel unit tests, T015, before T016).
- `welcome-view.js` region-mounting tasks (T009, T010, T017) are each independent try/catch blocks in the same file — sequential edits to avoid merge conflicts, but logically independent (SC-004).

### Parallel Opportunities

- T001 and T002 (Setup) in parallel.
- T005 and T007 (Foundational: view skeleton vs. chart-factory mode) in parallel — different files.
- T008 (plant-details-panel.js) in parallel with T007/T005 once Foundational's router/registry tasks (T004/T006) land.
- T015/T016 (US2's carousel module + its tests) can be built in parallel with all of US1, since `photo-carousel.js` has no dependency on `welcome-view.js` — only T017 (wiring it in) depends on US1's welcome-view skeleton existing.
- T022 and T023 (Polish test runs) in parallel.

---

## Parallel Example: Foundational Phase

```bash
Task: "Change defaultRoute() in web/js/router.js to return the welcome route; add 'welcome' to formatRoute()"
Task: "Create web/js/views/welcome-view.js with the two-region layout shell"
Task: "Add the 'day-total' mode (buildDayTotalOptions) to web/js/charts/chart-factory.js"
```

## Parallel Example: User Story 2

```bash
Task: "Write web/js/views/photo-carousel.test.js covering 0/1/2+ photo markup states"
Task: "Implement web/js/views/photo-carousel.js (carouselMarkup, initCarousel) to satisfy those tests"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (routing + view registry + `day-total` chart mode) — CRITICAL, blocks all stories.
3. Complete Phase 3: User Story 1 — welcome page renders all three regions, responsive, with `PLANT_PHOTOS` still empty (so the carousel shows US2's eventual placeholder region as a bare stub is acceptable only if T009–T012 already produce a real plant-details panel and real chart; the carousel mount itself can be a plain placeholder `<div>` until US2 lands, satisfying FR-008's zero-photos state trivially).
4. **STOP and VALIDATE**: Run `welcome-page.spec.js`'s US1 tests plus the FR-002 regression checks.
5. Deploy/demo if ready — this alone satisfies the spec's primary success criterion (SC-001).

### Incremental Delivery

1. Setup + Foundational → routing/plumbing ready.
2. Add User Story 1 → validate independently → MVP demo-able.
3. Add User Story 2 → validate independently (photo carousel states) → demo.
4. Add User Story 3 → validate independently (chart content/axis parity) → demo.
5. Polish → full regression + lint/format gates → ready to merge.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- No backend/API contracts exist for this feature (constitution Principle III) — `contracts/module-contracts.md`'s "contracts" are the internal JS module interfaces reflected directly in the Foundational-phase tasks (T004, T006, T007) and the new-module tasks (T008, T016).
- Verify `photo-carousel.test.js` tests fail before implementing `photo-carousel.js` (T015 before T016).
- Commit after each task or logical group (or let the `after_*` git-commit hooks handle it, per this project's `.specify/extensions.yml`).
- Avoid: vague tasks, same-file conflicts within `welcome-view.js` (T009/T010/T017 each touch it — sequence them), cross-story dependencies that break independent testability.
