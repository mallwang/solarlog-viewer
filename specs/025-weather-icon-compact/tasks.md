# Tasks: Compact Weather Display with Hover Detail

**Input**: Design documents from `/specs/025-weather-icon-compact/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (no contracts/ —
no external interface for this feature)

**Tests**: Included — plan.md's Testing section and quickstart.md explicitly require a
`node --test` unit test for the new `weather-text.js` module and Playwright rewrites/additions
for `tests/e2e/info-panel.spec.js`.

**Organization**: Tasks are grouped by user story (US1: compact glance, US2: hover/focus detail)
per spec.md priorities.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- File paths are exact — this is a single static web app (`web/`), no backend split.

---

## Phase 1: Setup

No project initialization needed — existing repo, existing toolchain (`npm start`, `npm run
lint`, `node --test`, Playwright already configured). Nothing to do in this phase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared string-building module both user stories' rendering depends on. Per
data-model.md, `compactValue` and `fullText` MUST come from the same source data in the same
function call (FR-004) — this module is that single source of truth, so it must exist before
either indicator's render logic is rewritten.

**⚠️ CRITICAL**: No user-story rendering work can begin until T001–T002 are complete.

- [x] T001 [P] Write `node:test` unit tests in `web/js/weather/weather-text.test.js` covering, per
      data-model.md's Current-Conditions/Forecast tables: current-conditions available
      (`compactValue` = `"21°C"`, `fullText` = `"Klar, 21°C"`, including the nighttime
      sunny→"clear" override producing the moon-label wording) and unavailable
      (`fullText` = `t('infoPanel.unavailable')`, no `compactValue`); forecast available for both
      today and tomorrow prefixes (`compactValue` = `"15° - 19°"`, `fullText` = `"Heute: Regen
(15°C - 19°C)"` / `"Morgen: ..."`) and unavailable; assert `compactValue` never contains the
      condition label or day prefix substring. Run first and confirm it fails (module doesn't
      exist yet).
- [x] T002 Implement `web/js/weather/weather-text.js` — pure functions
      `buildCurrentWeatherText({ available, icon, label, temperatureC })` and
      `buildForecastWeatherText({ available, icon, label, prefixKey, minC, maxC })` (or an
      equivalent single-module shape matching data-model.md's Compact Weather Indicator fields:
      `icon`, `compactValue`, `fullText`, `available`), reusing `t()` from `../i18n.js` for
      `infoPanel.weatherCategory.*`/`infoPanel.todayLabel`/`infoPanel.tomorrowLabel`/
      `infoPanel.unavailable` (no new i18n keys per Constraints). JSDoc each export. Run T001
      until it passes.

**Checkpoint**: `weather-text.js` is the single tested source of compact/full text — both user
stories now build on it.

---

## Phase 3: User Story 1 - Compact weather glance (Priority: P1) 🎯 MVP

**Goal**: Both weather indicators render as icon-over-value stacks (temperature / temperature
range only, no label/prefix text), separated by a visible divider, taking up less horizontal
space than the previous inline-sentence layout.

**Independent Test**: Load the info panel with weather data available; confirm the
current-conditions area shows only an icon and a temperature, the forecast area shows only an
icon and a range, separated by a divider, with no condition label or day-prefix text visible by
default.

### Implementation for User Story 1

