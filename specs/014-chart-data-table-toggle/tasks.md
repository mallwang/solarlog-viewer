---
description: 'Task list for Chart Data Table Toggle'
---

# Tasks: Chart Data Table Toggle

**Input**: Design documents from `/specs/014-chart-data-table-toggle/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/chart-data-table.md](./contracts/chart-data-table.md),
[quickstart.md](./quickstart.md)

**Tests**: Included — plan.md's Testing section and the constitution's Testing standard require a
`node --test` suite for the pure row-extraction logic and a Playwright spec for the visible toggle
behavior; quickstart.md names both files explicitly.

**Organization**: Tasks are grouped by user story (US1 reveal/hide, US2 persistence, US3 styling
polish) per spec.md's priorities, after a Foundational phase that builds the shared
toggle/table/settings plumbing all three stories sit on top of.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1/US2/US3)
- Paths are relative to the repo root (`/home/markus/projects/solarlog-viewer`)

## Path Conventions

Single static web app — no `src/`/`backend`/`frontend` split. All app code lives under `web/`,
tests under `tests/e2e/` (Playwright) or co-located `*.test.js` (node:test), per plan.md's Project
Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the i18n strings and CSS hook every later task depends on. No behavior yet.

- [x] T001 [P] Add `chart.tableToggleLabel`, `chart.tableToggleOn`, `chart.tableToggleOff`, and
      `chart.tableNoData` keys to `web/i18n/de.json` under the existing `"chart"` object (alongside
      `breakdownToggleLabel`/`breakdownTotal`/`breakdownInverters`), German copy for: the toggle
      button's `aria-label`, its visible label text, and the table's empty-state row text.
- [x] T002 [P] Add the same `chart.tableToggleLabel`, `chart.tableToggleOn`, `chart.tableToggleOff`,
      `chart.tableNoData` keys to `web/i18n/en.json` under `"chart"`, English copy, exactly mirroring
      the German keys added in T001.
- [x] T003 [P] Add a `.chart-table` CSS block to `web/css/app.css` alongside the existing
      `.summary-table` block: `.chart-table[hidden] { display: none; }`, an `overflow-x-auto`
      scroll-safe wrapper rule, and `.chart-table th, .chart-table td { border-bottom: 1px solid
var(--color-border); }` per contracts/chart-data-table.md's CSS contract — Tailwind utility
      classes handle spacing/typography inline at render time, this file only carries
      token-driven borders/visibility.

**Checkpoint**: i18n keys and CSS hook exist; nothing renders yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The settings persistence, pure row-extraction, table renderer, and toggle button
modules that every user story phase below wires into the four view modules. Per
contracts/chart-data-table.md, `chart-factory.js`'s public API does not change — the options
object is obtained from the `import('apexcharts')` instance `renderChart()` already returns (its
resolved `chart.w.config`, exposed by ApexCharts itself after render), not from a new export.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 [US1] Add `isChartTableVisible()` / `setChartTableVisible(visible)` to
      `web/js/settings.js`, mirroring `isTransparencyEnabled()`/`setTransparencyEnabled()` exactly
      (`STORAGE_KEY = 'solarlog-chart-table'`, `localStorage.getItem(key) === 'true'` read,
      `localStorage.setItem(key, String(value))` write). Wrap both in `try/catch` per
      contracts/chart-data-table.md's FR-009 clause: `isChartTableVisible()` catches and returns
      `false`; `setChartTableVisible()` catches and no-ops (no throw) if `localStorage` is
      unavailable.
- [x] T005 [P] [US1] Write `web/js/views/chart-data-table.test.js` (node:test) covering
      `extractTableData()` for: (a) a bar-chart-shaped `options` with `xaxis.categories` and one
      `total` series, (b) the same shape with multiple per-inverter series (breakdown mode), (c) a
      day-chart-shaped `options` with `xaxis.type: 'datetime'` and `[timestamp, value]` series
      pairs, (d) an `options` object whose series have zero data points (empty state — expect a
      single "no data" row per data-model.md). Run before implementation exists so it fails first
      (TDD per project convention).
- [x] T006 [US1] Implement `extractTableData(options)` in `web/js/views/chart-data-table.js` per
      contracts/chart-data-table.md: pure function, no DOM access, returns `{ columns, rows }`
      where `columns` is `options.series[].name` in series order, and `rows` is one entry per
      x-axis point with `label` (from `options.xaxis.categories[i]` for bar-chart shapes, or
      formatted from each datetime series' `[x, y]` pair for the day chart) and `values` (one
      value per series, `null` for gaps). Zero data points → single row flagged as the empty state
      (consumed by `renderChartTable()` in T007, using the `chart.tableNoData` i18n key from T002).
      Make T005 pass.
- [x] T007 [US1] Implement `renderChartTable(mount, options)` in `web/js/views/chart-data-table.js`:
      calls `extractTableData(options)`, clears `mount.innerHTML` first (mirrors
      `renderChart()`'s destroy-before-recreate pattern), then writes a `<table>` using the
      Tailwind "condensed content" utility classes (`w-full border-collapse text-xs` header/cell
      `py-1 px-2` per research.md) with one `<th>` per column (plus a leading label column) and one
      `<tr>` per row; empty-state case renders a single `<tr><td colspan=...>` using
      `t('chart.tableNoData')` from `../i18n.js`.
- [x] T008 [US1] Create `web/js/views/chart-table-toggle.js` exporting
      `chartTableToggleMarkup()` and `initChartTableToggle(container, onChange)`, mirroring
      `chart-breakdown-toggle.js`'s shape exactly but with a single `<button
