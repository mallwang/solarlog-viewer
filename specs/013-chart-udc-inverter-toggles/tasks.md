# Tasks: Chart UDC Toggle & Per-Inverter Stacked Bars

**Input**: Design documents from `/specs/013-chart-udc-inverter-toggles/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Included — plan.md's Testing section and the constitution's testing gate require
Playwright E2E coverage in `tests/e2e/detail-views.spec.js`, per Development Workflow rule 3
(tests before implementation).

**Organization**: Tasks are grouped by user story (US1 = day chart UDC toggle, US2 = per-inverter
stacked bars) per spec.md's priorities.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Paths are relative to the repository root (`/home/markus/projects/solarlog-viewer`)

---

## Phase 1: Setup

No project initialization needed — existing static frontend structure and vendored ApexCharts
are reused as-is (per plan.md's Structure Decision). No setup tasks required.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Both user stories are otherwise fully independent (different chart builders,
different views, no shared new helper) — per research.md/data-model.md there is no shared code
that must exist before either story starts. This phase is intentionally empty.

**Checkpoint**: No blocking prerequisites — US1 (Phase 3) and US2 (Phase 4) can both start
immediately and proceed in parallel.

---

## Phase 3: User Story 1 - Reveal DC voltage on the daily chart (Priority: P1) 🎯 MVP

**Goal**: The day chart (Mode 0) gains a "UDC" series, present in the legend but hidden on
initial render, toggled on/off via a native ApexCharts legend click, summed across reporting
inverter strings, with a tooltip row shown only while visible.

**Independent Test**: Open a day view for a day with recorded UDC readings. Confirm the UDC
series is present in the legend but not drawn on the chart. Click the UDC legend entry and
confirm the voltage line appears; click it again and confirm it hides.

### Tests for User Story 1

- [x] T001 [P] [US1] Add Playwright cases to `tests/e2e/detail-views.spec.js` (new
      `describe` block near the existing `Day view efficiency curve` one): day view
      (`?mode=0&offset=0`) for a day with UDC data shows a "UDC" legend entry but no third
      line/series drawn on first load; clicking the legend entry reveals the UDC line; clicking
      it again hides it and leaves the feed-in/efficiency series unaffected; hovering a point
      while UDC is visible shows a UDC row in the tooltip; a `day-yield` fallback day (backfilled,
      no `udcV`) shows no "UDC" legend entry at all — per spec.md US1 Acceptance Scenarios 1-5
      and FR-001–FR-005; must fail before T003

### Implementation for User Story 1

- [x] T002 [P] [US1] Add `chart.udcAxis` (e.g. "UDC (V)" / "UDC-Spannung (V)") to
      `web/i18n/en.json` and `web/i18n/de.json` under the existing `chart` key, for the new
      series/legend/tooltip label
- [x] T003 [US1] In `web/js/charts/chart-factory.js`'s `buildDayOptions()`, add a third series
      named `t('chart.udcAxis')` (`type: 'line'`) mapping each reading to
      `sumPerInverter(Object.values(r.perInverter).map((inv) => inv?.udcV))` (reusing the
      existing `sumPerInverter` helper, same null-handling as the feed-in series per FR-001);
      give it its own color/stroke width entries alongside the existing two series; only build
      this series when at least one reading has a non-null `udcV` value, otherwise omit it
      entirely (FR-005 — no UDC legend entry on `day-yield`/no-UDC-data days; depends on T002)
- [x] T004 [US1] In `web/js/charts/chart-factory.js`'s `renderChart()` (or immediately after
      `chart.render()` in the `'day'` branch), call `chart.hideSeries(t('chart.udcAxis'))` right
      after mount whenever the UDC series was included, so it starts hidden per FR-002 while
      relying on ApexCharts' default `legend.onItemClick.toggleDataSeries` for the click-to-
      reveal/hide interaction (FR-003) — no custom click handler (depends on T003)
- [x] T005 [US1] In `buildDayOptions()`'s `tooltip.custom` renderer, add a third `tooltipRow`
      for the UDC value, rendered only when the UDC series is currently visible (check
      `w.globals.collapsedSeriesIndices`/the series' visibility on the tooltip callback's `w`
      argument), formatted as a voltage value (e.g. `` `${formatNumber(udcValue, { decimals: 0,
lang })} V` ``), consistent with the existing feed-in/efficiency rows — per FR-004 and
      research.md Decision 4 (depends on T003)

**Checkpoint**: `npx playwright test tests/e2e/detail-views.spec.js --reporter=line` passes;
User Story 1 is independently functional and testable (MVP).

---

### Adjustment: Persist UDC visibility across visits (requested after initial US1 implementation)

**Why**: After T001–T005 shipped UDC always resetting to hidden on every fresh render (per the
original Edge Cases text), the user asked for the day chart to "remember" its own diagram
settings the way the month/year/total breakdown toggle already does — reopening the app or a
different day should show the UDC line already revealed if the user last left it that way.
spec.md's US1 was updated in place (Edge Cases, FR-002/FR-002a, Acceptance Scenario 6, SC-002a);
data-model.md's "State: UDC Series Visibility" section was rewritten to match.

- [x] T025 [P] Add `isDayUdcVisible()`/`setDayUdcVisible(visible)` to `web/js/settings.js`
      (`localStorage` key `solarlog-day-udc-visible`, mirroring the existing
      `getChartBreakdownMode`/`setChartBreakdownMode` pattern), defaulting to `false` (hidden) for
      any unset/unrecognized stored value (FR-002, FR-002a)
- [x] T026 In `web/js/charts/chart-factory.js`'s `renderChart()`, only call
      `chart.hideSeries(t('chart.udcAxis'))` after mount when `isDayUdcVisible()` is `false`;
      leave the series in ApexCharts' own default (shown) state when `true` (depends on T025)
- [x] T027 In `buildDayOptions()`, add a `chart.events.legendClick` handler (guarded to the UDC
      series index) that reads `w.globals.collapsedSeriesIndices` one tick after the click (after
      ApexCharts' own default toggle has applied) and persists the resulting visibility via
      `setDayUdcVisible()` — no change to the existing `legend.onItemClick.toggleDataSeries`
      show/hide interaction itself (FR-003 unaffected; depends on T025)
- [x] T028 Extend the US1 Playwright describe block in `tests/e2e/detail-views.spec.js` (added by
      T001): after revealing UDC, reload the page (or navigate to a different day) and confirm the
      UDC line is shown by default without clicking the legend again; confirm a fresh browser
      context with no prior localStorage still defaults to hidden — per spec.md US1 Acceptance
      Scenario 6 and SC-002a

**Checkpoint**: `npx playwright test tests/e2e/detail-views.spec.js --reporter=line` passes with
UDC visibility persisting across reloads/day navigation, defaulting to hidden when nothing has
been persisted yet.

---

## Phase 4: User Story 2 - Toggle period totals between combined and per-inverter-string bars (Priority: P2)

**Goal**: The month/year/year-months bar charts (Modes 1–3, all sharing `buildBarOptions`) gain a
persisted "Gesamt" / per-inverter-string toggle. `'total'` (default, matches the pre-feature
single bar exactly) shows one pre-summed series; `'inverters'` shows one stacked series per
inverter string (WR1, WR2, …) with a tooltip that adds the combined total above the per-string
rows. T006–T012 below record the chart-factory.js/tests work as it was first implemented
(always-stacked, no toggle); T016–T024 record the follow-up adjustment requested afterward that
turned that into the two-mode, persisted-toggle design described in spec.md's current US2 — read
both in order, since T016+ supersedes T006–T012's "always stacked" behavior rather than starting
over.

**Independent Test**: Open the monthly totals view. Confirm it shows the single combined "Gesamt"
bar by default. Switch the toggle to the per-inverter option and confirm each bar becomes a
stacked bar (one segment per string) whose combined height equals the "Gesamt" bar, with the
tooltip showing the combined total plus each string's value. Reload and confirm the same toggle
selection is still applied.

### Tests for User Story 2

- [x] T006 [P] [US2] Add Playwright cases to `tests/e2e/detail-views.spec.js`: month view
      (`?mode=1&offset=0`) renders stacked bars with a WR1 and WR2 segment per day whose combined
      height/tooltip total matches the pre-change single-bar total; the same assertions repeated
      for year view (`?mode=2&offset=0`, months-in-year) and lifetime/total view (`?mode=3`,
      years-in-lifetime); hovering a bar shows both strings' individual values in the tooltip;
      clicking a bar (any segment) still drills into the next-finer view exactly as before — per
      spec.md US2 Acceptance Scenarios 1-6 and FR-006–FR-011; must fail before T009

### Implementation for User Story 2

- [x] T007 [P] [US2] Add an inverter-string label lookup to `web/js/charts/chart-factory.js`
      (e.g. `inverterLabel(key)`, returning `` `WR${key}` `` — matching data-model.md's Inverter
      String Label table, generalizing to any key present in the data rather than hard-coding
      `1`/`2`, per FR-010/FR-011); no i18n table needed since "WR" + key is not user-facing prose
      to translate, but confirm with `docs/user-guide.md` wording conventions
- [x] T008 [US2] In `web/js/charts/chart-factory.js`'s `buildBarOptions()`, replace the single
      `series: [{ name: t('chart.total'), data: seriesData }]` with a `series` param passed in by
      each caller (one entry per inverter-string key present in the data, each
      `{ name: inverterLabel(key), data: categories.map(...) }`), add `chart: { stacked: true }`,
      and update `tooltip.y` so each series still formats via `formatKwh` — the combined total
      row from `chart.total` is no longer needed since ApexCharts' stacked-bar tooltip already
      lists every series (depends on T007)
- [x] T009 [US2] Update `buildMonthOptions()` in `web/js/charts/chart-factory.js` to derive
      `stringKeys` as the union of `Object.keys(d.perInverter)` across `data.dailyBreakdown`, and
      pass `buildBarOptions()` one series per key with
      `data: data.dailyBreakdown.map((d) => (d.perInverter[key]?.yieldWh ?? 0) / 1000)` instead
      of today's single pre-summed series (per data-model.md's Period Breakdown Entry table;
      depends on T008)
- [x] T010 [P] [US2] Update `buildYearOptions()` in `web/js/charts/chart-factory.js` to derive
      `stringKeys` from `Object.keys(y.perInverter)` across `yearlyTotalsList`, and pass one
      series per key with `data: yearlyTotalsList.map((y) => (y.perInverter[key] ?? 0) / 1000)`
      (note: `perInverter[key]` here is a plain number, not nested under `.yieldWh`, per
      data-model.md; depends on T008)
- [x] T011 [P] [US2] Update `buildYearMonthsOptions()` in `web/js/charts/chart-factory.js` to
      derive `stringKeys` from `Object.keys(m.perInverter)` across `data.monthlyBreakdown`, and
      pass one series per key with
      `data: data.monthlyBreakdown.map((m) => (m.perInverter[key] ?? 0) / 1000)` (depends on
      T008)
- [x] T012 [US2] Verify the existing `dataPointSelection` → `onDataPointClick(config.
dataPointIndex)` wiring in `buildBarOptions()` needs no change (per research.md Decision 3)
      and confirm via T006's Playwright cases that clicking any segment of a stacked bar still
      drills down correctly for month/year/year-months (FR-009)

**Checkpoint**: `npx playwright test tests/e2e/detail-views.spec.js --reporter=line` passes;
User Stories 1 AND 2 both work independently.

---

### Adjustment: Combined/per-inverter toggle (requested after initial US2 implementation)

**Why**: After T006–T012 shipped the "always stacked" version, the user asked for the stacked
view to be opt-in rather than the new default: the total bar must stay the default view, a switch
lets the user choose stacked-per-inverter instead, the choice must persist across visits, and the
tooltip must differ by mode (single value vs. Gesamt + per-string values). spec.md's US2 was
rewritten in place to describe this as the final intended behavior (see its Acceptance Scenarios
1-8 and FR-006/FR-006a/FR-008/FR-012).

- [x] T016 [P] Add `getChartBreakdownMode()`/`setChartBreakdownMode(mode)` to
      `web/js/settings.js` (`localStorage` key `solarlog-chart-breakdown`, mirroring the existing
      `isTransparencyEnabled`/`setTransparencyEnabled` pattern), defaulting to `'total'` for any
      unset/unrecognized stored value (FR-006a, FR-012)
- [x] T017 [P] Add `chart.breakdownToggleLabel`/`chart.breakdownTotal`/`chart.breakdownInverters`
      to `web/i18n/en.json` and `web/i18n/de.json` under the existing `chart` key
- [x] T018 Create `web/js/views/chart-breakdown-toggle.js` exporting
      `chartBreakdownToggleMarkup()` (two `aria-pressed` buttons, `data-breakdown="total"` /
      `data-breakdown="inverters"`, mirroring the header's `.lang-switcher` pattern) and
      `initChartBreakdownToggle(container, onChange)` (syncs both buttons' `aria-pressed` from
      `getChartBreakdownMode()`, and on click persists the new mode via `setChartBreakdownMode`
      and calls `onChange(mode)` so the caller re-renders in place — no page navigation) (depends
      on T016, T017)
- [x] T019 Add `.chart-breakdown-toggle button` / `[aria-pressed='true']` styles to
      `web/css/app.css`, mirroring `.lang-switcher button`'s existing rules
- [x] T020 In `web/js/charts/chart-factory.js`'s `buildBarOptions()`, take `totalData` (the
      pre-existing single-series values) and `stringSeries` (per-string series) plus a `breakdown:
