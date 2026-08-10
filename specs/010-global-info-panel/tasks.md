---
description: 'Task list for Global Desktop Info Panel'
---

# Tasks: Global Desktop Info Panel

**Input**: Design documents from `/specs/010-global-info-panel/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: Requested by plan.md — `node --test` unit coverage for every new pure-logic module plus a new Playwright e2e spec. Included below.

**Organization**: Tasks are grouped by user story (spec.md P1–P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Paths are relative to the repository root

## Path Conventions

Single existing project, `web/` tree (see plan.md's Project Structure) — no new top-level directories.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the new module directory and shared i18n scaffolding used by every story.

- [X] T001 Create `web/js/info-panel/` directory (no file yet — placeholder for Phase 2/3 modules)
- [X] T002 [P] Add empty `info-panel` string sections to `web/i18n/en.json` and `web/i18n/de.json` (keys to be filled in per-story tasks below)

**Checkpoint**: Directory and i18n scaffolding exist; no behavior yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared markup, styling scaffold, and wiring that every user story's controller code will attach to. No user story can render anything until this phase is done.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Add `<div id="info-panel" class="info-panel" hidden>` markup (with `data-*` placeholder slots for production, weather, and today's-forecast sections) inside `app-header` in `web/index.html`, gated by the existing `md:` breakpoint per research.md §5 (e.g. `hidden md:flex` equivalent class)
- [X] T004 [P] Add `.info-panel` layout rules (flex layout inside `app-header`, `md:`-only visibility, no overlap/displacement of nav or `app-main` per SC-004) to `web/css/app.css`
- [X] T005 [P] Add production-animation `@keyframes` and `--intensity` tier custom-property scaffolding (idle/low/medium/high/peak, per research.md §4) to `web/css/app.css` — no JS wiring yet, just the CSS tiers
- [X] T006 Wire a dynamic `import('./info-panel/info-panel-controller.js')` call after `bootstrap()`'s existing sky-controller import in `web/js/main.js`, mirroring the sky-controller lazy-init pattern (no controller module exists yet — this call is added now so T014 only has to fill in the module)

**Checkpoint**: Header has a hidden/desktop-gated panel shell and CSS tiers exist; `main.js` is ready to hand off to a controller module. Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - At-a-glance production status on desktop (Priority: P1) 🎯 MVP

**Goal**: Persistent desktop-only panel showing the plant's current total production, refreshed every ~10 minutes, with an independent "unavailable" state, hidden entirely on mobile widths.

**Independent Test**: Load the dashboard on a desktop-width viewport and verify the panel displays a current production value matching `data/min_cur.js`'s latest reading; resize below 768px and verify the panel disappears with no layout space.

### Tests for User Story 1

- [X] T007 [P] [US1] Unit tests for `productionIntensity()` boundary/tiering behavior in `web/js/info-panel/production-animation.test.js` (0 W → idle; each tier threshold; ≥~90% capacity → peak; above-nameplate clamps rather than overflows) — write first, confirm failing
- [X] T008 [P] [US1] Playwright scenarios for desktop-visible + populated panel, mobile-absent panel, and production "unavailable" state (mocked `data/min_cur.js` route failure) in `tests/e2e/info-panel.spec.js` — write first, confirm failing

### Implementation for User Story 1

- [X] T009 [P] [US1] Implement `productionIntensity(currentPacW, capacityKwp)` pure function in `web/js/info-panel/production-animation.js` (clamp ratio to `[0, 1]`, map to discrete tier per research.md §4), with file-level and function JSDoc — makes T007 pass
- [X] T010 [US1] Implement `web/js/info-panel/info-panel-controller.js`: on mount, fetch `data/min_cur.js` via existing `fetchText` + `parseMinFile` (same path as `dashboard.js`), sum `perInverter[*].pacW` into `totalPacW`, render into the `#info-panel` production slot, apply the `--intensity` custom property from `productionIntensity()`, set an "unavailable" state on fetch/parse failure without touching other panel sections, and start a `10 * 60 * 1000` ms `setInterval` re-fetch (FR-004) — keeps last good value on a tick with no newer reading (per spec's Edge Cases)
- [X] T011 [US1] Add `info-panel.production.*` / `info-panel.unavailable` display strings to `web/i18n/en.json` and `web/i18n/de.json`, and consume them from `info-panel-controller.js`
- [X] T012 [US1] Verify T008's Playwright scenarios pass against the new controller; run `node --test web/js/info-panel/production-animation.test.js` and confirm T007 passes

