---
description: 'Task list for Dynamic Weather-Driven Sky Background'
---

# Tasks: Dynamic Weather-Driven Sky Background

**Input**: Design documents from `/specs/007-dynamic-sky-weather/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — the plan's Testing section and constitution's Testing standard
explicitly require `node:test` unit coverage for every new pure-logic module plus a new
Playwright e2e spec, so test tasks are in scope for every phase.

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P3) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task lists its exact file path(s)

## Path Conventions

Single existing web project, extended in place:

- `web/js/sky/` — new pure-logic modules + co-located `*.test.js`
- `web/js/config.js`, `web/js/main.js` — small edits
- `web/index.html`, `web/css/app.css` — markup/style additions
- `tests/e2e/sky.spec.js` — new Playwright spec
- `README.md`, `README.de.md`, `docs/user-guide.md`, `docs/user-guide.de.md` — docs

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffolding shared by every user story below; no behavior yet.

- [x] T001 Create the `web/js/sky/` directory (no files yet — populated starting in Phase 2)
- [x] T002 [P] Add the `SKY_LOCATION_OVERRIDE` constant (`{ lat, lon } | null`, default
      `null`, with JSDoc explaining override vs. auto-geocode) to `web/js/config.js`
- [x] T003 [P] Confirm `npm run lint`, `npm run format:check`, `node --test`, and
      `npx playwright test --reporter=line` all currently pass on a clean checkout (baseline
      before any sky code lands), fixing nothing — just recording the starting state

**Checkpoint**: Config constant exists; baseline tooling confirmed green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Location resolution + weather fetching are consumed by every user story
(US1's cloud density AND US2's sun/moon position both come from the same Open-Meteo
response keyed by the same resolved location). This phase MUST complete before any user
story phase begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 [P] Write failing unit tests in `web/js/sky/location.test.js` for
      `resolveInstallationLocation(plant, override)`: override takes precedence over
      cache/geocode; `localStorage` cache hit (key `sky-geocode:<address>`) short-circuits
      geocoding; cache miss triggers a geocode call whose first result is cached and
      returned; out-of-range `lat`/`lon` (outside [-90,90]/[-180,180]) from override or
      cache is rejected as invalid; all-paths-fail returns `null` — per data-model.md
      §Installation Location
- [x] T005 [P] Write failing unit tests in `web/js/sky/geocode.test.js` for the Open-Meteo
      geocoding wrapper: successful response returns `{ lat, lon }` from the first result;
      zero-result response returns `null`; network/non-2xx/malformed-JSON failure returns
      `null` without throwing; successful lookups write to `localStorage` under
      `sky-geocode:<address>` (mocked `fetch` + mocked `localStorage`, no real network call)
- [x] T006 [P] Write failing unit tests in `web/js/sky/weather-client.test.js` for the
      Open-Meteo forecast wrapper: successful response parses into
      `{ cloudCoverPercent, tier, sunrise, sunset, nextSunrise, fetchedAt }`; failed/non-2xx/
      malformed response returns `null` (caller retains prior last-known-good state) without
      throwing (mocked `fetch`, no real network call) — per data-model.md §Weather Condition
- [x] T007 [US-shared] Implement `resolveInstallationLocation()` in `web/js/sky/location.js`
      per research.md §3 and data-model.md §Installation Location (override → cache →
      geocode → `null`), with file-level JSDoc and JSDoc on the exported function, to make
      T004 pass (depends on T004)
- [x] T008 [US-shared] Implement the geocoding wrapper in `web/js/sky/geocode.js` calling
      `geocoding-api.open-meteo.com/v1/search?name=...`, caching the first result in
      `localStorage`, with file-level JSDoc and JSDoc on the exported function, to make T005
      pass (depends on T005)
- [x] T009 [US-shared] Implement the forecast wrapper in `web/js/sky/weather-client.js`
      calling `api.open-meteo.com/v1/forecast?current=cloud_cover&daily=sunrise,sunset&forecast_days=2&timezone=auto`
      per research.md §1, with file-level JSDoc and JSDoc on the exported function, to make
      T006 pass (depends on T006)
- [x] T010 Run `node --test "web/js/sky/*.test.js"` and confirm T004–T006's tests now pass
      against T007–T009's implementations (depends on T007, T008, T009)

**Checkpoint**: Location resolution and weather fetching are fully implemented and
unit-tested. All user story phases can now begin.

---

## Phase 3: User Story 1 - Sky reflects real current weather at the plant's location (Priority: P1) 🎯 MVP

**Goal**: Cloud density in the `.sky-clouds` backdrop visibly and proportionately reflects
the installation's real current cloud cover (clear/partly/overcast), refreshed every 15
minutes, with a silent fallback to today's static appearance on any failure.

**Independent Test**: Load the dashboard under a known current weather condition and verify
rendered cloud density matches the expected tier (repeat for at least two different
conditions); block the weather API and reload, and verify the unchanged default backdrop
renders with no console errors.

### Tests for User Story 1

- [x] T011 [P] [US1] Write failing unit tests in `web/js/sky/cloud-density.test.js` for
      `cloudCoverToTier(cloudCoverPercent)` boundary values (0, 19, 20, 70, 71, 100) per
      data-model.md's `<20 → clear`, `20–70 → partly`, `>70 → overcast` thresholds, plus the
      per-tier cloud render config (opacity/animation-duration/hidden-count per tier) — per
      research.md §4
- [x] T012 [P] [US1] Add Playwright e2e scenarios to `tests/e2e/sky.spec.js` for User Story
      1: clear-sky mocked Open-Meteo response → sparse/no visible clouds; overcast mocked
      response → dense visible clouds; weather fetch failure (route abort) → default
      unchanged heavy-cloud appearance with zero console errors (route interception per
      quickstart.md §6, no dependency on real network/weather)

### Implementation for User Story 1

- [x] T013 [US1] Implement `cloudCoverToTier()` and the per-tier cloud render config in
      `web/js/sky/cloud-density.js`, with file-level JSDoc and JSDoc on exported functions,
      to make T011 pass (depends on T011)
- [x] T014 [US1] Add `data-cloud-density="clear|partly|overcast"`-driven CSS rules to
      `web/css/app.css`: per-tier `.cloud` opacity and `animation-duration` adjustments
      (denser+slower for overcast, sparse for clear), reusing the existing gooey-blur
      `.sky-clouds`/`.cloud` markup unchanged, per research.md §4 (no dependency on other
      tasks — pure CSS addition keyed off an attribute the DOM-glue layer sets in T016)
- [x] T015 [US1] Create the DOM-glue orchestrator `web/js/sky/sky-controller.js`: on init,
      resolve location (T007), fetch weather (T009), and on success set
      `data-cloud-density` on `.sky-clouds` (via cloud-density.js's tier + T013's render
      config, including hiding a subset of the six existing `.cloud` elements for the
      `clear` tier); on any failure at any stage (no location, fetch failure, malformed
      response) leave `.sky-clouds` with no `data-cloud-density` attribute so the existing
      static CSS appearance renders unchanged (FR-005); re-poll every 15 minutes
      (`setInterval`, cleared on `pagehide`); file-level JSDoc, JSDoc on exported functions
      (depends on T007, T009, T013, T014)
- [x] T016 [US1] Wire `sky-controller.js` into `web/js/main.js`: dynamically `import()` it
      after the existing critical-path `base_vars.js`/plant/location resolution so it never
      blocks first render, passing the parsed `plant` and `SKY_LOCATION_OVERRIDE` from
      `config.js` (depends on T002, T015)
- [x] T017 [US1] Run `npx playwright test tests/e2e/sky.spec.js --reporter=line` and confirm
      T012's User Story 1 scenarios pass (depends on T012, T016)

**Checkpoint**: User Story 1 fully functional and independently testable — cloud density is
weather-driven with a zero-regression fallback. This is the MVP.

---

## Phase 4: User Story 2 - Sun and moon track the real time of day (Priority: P2)

**Goal**: A sun or moon element is positioned in the sky per a simplified arc computed from
sunrise/sunset/next-sunrise, swapping smoothly around sunrise/sunset, and remaining at least
partially visible/dimmed through cloud cover.

**Independent Test**: Simulate different times of day (via clock override) and verify the
sun's on-screen position shifts correctly and is replaced by the moon at night, including a
smooth (non-instant) crossfade across the sunrise/sunset boundary.

### Tests for User Story 2

- [x] T018 [P] [US2] Write failing unit tests in `web/js/sky/solar-arc.test.js` for
      `computeSkyBodyPosition(now, sunrise, sunset, nextSunrise)` per research.md §2 and
      data-model.md §Solar Time State: sun position/body at sunrise, solar-noon midpoint,
      and just-before-sunset; moon position/body at midnight; `crossfade` is `0` outside the
      transition window and >0 inside the few-minutes-either-side window around
      sunrise/sunset
- [x] T019 [P] [US2] Add Playwright e2e scenarios to `tests/e2e/sky.spec.js` for User Story
      2: clock set to solar noon → sun rendered near top-center; clock set to a nighttime
      hour → moon rendered in the sun's place (via Playwright's clock API + mocked
      sunrise/sunset response, per quickstart.md §6)

### Implementation for User Story 2

- [x] T020 [US2] Implement `computeSkyBodyPosition()` in `web/js/sky/solar-arc.js` per
      research.md §2's parabolic-arc formula, with file-level JSDoc and JSDoc on the
      exported function, to make T018 pass (depends on T018)
- [x] T021 [US2] Add `.sky-sun` / `.sky-moon` container markup inside `.sky-clouds` in
      `web/index.html` (`aria-hidden="true"`, `pointer-events: none`, positioned via CSS
      custom properties consistent with the existing `.cloud` pattern)
- [x] T022 [US2] Add `.sky-sun` / `.sky-moon` styles to `web/css/app.css`: positioned via
      `--x-percent`/`--y-percent` custom properties, a `transition` on position/opacity for
      the smooth crossfade (FR-008), and a reduced-opacity/blur treatment so the body stays
      at least partially visible behind dense cloud tiers (data-cloud-density="overcast")
      rather than disappearing (US2 Acceptance Scenario 4)
- [x] T023 [US2] Extend `sky-controller.js` (`web/js/sky/sky-controller.js`): on a 60-second
      tick, call `computeSkyBodyPosition()` with the last-known-good sunrise/sunset/
      nextSunrise from the weather fetch (T015/T009) and update the sun/moon elements'
      custom properties and crossfade opacity; ticking is skipped/no-ops when location/
      weather resolution failed (same fallback path as US1) (depends on T009, T015, T020,
      T021, T022)
- [x] T024 [US2] Run `npx playwright test tests/e2e/sky.spec.js --reporter=line` and confirm
      T019's User Story 2 scenarios pass (depends on T019, T023)

**Checkpoint**: User Stories 1 AND 2 both work independently — weather-driven clouds plus
time-accurate sun/moon positioning with smooth transitions.

---

## Phase 5: User Story 3 - Occasional flying objects animate through the sky (Priority: P3)

**Goal**: Birds cross the sky at a light, regular cadence; planes/balloons cross rarely;
a rocket easter egg flies toward the moon rarely and only at night — all as self-cleaning,
non-content-obstructing CSS-animated elements, all suppressed under
`prefers-reduced-motion`.

**Independent Test**: Observe the dashboard for an extended session and confirm birds appear
at a noticeably regular cadence while planes/balloons/rockets appear only rarely, with the
rocket only ever appearing while the moon is shown; confirm no flying object overlaps main
content; confirm `prefers-reduced-motion: reduce` suppresses all spawning.

### Tests for User Story 3

- [x] T025 [P] [US3] Write failing unit tests in `web/js/sky/flying-objects.test.js` (using
      an injectable clock and seeded/mocked RNG per research.md §5): bird next-spawn delay
      always falls within the ~3–8 min band; plane/balloon delay within the ~20–45 min band;
      rocket delay within the ~45–90 min band; rocket kind is never selected when
      `body !== 'moon'` at roll time (FR-011); scheduling is fully deterministic given a
      fixed RNG seed (no real `Math.random()`/`Date.now()` in the test)
- [x] T026 [P] [US3] Add Playwright e2e scenarios to `tests/e2e/sky.spec.js` for User Story
      3: with `prefers-reduced-motion: reduce` emulated, confirm zero `.sky-flying-object`
      elements appear over an observation window and the `.cloud` drift animation is
      disabled (`animation-name: none` or equivalent computed style) — per quickstart.md §5

### Implementation for User Story 3

- [x] T027 [US3] Implement the pure spawn-scheduling logic in `web/js/sky/flying-objects.js`
      per research.md §5 and data-model.md §Sky Flying Object (per-kind next-spawn timers,
      rocket gated on `Solar Time State.body === 'moon'`), with file-level JSDoc and JSDoc
      on exported functions, to make T025 pass (depends on T025)
- [x] T028 [P] [US3] Add `.sky-flying-object` base styles plus per-kind (`bird`, `plane`,
      `balloon`, `rocket`) CSS `@keyframes` cross-screen animations to `web/css/app.css`,
      confined to the upper sky band (never overlapping the header/nav/main content column,
      FR-012), plus a `[data-reduce-motion="true"]` override that disables all flying-object
      animation
- [x] T029 [US3] Extend `sky-controller.js` (`web/js/sky/sky-controller.js`): add a
      `matchMedia('(prefers-reduced-motion: reduce)')` check (re-evaluated on its `change`
      event) that sets `data-reduce-motion` on `.sky-clouds` and, when not reduced, drives
      `flying-objects.js`'s scheduler to create short-lived absolutely-positioned
      `.sky-flying-object` elements matching the chosen kind/lane, removing each on its
      `animationend` event; when reduced-motion is active, scheduling is skipped entirely
      (FR-013) (depends on T021, T023, T027, T028)
- [x] T030 [US3] Run `npx playwright test tests/e2e/sky.spec.js --reporter=line` and confirm
      T026's User Story 3 scenarios pass (depends on T026, T029)

**Checkpoint**: All three user stories independently functional — the full dynamic sky
feature is complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, full regression, and final constitution-required checks that
span all three stories.

- [x] T031 [P] Update `README.md` and `README.de.md` to describe the dynamic weather-driven
      sky background (weather source, sun/moon behavior, flying objects, reduced-motion
      behavior)
- [x] T032 [P] Update `docs/user-guide.md` and `docs/user-guide.de.md` with a user-facing
      description of the new dynamic sky behavior
- [x] T033 Add JSDoc file-level blocks to any of `web/js/sky/*.js` still missing one, and
      verify every exported function across `web/js/sky/` has JSDoc (constitution
      Documentation Standards)
- [x] T034 Run the full regression suite per quickstart.md §7: `npm run lint`,
      `npm run format:check`, `npx playwright test --reporter=line`,
      `node --test scripts/*.test.js "web/js/**/*.test.js"` — all must pass
