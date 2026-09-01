# Tasks: Live Panel Falls Back to Daily Last Value

**Input**: Design documents from `/specs/028-live-panel-fallback/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Explicitly required by plan.md's Testing section — `node --test` unit coverage for
`lastReadingPower()`/`fetchTodayMinuteTrace()`, and new Playwright cases in
`tests/e2e/info-panel.spec.js` covering Stories 1-3.

**Organization**: Tasks are grouped by user story to enable independent implementation and
testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single static web app: production code under `web/js/`, e2e tests under `tests/e2e/`, docs at
repo root / `docs/`. Per plan.md's Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new dependencies, tooling, or scaffolding needed — this feature only adds a
module in an existing directory and edits three existing files. Nothing to set up.

_(No tasks — proceed directly to Foundational.)_

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared data helpers both `day-view.js`'s refactor (US1 prerequisite) and the
info panel controller (US1/US2/US3) depend on. MUST be complete, tested, and passing before any
user story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T001 [P] Write `node:test` cases in `web/js/data/yield-stats.test.js` for the new
      `lastReadingPower(trace)` per data-model.md: returns `null` for `trace.readings === []`;
      returns `{ w, timestamp }` from the trace's **last** reading (not the max, unlike
      `maxDailyPowerW`), summing `pacW` across `perInverter` the same way `maxDailyPowerW` does;
      returns `{ w: 0, timestamp }` (not `null`) when the last reading's summed `pacW` is exactly
      `0` (genuine idle reading). Confirm these cases fail before T002.
- [x] T002 [P] Implement `lastReadingPower(trace)` in `web/js/data/yield-stats.js`, placed near
      `maxDailyPowerW` (same file, same JSDoc conventions per the constitution): reduce the last
      entry of `trace.readings` to `{ w: number, timestamp: string } | null`, mirroring
      `maxDailyPowerW`'s per-reading `pacW` summation but applied only to `trace.readings.at(-1)`
      instead of scanning for a max. Run T001's tests to green.
- [x] T003 [P] Write `node:test` cases in `web/js/data/today-trace.test.js` (new file) for the new
      `fetchTodayMinuteTrace()` per data-model.md/research.md §3: mock/stub the underlying
      `fetchText` + `parseMinFile` calls (inline fixture strings, no real file I/O per
      CLAUDE.md's script-testing rules) to cover — a successful fetch with readings filtered to
      today's ISO date only (readings dated yesterday dropped, matching `day-view.js`'s existing
      post-midnight comment); a fetch that fails (`fetchText` not `ok`) resolving to `null`; a
      fetch that parses but has zero readings for today resolving to `null`. Confirm these cases
      fail before T004.
- [x] T004 Create `web/js/data/today-trace.js` exporting `fetchTodayMinuteTrace()`, extracted
      byte-for-byte in behavior from `web/js/views/day-view.js`'s `fetchDayTrace()` `isToday`
      branch (research.md §3): fetch `${DATA_DIR}/min_day.js` via `fetchText`, parse with
      `parseMinFile` using today's `ddmmyyFromParams`-equivalent date string, filter
      `trace.readings` to entries whose `timestamp` starts with today's ISO date, return `null`
      when the fetch fails or the filtered `readings` array is empty, else return the trace. Add
      file-level JSDoc per the constitution's format. Run T003's tests to green.
- [x] T005 [US-prereq] Refactor `web/js/views/day-view.js`'s `fetchDayTrace()` `isToday` branch to
      call the new `fetchTodayMinuteTrace()` from `web/js/data/today-trace.js` instead of
      duplicating the fetch/parse/filter logic (research.md §3) — no behavior change for the day
      view itself, so no new day-view test coverage is needed (existing day-view Playwright
      coverage must still pass unmodified).
- [x] T006 Run `node --test web/js/data/yield-stats.test.js web/js/data/today-trace.test.js` and
      confirm all pass; run the full `npx playwright test --reporter=line` suite once to confirm
      T005's refactor didn't regress existing day-view/info-panel scenarios.

**Checkpoint**: `lastReadingPower()` and `fetchTodayMinuteTrace()` exist, are unit-tested, and
`day-view.js` consumes the shared helper with no behavior change — user story implementation can
now begin.

---

## Phase 3: User Story 1 - See a real reading instead of "no data" whenever possible (Priority: P1) 🎯 MVP

**Goal**: The navbar/mobile info panel shows today's daily-minute-data last reading (wattage +
its own timestamp) whenever the live endpoint has never succeeded this session and today's data
has at least one reading — replacing the "no data yet" state — and switches over to a genuine
live reading the moment one arrives.

**Independent Test**: Mock `**/live/index.php` to abort every request and `**/min_day.js` with a
known last reading; load the site and confirm the panel shows that reading's wattage/timestamp
instead of "no data yet". Separately, let a later live poll succeed and confirm the panel switches
to it.

### Tests for User Story 1

- [x] T007 [P] [US1] Add `mockDailyFallback()` Playwright helper to `tests/e2e/info-panel.spec.js`,
      mirroring `mockProduction()`'s route-mock pattern: routes `**/min_day.js` with a fixture
      body whose last `m[mi++]=` line carries a controllable wattage/timestamp (or an
      empty/no-readings-for-today file when a scenario needs Story 3's neutral state), per
      quickstart.md's Playwright scenario list.
- [x] T008 [US1] Add Playwright case "shows the daily-data fallback when the live endpoint has
      never succeeded" to `tests/e2e/info-panel.spec.js` (quickstart.md scenario 1): mock
      `**/live/index.php` aborted, mock `**/min_day.js` via `mockDailyFallback()` with a known
      wattage/time; load the site; assert `[data-role="production"]` has `data-available="true"`,
      `[data-role="production-value"]` shows that wattage, and `[data-role="production-timestamp"]`
      shows that reading's own `HH:MM` (not the fetch/render time). Confirm it fails before T010.
- [x] T009 [US1] Add Playwright case "live succeeding later replaces the fallback"
      (quickstart.md scenario 2): start as in T008 (fallback showing), then re-route
      `**/live/index.php` to a successful fixed-wattage response via `mockProduction()` and
      advance past one `LIVE_REFRESH_INTERVAL_MS` tick via `overrideLiveRefreshInterval()`; assert
      the panel now shows the live endpoint's wattage/timestamp, not the fallback's. Confirm it
      fails before T010.

### Implementation for User Story 1

- [x] T010 [US1] In `web/js/info-panel/info-panel-controller.js`: import
      `fetchTodayMinuteTrace` (`../data/today-trace.js`) and `lastReadingPower`
      (`../data/yield-stats.js`); add `let liveEverSucceeded = false;` alongside the existing
      `lastGoodProduction`/`requestSeq` closure state (data-model.md); add a new
      `async function pollDailyFallback()` that calls `fetchTodayMinuteTrace()`, reduces a
      non-null result with `lastReadingPower()`, and — only when `!liveEverSucceeded` and a
      reading was found — writes `lastGoodProduction = { available: true, totalPacW: reading.w,
  timestamp: reading.timestamp }` and calls `renderProduction(elements, lastGoodProduction,
  capacityKwp)` (research.md §2/§4); set `liveEverSucceeded = true` inside `pollProduction()`'s
      existing `if (reading.available)` branch, before/alongside its `lastGoodProduction` write.
- [x] T011 [US1] In the same file's `initInfoPanelController()`: call `pollDailyFallback()`
      once at mount (alongside the existing `pollProduction(); pollYield(); pollWeather();` calls)
      and again on the existing `dataIntervalId = setInterval(pollYield, DATA_REFRESH_INTERVAL_MS)`
      tick — combine into that same interval callback (e.g. `setInterval(() => { pollYield();
  pollDailyFallback(); }, DATA_REFRESH_INTERVAL_MS)`) per research.md §2, rather than adding a
      second `setInterval`. Update the file's top JSDoc comment block to describe the new fallback
      source/precedence, per the constitution's JSDoc standard.
- [x] T012 [US1] Run `npx playwright test tests/e2e/info-panel.spec.js --reporter=line` and confirm
      T008/T009 pass along with all pre-existing cases in the file.

**Checkpoint**: User Story 1 is fully functional and independently testable — the panel shows the
daily fallback when live has never succeeded, and switches to live once it does.

---

## Phase 4: User Story 2 - Fallback never overrides a real live reading already on screen (Priority: P2)

**Goal**: Once a live reading has ever succeeded this session, a later failed live poll (or any
fallback poll) must never regress the panel back to the daily-data fallback.

**Independent Test**: Let the live endpoint succeed once, then fail on the next poll; confirm the
panel keeps showing the earlier live reading and timestamp, not the fallback.

### Tests for User Story 2

- [x] T013 [US2] Add Playwright case "a single failed live poll never regresses an already-shown
      live reading to the fallback" to `tests/e2e/info-panel.spec.js` (quickstart.md scenario 3):
      mock `**/live/index.php` to succeed once then fail (reuse/extend `mockProduction()`'s
      `aborted` toggle via re-routing between the load and the next tick, as existing "keeps last
      good value" cases in the file already do); mock `**/min_day.js` via `mockDailyFallback()`
      with a _different_, distinguishable wattage; load the site (first live poll succeeds);
      advance past one `LIVE_REFRESH_INTERVAL_MS` tick (live poll now fails) and one
      `DATA_REFRESH_INTERVAL_MS` tick (fallback poll fires, both intervals patched small via
      `overrideLiveRefreshInterval()`/an equivalent override for `DATA_REFRESH_INTERVAL_MS`);
      assert the panel still shows the first live reading's wattage/timestamp, unchanged. Confirm
      it fails before implementation (it should already pass once T010's `liveEverSucceeded` guard
      is in place from Phase 3 — this task is regression coverage confirming the guard holds, not
      new production code).

### Implementation for User Story 2

- [x] T014 [US2] Verify `pollDailyFallback()` (T010) checks `!liveEverSucceeded` before writing to
      `lastGoodProduction`, and that `liveEverSucceeded` is set `true` inside `pollProduction()`
      only on a _successful_ reading, never reset — re-read data-model.md's state-transition table
      and confirm the implementation matches every transition listed (mount / fallback resolves /
      fallback resolves null-or-blocked / live succeeds / live fails). No new code expected beyond
      T010 — this is a targeted review-and-fix pass if T013 exposes any gap.
- [x] T015 [US2] Run `npx playwright test tests/e2e/info-panel.spec.js --reporter=line` and confirm
      T013 passes along with all prior cases (T008/T009 and pre-existing ones).

**Checkpoint**: User Stories 1 AND 2 both work independently — the fallback appears when needed
and can never displace an already-shown live reading.

---

## Phase 5: User Story 3 - Neutral state remains when no reading of any kind exists (Priority: P3)

**Goal**: When neither the live endpoint nor today's daily minute data has any reading, the panel
keeps showing the existing neutral "no data yet" state — not a zero reading or an error.

**Independent Test**: Mock the live endpoint to fail and today's daily minute data to have zero
entries; confirm the panel still shows "no data yet".

### Tests for User Story 3

- [x] T016 [US3] Add Playwright case "neutral state preserved when neither source has data" to
      `tests/e2e/info-panel.spec.js` (quickstart.md scenario 4): mock `**/live/index.php` aborted
      and `**/min_day.js` via `mockDailyFallback()` returning an empty/no-readings-for-today body
      (or a 404, matching `fetchText`'s failure contract); load the site; assert
      `[data-role="production"]` still has `data-available="false"` and the existing "no data yet"
      text, not a zero reading or a thrown error. Confirm it fails before implementation (like
      T013, this should already pass given T004's `null`-on-empty contract and T010's guard —
      regression coverage for the residual case, not new production code).

### Implementation for User Story 3

- [x] T017 [US3] Verify `pollDailyFallback()` (T010) only calls `renderProduction()` /writes
      `lastGoodProduction` when `lastReadingPower()` returns non-`null` — confirm the `null` path
      (empty trace, or `fetchTodayMinuteTrace()` itself returning `null`) leaves
      `lastGoodProduction` untouched so `renderProduction()`'s existing `{ available: false }`
      initial state renders unchanged. No new code expected beyond T010 — fix if T016 exposes a
      gap (e.g. a missing null-check).
- [x] T018 [US3] Run `npx playwright test tests/e2e/info-panel.spec.js --reporter=line` and confirm
      T016 passes along with every prior case in the file (full regression pass across all three
      stories).

**Checkpoint**: All three user stories are independently functional — fallback shown when
possible (US1), never overrides live (US2), neutral state preserved when both sources are empty
(US3).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final validation across all stories.

- [x] T019 [P] Update `README.md` to describe the navbar panel's new daily-data fallback behavior
      (constitution Documentation standards), per plan.md's Project Structure.
- [x] T020 [P] Update `README.de.md` with the same content, translated, keeping it in sync with
      T019.
- [x] T021 [P] Update `docs/user-guide.md` to describe when/why the panel shows the daily fallback
      instead of "no data yet", and that it's superseded by a live reading once one succeeds.
- [x] T022 [P] Update `docs/user-guide.de.md` with the same content, translated, keeping it in
      sync with T021.
- [x] T023 Run the full quickstart.md validation end to end: both `node --test` commands, the full
      `npx playwright test --reporter=line` suite, and the manual smoke check (block the live
      endpoint via devtools network conditions, reload, cross-check the panel's fallback
      wattage/time against `#/day/<today>`'s data table's last row, then unblock and confirm the
      panel switches to live within `LIVE_REFRESH_INTERVAL_MS`).
      Automated portion run: `npm run test:scripts` (623/623 pass), `npx playwright test
    --reporter=line` (239 passed; the same 8 pre-existing dashboard-responsive/statistics-view
      320px failures and flaky retries reproduce identically on the pre-feature checkout —
      unrelated to this feature, confirmed via `git stash`). Manual devtools smoke check not run
      in this non-interactive session — the Playwright coverage above (mocked live-endpoint
      abort + `min_day.js` fallback, live-supersedes-fallback, never-regresses, neutral-state
      cases) exercises the same code paths end to end.