**Checkpoint**: User Story 1 is fully functional and independently testable — panel shows live production on desktop, hidden on mobile, degrades to "unavailable" cleanly.

---

## Phase 4: User Story 2 - Current weather and today's forecast alongside production (Priority: P2)

**Goal**: The same panel also shows the current weather condition and today's remaining forecast for the installation's location, with its own independent "unavailable" state.

**Independent Test**: Load the dashboard and verify the panel shows a current weather condition label and today's forecast summary (condition and/or min/max temperature) for the installation's location; block the weather request and verify only the weather/forecast area shows "unavailable" while production keeps displaying.

### Tests for User Story 2

- [X] T013 [P] [US2] Unit tests for the weather/forecast fetch+parse function in `web/js/info-panel/weather-forecast-client.test.js` (mocked `fetch`: successful response → `{ weatherCode, temperatureC, todayWeatherCode, todayMaxC, todayMinC, available: true }`; network failure/non-2xx/malformed response → `available: false`; no real network calls) — write first, confirm failing
- [X] T014 [P] [US2] Extend `tests/e2e/info-panel.spec.js` with desktop weather/forecast population from a mocked Open-Meteo response, and a weather-side "unavailable" scenario (mocked failure) that leaves the production side unaffected — write first, confirm failing

### Implementation for User Story 2