'total' | 'inverters'` param; render `series: [{ name: t('chart.total'), data: totalData }]`
      with `chart.stacked: false` and the default `tooltip.y` formatter when `breakdown !==
'inverters'`, else `stringSeries` with `chart.stacked: true` and a custom tooltip that sums
      `hoveredSeries` into a "Gesamt" row (colored via `colors[0]`, the same accent the total bar
      itself uses) above one row per string (FR-006, FR-006a, FR-007, FR-008); update
      `buildMonthOptions()`/`buildYearOptions()`/`buildYearMonthsOptions()` to compute and pass
      both `totalData` (restoring each function's original pre-T009/T010/T011 single-sum
      expression) and `stringSeries`, plus thread a `breakdown` option through from `config`
- [x] T021 Add `{ breakdownToggle?: boolean }` to `chartWithStatsLayoutMarkup()` in
      `web/js/views/stats-panel.js` (`web/js/views/chart-breakdown-toggle.js`'s markup rendered
      above `.chart-mount` only when `true`) — day view's call site stays unchanged (`false`
      default), only month/year/total opt in
- [x] T022 [P] In `web/js/views/month-view.js`, `web/js/views/year-view.js`, and
      `web/js/views/total-view.js`: pass `{ breakdownToggle: true }` to
      `chartWithStatsLayoutMarkup()`, wrap the existing `renderChart(...)` call in a local
      `drawChart()` closure that reads `breakdown: getChartBreakdownMode()` each call, invoke it
      once on initial render, and call `initChartBreakdownToggle(chartContainerEl, drawChart)` so
      toggling re-renders the already-mounted chart without a page navigation (FR-012)
- [x] T023 [P] Rewrite the "Per-inverter stacked bars" Playwright describe block in
      `tests/e2e/detail-views.spec.js` (added by T006) to match the toggle design: default render
      shows 1 series + toggle pressed on "Gesamt" + tooltip with only the combined value;
      switching to "Wechselrichter" shows 2 series/WR1+WR2 legend + tooltip with Gesamt+WR1+WR2;
      year/total views offer the same toggle; the selection persists across a `page.reload()` and
      across navigating to a different one of the three views; clicking a bar still drills down in
      either mode — per spec.md US2 Acceptance Scenarios 1-8 and FR-006–FR-012, SC-006
- [x] T024 Re-verify T006-T012's drill-down/generalizes-to-N-strings/tooltip-invariant coverage
      still holds under the new toggle design (no separate implementation change needed — T020's
      `stringSeries`/`chart.stacked: true` path is the same per-string rendering T007-T011 built,
      now reachable only via the `'inverters'` toggle state rather than unconditionally)

**Checkpoint**: `npx playwright test tests/e2e/detail-views.spec.js --reporter=line` passes with
the toggle defaulting to "Gesamt" and persisting selection; `npm run lint` and `npm run
format:check` are clean.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final validation across both stories.

- [x] T013 [P] Update `README.md`/`README.de.md` and `docs/user-guide.md`/
      `docs/user-guide.de.md` to describe the day chart's UDC legend toggle and the month/year/
      all-time views' per-string stacked bars, kept EN/DE consistent, per plan.md's Documentation
      Standards note
- [x] T014 Run `npm run lint` and `npm run format:check`; fix any failures
- [x] T015 Run the full quickstart.md validation end-to-end (`npm start`, manual checks for both
      user stories, `npm test`/`npx playwright test tests/e2e/detail-views.spec.js --reporter=