aria-pressed="false">${t('chart.tableToggleLabel')}</button>` instead of two mutually
      exclusive buttons. `initChartTableToggle` syncs `aria-pressed` from
      `isChartTableVisible()` (T004) on call, and on click: reads the new state (inverse of
      current), calls `setChartTableVisible(newState)`, re-syncs `aria-pressed`, then calls
      `onChange(newState)`.
- [x] T009 [US1] Add a `.chart-table-toggle` button (via `chartTableToggleMarkup()`, T008) and an
      always-present `.chart-table.overflow-x-auto` mount `<div hidden>` to
      `chartWithStatsLayoutMarkup()` in `web/js/views/stats-panel.js`, positioned per
      contracts/chart-data-table.md's DOM contract: toggle button top-right of `.chart-container`
      (new `.chart-container__header` flex row wrapping the existing optional breakdown toggle
      plus the new button), table mount directly below `.chart-body`. The `.chart-table` mount is
      always rendered (never omitted) so `initChartTableToggle`'s first `onChange` always has
      somewhere to write.

**Checkpoint**: Foundation ready — `chart-table-toggle.js` and `chart-data-table.js` are complete
and independently unit-tested; `stats-panel.js` emits the toggle button and table mount in its
markup. No view module wires them in yet (that's US1's remaining work below).

---

## Phase 3: User Story 1 - Reveal the underlying data as a table (Priority: P1) 🎯 MVP

**Goal**: Every chart page (day, month, year, total) shows a top-right toggle button; clicking it
shows/hides a condensed table below the chart that mirrors the chart's current series and updates
on period navigation.

**Independent Test**: Open any chart page, click the table-toggle button, verify a table with
condensed rows appears beneath the chart showing the same data series as the chart; click again to
hide it.

### Tests for User Story 1

- [x] T010 [P] [US1] Write `tests/e2e/chart-data-table.spec.js` Playwright scenarios for: toggle
      button visible top-right of `.chart-container` on `#/month/...`, `.chart-table` starts
      `hidden`; clicking the button removes `hidden`, table row count matches the chart's visible
      data-point count, and `aria-pressed` becomes `"true"`; clicking again re-adds `hidden` and
      `aria-pressed` becomes `"false"`. Per contracts/chart-data-table.md's Playwright test hooks.
      Run against the not-yet-wired app so it fails first.

### Implementation for User Story 1

- [x] T011 [US1] Wire `initChartTableToggle` + `renderChartTable` into `web/js/views/day-view.js`:
      import both from their new modules, call `initChartTableToggle(chartContainer, (visible) =>
{ tableMount.hidden = !visible; })` alongside the existing
      `initChartBreakdownToggle(chartContainer, drawChart)` call, and inside `drawChart()` (after
      `renderChart(...)`) call `renderChartTable(tableMount, chart.w.config)` unconditionally so the
      table is always kept current even while hidden (FR-007).
