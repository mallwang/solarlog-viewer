---
description: 'Task list for feature implementation'
---

# Tasks: Configurable Weather Backgrounds

**Input**: Design documents from `/specs/017-background-weather-config/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (all present; no
`contracts/` — see plan.md's "No contracts" note)

**Tests**: Included — plan.md's Testing section and quickstart.md explicitly define unit-test
(`node --test`) and Playwright coverage for every user-visible mode/category, so test tasks are
part of each phase below, not optional.

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P3) so each can be implemented
and verified independently, in priority order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps the task to US1/US2/US3
- File paths are exact, relative to repo root

---

## Phase 1: Setup

**Purpose**: Capture a clean baseline before touching shared modules.

- [ ] T001 Run the existing baseline and record it passes before any change: `npm run lint`,
      `npm run format:check`, `node --test scripts/*.test.js "web/js/**/*.test.js"`,
      `npx playwright test --reporter=line` (repo root).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared classifier, renamed render-config, and new config export that every user
story phase below reads from. **No user story task may start before this phase is complete.**

- [ ] T002 [P] Create `web/js/weather/weather-category.js` exporting
      `weatherCodeToCategory(weatherCode)` and `WEATHER_CATEGORIES = ['sunny', 'mixed', 'cloudy',
'rain', 'snow']`, implementing the WMO code table from research.md §3 (0,1→sunny; 2→mixed;
      3,45,48→cloudy; 51/53/55/56/57/61/63/65/66/67/80/81/82/95/96/99→rain;
      71/73/75/77/85/86→snow; any other code→cloudy). Pure function, no DOM (data-model.md
      §Weather Background Category).
- [ ] T003 [P] Create `web/js/weather/weather-category.test.js` (`node:test`) asserting one
      representative `weatherCode` per bucket returns the correct category (all five covered) and
      an unrecognized code (e.g. `100`) falls back to `'cloudy'` (FR-004).
- [ ] T004 [P] Rename `web/js/sky/cloud-density.js` → `web/js/weather/weather-render-config.js`:
      remove `cloudCoverToTier` (no longer needed), rename `CLOUD_TIER_RENDER_CONFIG` →
      `WEATHER_CATEGORY_RENDER_CONFIG` keyed by all five categories — `sunny`/`mixed`/`cloudy`
      carry over today's `clear`/`partly`/`overcast` `opacity`/`animationDurationScale`/
      `visibleCount` values unchanged (both `hasRainLayer`/`hasSnowLayer: false`); `rain`/`snow`
      reuse `cloudy`'s three values with `hasRainLayer: true`/`hasSnowLayer: true` respectively
      (research.md §4, data-model.md §`WEATHER_CATEGORY_RENDER_CONFIG`). Delete the old file.
- [ ] T005 [P] Rename `web/js/sky/cloud-density.test.js` →
      `web/js/weather/weather-render-config.test.js`, updating assertions for the renamed export
      and asserting `hasRainLayer`/`hasSnowLayer` are `true` only for `rain`/`snow` respectively
      and `false` for the other three. Delete the old file.
- [ ] T006 Add `BACKGROUND_WEATHER` export to `web/js/config.js`: `export const BACKGROUND_WEATHER
= 'auto';` with a doc comment matching the file's existing `SITE_TITLE`/`SKY_LOCATION_OVERRIDE`
      pattern, documenting accepted values (`'auto'` default, `'off'`, or one of the five category
      names) and that an unrecognized value falls back to `'auto'` (FR-005, FR-008, FR-010,
      data-model.md §Background Weather Setting, research.md §5).

**Checkpoint**: Shared classifier, render-config, and config export exist and are unit-tested —
user story phases below may now begin.

---

## Phase 3: User Story 1 - Background matches real weather, consistently with the nav bar (Priority: P1) 🎯 MVP

**Goal**: In `'auto'` mode (the default), the sky background and the nav bar's weather text are
both derived from the same shared `weatherCodeToCategory()` classification, so they always agree,
and the background gains two new animated treatments (rain, snow) alongside the renamed existing
three.

**Independent Test**: Load the site (or mock the Open-Meteo response) under each of the five
conditions in turn; confirm the background style and the nav bar text name the same condition, and
that rain/snow render as their own animated (not static) treatments.

### Implementation for User Story 1

- [ ] T007 [US1] Update `web/js/sky/weather-client.js`: change the Open-Meteo request from
      `current=cloud_cover` to `current=weather_code`; import `weatherCodeToCategory` from
      `../weather/weather-category.js`; parse the response into `{ weatherCode, category, sunrise,
sunset, nextSunrise, fetchedAt }` (data-model.md §Sky Weather Reading), dropping
      `cloudCoverPercent`/`tier`; keep returning `null` on any fetch failure/malformed body
      (FR-009).