- [x] T024 Update `**Status**` in `specs/028-live-panel-fallback/spec.md` from `Draft` to
      `Implemented` (only once every task above is checked off `[X]`).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — no tasks.
- **Foundational (Phase 2)**: No dependencies — BLOCKS all user stories (T001-T006 must complete
  first; T005/T006 specifically require T002/T004 done).
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion.
  - US1 (Phase 3) has no dependency on US2/US3.
  - US2 (Phase 4) builds directly on US1's `pollDailyFallback()`/`liveEverSucceeded` (T010) — its
    tests are regression coverage of behavior US1's implementation already provides, so do US1
    first even though the stories are conceptually independent.
  - US3 (Phase 5) likewise builds on T010's `null`-handling — same ordering rationale as US2.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each Phase

- T001/T003 (tests) before T002/T004 (implementation) — TDD per plan.md's Testing requirement.
- T005 (day-view refactor) depends on T004 (the new module existing).
- T007 (test helper) before T008/T009 (test cases that use it).
- T010 before T011 (interval wiring needs the function to exist).
- T012/T015/T018 (verification runs) after their phase's implementation tasks.

### Parallel Opportunities

- T001 and T003 can run in parallel (different test files, no shared dependency).
- T019-T022 (doc updates, four different files) can all run in parallel.
- Once Foundational (Phase 2) completes, US2's and US3's _test-writing_ tasks (T013, T016) could
  be drafted in parallel with US1's implementation (T010/T011), but their expected-pass
  verification (T015/T018) depends on T010 existing — see Dependencies above.

