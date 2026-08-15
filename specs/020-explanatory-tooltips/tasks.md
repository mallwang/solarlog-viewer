---
description: 'Task list for Explanatory Tooltips implementation'
---

# Tasks: Explanatory Tooltips

**Input**: Design documents from `/specs/020-explanatory-tooltips/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/info-tooltip.md, quickstart.md

**Tests**: Included — plan.md's Technical Context and constitution's Testing standard both require a
`node --test` unit test and a Playwright spec for this feature; quickstart.md's "Automated checks"
section lists the exact commands that must pass.

**Organization**: Tasks are grouped by user story (spec.md P1/P2/P3) to enable independent
implementation and testing of each story, per FR/SC references in spec.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1/US2/US3)
- File paths are exact, relative to repository root

---

## Phase 1: Setup

**Purpose**: Confirm a clean baseline before touching shared code — this feature adds no new
dependency, no new directory, no build-tool change (plan.md Technical Context), so Setup is
limited to a pre-flight check.

- [x] T001 Run `npm run test:scripts`, `npx playwright test --reporter=line`, `npm run lint`, and
      `npm run format:check` on the unmodified branch to confirm a green baseline before starting
      (so any later failure is attributable to this feature's changes)

**Checkpoint**: Baseline confirmed green — safe to start Foundational work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The single shared mechanism (i18n explanation entries, `stats-panel.js` markup/CSS
contract, `initInfoTooltips()` wiring) that every user story's view-level integration and tests
depend on. Per research.md/contracts/info-tooltip.md, this is intentionally centralized so no user
story duplicates rendering/positioning logic (FR-006, US3).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Add `explanations.yieldEuro`, `explanations.soll`, `explanations.sollAuflaufend`,
      `explanations.ist`, `explanations.co2` (German wording, drafted from the actual calculation
      logic per data-model.md's table) to `web/i18n/de.json`
- [x] T003 [P] Add the same five `explanations.*` keys (English wording, same meaning) to
      `web/i18n/en.json`
- [x] T004 [P] Write `node --test` unit tests in `web/js/views/stats-panel.test.js` for the
      extended `statsRow()`/`statsPanelMarkup()` contract (contracts/info-tooltip.md): a 2-element
      row renders byte-identical markup to today's output (no `.info-trigger`); a 3-element row
      renders a `<button class="info-trigger">` with `aria-describedby` pointing at a
      `role="tooltip"` element containing the resolved explanation text; two rows in the same panel
      each get a distinct generated DOM id. Tests MUST fail against the current implementation
      before T005 lands.
- [x] T005 Implement the extended contract in `web/js/views/stats-panel.js`: add an internal
      `infoTooltipMarkup(explanationKey)` helper, extend `statsRow(labelKey, value,
explanationKey)` to call it only when `explanationKey` is present, and update
      `statsPanelMarkup()`'s JSDoc for the new `[labelKey, value, explanationKey]` triple shape
      (depends on T002, T003, T004 failing first)
- [x] T006 [P] Add CSS rules to `web/css/app.css` per contracts/info-tooltip.md's CSS contract
      table: `.stat-label` flex wrapper, `.info-trigger` (`display: none` by default, `inline-flex`
      only inside `@media (hover: hover) and (pointer: fine)`), `.info-trigger:hover
