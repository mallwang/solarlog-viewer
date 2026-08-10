# Tasks: Navigate to Parent Period

**Input**: Design documents from `/specs/008-navigate-parent-level/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/period-nav-markup.md](./contracts/period-nav-markup.md), [quickstart.md](./quickstart.md)

**Tests**: Included — the project constitution mandates Playwright e2e coverage with behavior + visual assertion for every UI change, and `period-nav.js` already has an established `node --test` unit-test convention this feature extends.

**Organization**: Tasks are grouped by user story (US1 = day→month, US2 = month→year, US3 = year→total) so each is independently implementable, testable, and deliverable per spec.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

Single static web app — paths are relative to repository root: `web/js/views/`, `web/i18n/`, `tests/e2e/`.

---

## Phase 1: Setup

**Purpose**: No new project scaffolding needed — this feature extends existing modules only. Nothing to do here.

_(No setup tasks — proceed directly to Foundational.)_

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared markup/derivation building blocks that all three user stories (day→month, month→year, year→total) depend on.

**⚠️ CRITICAL**: Must complete before any user story phase.

- [x] T001 Add `parentOfDay`, `parentOfMonth`, `parentOfYear` pure helper functions to [web/js/views/period-nav.js](../../web/js/views/period-nav.js), matching the existing `addDays`/`addMonths`/`addYears` JSDoc style (see [data-model.md](./data-model.md))
- [x] T002 Extend `periodNavMarkup()` in [web/js/views/period-nav.js](../../web/js/views/period-nav.js) with optional `parentHref`/`parentLabel` params: render an enabled `<a class="period-nav__link period-nav__link--parent">` when `parentLabel` is set, omit entirely otherwise (no disabled state — see [contracts/period-nav-markup.md](./contracts/period-nav-markup.md))
- [x] T003 [P] Add unit tests for `parentOfDay`/`parentOfMonth`/`parentOfYear` and the new `periodNavMarkup` parent-link branch to [web/js/views/period-nav.test.js](../../web/js/views/period-nav.test.js) (mirrors existing `addDays`/today-link test style)

**Checkpoint**: `node --test web/js/views/period-nav.test.js` passes; `periodNavMarkup`/helpers ready for all three view integrations below.

---

## Phase 3: User Story 1 - Day → Month (Priority: P1) 🎯 MVP

**Goal**: From the day view, a single click navigates to the month view containing that day.

**Independent Test**: Open any day view, click the new "go to month" control, confirm the app lands on the correct month view — deliverable and demoable with only this phase done.

### Tests for User Story 1

- [x] T004 [P] [US1] Add `day.parentLink` key ("Monat" / "Month") to [web/i18n/de.json](../../web/i18n/de.json) and [web/i18n/en.json](../../web/i18n/en.json), under the existing `day` section
- [x] T005 [US1] Create [tests/e2e/parent-nav.spec.js](../../tests/e2e/parent-nav.spec.js) with a day-view test: navigate to `#/day/2026/3/15`, assert a parent link is present with the correct month href, click it, assert the resulting view is the March 2026 month view (depends on T006)

### Implementation for User Story 1

- [x] T006 [US1] In [web/js/views/day-view.js](../../web/js/views/day-view.js), pass `parentHref: formatRoute({ view: 'month', params: parentOfDay(params) })` and `parentLabel: t('day.parentLink')` into the `periodNavMarkup()` call (depends on T001, T002, T004)

**Checkpoint**: Day view shows a working, always-enabled "go to month" link; `parent-nav.spec.js`'s day-view test passes; User Story 1 is independently shippable.

---

## Phase 4: User Story 2 - Month → Year (Priority: P2)

**Goal**: From the month view, a single click navigates to the year view containing that month.

**Independent Test**: Open any month view, click the "go to year" control, confirm the app lands on the correct year view — independent of US1's day view changes.

### Tests for User Story 2

- [x] T007 [P] [US2] Add `month.parentLink` key ("Jahr" / "Year") to [web/i18n/de.json](../../web/i18n/de.json) and [web/i18n/en.json](../../web/i18n/en.json), under the existing `month` section
- [x] T008 [US2] Add a month-view test to [tests/e2e/parent-nav.spec.js](../../tests/e2e/parent-nav.spec.js): navigate to `#/month/2026/3`, assert a parent link is present with the correct year href, click it, assert the resulting view is the 2026 year view (depends on T009)

### Implementation for User Story 2

- [x] T009 [US2] In [web/js/views/month-view.js](../../web/js/views/month-view.js), pass `parentHref: formatRoute({ view: 'year', params: parentOfMonth(params) })` and `parentLabel: t('month.parentLink')` into the `periodNavMarkup()` call (depends on T001, T002, T007)

**Checkpoint**: Month view shows a working "go to year" link; User Stories 1 AND 2 both work independently.

---

## Phase 5: User Story 3 - Year → Total (Priority: P3)

**Goal**: From the year view, a single click navigates to the all-time total/overview view.

**Independent Test**: Open any year view, click the "go to total" control, confirm the app lands on the total/overview view — independent of US1/US2.

### Tests for User Story 3