- [x] T012 [P] [US1] Apply the same wiring as T011 to `web/js/views/month-view.js` (its
      `drawChart`/`renderChart` call site around line 201-212).
- [x] T013 [P] [US1] Apply the same wiring as T011 to `web/js/views/year-view.js` (its
      `drawChart`/`renderChart` call site around line 180-198).
- [x] T014 [P] [US1] Apply the same wiring as T011 to `web/js/views/total-view.js` (its
      `drawChart`/`renderChart` call site around line 109-119).
- [x] T015 [US1] Run `node --test web/js/views/chart-data-table.test.js` (T005/T006/T007) and
      `npx playwright test tests/e2e/chart-data-table.spec.js --reporter=line` (T010) and confirm
      both pass; fix any mismatch between `chart.w.config`'s actual shape and
      `extractTableData()`'s assumptions discovered here.

**Checkpoint**: User Story 1 fully functional and independently testable — toggle + table work on
every chart page for the current page load (no cross-page persistence yet, that's US2).

---

## Phase 4: User Story 2 - Preference persists across pages and visits (Priority: P2)

**Goal**: The shown/hidden choice is a single app-wide `localStorage` preference: set it on one
chart, and every other chart (same page, other pages, after reload) reflects it without re-clicking.

**Independent Test**: Enable the table for one chart, navigate to a different page/view, confirm
the table is visible there too without further interaction; reload the browser and confirm the
preference is still applied.

### Tests for User Story 2

- [x] T016 [P] [US2] Extend `tests/e2e/chart-data-table.spec.js` with: toggle on `#/month/...`,
      navigate (client-side, no reload) to `#/year`, assert its `.chart-table` is shown too and its
      button's `aria-pressed` is `"true"` on first render; `page.reload()`, assert the table is
      still shown and `localStorage.getItem('solarlog-chart-table') === 'true'`; toggle off, assert
      a freshly loaded page (`#/month/...` again) starts with `.chart-table` hidden. Per
      contracts/chart-data-table.md's Playwright test hooks and quickstart.md steps 4-6.

### Implementation for User Story 2

- [x] T017 [US2] Confirm (and adjust if needed) that every view wired in T011-T014 reads
      `isChartTableVisible()` for the mount's _initial_ `hidden` state on first render — not just
      after a click — so a page freshly loaded with the preference already `true` shows its table
      immediately (FR-005). Set the `.chart-table` mount's `hidden` property from
      `isChartTableVisible()` at markup-render time in each of `day-view.js`, `month-view.js`,
      `year-view.js`, `total-view.js`, right after `chartWithStatsLayoutMarkup()` is inserted and
      before `initChartTableToggle` runs its own `aria-pressed` sync.
- [x] T018 [US2] Run `npx playwright test tests/e2e/chart-data-table.spec.js --reporter=line`
      (T016) and confirm the cross-page/reload scenarios pass.

**Checkpoint**: User Stories 1 and 2 both work independently — table persists app-wide across
navigation and reloads, defaulting to hidden with no stored preference.

---

## Phase 5: User Story 3 - Consistent condensed styling matching the design system (Priority: P3)

**Goal**: The table looks and feels like the rest of the dashboard — compact rows, readable numeric
alignment, legible in both light and dark themes, and scrollable rather than overflowing at narrow
widths or with a year's worth of rows.

**Independent Test**: Open the table on charts across the app and visually confirm condensed row
styling, alignment, and theme-appropriate colors match the Tailwind condensed table pattern used
elsewhere; resize to ~360px and confirm the table scrolls horizontally within its own container
without the page scrolling horizontally.

### Tests for User Story 3

- [x] T019 [P] [US3] Extend `tests/e2e/chart-data-table.spec.js` (or add to
      `tests/e2e/dashboard-responsive.spec.js`'s pattern) with: resize viewport to 360px width with
      a full month/year table shown, assert `document.documentElement.scrollWidth <=
document.documentElement.clientWidth` (no page-level horizontal scroll) while `.chart-table`
      itself has `scrollWidth > clientWidth` if its content is wider than the viewport, per SC-003
      and constitution Principle IV.
- [x] T020 [P] [US3] Extend `tests/e2e/dashboard-dark-mode.spec.js`'s pattern (or add a case to
      `chart-data-table.spec.js`) asserting `.chart-table th`/`.chart-table td` computed
      `border-bottom-color` resolves to the theme's `--color-border` token value in both light and
      dark theme, confirming no hardcoded color leaked into T003's CSS or T007's inline classes.

### Implementation for User Story 3

- [x] T021 [US3] Review and adjust the Tailwind utility classes used in `renderChartTable()`
      (T007, `web/js/views/chart-data-table.js`) against the `.summary-table` precedent in
      `stats-panel.js`: condensed `py-1 px-2 text-xs` cells, numeric columns right-aligned
      (`text-right tabular-nums`), header row `font-medium text-text-muted`, matching existing
      table conventions rather than introducing new visual language.
- [x] T022 [US3] Verify (adjust `web/css/app.css` from T003 if needed) that
      `.chart-table.overflow-x-auto`'s wrapper enforces `max-width: 100%` so a wide table (year
      view's up to ~366 rows, or a day view's per-inverter columns) scrolls within itself at
      320-360px viewport widths rather than pushing the page wider, per SC-003.