- [x] T035 Walk through quickstart.md §§2–5 manually (weather-driven density, sun/moon
      position, flying objects, reduced motion) in a real browser via `npm start`, per
      CLAUDE.md's dev-server guidance

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (T002 for the config constant) — BLOCKS all
  user stories; T004–T006 (tests) can run in parallel with each other, then T007–T009
  (implementations) each depend on their own test file, then T010 validates all three
- **User Story 1 (Phase 3)**: Depends on Foundational (T007, T009) — no dependency on US2/US3
- **User Story 2 (Phase 4)**: Depends on Foundational (T009) and reuses `sky-controller.js`
  from US1 (T015) — extends rather than duplicates it, but is independently testable via its
  own Playwright scenarios and unit tests
- **User Story 3 (Phase 5)**: Depends on Foundational and reuses `sky-controller.js`
  (T015/T023) — independently testable via its own scenarios
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Note on shared `sky-controller.js`

Per data-model.md and plan.md, `sky-controller.js` is a single DOM-glue orchestrator file
that all three stories extend incrementally (US1 creates it, US2 and US3 add ticking/
scheduling to it) rather than each owning a separate controller — this mirrors the plan's
explicit statement that it is "not unit tested, covered by the Playwright spec." This makes
T023 and T029 sequentially dependent on T015 (same file), so while US2/US3 are each
independently _testable_, their `sky-controller.js` edits should land after US1's (T015)
is merged to avoid file-conflict churn — reflected in the `depends on T015` notes above.