- [x] T003 [US1] Restructure the desktop weather markup in `web/index.html`
      (`.info-panel--desktop`'s `.info-panel__weather` block, ~line 282–290): give both
      `[data-role="weather-current"]` and `[data-role="weather-forecast"]` an icon child span, a
      compact-value child span, `tabindex="0"`, and an empty tooltip child span (structure per
      design.md/mockup.html); keep the existing `data-role`/wrapper attributes so
      `info-panel-controller.js` keeps selecting the same elements.
- [x] T004 [US1] Apply the identical markup restructure to the mobile weather block in
      `web/index.html` (`.info-panel--mobile`'s `.info-panel__weather`, ~line 332–340) — same
      shape as T003, kept in sync per plan.md's "four indicator elements total" scope.
- [x] T005 [US1] Rewrite `renderWeather()` in
      `web/js/info-panel/info-panel-controller.js` (~line 267–316) to call the new
      `weather-text.js` functions per indicator, set `icon`/`compactValue` into the new child
      spans (icon `aria-hidden="true"`), set `data-available` independently on each indicator (not
      only on the outer `[data-role="weather"]` link) per FR-007/data-model.md, and set each
      indicator's `aria-label` to the `fullText` unconditionally (research.md §2). Remove the old
      inline text-node building (`buildWeatherIconEl` sentence construction) in favor of the
      structured icon+value+tooltip DOM.
- [x] T006 [US1] Update `web/css/app.css`'s `.info-panel__weather-*` rules (~line 1545–1580):
      turn `.info-panel__weather-current`/`-forecast` into flex columns (icon on top, value
      beneath) per design.md's layout; add the divider as a `border-left: 1px solid
var(--color-border)` on the forecast indicator's leading edge; add a dimmed/reduced-opacity
      style for the unavailable dash-icon state, applied per-indicator via the new per-indicator
      `data-available` attribute from T005.
- [x] T007 [US1] Update the forecast indicator's unavailable handling so it renders the dimmed
      dash icon (matching current-conditions) instead of rendering nothing, per data-model.md's
      "Unavailable" column and research.md §5 — covered by the same `renderWeather()` rewrite in
      T005; call out explicitly here since it's a behavior change from 023-weather-panel-icons,
      not just a restyle.
- [x] T008 [US1] Rewrite the existing text-content assertions in
      `tests/e2e/info-panel.spec.js` that currently expect inline label text (e.g. `toContainText`
      on `Schnee`/`Regen`/`Sonnig` around lines 321, 334, 351, 393) to instead assert the compact
      value only (e.g. temperature text) is visible and the condition label is absent from visible
      text, per US1's Independent Test. Do not yet add hover/tooltip assertions — those belong to
      US2 (T012).
- [x] T009 [US1] Add a Playwright assertion in `tests/e2e/info-panel.spec.js` that a divider
      element/style is present between the current and forecast indicators (Acceptance Scenario 3),
      and that the forecast's unavailable state now renders the dimmed dash icon instead of empty
      content (covers T007's behavior change), for both `.info-panel--desktop` and
      `.info-panel--mobile`.

**Checkpoint**: User Story 1 is fully functional and independently testable — compact icon+value
display with divider, no label text visible by default, in both desktop and mobile panel copies.

---

## Phase 4: User Story 2 - Reveal full detail on hover (Priority: P2)

**Goal**: Hovering, focusing, or tapping either weather icon reveals a tooltip with the exact
previous inline text (including the forecast's day prefix); the tooltip disappears when the
pointer/focus moves away; the full text is also always available as each indicator's accessible
name.

**Independent Test**: With the compact display in place, hover the current-conditions icon and
verify a tooltip shows the previous inline text (e.g. "Klar, 21°C"); hover the forecast icon and
verify its tooltip includes the day prefix (e.g. "Heute: Regen (15°C - 19°C)"); moving the
pointer away hides each tooltip; tabbing to each indicator reveals the same tooltip and exposes
the same text as its accessible name.

### Implementation for User Story 2

- [x] T010 [US2] Add the floating tooltip CSS to `web/css/app.css`: a new
      `.info-panel__weather-tooltip` rule (`position: absolute`, centered under/over the icon, using
      `--color-text`/`--color-bg` per plan.md's Project Structure notes) with opacity/
      pointer-events toggled by `:hover`, `:focus-within`, and a `[data-open]` attribute fallback;
      clamp horizontal offset so it never overflows the viewport at 320px width (Constraints); add
      a `:focus-visible` outline on each indicator.
- [x] T011 [US2] Wire the tooltip content and touch fallback in
      `web/js/info-panel/info-panel-controller.js`'s `renderWeather()` (building on T005): set the
      tooltip child span's text content to `fullText`, `aria-hidden="true"` on the tooltip itself
      (decorative — `aria-label` on the indicator already covers assistive tech per research.md
      §2); add a `click`/`touchstart` handler (wired once during `initInfoPanelController`, not
      per-render) that toggles `data-open="true"` on the tapped indicator and closes it on an
      outside tap or `Escape` key (research.md §3).
- [x] T012 [P] [US2] Add Playwright coverage in `tests/e2e/info-panel.spec.js` for: hovering the
      current-conditions icon reveals a tooltip containing the exact previous inline text;
      hovering the forecast icon reveals a tooltip containing the day prefix + label + range;
      moving the pointer away hides each tooltip independently (hovering current never reveals the
      forecast tooltip and vice versa, per design.md); tabbing to each indicator via keyboard
      reveals the same tooltip.
- [x] T013 [P] [US2] Add Playwright coverage in `tests/e2e/info-panel.spec.js` asserting each
      indicator's `aria-label` equals the full previous inline text unconditionally (present
      without any hover/focus/tap), for both available and unavailable states, per FR-006/SC-002.
- [x] T014 [US2] Add Playwright coverage (touch emulation) in `tests/e2e/info-panel.spec.js` for
      the tap-to-reveal fallback: tapping an indicator opens its tooltip, and tapping elsewhere (or
      pressing Escape) closes it, per the Edge Cases touch-device requirement and research.md §3.
- [x] T015 [US2] Add a 320px-viewport Playwright assertion in `tests/e2e/info-panel.spec.js`
      confirming neither indicator nor an open tooltip clips or overflows the viewport edge
      (constitution Principle IV / plan.md Constraints).

**Checkpoint**: User Stories 1 AND 2 both work independently — compact display plus full-text
reveal via hover, focus, and tap, with no accessibility regression.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final validation across both stories.

- [x] T016 [P] Update `README.md`/`README.de.md` and `docs/user-guide.md`/
      `docs/user-guide.de.md` for any mention/screenshot of the old inline weather text format,
      describing the new compact icon + hover-detail behavior (plan.md Documentation Standards).
- [x] T017 Run the full regression gate per quickstart.md: `npm run lint`, `npm run format:check`,
      `npx playwright test --reporter=line` — all three MUST pass.
- [x] T018 Walk through quickstart.md's Manual visual check end-to-end in a real browser
      (`npm start`) to confirm the compact layout, divider, hover/focus/tap tooltip reveal, and
      independent unavailable states all match the approved mockup.
- [x] T019 Update `**Status**` in `spec.md` from `Draft` to `Implemented` (only once every task
      above is checked off).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — nothing to do.
- **Foundational (Phase 2)**: No dependencies — BLOCKS all user stories (T001/T002 must land
  before T005, T011).
- **User Story 1 (Phase 3)**: Depends on Phase 2 (`weather-text.js`). No dependency on US2.
- **User Story 2 (Phase 4)**: Depends on Phase 2, and on US1's markup/render restructure (T003–
  T005) existing first (a tooltip needs the compact indicator + icon/value spans to attach to) —
  matches spec.md's "This depends on User Story 1 existing first."
- **Polish (Phase 5)**: Depends on both user stories being complete.

### Within Each User Story

- Markup (T003/T004) before the render rewrite that targets it (T005).
- Render rewrite (T005) before CSS that depends on the new per-indicator `data-available`/DOM
  shape (T006).
- Implementation before its Playwright coverage (T008/T009 after T003–T007; T012–T015 after
  T010/T011).

### Parallel Opportunities

- T001 (tests) can be written in parallel with nothing else in Phase 2 — it must land before T002
  but is otherwise independent.
- T003 and T004 touch the same file (`index.html`) but different DOM blocks — sequential is safer
  in one PR; not marked [P].
- T012 and T013 are both pure Playwright-assertion additions to the same spec file targeting
  different behaviors — marked [P] as independent edits, but coordinate to avoid merge conflicts
  if run by parallel agents.
- T016 (docs) can run in parallel with T017–T019 (validation) — different files.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# T001 must complete and fail before T002 starts (TDD), so these are sequential, not parallel,
# despite the [P] marker on T001 (marker reflects "different file from Phase 3/4 work", not
# concurrency with T002).
```

## Parallel Example: User Story 2

```bash
Task: "Add hover/focus tooltip Playwright coverage in tests/e2e/info-panel.spec.js"       # T012
Task: "Add aria-label unconditional-presence Playwright coverage in tests/e2e/info-panel.spec.js" # T013
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (`weather-text.js` + its unit test).
2. Complete Phase 3: User Story 1 (compact icon-over-value display + divider, both panel copies).
3. **STOP and VALIDATE**: Run T008/T009, confirm the compact layout renders correctly and no
   label/prefix text leaks into the default view.
4. This alone satisfies SC-001 and Acceptance Scenarios 1–4 of User Story 1 — deployable on its
   own if hover-detail (US2) needs more time, since FR-007's unavailable state and FR-006's
   `aria-label` were **not** deferred (T005 sets `aria-label` as part of US1's render rewrite,
   ahead of the tooltip UI) — but SC-002/SC-003 (full information reachable via hover) is not met
   until US2 also ships.

### Incremental Delivery

1. Foundational → Foundation ready.
2. User Story 1 → validate independently → optional deploy (compact display; full text still
   only in `aria-label`, no visible tooltip yet).
3. User Story 2 → validate independently → deploy (adds the hover/focus/tap tooltip on top).
4. Polish → docs + full regression gate → done.

---

## Notes

- [P] tasks = different files or independently-addable assertions, no blocking dependency.
- [Story] label maps each task to US1 or US2 for traceability back to spec.md.
- No `contracts/` directory and no new data entities — this is a render-only feature; no
  model/service/endpoint tasks apply from the template's generic structure.
- Commit after each task or logical group, per repository convention.
- Verify T001 fails before implementing T002 (TDD, per plan.md Testing standard).