line`) and confirm all Acceptance Scenarios and Success Criteria (SC-001–SC-005) pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — skipped, no tasks.
- **Foundational (Phase 2)**: None — empty; does not block Phase 3 or Phase 4.
- **User Story 1 (Phase 3)**: No dependency on US2. Can start immediately.
- **User Story 2 (Phase 4)**: No dependency on US1 (can be built/tested in parallel with Phase 3
  by a second developer).
- **Polish (Phase 5)**: Depends on both Phase 3 and Phase 4 being complete.

### Within Each User Story

- T001 (tests) MUST be written and FAIL before T003-T005 (US1 implementation).
- T002 before T003 (i18n label before chart code references it) within US1.
- T003 before T004 before T005 (series must exist before it's hidden on mount; hide-on-mount is
  independent of the tooltip row, but both build on the series existing) within US1.
- T006 (tests) MUST be written and FAIL before T008-T012 (US2 implementation).
- T007 before T008 (label helper before `buildBarOptions()` uses it) within US2.
- T008 before T009/T010/T011 (shared `buildBarOptions()` shape change before each of the three
  callers is updated to pass per-string series) within US2.
- T009, T010, T011 touch three different functions in the same file — sequence them to avoid
  merge conflicts even though they're logically parallel.

### Parallel Opportunities

- Once Phase 2 (empty) is acknowledged, US1 (Phase 3) and US2 (Phase 4) can proceed fully in
  parallel — different series/functions in `chart-factory.js`, different `describe` blocks in
  `detail-views.spec.js`, no shared helper.
- T001 and T002 within US1 can run in parallel (different files).
- T006 and T007 within US2 can run in parallel (different files).
- T010 and T011 within US2 can run in parallel with each other once T008/T009 land (different
  functions, same file — coordinate to avoid clobbering each other's edits).
- T013 (docs) can run in parallel with T014 (lint/format run).

---

## Parallel Example: Both Stories (no Foundational blocker)

```bash
# Launch both stories together — no shared prerequisite:
Task: "US1: day chart UDC toggle tests + implementation"        # T001-T005
Task: "US2: per-inverter stacked bars tests + implementation"   # T006-T012
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 3: User Story 1 (day chart UDC toggle).
2. **STOP and VALIDATE**: `npx playwright test tests/e2e/detail-views.spec.js --reporter=line`.
3. Ship — the UDC reveal-on-click is a complete, independently valuable increment.

### Incremental Delivery

1. Add User Story 1 → validate → ship (MVP).
2. Add User Story 2 → validate → ship.
3. Phase 5 polish (docs, lint, full quickstart pass) → done.

### Parallel Team Strategy

With two developers: both start immediately — Developer A takes Phase 3 (US1, day chart),
Developer B takes Phase 4 (US2, bar charts); no file overlap beyond `chart-factory.js`'s
different functions and `detail-views.spec.js`'s different `describe` blocks, so both can merge
independently with light coordination.

---

## Notes

- [P] tasks = different files, no dependencies (or same file, non-conflicting sections — see T010/
  T011 caveat above).
- [Story] label maps task to specific user story for traceability.
- Verify each story's Playwright test fails before implementing (T001 before T003-T005; T006
  before T008-T012).
- Commit after each task or logical group.
- Stop at either checkpoint to validate a story independently before moving on.
- No changes to `web/js/data/min-file.js`, `web/js/data/aggregates.js`, or any SolarLog `.js` data
  file are in scope — both stories are pure rendering changes over already-parsed data.
