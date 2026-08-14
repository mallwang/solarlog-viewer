---
description: 'Task list for Day/Night Sky Background'
---

# Tasks: Day/Night Sky Background

**Input**: Design documents from `/specs/018-day-night-sky/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md), [design.md](./design.md)

**Tests**: Included — the constitution's Testing standard and plan.md require Playwright coverage for every UI-visible change plus `node --test` unit coverage for the new pure-logic scheduler.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3) so each can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps the task to US1/US2/US3
- File paths are exact and repo-relative

## Path Conventions

Single static web app (`web/`), no frontend/backend split — see plan.md's Project Structure. Only
three implementation files change plus two test files:

- `web/index.html` — starfield/falling-star markup
- `web/css/app.css` — night gradient, moon-dimming, twinkle/falling-star `@keyframes`
- `web/js/sky/sky-controller.js` — `applyDayNightState()`, falling-star scheduler wiring
- `web/js/sky/falling-star-scheduler.js` (+ `.test.js`) — NEW pure scheduler module
- `tests/e2e/sky.spec.js` — extended Playwright coverage

---

## Phase 1: Setup

**Purpose**: Project initialization

No setup tasks required — this feature adds no dependency, no new directory, and no build/tooling
change (plan.md Technical Context: "No new dependency"). `npm start`, `npx playwright test`, and
`node --test` are already configured and used unchanged by this feature (see quickstart.md
Prerequisites).

---

## Phase 2: Foundational

**Purpose**: Blocking prerequisites shared by all user stories

No separate foundational phase — User Story 1 (`data-sky` / `--night-crossfade`) _is_ the shared
foundation User Story 2 and User Story 3 build on (data-model.md: Starfield and Falling Star Event
both gate on `data-sky`). Splitting it out would just duplicate US1's own tasks below, so US1 must
complete first and its checkpoint doubles as the foundational checkpoint.

---

## Phase 3: User Story 1 - Sky darkens to a night appearance after sunset (Priority: P1) 🎯 MVP

**Goal**: `.sky-clouds`/`<body>` gain a `data-sky` (`'day'`/`'night'`) attribute and a
`--night-crossfade` custom property, derived from `computeSkyBodyPosition()`'s existing
`body`/`crossfade` output, driving a night gradient and moon-dimming-under-cover — with clouds,
rain/snow, and flying objects completely unaffected.

**Independent Test**: Mock `sunrise`/`sunset` (via `mockOpenMeteo()` in `tests/e2e/sky.spec.js`) so
"now" falls on the night side; confirm `.sky-clouds[data-sky="night"]` and the dark gradient/moon
crossfade render while clouds/flying objects for the mocked category are unaffected. Repeat on the
day side and confirm today's appearance is byte-for-byte unchanged.

### Tests for User Story 1

- [x] T001 [P] [US1] Add `test.describe('Day/night sky background — User Story 1', ...)` to
      `tests/e2e/sky.spec.js` per quickstart.md's Automated validation section: a night-window test
      asserting `data-sky="night"` plus moon crossfade while `.cloud`/`.sky-flying-objects` behavior
      is unchanged from existing day-mode assertions, and a day-window test asserting
      `data-sky="day"` with no visual change from today. Both tests MUST fail until T002–T004 land.
- [x] T002 [US1] Add a gradual-transition test to `tests/e2e/sky.spec.js`: mock `sunrise`/`sunset`
      so "now" falls inside the existing 5-minute `CROSSFADE_WINDOW_MS` boundary window and assert
      `--night-crossfade` (or its rendered effect) reflects a partial blend, not a hard cut
      (quickstart.md step 4).
- [x] T003 [US1] Add a last-known-good test to `tests/e2e/sky.spec.js`: load with a working mock,
      capture `data-sky`, force a subsequent poll failure (existing `mockOpenMeteo` failure pattern
      already used for the "weather fetch failure" test), and assert `data-sky` stays at its last
      value (FR-012, quickstart.md step 6).

### Implementation for User Story 1

- [x] T004 [US1] Implement `applyDayNightState(skyClouds, position)` in
      `web/js/sky/sky-controller.js`: sets `data-sky = position.body === 'sun' ? 'day' : 'night'` on
      both `skyClouds` and `document.body` (mirrors `applyWeatherCategory()`'s dual-target pattern)
      and writes `--night-crossfade` from `position.crossfade` on `skyClouds`; call it from `tick()`
      alongside the existing `applySkyBodyPosition()` call, guarded by the same
      `if (!lastWeather || !sunEl || !moonEl) return;` early-out so a poll failure freezes
      `data-sky` (FR-012, data-model.md §Day/Night State).
- [x] T005 [P] [US1] Add night-appearance CSS to `web/css/app.css`: `body[data-sky='night']` /
      `.sky-clouds[data-sky='night']` dark navy gradient (research.md §2/§4), blended in via
      `--night-crossfade` the same way `.sky-sun`/`.sky-moon` opacity is already blended, so the
      switch reads gradual across the existing crossfade window rather than an instant flip (FR-009).
- [x] T006 [P] [US1] Add moon-dimming-under-cloud-cover CSS to `web/css/app.css`: a
      `data-weather`-scoped rule dimming `.sky-moon` opacity to ~15% under
      `[data-sky='night'][data-weather='cloudy'|'rain'|'snow']`, following the exact
      selector-composition pattern the existing sun-dimming rule already uses (research.md §4,
      design.md's approved mockup values).
- [x] T007 [US1] Verify (no code change expected) that clouds/rain/snow/flying-object CSS and
      `spawnFlyingObject()`/`spawnPoll()` in `web/js/sky/sky-controller.js` make no reference to
      `data-sky` — confirms FR-003/SC-002 (day/night is orthogonal to `data-weather`) before layering
      US2/US3 on top.

**Checkpoint**: `data-sky`/`--night-crossfade` are live and gate nothing yet visually beyond the
night gradient/moon-dimming; T001–T003 pass; clouds/rain/snow/flying objects unchanged.

---

## Phase 4: Starfield — Clear/partly-cloudy nights show stars (Priority: P2)

**Goal**: A fixed set of `.sky-star` dot elements, shown purely via CSS attribute-selector gating
on `data-sky='night'` combined with `data-weather='sunny'|'mixed'`, with a twinkle animation.

**Independent Test**: With the night appearance active (per US1), force/observe `sunny`/`mixed` and
confirm stars render; force/observe `cloudy`/`rain`/`snow` and confirm no stars render; confirm no
stars ever render in the daytime appearance regardless of category.

### Tests for User Story 2

- [x] T008 [P] [US2] Add `test.describe('Starfield — User Story 2', ...)` to `tests/e2e/sky.spec.js`
      per quickstart.md: loop `CATEGORY_CODES` under the night-window mock and assert `.sky-star`
      visibility matches `['sunny', 'mixed'].includes(category)`; add a day-window test asserting no
      stars regardless of category. Tests MUST fail until T009–T010 land.

### Implementation for User Story 2

- [x] T009 [US2] Add starfield markup to `web/index.html`: ~12 fixed `<div class="sky-star">` dots
      (fixed placeholder positions per design.md — no runtime placement algorithm) inside
      `.sky-clouds`, placed after the rain/snow particle layers so it paints above the night
      gradient but below the clouds (data-model.md §Starfield, plan.md's file-by-file notes).
- [x] T010 [US2] Add starfield CSS to `web/css/app.css`: `.sky-clouds[data-sky='night'][data-weather='sunny']`
      / `[data-weather='mixed']` visibility (hidden in every other `data-sky`/`data-weather`
      combination per FR-004–FR-006) plus a per-star twinkle `@keyframes` (opacity/scale pulse);
      fade the starfield in/out via `--night-crossfade` alongside the night gradient from T005 so it
      doesn't pop in/out abruptly at the sunrise/sunset boundary (FR-009, edge case in spec.md).

**Checkpoint**: T001–T010 all pass; stars appear only for night+sunny/mixed; US1's night gradient
and moon-dimming still correct underneath.

---

## Phase 5: Falling star — Occasional falling star on clear/partly-cloudy nights (Priority: P3)

**Goal**: A single `.sky-falling-star` element replays a CSS streak animation at a randomized,
infrequent interval, driven by a new pure `falling-star-scheduler.js` module (mirrors
`flying-objects.js`'s `createFlyingObjectScheduler()`), gated on the starfield being visible and
suppressed under `prefers-reduced-motion`.

**Independent Test**: With stars showing (per US2), observe over several minutes and confirm the
falling-star animation plays occasionally, not continuously/every load; confirm it never plays when
stars aren't showing (day, or night+cloudy/rain/snow) or when reduced motion is active.

### Tests for User Story 3

- [x] T011 [P] [US3] Write `web/js/sky/falling-star-scheduler.test.js` (fails until T012 lands),
      following `flying-objects.test.js`'s pattern: injectable `now`/`rng`, asserts `poll(nowMs)`
      returns no replay before the next randomized fire time and exactly one replay at/after it,
      then reschedules to a new randomized future time (data-model.md §Falling Star Event).
- [x] T012 [P] [US3] Add `test.describe('Falling star — User Story 3', ...)` to
      `tests/e2e/sky.spec.js` per quickstart.md: a reduced-motion test
      (`page.emulateMedia({ reducedMotion: 'reduce' })`) asserting `.sky-falling-star` never gains
      its play class while `.sky-star` dots stay visible, and a test asserting the falling star never
      plays during day or night+cloudy/rain/snow. Tests MUST fail until T013–T016 land.

### Implementation for User Story 3

- [x] T013 [US3] Implement `createFallingStarScheduler({ now, rng })` in
      `web/js/sky/falling-star-scheduler.js`: internal `nextFireAtMs` initialized to a randomized
      infrequent offset from `now()`, `poll(nowMs)` returns whether to fire now and reschedules on
      fire — same shape as `flying-objects.js`'s scheduler (data-model.md §Falling Star Event), to
      satisfy T011.
- [x] T014 [US3] Add `.sky-falling-star` element markup to `web/index.html`, inside the starfield
      layer added in T009 (design.md: "lives inside the starfield layer... only ever present
      alongside the starfield").
- [x] T015 [P] [US3] Add falling-star CSS to `web/css/app.css`: a streak `@keyframes` animation
      triggered by a replay class (e.g. `.sky-falling-star--play`) on
      `[data-sky='night'][data-weather='sunny'|'mixed']`, suppressed under
      `[data-reduce-motion='true']` per the existing reduced-motion pattern (FR-011 — motion only;
      the static starfield from T010 stays visible).
- [x] T016 [US3] Wire the scheduler into `web/js/sky/sky-controller.js`: create a
      `createFallingStarScheduler()` instance alongside the existing flying-object `scheduler`, poll
      it only while `data-sky === 'night'` and `data-weather` is `'sunny'`/`'mixed'` and
      `!reducedMotion` (same gating style `spawnPoll()` already uses), toggle the
      `sky-falling-star--play` class on fire and remove it on `animationend` (mirrors
      `spawnFlyingObject()`'s cleanup idiom), and recreate the scheduler on the existing
      `visibilitychange` return-from-background handler so a throttled tab can't queue a replay burst
      (data-model.md §Falling Star Event Gating).

**Checkpoint**: All of T001–T016 pass; falling star replays occasionally only while stars are
visible and motion isn't reduced; US1/US2 behavior unchanged.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all three stories

- [x] T017 [P] Run `node --test web/js/sky/falling-star-scheduler.test.js` and confirm it passes.
- [x] T018 [P] Run `npx playwright test tests/e2e/sky.spec.js --reporter=line` and confirm every new
      and existing test in the file passes, with no new console errors in any scenario (quickstart.md
      Expected outcomes).
- [x] T019 Run `npm run lint` and `npm run format:check`; fix any reported issues across
      `web/index.html`, `web/css/app.css`, `web/js/sky/sky-controller.js`,
      `web/js/sky/falling-star-scheduler.js`, and `tests/e2e/sky.spec.js` until both exit 0
      (quickstart.md Expected outcomes).
- [x] T020 Walk through quickstart.md's Manual validation steps 1–6 locally against `npm start`
      (with a scratch Playwright script or the automated suite) to confirm the feature reads
      correctly end-to-end, including the 320px–2560px no-horizontal-scroll check (constitution
      Principle IV).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup / Foundational**: None — see Phase 1/2 notes above.
- **User Story 1 (Phase 3)**: No dependencies; must complete first — it produces `data-sky` /
  `--night-crossfade`, which both later stories gate on.
- **User Story 2 (Phase 4)**: Depends on US1's `data-sky` attribute (T004) existing before its CSS
  selectors (T010) can gate on it.
- **User Story 3 (Phase 5)**: Depends on US1's `data-sky`/`data-weather` gating and US2's starfield
  container (T009) existing (the falling star lives inside it), but its scheduler module
  (T011/T013) has no DOM dependency and can be built in parallel with US2.
- **Polish (Phase 6)**: Depends on all three stories being complete.

### Within Each User Story

- Tests (T001–T003, T008, T011–T012) MUST be written and failing before their corresponding
  implementation tasks.
- Markup (`web/index.html`) before CSS that selects it, where the CSS depends on new class/attribute
  names introduced by the markup task.
- `sky-controller.js` wiring (T004, T016) before the CSS/markup it drives can be exercised
  end-to-end, though the CSS itself can be written in parallel (different file).

### Parallel Opportunities

- T001 and T002/T003 all touch the same file (`tests/e2e/sky.spec.js`) — write them in one pass
  rather than literally in parallel; the `[P]` marker below reflects independence from
  implementation tasks, not from each other.
- T005 and T006 (`app.css`, [P]) can run in parallel with each other and with T004
  (`sky-controller.js`) once T004's attribute names are agreed.
- T011 (`falling-star-scheduler.test.js`) and T012 (`sky.spec.js`) are [P] — different files.
- T013 (scheduler) and T015 (CSS) are [P] — different files; T014 (markup) is a quick prerequisite
  for T015's selector to have something to target but can be done alongside T013.
- T017 and T018 (Polish) are [P] — independent test runners.

---

## Parallel Example: User Story 1

```bash
# Tests (same file, write together):
Task: "Night/day data-sky assertions in tests/e2e/sky.spec.js"
Task: "Gradual-transition assertion in tests/e2e/sky.spec.js"
Task: "Last-known-good-on-failure assertion in tests/e2e/sky.spec.js"