- [ ] T008 [P] [US1] Update `web/js/sky/weather-client.test.js` fixtures/assertions for the new
      request URL and `{ weatherCode, category, ... }` response shape (mocked `fetch`, no real
      network call, per quickstart.md §1).
- [ ] T009 [US1] Update `web/js/sky/sky-controller.js`: import `WEATHER_CATEGORY_RENDER_CONFIG`
      from `../weather/weather-render-config.js` in place of `./cloud-density.js`; rename
      `applyCloudDensity(skyClouds, tier)` to a category-based equivalent that sets
      `skyClouds.dataset.weather = category` (renamed from `dataset.cloudDensity`) and toggles the
      rain/snow layer elements (added in T012) via `hasRainLayer`/`hasSnowLayer`; read
      `BACKGROUND_WEATHER` from `../config.js` once at `initSkyController()` startup and compute
      `effectiveMode = ['off', ...WEATHER_CATEGORIES].includes(BACKGROUND_WEATHER) ?
BACKGROUND_WEATHER : 'auto'` (data-model.md §Background Weather Setting); for this task, only
      wire the `'auto'` path (`poll()` applies `weather.category` on every successful poll) — the
      `'off'`/fixed paths are added in US2/US3 below without needing to revisit this block twice.
- [ ] T010 [US1] Update `web/css/app.css`: rename the `[data-cloud-density]` attribute selector
      family to `[data-weather]` and its three values `clear`/`partly`/`overcast` to
      `sunny`/`mixed`/`cloudy` (same `opacity`/`animation-duration` values, including the
      dimmed-sun/moon `overcast`→`cloudy` rule), updating the surrounding comment block (~line
      113-133 and ~172-173) to reference `weather-render-config.js`/`WEATHER_CATEGORY_RENDER_CONFIG`
      instead of `cloud-density.js`/`CLOUD_TIER_RENDER_CONFIG`.
- [ ] T011 [US1] Add two new CSS-only layers to `web/css/app.css`: a rain-streak layer
      (`.sky-clouds[data-weather='rain'] .sky-rain` or equivalent) and a snow-flake layer
      (`.sky-clouds[data-weather='snow'] .sky-snow`), each with its own `@keyframes` animation
      matching `.cloud`'s technique (CSS custom properties for per-element variance, no canvas, no
      JS animation loop); suppress both under `prefers-reduced-motion: reduce` **and** under
      `.sky-clouds[data-reduce-motion='true']`, matching the existing dual mechanism `.cloud`
      already uses (~lines 91-110).
- [ ] T012 [US1] Add the rain-streak and snow-flake child markup inside `.sky-clouds` in
      `web/index.html` (a handful of absolutely-positioned elements per layer, e.g.
      `.sky-rain-drop`/`.sky-snow-flake`, `aria-hidden="true"`, styled entirely via the CSS added
      in T011 — visibility driven by `data-weather` alone, no inline `hidden` toggling needed).
- [ ] T013 [US1] Update `web/js/info-panel/weather-forecast-client.js`: replace
      `weatherCodeToLabelKey`'s internal 7-bucket table with a thin wrapper around the shared
      `weatherCodeToCategory()` (imported from `../weather/weather-category.js`), returning
      `infoPanel.weatherCategory.<category>` keys (sunny/mixed/cloudy/rain/snow) in place of the
      old `infoPanel.weatherCode.*` keys.
- [ ] T014 [P] [US1] Update `web/js/info-panel/weather-forecast-client.test.js` for the new
      `infoPanel.weatherCategory.*` key namespace and shared-classifier delegation (quickstart.md
      §1).
- [ ] T015 [P] [US1] Update `web/i18n/en.json`: rename the `infoPanel.weatherCode` object (7 keys:
      clear/cloudy/fog/rain/snow/storm/unknown) to `infoPanel.weatherCategory` with exactly 5 keys
      (sunny/mixed/cloudy/rain/snow), e.g. `"sunny": "Sunny"`, `"mixed": "Partly cloudy"`,
      `"cloudy": "Cloudy"`, `"rain": "Rain"`, `"snow": "Snow"`.
- [ ] T016 [P] [US1] Update `web/i18n/de.json`: same key rename with German labels, e.g.
      `"sunny": "Sonnig"`, `"mixed": "Wechselnd bewölkt"`, `"cloudy": "Bewölkt"`, `"rain":
"Regen"`, `"snow": "Schnee"`.
- [ ] T017 [US1] Extend `tests/e2e/sky.spec.js`: rename existing `data-cloud-density`
      assertions/values to `data-weather`/`sunny`/`cloudy`; add scenarios (mocked Open-Meteo
      `weather_code` response per bucket) for all five categories in `'auto'` mode, asserting
      `.sky-clouds` carries the matching `data-weather` value and that the rain-streak/snow-flake
      layer elements are present only for `rain`/`snow` and absent for the other three
      (quickstart.md §6).
