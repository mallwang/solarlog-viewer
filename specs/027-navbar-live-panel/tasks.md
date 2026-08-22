---
description: 'Task list for Live Navbar Watt Reading (027-navbar-live-panel)'
---

# Tasks: Live Navbar Watt Reading

**Input**: Design documents from `/specs/027-navbar-live-panel/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/live-endpoint.md, quickstart.md

**Tests**: Included — plan.md's Constitution Check requires a Playwright test update and a
`node:test` unit-test file for the new client module (project CLAUDE.md's TDD conventions for
`web/js/**/*.test.js`).

**Organization**: Tasks are grouped by user story (P1/P2/P3 from spec.md) to enable independent
implementation and testing of each.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1/US2/US3)

## Path Conventions

Single static web app (`web/`) — see plan.md's Project Structure. No frontend/backend split.

---

## Phase 1: Setup

**Purpose**: No new tooling/dependencies are needed (plan.md's Primary Dependencies — this
feature adds no new package, just a second `fetch()` target). Setup is limited to confirming the
two new files' naming matches the existing `weather-forecast-client.js`/`*.test.js` co-location
pattern already in `web/js/info-panel/`.

- [x] T001 Confirm `web/js/info-panel/` naming/co-location plan: `web/js/info-panel/live-reading-client.js` + `web/js/info-panel/live-reading-client.test.js`, mirroring `weather-forecast-client.js` —
      no action needed beyond creating the files in Phase 2, this task is a no-op checkpoint (no
      new lint config, no new `package.json` dependency required).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The config constants and the stateless fetch/validate client are shared by all three
user stories — nothing in Phase 3+ can be wired up until these exist.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Add `LIVE_ENDPOINT_URL` (`'https://wolfsbach.synology.me/live/index.php'`) and
      `LIVE_REFRESH_INTERVAL_MS` (default `60 * 1000`) constants to `web/js/config.js`, with a doc
      comment matching the file's existing style (see `WEATHER_REFRESH_INTERVAL_MS`'s comment for
      the pattern) explaining the constant is independent of `DATA_REFRESH_INTERVAL_MS` (FR-003).
- [x] T003 [P] Write `web/js/info-panel/live-reading-client.test.js` FIRST (must fail before T004):
      `node:test` cases against inline fixture JSON strings and an injected `fetchImpl`, covering
      every FR-004/contracts/live-endpoint.md classification rule — success (`available: true,
  watt, timestamp`), thrown fetch/network error, non-2xx `response.ok: false`, unparseable
      JSON body, missing/non-numeric top-level `watt`, and `sources.solarlog.ok` false/missing —
      each non-success case asserting the exact `{ available: false }` shape (data-model.md).
- [x] T004 [US-shared] Implement `web/js/info-panel/live-reading-client.js` exporting
      `fetchLiveReading({ fetchImpl = fetch } = {})`: fetches `LIVE_ENDPOINT_URL` from
      `web/js/config.js`, applies the FR-004 classification rules (research.md §7) inside a single
      `try/catch`, and returns `{ available: true, watt, timestamp }` or `{ available: false }` —
      structured like `fetchWeatherAndForecast()` in `web/js/info-panel/weather-forecast-client.js`
      (never throws). Run T003 until green: `node --test web/js/info-panel/live-reading-client.test.js`.

**Checkpoint**: Foundation ready — `fetchLiveReading()` is fully tested and usable by the
controller; all three user stories can now proceed.

---

## Phase 3: User Story 1 - See true current production at a glance (Priority: P1) 🎯 MVP

**Goal**: The navbar live panel displays a wattage sourced from the live endpoint's `watt`,
refreshed on its own `LIVE_REFRESH_INTERVAL_MS` timer, fully decoupled from the 10-minute
diagram/yield cycle.

**Independent Test**: Load any page with the navbar visible; poll the live endpoint separately;
confirm the displayed wattage matches `watt` and updates within one refresh cycle without any
diagram/data-panel figure also updating.

### Implementation for User Story 1

- [x] T005 [US1] In `web/js/info-panel/info-panel-controller.js`, import `fetchLiveReading` from
      `./live-reading-client.js` and `LIVE_REFRESH_INTERVAL_MS` from `../config.js`; replace the
      body of `pollProduction()` (currently calling the local `fetchCurrentProduction()`, which
      reads `data/min_cur.js`) with a call to `fetchLiveReading()`, mapping its
      `{ available: true, watt, timestamp }` result to the `{ totalPacW, timestamp, available }`
      shape `renderProduction()`/`productionValueText()`/`productionTimestampText()` already
      expect (no `perInverter` field — research.md §6, efficiency suffix drops silently since
      `efficiencyPercent(undefined)` already returns `null`).
- [x] T006 [US1] Remove the now-unused `fetchCurrentProduction()` function and its
      `parseMinFile`/`data/min_cur.js`-only imports from `info-panel-controller.js` if nothing else
      in the file still uses them (check `parseMinFile`'s only other caller before removing the
      import — keep `fetchText`/`parseMinFile` imports only if `fetchYield()` or another function
      still needs them).
- [x] T007 [US1] Add a third, independent `setInterval(pollProduction, LIVE_REFRESH_INTERVAL_MS)`
      in `initInfoPanelController()`, separate from the existing `dataIntervalId` (which now polls
      only `pollYield` on `DATA_REFRESH_INTERVAL_MS` — production comes out of that combined call)
      and `weatherIntervalId`; call `pollProduction()` once immediately on mount (already done) and
      return the new interval's id from the cleanup function alongside the other two
      (`clearInterval` for all three).
- [x] T008 [US1] Update the file-level doc comment at the top of `info-panel-controller.js` to
      describe the new three-timer setup (production/live on `LIVE_REFRESH_INTERVAL_MS`, yield on
      `DATA_REFRESH_INTERVAL_MS`, weather on `WEATHER_REFRESH_INTERVAL_MS`) and drop the outdated
      references to `data/min_cur.js` driving the production figure.
- [x] T009 [US1] Update `tests/e2e/info-panel.spec.js`'s `mockProduction()` helper (or add a new
      `mockLiveReading()` helper) to mock `**/live/index.php` via `page.route()` with a JSON body
      matching contracts/live-endpoint.md's success shape, replacing the `data/min_cur.js` mock
      used by production-value assertions; keep/adjust existing assertions that read
      `[data-role="production-value"]`/`[data-role="production-timestamp"]` to expect the live
      endpoint's `watt`/`timestamp` fields (accounting for the dropped efficiency suffix, T005).
- [x] T010 [US1] Add a new Playwright test in `tests/e2e/info-panel.spec.js` (patching
      `LIVE_REFRESH_INTERVAL_MS` down to a small value the same way `overrideBackgroundWeather()`
      patches `BACKGROUND_WEATHER` — see its `**/js/config.js` route handler pattern) that: (a)
      asserts the initial render matches the mocked `watt`, (b) changes the mocked response's
      `watt` and waits one patched interval, asserting the panel updates without a full page
      reload, and (c) asserts `data/*.js`/`hist/*.js` requests do NOT fire again outside their own
      `DATA_REFRESH_INTERVAL_MS` cadence during that wait (SC-002 — decoupling).

**Checkpoint**: User Story 1 is fully functional and independently testable — the navbar shows a
live-endpoint-sourced wattage on its own cadence.

---

## Phase 4: User Story 2 - Live panel degrades gracefully (Priority: P2)

**Goal**: A failed/unreachable/unhealthy live-endpoint reading never blanks or crashes the panel —
it keeps the last successful reading (or shows a distinct "no data yet" state if none exists yet)
and keeps retrying.

**Independent Test**: Simulate the endpoint being unreachable or reporting `ok:false`; confirm the
panel shows its defined fallback state rather than crashing or silently freezing.

### Implementation for User Story 2

- [x] T011 [US2] In `info-panel-controller.js`, add a closure-held `lastGoodProduction` variable
      (module-scope inside `initInfoPanelController()`, initial value `{ available: false }` —
      research.md §3) that `pollProduction()` only _replaces_ when `fetchLiveReading()` returns
      `available: true`; every render call (initial mount + every tick, success or failure) renders
      whatever `lastGoodProduction` currently holds, not the tick's own raw result.
- [x] T012 [US2] Add a monotonic request-sequence guard (research.md §4): a closure-held
      `let requestSeq = 0` in `initInfoPanelController()`; `pollProduction()` captures
      `const seq = ++requestSeq` before `await fetchLiveReading()` and only updates
      `lastGoodProduction`/re-renders if `seq === requestSeq` when the fetch resolves (FR-008 — no
      out-of-order/overlapping results applied).
- [x] T013 [US2] Add a `document.visibilitychange` listener in `initInfoPanelController()` that
      calls `pollProduction()` immediately when `document.visibilityState === 'visible'` (FR-009,
      research.md §5); remove the listener in the controller's returned cleanup function alongside
      the existing `clearInterval` calls.
- [x] T014 [US2] Add Playwright tests in `tests/e2e/info-panel.spec.js`: (a) mock
      `**/live/index.php` to abort/fail after an initial successful mock, wait one patched
      `LIVE_REFRESH_INTERVAL_MS` interval, and assert the panel still shows the last successful
      `watt`/timestamp with no page error (SC-003); (b) mock `**/live/index.php` to abort from page
      load with no prior success, and assert the panel shows `t('infoPanel.unavailable')`
      (FR-006), distinct from a real `0` reading; (c) mock a response with `sources.solarlog.ok:
  false` and assert it's treated the same as a failed reading (FR-004).
- [x] T015 [US2] Add a `node:test` case in `live-reading-client.test.js` (if not already covered
      by T003) confirming a `watt: 0` success response returns `{ available: true, watt: 0,
  timestamp }` — not `{ available: false }` — so FR-011's genuine-zero-vs-no-data distinction
      is guaranteed at the client layer, not just the controller's render layer.

**Checkpoint**: User Stories 1 AND 2 both work independently — the panel now degrades gracefully
under real network failure conditions.

---

## Phase 5: User Story 3 - Operator can tune the live refresh cadence (Priority: P3)

**Goal**: Changing `LIVE_REFRESH_INTERVAL_MS` in `web/js/config.js` is the only edit needed to
change the navbar's live-poll cadence.

**Independent Test**: Change the configured interval, reload, confirm the panel's actual polling
cadence follows the new value.

### Implementation for User Story 3

- [x] T016 [US3] Add a Playwright test in `tests/e2e/info-panel.spec.js` that patches
      `LIVE_REFRESH_INTERVAL_MS` to a distinct small value (different from the value used in T010),
      via the same `**/js/config.js` route-patch pattern as `overrideBackgroundWeather()`, and
      asserts (via request count/timing on the mocked `**/live/index.php` route) that the panel
      polls at that new cadence rather than the default 60 000 ms or the unrelated
      `DATA_REFRESH_INTERVAL_MS` (SC-004).
- [x] T017 [US3] Confirm (code inspection, no code change expected if T007 was done correctly)
      that `LIVE_REFRESH_INTERVAL_MS` is read once from `../config.js` and used directly as the
      `setInterval` delay in `initInfoPanelController()` — no hardcoded fallback/duplicate literal
      elsewhere in the file that could silently override an operator's edit.

**Checkpoint**: All three user stories are independently functional — cadence is fully
operator-configurable via a single constant.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and repo-wide consistency required by plan.md's Constitution Check.

- [x] T018 [P] Update `README.md` and `README.de.md` to describe the new live-refresh behavior
      (navbar wattage now sourced from `live/index.php`, polled every `LIVE_REFRESH_INTERVAL_MS`
      independent of the 10-minute diagram cycle) per plan.md's "Documentation standards" gate.
- [x] T019 [P] Update `docs/user-guide.md` and `docs/user-guide.de.md` with the same behavior
      description, wherever the navbar's live wattage figure is currently documented.
- [x] T020 Run the full quickstart.md validation checklist manually (`npm start`, compare navbar
      value against a direct tab on `https://wolfsbach.synology.me/live/index.php`, confirm the
      10-minute diagram cadence is unaffected in dev tools' Network tab) — User Stories 1–3.
