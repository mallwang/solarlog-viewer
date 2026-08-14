---
description: 'Task list for Ereignisse (Events) Datatable'
---

# Tasks: Ereignisse (Events) Datatable

**Input**: Design documents from `/specs/016-events-datatable/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/events.md, quickstart.md

**Tests**: Included — plan.md's Testing section and constitution's Testing standard require
`node --test` coverage for every new pure function and a Playwright spec for the visible page;
this is an explicit requirement of this feature, not the template's optional default.

**Organization**: Tasks are grouped by user story (US1 browse, US2 filter, US3 sort) per spec.md's
priorities, so each can be implemented and independently verified in order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps task to US1/US2/US3
- File paths are exact, from plan.md's Project Structure

## Path Conventions

Single static web app — `web/js/data/`, `web/js/views/`, `web/css/`, `web/i18n/`, `tests/e2e/` at
repository root (see plan.md's Project Structure; no frontend/backend split in this repo).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Nothing new to initialize — no new dependency, no new directory. This phase is
intentionally empty beyond confirming the branch is ready.

- [ ] T001 Confirm on branch `016-events-datatable` with a clean working tree (`git status`) before
      starting implementation.

**Checkpoint**: Ready to start Foundational phase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared data layer every user story's rendering depends on — per-inverter status/
error code lists from `base_vars.js`, and the parse/merge/dedupe/enrich pipeline for the event
files themselves. No UI work can start until these exist and pass their tests.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 [P] Extend `parseBaseVars()` in `web/js/data/plant.js` to also return `statusCodes:
    string[][]` and `errorCodes: string[][]`, parsed from `StatusCodes[i] = "..."` /
      `FehlerCodes[i] = "..."` lines per research.md R2 (regex
      `/^(StatusCodes|FehlerCodes)\[(\d+)]\s*=\s*"([^"]*)"/`, comma-split, missing index → `[]`
      never `undefined`). Update the function's JSDoc return type to match contracts/events.md.
- [ ] T003 [P] Add cases to `web/js/data/plant.test.js` for the new `statusCodes`/`errorCodes`
      fields: matches fixture `StatusCodes[0]`/`StatusCodes[1]`/`FehlerCodes[0]`/`FehlerCodes[1]`
      lines, and a missing-inverter-index case returns `[]` not `undefined`.
- [ ] T004 [US-shared] Create `web/js/data/events.js` implementing, per contracts/events.md:
      `parseEventLine(line)` (5-field split, returns `null` for malformed per FR-009),
      `parseEventsFile(fileText)` (calls `extractAssignedStrings` from `web/js/data/parse-
    lines.js` + `parseEventLine`, filtering `null`s), `mergeAndDedupeEvents(historyRecords,
    todayRecords)` (exact-string dedup on `dedupeKey`, research.md R5), and
      `enrichEvent(rawRecord, codes)` (timestamp parsing per research.md R4, `isOngoing`/
      `durationMs` derivation, `resolveStatusLabel`/`resolveErrorLabel` fallback logic per
      research.md R3, producing the `Event` shape in data-model.md). Depends on T002 for the
      `codes` shape `enrichEvent` consumes.
- [ ] T005 [P] [US-shared] Create `web/js/data/events.test.js` covering (per quickstart.md):
      `parseEventLine`/`parseEventsFile` valid + malformed lines (FR-009); `mergeAndDedupeEvents`
      dedupes a line duplicated across both fixture files (FR-008); `enrichEvent` for an ongoing
      event (`end: null`), an out-of-range status code → `"Offline"` (FR-010), error code `0` →
      `null` (no error), and a genuinely unknown error code → `errorRawCode` set. Write these
      tests to fail first, then implement T004 against them (or iterate together — same phase).

**Checkpoint**: `node --test web/js/data/events.test.js web/js/data/plant.test.js` all pass.
Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Browse the inverter event log (Priority: P1) 🎯 MVP

**Goal**: Open the Ereignisse page and see every event from both source files as one readable,
deduplicated table, most-recent first, with ongoing/fallback handling — no filter or sort
interaction yet (defaults only).

**Independent Test**: Open the Ereignisse page with no filters applied and confirm every event
from `events.js` and `events_day.js` appears as one row with a human-readable start time, end
time (or "ongoing"), inverter label, status description, and error description.

### Implementation for User Story 1