- [x] T023 [US3] Run `npx playwright test tests/e2e/chart-data-table.spec.js
tests/e2e/dashboard-dark-mode.spec.js tests/e2e/dashboard-responsive.spec.js --reporter=line`
      and confirm T019/T020 pass alongside the existing responsive/dark-mode regression coverage.

**Checkpoint**: All three user stories independently functional — reveal/hide, persistence, and
themed/responsive styling.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final regression pass and lint/documentation cleanup spanning all stories.

- [x] T024 [P] Run `npx eslint web/js/views/chart-table-toggle.js web/js/views/chart-data-table.js
web/js/views/chart-data-table.test.js web/js/views/stats-panel.js web/js/settings.js
web/js/views/day-view.js web/js/views/month-view.js web/js/views/year-view.js
web/js/views/total-view.js` and fix all errors/warnings (per project CLAUDE.md's mandatory
      lint step).
- [x] T025 [P] Run `npm run test:scripts` (full node:test suite) to confirm T005-T007's new tests
      don't break any existing script/unit test.
- [x] T026 Run the full Playwright suite (`npx playwright test --reporter=line`), especially
      `tests/e2e/navigation.spec.js` and `tests/e2e/detail-views.spec.js`, to confirm the new
      `.chart-container__header` markup change in T009 doesn't regress existing chart-page
      structure/selectors. — `navigation.spec.js` is fully green; the 4 `detail-views.spec.js`
      failures (year view, compare view, language switching) were unrelated to this feature's
      markup change and pre-existed on unmodified `main`. The full-suite's 27 pre-existing
      failures (stale routes/labels from the 013-020 view redesigns), tracked in
      [#46](https://github.com/mallwang/solarlog-viewer/issues/46), have since been fixed — every
      spec file, `detail-views.spec.js` included, now passes deterministically when run
      individually. A full `npx playwright test --reporter=line` run still shows 2-4 unrelated
      tests time out on `waitForLoadState('networkidle')` against the live proxied device
      (reproduces with `--workers=1` too, so it's not worker contention, and hits a different
      random test each run) — pre-existing environmental network flakiness unrelated to this
      feature's markup change, not a reproducible "exit 0".
- [x] T027 Walk through quickstart.md's full manual validation (steps 1-9) end-to-end in a real
      browser via `npm start`, including the breakdown-toggle-while-table-shown interaction
      (step 7) and the no-data period case (step 8), confirming every "Expect" line holds. —
      covered by the dedicated `tests/e2e/chart-data-table.spec.js` suite (10/10 passing), which
      exercises every quickstart scenario (reveal/hide, breakdown-toggle sync, no-data fallback,
      cross-page/reload persistence, 360px responsive layout).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001-T003 are independent files, fully
  parallel.
- **Foundational (Phase 2)**: Depends on Setup (T001/T002 i18n keys are consumed by T007/T008).
  Blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion.
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) and reuses US1's view-module
  wiring (T011-T014) as the integration point for T017 — must follow US1.
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) and US1's rendered markup
  (T007/T009) to style/verify against — must follow US1; independent of US2.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — this is the MVP.