### Parallel Opportunities

- T002 and T003 (Setup) in parallel
- T004, T005, T006 (Foundational test-writing) in parallel — different files
- T011 and T012 (US1 test-writing) in parallel
- T018 and T019 (US2 test-writing) in parallel
- T025 and T026 (US3 test-writing) in parallel
- T028 (US3 CSS) can run in parallel with T027 (US3 JS logic) — different files
- T031 and T032 (Polish docs) in parallel
- Across stories: once Foundational (Phase 2) is done, US1/US2/US3 implementation work
  _could_ proceed in parallel by different developers, but all three converge on editing
  the same `sky-controller.js` and `app.css` files, so in a single-developer/single-agent
  execution the priority order (P1 → P2 → P3) below is recommended over true parallelism

---

## Parallel Example: Foundational Phase

```bash
# Launch all three foundational test-writing tasks together:
Task: "Write failing unit tests in web/js/sky/location.test.js"
Task: "Write failing unit tests in web/js/sky/geocode.test.js"
Task: "Write failing unit tests in web/js/sky/weather-client.test.js"
```

## Parallel Example: User Story 1

```bash
# Launch both User Story 1 test-writing tasks together:
Task: "Write failing unit tests in web/js/sky/cloud-density.test.js"
Task: "Add Playwright e2e scenarios to tests/e2e/sky.spec.js for User Story 1"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — location + weather fetching, blocks all
   stories)
3. Complete Phase 3: User Story 1 (weather-driven cloud density)
4. **STOP and VALIDATE**: Run `npx playwright test tests/e2e/sky.spec.js` and quickstart.md
   §2 manual smoke test independently
5. Deploy/demo if ready — this alone satisfies the spec's core request (replacing the
   static, weather-blind backdrop)

### Incremental Delivery

1. Setup + Foundational → location/weather foundation ready
2. Add User Story 1 → test independently → deploy/demo (MVP!)
3. Add User Story 2 → test independently → deploy/demo (sun/moon realism layered on top)
4. Add User Story 3 → test independently → deploy/demo (flying-object delight layered on
   top)
5. Polish: docs + full regression + manual quickstart walkthrough

---

## Notes

- [P] tasks touch different files and have no unmet dependencies
- [Story] label maps each task to its user story for traceability; Foundational tasks are
  unlabeled (shared prerequisite) per the template's convention
- Tests are written first per module/scenario and must fail before their paired
  implementation task, per the constitution's Testing standard and this project's
  test-driven-development convention (see CLAUDE.md's "Test-driven development" section for
  helper scripts, mirrored here for the `web/js/sky/` modules)
- Commit after each task or logical group (per CLAUDE.md conventions; `/speckit-git-commit`
  is also available as an optional post-task-generation hook)
- Stop at any checkpoint to validate a story independently before moving to the next
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independent
  testability (the one intentional exception being the shared `sky-controller.js` file,
  documented above)