- [ ] T018 [US1] Extend `tests/e2e/info-panel.spec.js`: with the same mocked `weather_code` used
      in T017, assert the nav bar's weather text renders the matching `infoPanel.weatherCategory.*`
      label, confirming background and nav bar agree in `'auto'` mode (spec User Story 1 AS1-AS6).
- [ ] T019 [US1] Extend `tests/e2e/sky.spec.js`'s reduced-motion block: with
      `prefers-reduced-motion: reduce` emulated and weather mocked to `rain` then `snow`, assert
      the new layers render without animation (quickstart.md §5).

**Checkpoint**: User Story 1 is fully functional and independently testable — auto mode shows all
five categories, matching the nav bar, including the two new animated treatments.

---

## Phase 4: User Story 2 - Operator disables the weather-driven background (Priority: P2)

**Goal**: Setting `BACKGROUND_WEATHER = 'off'` in `config.js` makes the background always show its
plain pre-feature default appearance, regardless of the live API response, while the nav bar and
sun/moon positioning stay unaffected.

**Independent Test**: Set `BACKGROUND_WEATHER = 'off'`, reload, confirm the background never shows
a weather-specific treatment under any real condition, while sun/moon positioning and the nav
bar's weather text are unaffected.

### Implementation for User Story 2

- [ ] T020 [US2] In `web/js/sky/sky-controller.js`'s `poll()` (building on T009's `effectiveMode`):
      when `effectiveMode === 'off'`, skip applying `weather.category` to `data-weather` entirely
      (leave the attribute unset, reusing the pre-existing no-attribute CSS fallback per
      research.md §6) while the poll itself still runs and still updates `lastWeather` so
      `tick()`'s sun/moon positioning is unaffected (FR-007, edge cases).
- [ ] T021 [P] [US2] Extend `tests/e2e/sky.spec.js`: with `BACKGROUND_WEATHER = 'off'` (test-time
      override/injection) and weather mocked to any condition, assert `.sky-clouds` never carries
      a `data-weather` attribute and that sun/moon positioning still updates; extend
      `tests/e2e/info-panel.spec.js` in the same scenario to assert the nav bar still shows the
      real mocked condition (quickstart.md §6, spec User Story 2 AS1-AS2).

**Checkpoint**: User Stories 1 AND 2 both work independently — auto mode and the off-switch are
both correct.

---

## Phase 5: User Story 3 - Operator forces a fixed weather background (Priority: P3)

**Goal**: Setting `BACKGROUND_WEATHER` to one specific category (e.g. `'snow'`) always shows that
background regardless of live conditions, while the nav bar keeps reporting the real, live
condition; an invalid value falls back to `'auto'` behavior.

**Independent Test**: Set `BACKGROUND_WEATHER = 'snow'`, reload under a real/mocked condition that
differs from it, confirm the background always shows `'snow'` while the nav bar reports the real
condition; set an invalid value and confirm it behaves identically to `'auto'`.

### Implementation for User Story 3

- [ ] T022 [US3] In `web/js/sky/sky-controller.js`'s `poll()` (building on T009/T020): when
      `effectiveMode` is one of `WEATHER_CATEGORIES`, always set `data-weather` to that fixed
      value (on the initial `await poll()` call and every subsequent poll), ignoring
      `weather.category`, while `lastWeather` still updates from the live response so `tick()`'s
      sun/moon positioning and the nav bar's independent poll remain unaffected (FR-006).
- [ ] T023 [P] [US3] Extend `tests/e2e/sky.spec.js`: with `BACKGROUND_WEATHER` fixed to a category
      (e.g. `'snow'`) and weather mocked to a _different_ condition (e.g. sunny), assert
      `.sky-clouds` carries `data-weather="snow"` regardless; extend `tests/e2e/info-panel.spec.js`
      in the same scenario to assert the nav bar still shows the real mocked (sunny) condition
      (quickstart.md §6, spec User Story 3 AS1).
- [ ] T024 [P] [US3] Extend `tests/e2e/sky.spec.js`: with `BACKGROUND_WEATHER` set to an invalid
      value (e.g. `'not-a-real-value'`), assert the background behaves identically to `'auto'`
      mode for a mocked condition (FR-008, spec User Story 3 AS2, SC-005).