- [x] T021 Run automated tests and fix any failures:
      `node --test web/js/info-panel/live-reading-client.test.js` and
      `npx playwright test tests/e2e/info-panel.spec.js --reporter=line`.
- [x] T022 Run `npx eslint web/js/info-panel/live-reading-client.js web/js/info-panel/live-reading-client.test.js web/js/info-panel/info-panel-controller.js` and resolve all errors (project CLAUDE.md linting standard); also address any SonarLint warnings visible in the IDE for these files.
- [x] T023 Update `**Status**` in `specs/027-navbar-live-panel/spec.md` from `Draft` to
      `Implemented` (only once every task above is checked off).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — a no-op confirmation step.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories — `fetchLiveReading()`
  (T004) and the config constants (T002) are consumed by every later phase.
- **User Story 1 (Phase 3)**: Depends on Phase 2. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Phase 2 and on Phase 3's `pollProduction()`/timer wiring
  (T005–T007) existing to extend with fallback state/race-guard/visibility-repoll — not
  independently implementable before US1's poll loop exists, but independently _testable_ once
  both are in place (spec.md's own Independent Test framing).
- **User Story 3 (Phase 5)**: Depends on Phase 2 (T002's constant) and Phase 3 (T007's `setInterval`
  wiring that reads it) — purely a verification/test phase, no new production code expected.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Parallel Opportunities

- T002 and T003 can run in parallel (different files: `config.js` vs the new test file).
- T018 and T019 (README vs docs/user-guide, DE+EN each) can run in parallel with each other and
  with T020–T022.
- Within Phase 4, T011–T013 all touch the same file (`info-panel-controller.js`) and should be
  done sequentially, not in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (no-op) → Phase 2 (Foundational: config + client + its unit tests).
2. Complete Phase 3 (User Story 1): wire the controller's `pollProduction()` to the live endpoint
   on its own decoupled timer.
3. **STOP and VALIDATE**: Run T009/T010's Playwright assertions; confirm SC-001/SC-002 manually
   per quickstart.md.
4. This alone ships the feature's core value — a live, correctly-sourced navbar wattage — even
   before graceful-degradation or configurability hardening lands.

### Incremental Delivery

1. Setup + Foundational → foundation ready (client module fully unit-tested).
2. User Story 1 → live wattage on its own cadence → validate → could ship as-is.
3. User Story 2 → graceful degradation (last-known-good, race guard, refocus repoll) → validate.
4. User Story 3 → cadence-configurability test coverage → validate.
5. Polish → docs + full test/lint pass → mark spec Implemented.