- [ ] T006 [US1] Add the `#/events` route to `web/js/router.js`: `parseRoute` recognizes
      `'events'` with no params (mirrors the existing `'total'` branch, research.md R8);
      `formatRoute` adds the `case 'events': return '#/events';` branch.
- [ ] T007 [US1] Add new `events` i18n namespace + `nav.eventsView` key to `web/i18n/de.json`
      ("Ereignisse" nav label, table column headers, ongoing/no-error/offline/unknown-code
      fallback copy, empty-state copy) per design.md's approved layout and contracts/events.md's
      i18n contract.
- [ ] T008 [P] [US1] Add the matching English key set to `web/i18n/en.json` (same structure as
      T007, English copy) — key sets MUST match exactly between the two files.
- [ ] T009 [US1] Create `web/js/views/events-view.js` with `export async function render(container,
    { plant, route })`: fetches `data/events.js` + `data/events_day.js` via `fetchText`
      (independently — one failing must not block the other, per contracts/events.md), parses via
      `parseEventsFile`, merges via `mergeAndDedupeEvents`, enriches every record via `enrichEvent`
      using `plant.statusCodes`/`plant.errorCodes`, applies the default sort (`{ column: 'start',
    direction: 'desc' }`, FR-004), and renders the table markup: Von–Bis (combined start/end,
      same-day end shows time-of-day only per design.md), WR (colored dot per inverter), Dauer,
      Status (colored pill), Fehler (dash for no-error, red bold for an error, "Code N
      (unbekannt)" for `errorRawCode`), ongoing "aktiv" pulsing badge for `isOngoing` events. Reuse
      `emptyStateMarkup` from `web/js/views/empty-state.js` for the zero-events-total case (Edge
      Case: fresh install). No filter bar or sort interaction yet — this task only needs the
      static, default-sorted, non-interactive table to satisfy US1's Independent Test.
- [ ] T010 [US1] Register the new view in `web/js/main.js`: add `events: () =>
    import('./views/events-view.js')` to `viewModules`, and add `{ view: 'events', labelKey:
    'nav.eventsView', icon: '<existing icon name>', params: {} }` to `NAV_ITEMS` positioned
      after "Gesamt" (Total) per research.md R8.
- [ ] T011 [P] [US1] Add `.events-page`/`.events-table`/status-pill/ongoing-badge styles to
      `web/css/app.css` for what Tailwind utilities don't cover (sticky header, status pill color
      buckets, ongoing-badge pulse animation, respecting `prefers-reduced-motion` per design.md).
- [ ] T012 [P] [US1] Create `web/js/views/events-view.test.js` with initial coverage for any pure
      helper factored out of `render` for row-markup construction (if extracted) — full
      filter/sort helper coverage is added in later phases; this task only covers what US1
      introduces (e.g. row/label formatting helpers).