.info-tooltip`/`.info-trigger:focus-visible .info-tooltip` reveal rules, `.info-tooltip`
      floating-callout styling (existing colour/spacing/radius custom properties only, per
      constitution Technical Standards), and the `.info-trigger--flip .info-tooltip` right-anchored
      modifier — reusing `mockup.html`'s approved visual treatment
- [x] T007 Implement and export `initInfoTooltips()` in `web/js/views/stats-panel.js`: a single
      delegated `focusin`/`pointerenter` listener that measures an about-to-show `.info-tooltip`'s
      projected right edge against `window.innerWidth` and toggles `.info-trigger--flip` (FR-007;
      depends on T005)
- [x] T008 Call `initInfoTooltips()` once during startup in `web/js/main.js`, alongside the other
      one-time `init*` calls (e.g. `initTransparencyMode`) — not from any view's `render()`
      (depends on T007)

**Checkpoint**: Foundation ready — `stats-panel.js` accepts explanation keys, CSS reveals/hides/
flips tooltips, and `initInfoTooltips()` is wired. No view yet passes an `explanationKey`, so
behavior is unchanged end-to-end until Phase 3.

---

## Phase 3: User Story 1 - Understand a figure's calculation on desktop (Priority: P1) 🎯 MVP

**Goal**: A desktop visitor hovering (or keyboard-focusing) the info icon next to an annotated stat
sees a tooltip with wording specific to that stat's real calculation, on every view that shows one
of the five initial stats.

**Independent Test**: Load the month view's "Soll (auflaufend)" tile on a desktop-sized viewport,
hover the information icon, and confirm an explanatory tooltip appears with accurate, stat-specific
content and disappears on mouse-out (spec.md's Independent Test for US1).

### Implementation for User Story 1

- [x] T009 [P] [US1] In `web/js/views/day-view.js`'s `dayStatsRows()`, add a third tuple element to
      the `day.stats.yieldEuro` row (`'explanations.yieldEuro'`), `day.stats.soll` row
      (`'explanations.soll'`), `day.stats.ist` row (`'explanations.ist'`), and `day.stats.co2` row
      (`'explanations.co2'`)
- [x] T010 [P] [US1] In `web/js/views/month-view.js`'s `monthStatsRows()`, add a third tuple
      element to the `month.stats.yieldEuro` row (`'explanations.yieldEuro'`), the conditional
      Soll row (`'explanations.sollAuflaufend'` when `isCurrentMonth`, else `'explanations.soll'`),
      the `month.stats.ist` row (`'explanations.ist'`), and the `month.stats.co2` row
      (`'explanations.co2'`)
- [x] T011 [P] [US1] In `web/js/views/year-view.js`'s `yearStatsRows()`, add a third tuple element
      to the `year.stats.yieldEuro` row (`'explanations.yieldEuro'`), the conditional Soll row
      (`'explanations.sollAuflaufend'` when `isCurrentYear`, else `'explanations.soll'`), the
      `year.stats.ist` row (`'explanations.ist'`), and the `year.stats.co2` row
      (`'explanations.co2'`)
- [x] T012 [P] [US1] In `web/js/views/total-view.js`'s `totalStatsRows()`, add a third tuple
      element to the `total.stats.yieldEuro` row (`'explanations.yieldEuro'`), the
      `total.stats.sollTotal` row (`'explanations.soll'`), the `total.stats.ist` row
      (`'explanations.ist'`), and the `total.stats.co2` row (`'explanations.co2'`)
- [x] T013 [P] [US1] In `web/js/views/welcome-view.js`'s `renderStats()`, add a third tuple element
      (`'explanations.co2'`) to the `total.stats.co2` row
- [x] T014 [US1] Add a Playwright test in `tests/e2e/explanatory-tooltips.spec.js` for hover-reveal
      (quickstart Scenario 1): navigate to a month view with data, hover the info icon next to
      "Monatsertrag in €", assert the tooltip text matches the yield×tariff explanation (not a
      Soll/Ist/CO2 message), then move the pointer off and assert the tooltip disappears; repeat
      for "Soll (auflaufend)", "Ist", "Vermiedenes CO2" on the month panel and "Tagesertrag in €"
      on a day view (depends on T009-T013)
- [x] T015 [US1] Add a Playwright test in `tests/e2e/explanatory-tooltips.spec.js` for
      keyboard-focus reveal (quickstart Scenario 2, FR-008/SC-005): Tab to an info icon, assert the
      same tooltip becomes visible on focus without moving the mouse, then Tab away and assert it
      disappears (depends on T009-T013)
- [x] T016 [US1] Add a Playwright test in `tests/e2e/explanatory-tooltips.spec.js` for the
      viewport-edge flip (quickstart Scenario 4, FR-007/SC-004): narrow the browser window (or pick
      an icon near the right edge, e.g. "Ist"/"Vermiedenes CO2"), hover it, and assert the tooltip
      stays fully within the viewport (right-anchored via `.info-trigger--flip`) rather than being
      clipped (depends on T007, T009-T013)

**Checkpoint**: User Story 1 is fully functional and independently testable — desktop hover/focus
reveals accurate, stat-specific tooltips for all five initial stats across every view, staying
on-screen near edges.

---

## Phase 4: User Story 2 - No tooltip clutter on mobile (Priority: P2)

**Goal**: On touch-only viewports, no information icon or tooltip is rendered anywhere, and the
stats-panel layout is pixel-identical to a stat with no explanation registered.

**Independent Test**: Load the same annotated month view at a mobile/touch-emulated viewport width
and confirm no hover-triggered tooltip UI appears or interferes with tapping/scrolling (spec.md's
Independent Test for US2).

### Implementation for User Story 2

- [x] T017 [US2] Add a Playwright test in `tests/e2e/explanatory-tooltips.spec.js`, using a
      touch-emulated device profile (`(hover: none)`, e.g. Playwright's `devices['iPhone 14']`),
      for quickstart Scenario 3 (User Story 2, SC-002): load the same annotated month view, assert
      no `.info-trigger` element is visible anywhere in the stats panel, assert the annotated row's
      rendered height/width matches an unannotated row (no layout footprint per FR-004/FR-009), and
      assert normal tap/scroll interaction on the page is unaffected (depends on T006, T009-T013)

**Checkpoint**: User Stories 1 AND 2 both work independently — desktop keeps full tooltip
functionality, touch viewports stay exactly as clean as before this feature.

---

## Phase 5: User Story 3 - Add a new explained stat later (Priority: P3)

**Goal**: A developer can register a new explanation entry in the central i18n definition and get
a working icon/tooltip on that stat's row with zero changes to shared rendering/positioning code,
and shared explanation text (e.g. "Soll") stays in sync across every view that references it.

**Independent Test**: Add one new stat + explanation entry to `web/i18n/*.json`, reference it from
an existing row tuple, and confirm it renders with a working icon and tooltip using the same visual
style/behavior as the existing five, with no changes to `stats-panel.js` (spec.md's Independent
Test for US3).

### Implementation for User Story 3

- [x] T018 [P] [US3] Add a `node --test` unit test to `web/js/views/stats-panel.test.js` asserting
      the extensibility contract (US3 Acceptance Scenario 1): a `statsPanelMarkup()` call with a
      row tuple carrying an arbitrary, previously-unseen `explanationKey` (not one of the five
      initial keys) renders a working info-trigger/tooltip pair — proving `stats-panel.js` contains
      no hardcoded list of explanation keys
- [x] T019 [P] [US3] Add a `node --test` unit test to `web/js/views/stats-panel.test.js` asserting
      US3 Acceptance Scenario 2: two separate `statsPanelMarkup()` calls (simulating day view's
      "Soll" and month view's "Soll") that both pass `'explanations.soll'` each render their own
      independent info-trigger/tooltip markup reading the same resolved text, with distinct
      generated DOM ids (no id collision across panels)
- [x] T020 [US3] Manually perform quickstart.md Scenario 5's validation drill (add
      `explanations.maxDaily` to `web/i18n/de.json`/`en.json`, wire it onto month-view's
      "Maximalwert" row, reload, confirm the icon/tooltip work with zero `stats-panel.js` changes,
      then revert the drill change) to confirm SC-003 end-to-end; not a permanent code change
      (depends on T005-T008)
- [x] T021 [US3] Document the "add a new explanation" process (central i18n key → row-tuple third
      element, no rendering-code change needed) in `README.md` and `README.de.md`, referencing
      `web/js/views/stats-panel.js` and the `explanations.*` i18n namespace

**Checkpoint**: All three user stories are independently functional — the extension point is proven
by an automated regression test, not just today's five entries.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final validation across all user stories.

- [x] T022 [P] Update `user-guide/user-guide.md` and `user-guide/user-guide.de.md` to mention the
      new info-icon tooltips (what they are, hover/keyboard access, desktop-only) alongside the
      existing stats-panel documentation
- [x] T023 [P] Confirm JSDoc is complete and accurate on every new/modified exported function
      (`statsPanelMarkup()`, `initInfoTooltips()` in `stats-panel.js`; updated row-builder functions
      in day/month/year/total/welcome-view.js) per constitution Documentation Standards
- [x] T024 Run `npx eslint web/js/views/stats-panel.js web/js/views/stats-panel.test.js
web/js/views/day-view.js web/js/views/month-view.js web/js/views/year-view.js
web/js/views/total-view.js web/js/views/welcome-view.js web/js/main.js
tests/e2e/explanatory-tooltips.spec.js` and fix all errors and SonarLint warnings
- [x] T025 Run the full quickstart.md validation: all 5 manual scenarios plus `node --test
web/js/views/stats-panel.test.js`, `npx playwright test tests/e2e/explanatory-tooltips.spec.js
--reporter=line`, `npm run lint`, `npm run format:check` — all MUST pass (constitution
      Development Workflow §3/§5)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run first.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories — no view can pass an
  `explanationKey` until `stats-panel.js`/CSS/`initInfoTooltips()` exist.
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational and on at least one view carrying an
  `explanationKey` to test against (T009-T013 from US1) — the CSS itself (T006) is foundational,
  but the test needs an annotated row to point at.
- **User Story 3 (Phase 5)**: Depends on Foundational (T005-T008); independent of US1/US2's
  Playwright tests, though T021's documentation reads more naturally after US1 ships.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependency on US2/US3 — can ship alone as the MVP.
- **User Story 2 (P2)**: Its test (T017) needs an annotated row to exist, so run after T009-T013
  land (in practice, after starting US1), even though the omission behavior itself (T006) is
  foundational and pre-existing rows are already unaffected.
- **User Story 3 (P3)**: Independently testable via synthetic explanation keys (T018-T019); the
  manual drill (T020) and docs (T021) don't require US1/US2 to be finished, but are more legible
  once at least one real explanation is visible in the app.

### Within Each User Story

- Tests before/alongside implementation where the contract is being newly established
  (Foundational T004 before T005).
- Row-tuple wiring (T009-T013) before the Playwright tests that exercise it (T014-T016, T017).

### Parallel Opportunities

- T002 and T003 (DE/EN i18n files) — different files.
- T004 and T006 — different files (test file vs. CSS), both depend only on T002/T003 conceptually
  but not on each other.
- T009-T013 (day/month/year/total/welcome row wiring) — five different files, fully parallel.
- T018 and T019 — same test file but independent test cases; parallelizable if written as separate
  edits merged together, otherwise run sequentially in the same file.
- T022 and T023 — different files (user-guide vs. JSDoc-only review).

---

## Parallel Example: Foundational Phase

```bash
# i18n keys (different files):
Task: "Add explanations.* keys (DE) to web/i18n/de.json"
Task: "Add explanations.* keys (EN) to web/i18n/en.json"

# After i18n keys land, contract test + CSS (different files):
Task: "Write node --test unit tests for extended statsRow()/statsPanelMarkup() in web/js/views/stats-panel.test.js"
Task: "Add CSS rules for .info-trigger/.info-tooltip to web/css/app.css"
```

## Parallel Example: User Story 1 row wiring

```bash
Task: "Add explanationKey to dayStatsRows() in web/js/views/day-view.js"
Task: "Add explanationKey to monthStatsRows() in web/js/views/month-view.js"
Task: "Add explanationKey to yearStatsRows() in web/js/views/year-view.js"
Task: "Add explanationKey to totalStatsRows() in web/js/views/total-view.js"
Task: "Add explanationKey to renderStats() in web/js/views/welcome-view.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: hover/focus every one of the five stats across day/month/year/total/
   welcome views and confirm accurate, stat-specific, on-screen tooltips
5. Ship — User Story 1 alone already delivers the feature's entire end-user value (spec.md: "This
   is the entire feature — without it there is nothing to test or ship")

### Incremental Delivery

1. Setup + Foundational → shared mechanism ready, behavior unchanged
2. Add User Story 1 → validate independently → ship (MVP)
3. Add User Story 2 → validate independently → ship (mobile guardrail confirmed, not just assumed)
4. Add User Story 3 → validate independently → ship (extensibility proven by regression test)
5. Polish → documentation + final quickstart validation

---

## Notes

- [P] tasks touch different files and have no unmet dependency at the time they'd run.
- [Story] labels map every Phase 3+ task to spec.md's US1/US2/US3 for traceability.
- Foundational Phase 2 is unusually large relative to the user-story phases because this feature's
  architecture (per plan.md/research.md) deliberately centralizes all rendering/positioning logic
  in one module — the user-story phases are almost entirely per-view wiring and tests, matching
  User Story 3's explicit "no changes to shared tooltip rendering code" requirement.
- Verify contract tests (T004) fail before implementing T005.
- Commit after each task or logical group.
- Stop at any checkpoint to validate a story independently before continuing.
</content>