- [X] T015 [US2] Implement the Open-Meteo fetch+parse function in `web/js/info-panel/weather-forecast-client.js` per research.md §1's request shape (`current=weather_code,temperature_2m&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`), returning the shape from data-model.md's "Current Weather Condition"/"Today's Forecast Summary", never throwing (mirrors `sky/weather-client.js`'s convention) — makes T013 pass
- [X] T016 [P] [US2] Add a WMO `weather_code` → short i18n label key mapping table alongside `weather-forecast-client.js` (or as a small exported map within it), covering at minimum clear/cloudy/rain/snow/storm groupings
- [X] T017 [US2] In `web/js/info-panel/info-panel-controller.js`, resolve the installation location via `resolveInstallationLocation()` (reused from `web/js/sky/location.js`), call the new weather-forecast client on mount and every ~10 minutes (same cadence as production, per research.md §6), render current condition + today's min/max/condition into the panel's weather slot, and set the weather-area's own independent "unavailable" state on failure or unresolved location — must not affect the production slot's rendering
- [X] T018 [US2] Add `info-panel.weather.*` / `info-panel.forecast.*` display strings (condition labels, today's forecast summary phrasing) to `web/i18n/en.json` and `web/i18n/de.json`, and consume them from the controller
- [X] T019 [US2] Verify T014's new Playwright scenarios pass; run `node --test web/js/info-panel/weather-forecast-client.test.js` and confirm T013 passes

**Checkpoint**: User Stories 1 AND 2 both work independently — production and weather/forecast render side by side, each with its own failure isolation.

---

## Phase 5: User Story 3 - Jump to detailed forecast on wetteronline.com (Priority: P2)

**Goal**: Clicking/tapping the weather/forecast area opens a wetteronline.com search-results page for the installation's address in a new tab.

**Independent Test**: Click the weather/forecast area and verify a new tab opens to `https://www.wetteronline.de/suche?q=<encoded address>`; with an empty/missing address, verify the click does nothing or opens the generic search page rather than erroring.

### Tests for User Story 3

- [X] T020 [P] [US3] Unit tests for the URL builder in `web/js/info-panel/wetteronline-link.test.js` (address correctly `encodeURIComponent`-ed into `https://www.wetteronline.de/suche?q=...`; empty/missing address → `null`) — write first, confirm failing
- [X] T021 [P] [US3] Extend `tests/e2e/info-panel.spec.js` with a scenario asserting a click on the weather/forecast area opens a new tab/page to the expected wetteronline.de search URL (`page.context().waitForEvent('page')` or `target="_blank"` assertion) — write first, confirm failing

### Implementation for User Story 3

- [X] T022 [US3] Implement `buildWetteronlineSearchUrl(address)` pure function in `web/js/info-panel/wetteronline-link.js` per research.md §3 — makes T020 pass
- [X] T023 [US3] In `web/index.html`, wrap the panel's weather/forecast slot in an `<a target="_blank" rel="noopener">` (or add an equivalent click handler in the controller) whose `href`/target is set from `buildWetteronlineSearchUrl(plant.location)`; when the builder returns `null`, leave the area non-clickable rather than a broken link
- [X] T024 [US3] Verify T021's Playwright scenario passes; run `node --test web/js/info-panel/wetteronline-link.test.js` and confirm T020 passes

**Checkpoint**: All P1/P2 user stories (US1, US2, US3) are independently functional — production, weather/forecast, and the wetteronline.com link all work together and in isolation.

---

## Phase 6: User Story 4 - Production animation that reflects the amount of energy (Priority: P3)

**Goal**: A visual animation next to the production value whose intensity scales with `currentPacW / capacityKwp`, transitioning smoothly rather than jumping abruptly (FR-009/FR-010).

**Independent Test**: Under a known near-zero reading and a known near-peak reading (real or simulated), verify the animation is visibly calmer/sparser at low production and visibly more active at high production, with smooth transitions between updates.

### Tests for User Story 4

- [X] T025 [P] [US4] Extend `tests/e2e/info-panel.spec.js` (or add a dedicated visual-state assertion) verifying the panel's animation element carries the expected `data-intensity`/`--intensity` value for a mocked idle-tier production reading and a mocked peak-tier reading — write first, confirm failing

### Implementation for User Story 4

- [X] T026 [US4] Add the animation markup (e.g. an `.info-panel__pulse` element) next to the production value in `web/index.html`'s `#info-panel` panel shell, driven purely by the `--intensity` custom property already scaffolded in T005
- [X] T027 [US4] Add a CSS transition on the `--intensity`-driven animation properties (duration/scale/opacity) in `web/css/app.css` so tier changes between polls animate smoothly rather than snapping (FR-010)
- [X] T028 [US4] Confirm `info-panel-controller.js` (from T010) sets `--intensity` from `productionIntensity()` on every poll tick, including on the "unavailable" transition (falls back to idle tier rather than leaving a stale peak animation running)
- [X] T029 [US4] Verify T025's Playwright scenario passes

**Checkpoint**: All four user stories are independently functional — full feature scope complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, linting, and final full-suite validation across all stories.

- [X] T030 [P] Update `README.md` and `README.de.md` to describe the new global desktop info panel (production, weather/forecast, wetteronline.com link, animation, desktop-only visibility)
- [X] T031 [P] Update `docs/user-guide.md` and `docs/user-guide.de.md` with the same description, screenshots/description of the panel's location and behavior
- [X] T032 Run `npx eslint web/js/info-panel/*.js web/js/info-panel/*.test.js` and fix all errors; resolve any SonarLint warnings surfaced in the IDE
- [X] T033 Run `npm run format:check` (and `format` if needed) across all modified/new files
- [X] T034 Run the full unit suite (`node --test "web/js/info-panel/*.test.js"`) and the full e2e suite (`npx playwright test tests/e2e/info-panel.spec.js --reporter=line`) together and confirm all pass
- [X] T035 Execute every manual smoke-test section in [quickstart.md](./quickstart.md) end-to-end against `npm start` and confirm each expected result

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories (T009+ all attach to the `#info-panel` markup/CSS/dynamic-import wiring from T003–T006).
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on other stories. Delivers the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational. Extends the same `info-panel-controller.js` file T010 creates, so T017 has a soft ordering dependency on T010 landing first (same-file edit, not a hard story-blocking dependency) — otherwise independently testable per its own mocked scenarios.
- **User Story 3 (Phase 5)**: Depends on Foundational; its clickable area wraps US2's weather slot, so T023 has a soft ordering dependency on T017, but the URL-builder logic (T020/T022) is fully independent and can be built in parallel with US2.
- **User Story 4 (Phase 6)**: Depends on Foundational (T005's CSS tiers) and on US1's `info-panel-controller.js` (T010) already setting `--intensity` per poll — extends rather than duplicates that wiring.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### Within Each User Story

- Tests (T007/T008, T013/T014, T020/T021, T025) are written and confirmed failing before their corresponding implementation tasks.
- Pure-logic modules (`production-animation.js`, `weather-forecast-client.js`, `wetteronline-link.js`) before the DOM-glue controller wiring that consumes them.
- Controller wiring before i18n string consumption tasks that touch the same rendered output.
- Story implementation complete and its own Playwright scenarios green before moving to the next priority.

### Parallel Opportunities

- T002 (i18n scaffolding) can run in parallel with T001.
- T004 and T005 (both `app.css`, but non-overlapping rule blocks — layout vs. animation tiers) can be done in parallel by different people if careful about merge conflicts; otherwise sequence them.
- T007/T008 (US1 tests, different files) in parallel; T013/T014 (US2 tests) in parallel; T020/T021 (US3 tests) in parallel.
- T009 (production-animation.js) has no dependency on T010–T011 and can be built fully in parallel with them once T007 exists.
- US2's T015/T016 (weather client + code-label map) can proceed in parallel with US3's T020/T022 (wetteronline URL builder) — different files, no shared state.
- T030/T031 (README/docs) and T032/T033 (lint/format) can all run in parallel in Phase 7.

---

## Parallel Example: User Story 1

```bash
# Tests for User Story 1 (different files):
Task: "Unit tests for productionIntensity() in web/js/info-panel/production-animation.test.js"
Task: "Playwright desktop/mobile/unavailable scenarios in tests/e2e/info-panel.spec.js"

# Pure-logic implementation, independent of controller wiring:
Task: "Implement productionIntensity() in web/js/info-panel/production-animation.js"
```

## Parallel Example: User Story 2 + User Story 3 (once Foundational is done)

```bash
# Different files, no shared state — can proceed in parallel with US1's controller landing:
Task: "Implement weather-forecast-client.js (US2)"
Task: "Implement wetteronline-link.js (US3)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run T012's checks; confirm production shows on desktop, hides on mobile, degrades cleanly
5. Deploy/demo if ready — this alone satisfies SC-001's production half and SC-004

### Incremental Delivery

1. Setup + Foundational → panel shell exists, hidden below `md:`
2. Add User Story 1 → validate independently → MVP demo-able
3. Add User Story 2 → validate independently (weather/forecast rendering + isolated failure) → demo
4. Add User Story 3 → validate independently (wetteronline.com click-through) → demo
5. Add User Story 4 → validate independently (animation intensity states) → demo
6. Polish (Phase 7) → docs, lint, full-suite regression, quickstart walkthrough

### Parallel Team Strategy

With multiple developers, once Phase 2 (Foundational) is merged:

- Developer A: User Story 1 (production + controller skeleton)
- Developer B: User Story 2's `weather-forecast-client.js` (independent file, integrates into the controller after US1 lands)
- Developer C: User Story 3's `wetteronline-link.js` (independent file, integrates after US2's slot exists)
- User Story 4 is best picked up last since it extends US1's controller output.