# Implementation (different files, run in parallel):
Task: "applyDayNightState() in web/js/sky/sky-controller.js"
Task: "Night gradient CSS in web/css/app.css"
Task: "Moon-dimming-under-cover CSS in web/css/app.css"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3 (User Story 1): `data-sky`/`--night-crossfade`, night gradient, moon-dimming.
2. **STOP and VALIDATE**: T001–T003 pass; clouds/rain/snow/flying objects visibly unaffected.
3. This alone satisfies SC-001/SC-002 and is deployable on its own — stars/falling star are pure
   additions on top.

### Incremental Delivery

1. User Story 1 → validate → deploy/demo (night appearance alone is a complete, shippable
   increment).
2. Add User Story 2 (starfield) → validate → deploy/demo.
3. Add User Story 3 (falling star) → validate → deploy/demo.
4. Phase 6 polish (lint, format, full quickstart walkthrough) before calling the feature done.

### Solo-Developer Strategy

Given the file overlap (three of five files touched by every story), work the phases strictly in
order (US1 → US2 → US3) rather than attempting true parallelism — the `[P]` markers above identify
which _tasks within a phase_ can be batched, not that whole phases can run concurrently without
merge conflicts.

---

## Notes

- [P] tasks touch different files and have no unmet dependency within their phase.
- [Story] labels map every implementation task to spec.md's US1/US2/US3 priorities for traceability.
- Tests are written first per story and must fail before the matching implementation task lands
  (constitution Testing standard).
- Commit after each task or logical group (`speckit.git.commit`, offered automatically after this
  phase per `.specify/extensions.yml`).
- Stop at any checkpoint to validate a story independently before starting the next.
</content>