- [ ] T013 [US1] Create `tests/e2e/events-view.spec.js` with the first two Playwright scenarios
      from contracts/events.md: (1) navigating to `#/events` renders a table with rows, (2) the
      event with a blank end time (per quickstart.md, `events_day.js`'s last line) shows the
      ongoing indicator, not a blank cell.

**Checkpoint**: `node --test web/js/data/events.test.js web/js/data/plant.test.js
web/js/views/events-view.test.js` and `npx playwright test tests/e2e/events-view.spec.js
--reporter=line` pass. User Story 1 is fully functional and independently testable — the page is
reachable from nav, shows every event, most-recent first, with ongoing/fallback handling.

---

## Phase 4: User Story 2 - Filter the event log (Priority: P2)

**Goal**: Add the filter bar (inverter/day/status/error) with active-filter chips and a clear-
filters button, narrowing the rendered table without changing the underlying merged/enriched
event list.

**Independent Test**: With the full event list loaded, apply an inverter filter and confirm only
that inverter's events remain; apply a day filter and confirm only events overlapping that day
remain; apply a status or error filter and confirm only matching events remain. Filters can be
combined and cleared independently.

### Implementation for User Story 2

- [ ] T014 [P] [US2] Add `export function filterEvents(events, filters)` and `export function
    buildFilterOptions(events)` to `web/js/views/events-view.js` per contracts/events.md's exact
      signatures — pure, DOM-free (`FilterState` shape from data-model.md: `inverter`, `day`,
      `status`, `error`, each `'all'` or a specific value; `buildFilterOptions` narrows each
      dimension's available options to what's present in the _currently filtered_ set, per User
      Story 2 acceptance scenario 1).
- [ ] T015 [P] [US2] Add cases to `web/js/views/events-view.test.js` for `filterEvents` (each
      dimension in isolation, combined, and the day-match rule — event's start or end date equals
      `filter.day`) and `buildFilterOptions` (options narrow correctly when another filter is
      active; de-duplicated; `days` most-recent-first; `inverters` ascending).
- [ ] T016 [US2] Wire the filter bar into `events-view.js`'s `render()`: four labeled dropdowns
      (Wechselrichter/Tag/Status/Fehler) in a row that wraps on narrow viewports, a "Filter
      zurücksetzen" button right-aligned, and a title-row live count (`401 Ereignisse` / `18 von
    401 Ereignissen`) per design.md. Selecting a dropdown value updates in-memory `FilterState`,
      re-renders the table via `filterEvents`, and re-derives the other dropdowns' options via
      `buildFilterOptions` (resetting a now-invalid selection to `'all'` per data-model.md's State
      transitions). Depends on T009, T014.
- [ ] T017 [US2] Add active-filter pill chips directly under the filter bar (one per active
      filter dimension, each independently removable, e.g. `WR2 ✕`) per design.md — clicking a
      chip's ✕ resets just that `FilterState` field to `'all'` and re-renders.
- [ ] T018 [US2] Add the empty-state branch: when the active filters match zero events, replace
      the table with the centered "Keine Ereignisse gefunden" message + hint to clear filters
      (design.md, reusing `emptyStateMarkup` conventions), instead of an empty `<table>`.
- [ ] T019 [US2] Extend `tests/e2e/events-view.spec.js` with contracts/events.md scenarios 3 and 5:
      selecting an inverter filter narrows visible rows to that inverter only; a filter
      combination with zero matches shows the empty state.

**Checkpoint**: All Phase 4 tests pass. User Stories 1 AND 2 both work independently — filtering
narrows the table, chips/clear-button work, empty state renders correctly.

---

## Phase 5: User Story 3 - Sort the event log by column (Priority: P3)

**Goal**: Make the Von–Bis, WR, and Dauer column headers clickable to sort (and re-sort/toggle),
applied only within the currently filtered set.

**Independent Test**: With the event list loaded, click each sortable column header in turn and
confirm the row order changes accordingly and toggles between ascending/descending.

### Implementation for User Story 3

- [ ] T020 [P] [US3] Add `export function sortEvents(events, sort)` to `web/js/views/events-
    view.js` per contracts/events.md — pure, stable, never mutates input; `SortState` shape from
      data-model.md (`column: 'start' | 'inverter' | 'duration'`, `direction: 'asc' | 'desc'`).
- [ ] T021 [P] [US3] Add cases to `web/js/views/events-view.test.js` for `sortEvents`: each column
      ascending/descending, stability on equal keys, sorting `inverterIdx` and `durationMs`
      correctly including `durationMs === null` (ongoing) events' placement.
- [ ] T022 [US3] Wire sortable column headers (Von–Bis, WR, Dauer) into `events-view.js`'s table
      render: click toggles `direction` on the same column, switches `column` + resets to the
      per-column default direction on a different column (`'desc'` for start/duration, `'asc'`
      for inverter, per data-model.md), shows a direction-arrow glyph in the active header, and
      re-renders via `sortEvents` applied to the _already-filtered_ set (US3 acceptance scenario
      3 — sort never changes which rows are included). Depends on T009, T016, T020.
- [ ] T023 [US3] Extend `tests/e2e/events-view.spec.js` with contracts/events.md scenario 4:
      clicking a sortable column header changes row order, clicking again reverses it.

**Checkpoint**: All three user stories independently functional — browse, filter, and sort all
work together without interfering (filter narrows, sort reorders only within that narrowed set).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Constitution-required documentation, the remaining Playwright scenario (mobile
viewport), and final verification.

- [ ] T024 [P] Add the mobile-viewport Playwright scenario (contracts/events.md scenario 6) to
      `tests/e2e/events-view.spec.js`: filter bar wraps, table remains reachable via horizontal
      scroll inside its own container, no horizontal _page_ scroll (constitution Principle IV).
- [ ] T025 [P] Update `README.md` and `README.de.md` to document the new Ereignisse page (plan.md
      Documentation Standards, quickstart.md's constitution checklist).
- [ ] T026 [P] Update `docs/user-guide.md` and `docs/user-guide.de.md` with how to reach the
      Ereignisse page and its filter/sort behavior.
- [ ] T027 Run `npm run lint` and `npm run format:check`; fix any errors (quickstart.md's
      constitution/documentation checklist).
- [ ] T028 Run the full quickstart.md validation: all `node --test` files, the full
      `tests/e2e/events-view.spec.js` Playwright suite, and the manual walkthrough steps for all
      three user stories.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories (events-view.js needs
  `parseEventsFile`/`mergeAndDedupeEvents`/`enrichEvent` from `web/js/data/events.js`, and
  `plant.statusCodes`/`plant.errorCodes` from the extended `parseBaseVars`).
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational + US1's `render()`/table markup existing
  (T009) to attach the filter bar to — not independently implementable before US1's table exists,
  though its pure `filterEvents`/`buildFilterOptions` functions (T014) have no such dependency and
  can be written in parallel with US1.
- **User Story 3 (Phase 5)**: Depends on Foundational + US1's table (T009) and, for the click-
  wiring task (T022), US2's filter re-render path (T016) since sort must apply within the
  filtered set. `sortEvents` itself (T020) is pure and can be written in parallel with US1/US2.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Foundational only.
- **US2 (P2)**: Foundational + US1's rendered table to filter (integration point: T009). Pure
  logic (T014/T015) is independent and parallelizable.
- **US3 (P3)**: Foundational + US1's rendered table (integration point: T009) + US2's filtered-set
  re-render (integration point: T016, for T022 only). Pure logic (T020/T021) is independent and
  parallelizable.

### Within Each User Story

- Pure logic functions before their wiring into `render()`.
- Tests alongside/before their corresponding implementation task (constitution Testing standard).
- Story's own Playwright scenarios added last, once its interactive behavior exists.

### Parallel Opportunities

- T002/T003 (plant.js) can run in parallel with T004/T005 (events.js) — different files, T004
  only needs T002's _shape_, not its implementation, to write against the contract.
- T007/T008 (de.json/en.json) are parallelizable with each other and with T006 (router.js).
- T011 (CSS) is parallelizable with T009/T010/T012 (different files).
- T014/T015 (filterEvents/buildFilterOptions + tests) and T020/T021 (sortEvents + tests) are pure
  and parallelizable with each other and with US1's Phase 3 tasks, even though their _wiring_
  tasks (T016, T022) must wait for T009.
- T024/T025/T026 (Polish phase docs/tests) are parallelizable with each other.

---

## Parallel Example: Foundational Phase

```bash
# Launch in parallel — different files:
Task: "Extend parseBaseVars() in web/js/data/plant.js with statusCodes/errorCodes (T002)"
Task: "Create web/js/data/events.js with parse/merge/enrich functions (T004)"
```

## Parallel Example: User Story 2

```bash
# Pure logic can be written before or alongside US1's wiring task (T009):
Task: "Add filterEvents/buildFilterOptions to events-view.js (T014)"
Task: "Add filterEvents/buildFilterOptions test cases (T015)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (trivial).
2. Complete Phase 2: Foundational — data layer (`events.js`, extended `plant.js`) with full
   `node --test` coverage.
3. Complete Phase 3: User Story 1 — route, nav entry, static default-sorted table, i18n, CSS,
   first two Playwright scenarios.
4. **STOP and VALIDATE**: Open `#/events`, confirm every event renders correctly including the
   ongoing badge and fallback labels (quickstart.md's User Story 1 manual walkthrough).
5. This is a shippable increment: a read-only, correctly decoded event log, even without
   filter/sort.

### Incremental Delivery

1. Setup + Foundational → data layer proven correct in isolation.
2. - User Story 1 → deploy/demo (MVP: browsable event log).
3. - User Story 2 → deploy/demo (filterable — the legacy page's core diagnostic value).
4. - User Story 3 → deploy/demo (sortable — convenience on top).
5. - Polish → mobile Playwright scenario, README/user-guide updates, lint/format clean, full
     quickstart.md validation.

---

## Notes

- [P] tasks touch different files with no completed-task dependency between them.
- [Story] labels map every Phase 3+ task to US1/US2/US3 for traceability back to spec.md.
- This feature reuses two existing modules unchanged: `web/js/data/parse-lines.js`
  (`extractAssignedStrings`, research.md R1) and `web/js/views/empty-state.js`
  (`emptyStateMarkup`) — no task recreates them.
- Commit after each task or logical group, per this repo's existing convention.
- Stop at any Checkpoint to validate a story independently before continuing.