---

## Parallel Example: Foundational Phase

```bash
# Launch both new-helper test-writing tasks together:
Task: "Write node:test cases for lastReadingPower() in web/js/data/yield-stats.test.js"
Task: "Write node:test cases for fetchTodayMinuteTrace() in web/js/data/today-trace.test.js"
```

## Parallel Example: Polish Phase

```bash
# Launch all four doc updates together:
Task: "Update README.md with the daily-data fallback behavior"
Task: "Update README.de.md with the daily-data fallback behavior"
Task: "Update docs/user-guide.md with the daily-data fallback behavior"
Task: "Update docs/user-guide.de.md with the daily-data fallback behavior"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (`lastReadingPower()`, `fetchTodayMinuteTrace()`, `day-view.js`
   refactor — all unit-tested).
2. Complete Phase 3: User Story 1 (fallback shown + live supersedes it).
3. **STOP and VALIDATE**: Run T012's Playwright pass; manually confirm via quickstart.md's manual
   smoke check.
4. Deploy/demo if ready — US1 alone already delivers the spec's primary value (SC-001).

### Incremental Delivery

1. Foundational → shared helpers ready, unit-tested.
2. Add US1 → fallback shown/superseded → validate → demo (MVP).
3. Add US2 → regression-proof the never-overrides-live guarantee → validate.
4. Add US3 → regression-proof the neutral-state guarantee → validate.
5. Polish → docs + full quickstart.md pass → mark spec Implemented.

### Solo-Developer Note

Given this feature's small scope (one new module, ~40 lines in one controller, a handful of test
cases), Phases 3-5 are best done as one continuous implementation pass (T010/T011 cover all three
stories' production logic at once, per data-model.md's unified state-transition table) followed by
writing all three phases' test cases together — the "Independent Test" sections above describe
what to verify per story, not a mandate to context-switch between separate implementation passes.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- T010/T011 are listed once, under US1, because data-model.md's design has one implementation
  (the `liveEverSucceeded` guard) satisfying US1, US2, and US3 simultaneously — US2/US3's phases
  add regression tests (T013/T016) and a verification pass (T014/T017), not new production code.
- Verify each story's Playwright case(s) fail (or would trivially pass for the wrong reason)
  before trusting them as coverage — run them against a pre-T010 checkout if in doubt.
- Commit after each phase's checkpoint.
- Avoid: vague tasks, same-file conflicts (T010/T011 both touch
`info-panel-controller.js` sequentially, not in parallel), cross-story dependencies that break
independent testability of the _test_ suites even though the underlying implementation is
shared.
</content>