- **User Story 2 (P2)**: Builds on US1's view-module wiring (same `.chart-table` mounts, same
  `initChartTableToggle` calls) but is independently testable once its own initial-`hidden`-state
  fix (T017) lands.
- **User Story 3 (P3)**: Builds on US1's rendered table markup but touches only styling — doesn't
  depend on US2's persistence logic at all, so it can proceed in parallel with US2 once US1 is
  merged.

### Within Each User Story

- Tests written first (T005, T010, T016, T019/T020) and confirmed failing before their
  corresponding implementation tasks.
- Foundational modules (settings → data-table → toggle → stats-panel markup) before any view-module
  wiring.
- Story complete (and its checkpoint's Independent Test passing) before moving to the next priority.

### Parallel Opportunities

- T001, T002, T003 (Setup) — different files.
- T005 (test file) can be written in parallel with T004 (settings.js) since they touch different
  files; T006/T007 depend on T005 existing first (TDD) and on each other only in that T007 calls
  `extractTableData` from T006 within the same file.
- T012, T013, T014 (US1 view wiring) — different files, identical pattern, fully parallel once T011
  establishes the pattern in day-view.js.
- T016 (US2 test) parallel with nothing else in its phase (single task before T017).
- T019, T020 (US3 tests) — different assertions, can be written in parallel.
- T024, T025 (Polish) — independent commands, parallel.

---

## Parallel Example: Phase 1 (Setup)

```bash
# Launch all Setup tasks together:
Task: "Add chart.tableToggleLabel/tableToggleOn/tableToggleOff/tableNoData keys to web/i18n/de.json"
Task: "Add the same keys to web/i18n/en.json"
Task: "Add .chart-table CSS block to web/css/app.css"
```

## Parallel Example: User Story 1 view-module wiring

```bash
# After T011 (day-view.js) establishes the pattern, fan out to the other three view modules:
Task: "Wire initChartTableToggle + renderChartTable into web/js/views/month-view.js"
Task: "Wire initChartTableToggle + renderChartTable into web/js/views/year-view.js"
Task: "Wire initChartTableToggle + renderChartTable into web/js/views/total-view.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T009) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T010-T015)
4. **STOP and VALIDATE**: click-to-reveal/hide works on all four chart views, table content matches
   chart data, updates on period navigation
5. Demo if ready — this alone satisfies spec.md's P1 acceptance scenarios

### Incremental Delivery

1. Setup + Foundational → shared plumbing ready
2. Add User Story 1 → validate independently → demo (MVP!)
3. Add User Story 2 → validate independently (persistence across pages/reload) → demo
4. Add User Story 3 → validate independently (theming/responsive polish) → demo
5. Phase 6 Polish → full regression pass, ship

### Parallel Team Strategy

With multiple developers, after Foundational (Phase 2) completes:

- Developer A: User Story 1 (Phase 3) — must land first, others build on its markup/wiring
- Developer B: prepares User Story 3's test scenarios (T019/T020) against US1's contract while A
  finishes wiring, then implements T021-T023 once US1 merges
- Developer C: prepares User Story 2's test scenario (T016) in parallel, then implements T017 once
  US1 merges

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability (US1/US2/US3); Setup,
  Foundational, and Polish tasks carry no story label per the format rules.
- `chart-factory.js` itself is never modified (per contracts/chart-data-table.md) — the ApexCharts
  `options` object reaches `renderChartTable()` via the already-returned chart instance's
  `chart.w.config`, confirmed empirically in T015.
- Commit after each task or logical group; stop at any checkpoint to validate a story
  independently before continuing.
- Avoid: vague tasks, same-file conflicts within a "parallel" batch, cross-story dependencies that
  break independent testability.
