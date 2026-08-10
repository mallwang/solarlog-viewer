---

description: "Task list template for feature implementation"
---

# Tasks: Transparency Mode

**Input**: Design documents from `/specs/009-transparency-mode/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/transparency-mode.md](./contracts/transparency-mode.md), [quickstart.md](./quickstart.md)

**Tests**: Included. The constitution (Technical Standards → Testing) requires a Playwright end-to-end test for every visible UI change, so test tasks are mandatory here, not optional.

**Organization**: Tasks are grouped by user story (US1 = turn on, US2 = turn off) per [spec.md](./spec.md), sharing one Foundational phase for the preference module and CSS hook both stories depend on.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- File paths are exact, relative to repository root

## Path Conventions

Single static frontend project — all paths under `web/` and `tests/e2e/`, per [plan.md](./plan.md) Project Structure. No backend/mobile paths apply.

---

## Phase 1: Setup

**Purpose**: Add the shared design tokens and module scaffold the rest of the feature builds on.

- [X] T001 [P] Add `--transparency-nav-opacity` and `--transparency-panel-opacity` custom properties (default `1`) to `:root` in `web/css/tokens.css`, per [contracts/transparency-mode.md](./contracts/transparency-mode.md) CSS rules
- [X] T002 [P] Create `web/js/settings.js` with the exported function signatures `isTransparencyEnabled()`, `setTransparencyEnabled(enabled)`, `initTransparencyMode()` (bodies may throw/stub for now), per [contracts/transparency-mode.md](./contracts/transparency-mode.md) Module contract

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The preference module and the CSS attribute hook that both User Story 1 (on) and User Story 2 (off) depend on.

**⚠️ CRITICAL**: No user story task can be verified until this phase is complete.

- [X] T003 [P] Write unit tests for `web/js/settings.js` in `web/js/settings.test.js` (mirroring `web/js/sky/location.test.js` conventions): default `isTransparencyEnabled()` is `false` when `localStorage` is empty, `setTransparencyEnabled(true)`/`(false)` persists `"true"`/`"false"` under the `solarlog-transparency` key, and `initTransparencyMode()` applies the persisted value on call — write these to FAIL first
- [X] T004 Implement `web/js/settings.js` logic (`isTransparencyEnabled`, `setTransparencyEnabled`, `initTransparencyMode`) per [data-model.md](./data-model.md) Storage representation and [contracts/transparency-mode.md](./contracts/transparency-mode.md), so `node --test web/js/settings.test.js` passes (depends on T002, T003)
- [X] T005 Add `html[data-transparency='on']` scoped CSS rules to `web/css/app.css` setting `--transparency-nav-opacity: 0` and `--transparency-panel-opacity: 0.4`, and apply `--transparency-nav-opacity` to `.app-nav`/`.period-nav` backgrounds and `--transparency-panel-opacity` as `opacity` on chart-container cards and `.stats-panel`, per [contracts/transparency-mode.md](./contracts/transparency-mode.md) CSS rules (depends on T001)
- [X] T006 Call `initTransparencyMode()` during bootstrap in `web/js/main.js` (alongside the existing `initI18n()` call) so the persisted preference is applied to `<html>` before first paint (depends on T004)

**Checkpoint**: `data-transparency` attribute can be set/read and CSS responds to it; ready for the toggle control itself.

---

## Phase 3: User Story 1 - Turn on transparency mode (Priority: P1) 🎯 MVP

**Goal**: A user can enable transparency mode from a global control and immediately see fully transparent nav bars and 40%-opacity diagrams/statistics over the sky background, on every view, persisted across reloads.

**Independent Test**: Open the settings/header toggle, enable transparency mode, and visually confirm nav bars are fully transparent and chart/stat panels render at 40% opacity over the animated sky background; confirm this holds across views and after a reload.

### Tests for User Story 1

- [X] T007 [P] [US1] Playwright test in `tests/e2e/transparency-mode.spec.js`: enabling the toggle sets `data-transparency="on"` on `<html>`, drives nav background alpha to ≈0 and chart-container/`.stats-panel` computed `opacity` to ≈0.4 — write to FAIL first
- [X] T008 [P] [US1] Playwright test in `tests/e2e/transparency-mode.spec.js`: with transparency mode enabled, navigating between dashboard/day/month/year views keeps `data-transparency="on"` and the same opacity effects applied on each view (FR-005) — write to FAIL first
- [X] T009 [P] [US1] Playwright test in `tests/e2e/transparency-mode.spec.js`: after enabling transparency mode and calling `page.reload()`, `data-transparency="on"` and `localStorage.getItem('solarlog-transparency') === 'true'` still hold (FR-006, SC-004) — write to FAIL first

### Implementation for User Story 1

- [X] T010 [US1] Add a transparency-mode toggle control to the header in `web/index.html`, next to the existing language-switcher/mobile-nav-toggle area, with an accessible label/`aria-pressed` state (depends on T006)
- [X] T011 [US1] Wire the toggle control's click handler in `web/js/main.js` to call `setTransparencyEnabled(!isTransparencyEnabled())` and update the control's own `aria-pressed`/visual state to reflect the new value (depends on T004, T010)
- [X] T012 [US1] Verify/adjust nav-bar text and icon styling in `web/css/app.css` so labels stay legible over the sky background when `data-transparency="on"` (FR-002, FR-008), reusing the existing text-shadow/contrast treatment from the sky-background header title (depends on T005)
- [X] T013 [US1] Run `npx playwright test tests/e2e/transparency-mode.spec.js --reporter=line` and fix implementation until T007–T009 pass

**Checkpoint**: User Story 1 fully functional and independently testable — transparency mode can be turned on and works everywhere, persistently.

---

## Phase 4: User Story 2 - Turn off transparency mode (Priority: P2)

**Goal**: A user who enabled transparency mode can turn it back off and immediately get the normal, fully opaque appearance back, persisted across reloads.

**Independent Test**: With transparency mode already on, disable it from the same global control and visually confirm nav bars and panels return to their normal opaque baseline appearance; confirm this holds after a reload.

### Tests for User Story 2

- [X] T014 [P] [US2] Playwright test in `tests/e2e/transparency-mode.spec.js`: starting from transparency mode enabled, disabling the toggle removes `data-transparency="on"` from `<html>` and restores nav background alpha to 1 and chart-container/`.stats-panel` `opacity` to 1 (FR-004) — write to FAIL first
- [X] T015 [P] [US2] Playwright test in `tests/e2e/transparency-mode.spec.js`: after disabling transparency mode and calling `page.reload()`, the attribute stays absent/`"off"` and `localStorage.getItem('solarlog-transparency') === 'false'` (FR-006) — write to FAIL first

### Implementation for User Story 2

- [X] T016 [US2] Confirm the toggle handler from T011 correctly round-trips off→on→off (no residual inline styles or stuck attribute values) in `web/js/main.js`; fix if T014/T015 reveal a gap (depends on T011)
- [X] T017 [US2] Run `npx playwright test tests/e2e/transparency-mode.spec.js --reporter=line` and fix implementation until T014–T015 pass

**Checkpoint**: Both User Story 1 and User Story 2 work independently — transparency mode can be turned on and off, everywhere, persistently.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Regression safety and hygiene across both stories.

- [X] T018 [P] Run `node --test web/js/settings.test.js` and `npx eslint web/js/settings.js web/js/settings.test.js`, fixing any errors (zero errors required per `CLAUDE.md`)
- [X] T019 [P] Run `npx playwright test tests/e2e/navigation.spec.js --reporter=line` to confirm the new header toggle introduced no regression to existing nav/frameset coverage
- [X] T020 Run through the manual validation steps in [quickstart.md](./quickstart.md) end-to-end in a real browser via `npm start`
- [X] T021 [P] Run `npm run format:check` and `npm run lint` across changed files and fix any violations

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup (T001, T002) — BLOCKS both user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion. No dependency on User Story 2.
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) completion, and reuses the toggle control/handler built in US1 (T010, T011) — so in practice implement after US1, though its tests (T014, T015) are independent assertions.
- **Polish (Phase 5)**: Depends on both user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependency on User Story 2.
- **User Story 2 (P2)**: Functionally the inverse of the same toggle built in US1 — shares the control/handler (T010, T011) but is validated and hardened independently (T014–T017). Not blocked on US1's Playwright tests passing, only on the shared implementation tasks (T010, T011) existing.

### Within Each User Story

- Tests (T007–T009, T014–T015) MUST be written and FAIL before their implementation tasks are considered done.
- Toggle markup (T010) before handler wiring (T011).
- CSS legibility pass (T012) can run in parallel with T010/T011 (different files).

### Parallel Opportunities

- T001 and T002 (Setup) can run in parallel — different files.
- T003 (US1/US2-shared test) can be written in parallel with T001/T002, but T004 depends on T003 existing first (TDD).
- T007, T008, T009 (US1 tests) can be written in parallel — same file, but independent `test()` blocks with no shared state.
- T014, T015 (US2 tests) can be written in parallel with each other, and in parallel with US1 polish tasks once Foundational is done.
- T018, T019, T021 (Polish) can run in parallel — independent commands/files.

---

## Parallel Example: User Story 1

```bash
# Launch all Playwright test-writing tasks for User Story 1 together (same file, independent blocks):
Task: "Playwright test: enabling toggle sets data-transparency=on and opacity effects in tests/e2e/transparency-mode.spec.js"
Task: "Playwright test: transparency effect persists across dashboard/day/month/year navigation in tests/e2e/transparency-mode.spec.js"
Task: "Playwright test: transparency setting persists across page reload in tests/e2e/transparency-mode.spec.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T006) — CRITICAL, blocks both stories
3. Complete Phase 3: User Story 1 (T007–T013)
4. **STOP and VALIDATE**: Run `tests/e2e/transparency-mode.spec.js`'s US1 tests and the quickstart's "enable" steps independently
5. Demo: transparency mode can be turned on and works everywhere, persistently — this alone delivers the requested value (seeing the sky/clouds/flying objects through the UI)

### Incremental Delivery

1. Setup + Foundational → module and CSS hook ready
2. Add User Story 1 → test independently → demo (MVP: turning transparency on)
3. Add User Story 2 → test independently → demo (turning it back off cleanly)
4. Polish (Phase 5) → regression safety, lint/format, full quickstart pass

---

## Notes

- [P] tasks = different files or independent test blocks, no dependencies
- [Story] label maps task to specific user story (US1, US2) for traceability
- Verify each Playwright test fails before implementing the behavior it checks (T007–T009, T014–T015)
- Commit after each task or logical group, per existing repo convention
- Stop at the Phase 3 checkpoint to validate User Story 1 independently before starting User Story 2
- No task in this feature touches any SolarLog `.js` data file, `days_hist`/`months`/`years` aggregation, or the sync/backfill scripts — constitution Principles I and II are structurally unaffected