**Checkpoint**: All three user stories are independently functional — auto, off, and fixed-override
modes, plus the invalid-value fallback.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final regression pass and cleanup once all three stories are complete.

- [ ] T025 [P] Grep the repo for any remaining references to the old names
      (`data-cloud-density`, `cloud-density.js`, `CLOUD_TIER_RENDER_CONFIG`, `cloudCoverToTier`,
      `infoPanel.weatherCode`) outside this feature's already-updated files (e.g. stray comments in
      other modules, docs) and fix or remove them.
- [ ] T026 Confirm `web/js/config.js`'s `BACKGROUND_WEATHER` is left at `'auto'` (quickstart.md §4
      step 4 — revert any test value used while validating US2/US3 manually).
- [ ] T027 Run the full regression suite per quickstart.md §7 and confirm all pass: `npm run lint`,
      `npm run format:check`, `npx playwright test --reporter=line`, `node --test scripts/*.test.js
"web/js/**/*.test.js"`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories** — `weather-category.js`,
  `weather-render-config.js`, and `BACKGROUND_WEATHER` are read by every story's tasks.
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational; its `poll()` change (T020) builds on US1's
  T009 (same function) — implement after US1 for a clean diff, though the _behavior_ itself has no
  data dependency on US1's rain/snow CSS work.
- **User Story 3 (Phase 5)**: Depends on Foundational; its `poll()` change (T022) builds on T009 +
  T020 (same function) — implement after US2 for the same reason.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each Phase

- Foundational: T002/T003 (classifier + its test) and T004/T005 (render-config rename + its test)
  are independent pairs, both parallelizable with each other and with T006 (config export).
- User Story 1: T007→T008 (client rewrite before its test update); T009 depends on T002/T004/T006
  (Foundational) only; T010→T011→T012 are sequential (same CSS file/markup, in order: rename
  selectors, then add new layers, then add their markup); T013→T014 (info-panel rewrite before its
  test); T015/T016 (i18n files) are independent of everything except needing the key names T013
  introduces; T017/T018/T019 (e2e) come last, after all US1 implementation tasks.
- User Story 2 / 3: single implementation task each (T020, T022), each followed by its own e2e
  extension task(s).

### Parallel Opportunities

- Foundational: T002+T003 ∥ T004+T005 ∥ T006 (three independent groups).
- User Story 1: T008 ∥ T014 ∥ T015 ∥ T016 once their respective prerequisite tasks land.
- User Story 2: T021 has no other parallel task in its phase.
- User Story 3: T023 ∥ T024 (both extend the same spec file but independent scenarios — treat as
  sequential edits to `tests/e2e/sky.spec.js` in practice, parallel only in the `info-panel.spec.js`
  half of T023).
- Polish: T025 can run any time after Phase 5; T026/T027 last.

---

## Parallel Example: Foundational Phase

```bash
# Launch independent Foundational groups together:
Task: "Create web/js/weather/weather-category.js"
Task: "Create web/js/weather/weather-category.test.js"
Task: "Rename web/js/sky/cloud-density.js -> web/js/weather/weather-render-config.js"
Task: "Rename web/js/sky/cloud-density.test.js -> web/js/weather/weather-render-config.test.js"
Task: "Add BACKGROUND_WEATHER export to web/js/config.js"
```

## Parallel Example: User Story 1 (once T007/T009/T010-T013 land)

```bash
Task: "Update web/js/sky/weather-client.test.js fixtures"
Task: "Update web/js/info-panel/weather-forecast-client.test.js"
Task: "Update web/i18n/en.json weatherCategory keys"
Task: "Update web/i18n/de.json weatherCategory keys"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks everything)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: run quickstart.md §1-§2, §5-§6 for auto mode only
5. Deploy/demo if ready — this alone delivers the spec's stated core value (background/nav-bar
   agreement + rain/snow treatments)

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add User Story 1 → validate independently → deploy/demo (MVP)
3. Add User Story 2 (`'off'`) → validate independently → deploy/demo
4. Add User Story 3 (fixed override + invalid fallback) → validate independently → deploy/demo
5. Polish (Phase 6) → final regression pass

### Notes

- [P] tasks touch different files (or clearly separable regions) and have no unfinished
  dependency between them.
- Every task lists its exact file path(s) per this project's CLAUDE.md conventions (ESM scripts,
  co-located `*.test.js`, JSDoc on exports — already followed by the existing modules being
  edited).
- Commit after each task or logical group; stop at any checkpoint to validate a story
  independently before moving to the next.
- Avoid: editing `sky-controller.js`'s `poll()` out of order (T009 before T020 before T022 — same
  function, each building on the last).