- [x] T010 [P] [US3] Add `year.parentLink` key ("Gesamt" / "Total") to [web/i18n/de.json](../../web/i18n/de.json) and [web/i18n/en.json](../../web/i18n/en.json), under the existing `year` section
- [x] T011 [US3] Add a year-view test to [tests/e2e/parent-nav.spec.js](../../tests/e2e/parent-nav.spec.js): navigate to `#/year/2026`, assert a parent link is present with the total-view href, click it, assert the resulting view is the total/overview view; plus a total-view test asserting NO parent link is rendered there (depends on T012)

### Implementation for User Story 3

- [x] T012 [US3] In [web/js/views/year-view.js](../../web/js/views/year-view.js), pass `parentHref: formatRoute({ view: 'total', params: {} })` and `parentLabel: t('year.parentLink')` into the `periodNavMarkup()` call (depends on T001, T002, T010)

**Checkpoint**: Year view shows a working "go to total" link, total view shows none; all three user stories independently functional — full feature complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cross-story verification and documentation cleanup.

- [x] T013 [P] Add a language-toggle assertion to [tests/e2e/parent-nav.spec.js](../../tests/e2e/parent-nav.spec.js) verifying parent-link labels switch DE ⇄ EN correctly (covers FR-007/SC-004; exercises day, month, and year links together)
- [x] T014 [P] Add a deep-link assertion to [tests/e2e/parent-nav.spec.js](../../tests/e2e/parent-nav.spec.js): load a day view directly via URL (no prior in-app navigation) and confirm the parent link still resolves correctly (covers spec.md Edge Cases / Acceptance Scenario 1.2)
- [x] T015 Run `npx eslint web/js/views/period-nav.js web/js/views/period-nav.test.js web/js/views/day-view.js web/js/views/month-view.js web/js/views/year-view.js` and fix any errors
- [x] T016 Run the full [quickstart.md](./quickstart.md) manual validation checklist end-to-end and confirm all steps pass

**Checkpoint**: Feature complete, tested (unit + e2e), linted, and manually validated per quickstart.md.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories (T001/T002 are shared by every story's implementation task).
- **User Story 1 (Phase 3)**: Depends on Phase 2 (T001, T002). No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Phase 2 (T001, T002). No dependency on US1/US3 — can run in parallel with Phase 3 if staffed.
- **User Story 3 (Phase 5)**: Depends on Phase 2 (T001, T002). No dependency on US1/US2 — can run in parallel with Phases 3–4 if staffed.
- **Polish (Phase 6)**: Depends on all three user stories being complete (T013/T014 exercise all three views together in one spec file).

### Within Each User Story

- i18n key task (T004/T007/T010) before the view-wiring task that calls `t()` with it (T006/T009/T012)
- View-wiring task before its e2e test task, since the e2e test exercises the wired behavior (T006→T005, T009→T008, T012→T011)

### Parallel Opportunities

- T001, T002 within Phase 2 are sequential (T002 is easiest to write once T001's helpers exist as reference, though they touch the same file — not parallelizable in practice despite no logical dependency; treat as sequential same-file edits)
- T003 (tests) can be written in parallel with T001/T002 as long as it's finalized after both land, per TDD note below
- Once Phase 2 lands, US1/US2/US3 phases (Phases 3–5) can proceed fully in parallel — each touches a disjoint view file and a disjoint i18n subsection
- T004, T007, T010 (i18n additions, different JSON subsections) are parallelizable with each other
- T013, T014 (Phase 6) are parallelizable with each other

---

## Parallel Example: Phase 2 (Foundational)

```bash
# T001 and T002 touch the same file (period-nav.js) — do sequentially.
# T003 (tests) can be drafted in parallel, finalized after T001+T002 land:
Task: "Add unit tests for parentOf* helpers and periodNavMarkup parent-link branch in web/js/views/period-nav.test.js"
```

## Parallel Example: User Stories (after Phase 2 checkpoint)

```bash
# Three developers, three disjoint view files:
Task: "US1 — wire day-view.js parent link"     # Phase 3
Task: "US2 — wire month-view.js parent link"   # Phase 4
Task: "US3 — wire year-view.js parent link"    # Phase 5
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001–T003)
2. Complete Phase 3: User Story 1 (T004–T006)
3. **STOP and VALIDATE**: `node --test web/js/views/period-nav.test.js` + `npx playwright test tests/e2e/parent-nav.spec.js --reporter=line`; manually verify day→month click per quickstart.md step 1
4. Deploy/demo if ready — day→month navigation alone already delivers the most commonly needed jump

### Incremental Delivery

1. Foundational → US1 (day→month) → validate → demo (MVP)
2. Add US2 (month→year) → validate → demo
3. Add US3 (year→total) → validate → demo
4. Phase 6 polish (language toggle + deep-link edge case + lint) → final validation via quickstart.md

---

## Notes

- [P] tasks touch different files or independent i18n subsections — no shared-file edit conflicts
- Total view ([total-view.js](../../web/js/views/total-view.js)) is intentionally never touched — FR-004 requires no parent control there, and `periodNavMarkup()` simply isn't called with parent fields for it
- Commit after each phase checkpoint, consistent with the project's existing per-feature commit pattern
- Stop at any user-story checkpoint to validate independently before continuing
