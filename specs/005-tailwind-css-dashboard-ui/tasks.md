---

description: "Task list for Tailwind CSS Dashboard Redesign"

---

# Tasks: Tailwind CSS Dashboard Redesign

**Input**: Design documents from `/specs/005-tailwind-css-dashboard-ui/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/chart-factory.md, contracts/navigation.md, quickstart.md

**Tests**: Playwright and `node:test` are the project's mandated testing standard (constitution
"Technical Standards → Testing"); quickstart.md §1–7 and research.md §5 explicitly define new specs
for this feature, so test tasks ARE included below.

**Organization**: Tasks are grouped by user story (US1 = P1 consistent presentation, US2 = P2
navigation, US3 = P3 responsive layout) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- File paths are exact, relative to repo root

## Path Conventions

Single project (Option 1) — `web/` frontend, `tests/e2e/`, `scripts/` at repository root, per
plan.md's Project Structure section.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add build tooling (Tailwind CLI, vendored ApexCharts) without touching data or routing.

- [ ] T001 Add `tailwindcss` (v4) as an npm devDependency and `apexcharts` build source in
      `package.json`; add `build:css` script (`tailwindcss -i web/css/tailwind.css -o
      web/css/tailwind.generated.css`) and update `start` to run Tailwind CLI in `--watch` mode
      alongside `browser-sync` (research.md §1)
- [ ] T002 Run `npm install` to lock the new devDependency in `package-lock.json`
- [ ] T003 [P] Vendor ApexCharts ESM/UMD build into `web/vendor/apexcharts/` (replacing
      `web/vendor/chart.js/` per plan.md Project Structure), matching the existing Chart.js
      vendoring pattern (research.md §4)
- [ ] T004 [P] Create `web/css/tailwind.css` with `@import "tailwindcss";` plus a `@theme` block
      mapping Tailwind utility tokens (colors, spacing, fonts) to the existing CSS custom
      properties in `web/css/tokens.css` — no raw hex/value duplication (research.md §2)
- [ ] T005 Run `npm run build:css` to produce the initial `web/css/tailwind.generated.css` and
      commit it as a build artifact (plan.md Project Structure; FR-012)
- [ ] T006 Add `<link rel="stylesheet" href="css/tailwind.generated.css">` to `web/index.html`
      alongside the existing `app.css`/`tokens.css` links, and add the nav-toggle `<button>` markup
      per contracts/navigation.md's markup contract

**Checkpoint**: Tailwind compiles to a static file, ApexCharts is vendored, and both are wired into
`index.html` — but no view is restyled yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core seams every user story depends on — the ApexCharts rendering engine swap
(chart-factory.md contract) and the navigation contract (navigation.md), since both FR-013's chart
swap and FR-002–FR-004's nav work touch shared modules consumed by all three user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T007 Rewrite `web/js/charts/chart-factory.js` internals to build ApexCharts option objects
      and mount into a `<div>` container instead of a `<canvas>`, keeping the exported
      `renderChart(container, mode, data)` signature per contracts/chart-factory.md; implement
      idempotent remount (`chart.destroy()` before re-creating), all 5 modes, `--chart-color-1..6`
      CSS-variable-sourced series colors, and `t()`-resolved axis/legend text
- [ ] T008 Keep the `typeof window !== 'undefined'` guard in `web/js/charts/chart-factory.js` so it
      does not throw when imported in the DOM-less `node:test` environment (contracts/
      chart-factory.md Compatibility note)
- [ ] T009 [P] Extend `renderNav()`/`NAV_ITEMS` in `web/js/main.js` to render the full markup
      contract from contracts/navigation.md: `<button class="app-nav__toggle" aria-expanded
      aria-controls="app-nav-list">` + `<ul id="app-nav-list" data-open>` with one `<li><a>` per
      route, `aria-current="page"` recomputed synchronously inside the existing `dispatch()` call
- [ ] T010 [P] Add nav toggle open/close vanilla JS in `web/js/main.js`: click toggles
      `aria-expanded`/`data-open`, closes on nav-item selection, outside click, and Escape key
      (contracts/navigation.md Keyboard/a11y; Edge Cases)
- [ ] T011 [P] Add new i18n keys (nav `aria-label`, toggle accessible label, empty-state text,
      "not producing" status text) to `web/i18n/de.json` and `web/i18n/en.json`
- [ ] T012 [P] Add Tailwind utility classes for `.app-nav`, `.app-nav__toggle`, `.app-nav__list`
      responsive behavior (persistent `md:` and above, collapsible below) to `web/css/tailwind.css`
      `@theme`/component layer, then re-run `npm run build:css`
- [ ] T013 Update each of `web/js/views/dashboard.js`, `day-view.js`, `month-view.js`,
      `year-view.js`, `total-view.js`, `compare-view.js` to create/obtain a `<div>` chart-mount
      element instead of `<canvas>` and pass it to `renderChart` (only call-site change per
      contracts/chart-factory.md "DOM change required at call sites")
- [ ] T014 Remove `web/vendor/chart.js/` and the `chart.js` devDependency from `package.json` now
      that all call sites use ApexCharts (plan.md Project Structure)

**Checkpoint**: Foundation ready — ApexCharts renders in all 5 modes via the same public API, and
the responsive nav contract is implemented. User story work (styling polish, active-state
verification, viewport testing) can now proceed.

---

## Phase 3: User Story 1 - Coherent, Polished Presentation of All Solar Data (Priority: P1) 🎯 MVP

**Goal**: All six views (dashboard/current, day, month, year, total, compare) share one consistent
Tailwind-based visual design system — colors, typography, spacing, card/table treatment — in both
light and dark mode.

**Independent Test**: Load each of the six views and confirm they share the same color palette,
typography scale, spacing rhythm, and card/table styling, with no view visibly "unstyled"; toggle
OS dark mode and confirm all six adapt with sufficient contrast.

### Tests for User Story 1

- [ ] T015 [P] [US1] Playwright spec `tests/e2e/dashboard-consistency.spec.js`: navigate to all six
      views, assert each uses shared Tailwind utility classes for headings/cards/chart containers
      (no view missing the shared class set), per quickstart.md §1
- [ ] T016 [P] [US1] Playwright spec `tests/e2e/dashboard-dark-mode.spec.js`: use
      `page.emulateMedia({ colorScheme: 'dark' })`, load each of the six views, assert no
      console/page errors and sufficient computed contrast on text/background pairs, per
      quickstart.md §1 and research.md §5(d)
- [ ] T017 [P] [US1] Playwright spec `tests/e2e/dashboard-charts.spec.js`: open day, month, year,
      total, compare views, assert each renders an `.apexcharts-svg` element (not `<canvas>`) with
      a working hover tooltip showing correct units (W for day, kWh for month/year/total/compare),
      per quickstart.md §6 and research.md §5(e)
- [ ] T018 [P] [US1] Playwright spec `tests/e2e/dashboard-empty-state.spec.js`: navigate to a
      day/month/year route with no data (future date or out-of-range year), assert a styled
      empty/placeholder state renders with no console error, per quickstart.md §4, FR-009
- [ ] T019 [P] [US1] Playwright spec `tests/e2e/dashboard-status.spec.js`: assert the
      current-production summary stat's "not producing" state includes a text/icon node, not a
      color-only indicator, per quickstart.md §5, FR-010

### Implementation for User Story 1

- [ ] T020 [US1] Migrate `web/js/views/dashboard.js`'s summary-stat cards (current power,
      today's total) to Tailwind utility classes, rendering as visually distinct, scannable
      elements per data-model.md's `SummaryStat` (FR-005)
- [ ] T021 [US1] Implement the `SummaryStat.status` non-color indicator (icon + text label
      alongside color) in `web/js/views/dashboard.js`, driven by `producing`/`idle`/`unavailable`
      (FR-010)
- [ ] T022 [P] [US1] Migrate `web/js/views/day-view.js` chart container and layout to Tailwind
      utility classes (chart-mount `<div>` styling only — data/logic unchanged)
- [ ] T023 [P] [US1] Migrate `web/js/views/month-view.js` chart container and summary elements to
      Tailwind utility classes
- [ ] T024 [P] [US1] Migrate `web/js/views/year-view.js` chart container and summary elements to
      Tailwind utility classes
- [ ] T025 [P] [US1] Migrate `web/js/views/total-view.js` lifetime-total summary elements to
      Tailwind utility classes (data-model.md `SummaryStat`)
- [ ] T026 [P] [US1] Migrate `web/js/views/compare-view.js` chart container and layout to Tailwind
      utility classes
- [ ] T027 [US1] Implement the shared FR-009 empty/placeholder-state component (used by
      day/month/year/total/compare views when data is unavailable) as a small helper — e.g.
      `web/js/views/empty-state.js` — styled with Tailwind utility classes, imported by each view
      module
- [ ] T028 [US1] Trim now-redundant rules from `web/css/app.css` as each view's markup migrates to
      Tailwind utility classes, keeping only rules with no Tailwind equivalent
- [ ] T029 [US1] Verify `web/css/tokens.css` light/dark `--color-*`/`--chart-color-*` values are
      unchanged (source of truth per research.md §2) and confirm the Tailwind `@theme` mapping in
      `web/css/tailwind.css` resolves correctly in both color schemes

**Checkpoint**: User Story 1 fully functional and independently testable — all six views share one
visual system in light and dark mode, with empty states and non-color status indicators in place.

---

## Phase 4: User Story 2 - Clear App Navigation Between All Views (Priority: P2)

**Goal**: A visible, always-available navigation menu lists all six views, is one click/tap away
from any view, and visually highlights the currently active view, updating without a full page
reload.

**Independent Test**: From any view, open the navigation and confirm every other view is listed
and reachable in one click, and the active view is visually highlighted; select a different view
and confirm the nav updates without a full page reload.

### Tests for User Story 2

- [ ] T030 [P] [US2] Playwright spec `tests/e2e/dashboard-nav.spec.js`: from each of the six
      views, assert the nav lists all six routes with human-readable `t()`-resolved labels, and
      exactly one `<a>` carries `aria-current="page"` matching the current route, per
      quickstart.md §2
- [ ] T031 [P] [US2] Extend `tests/e2e/dashboard-nav.spec.js` (or add a case) asserting that
      clicking a nav item updates `aria-current` and view content within 2 seconds without a
      `load` event firing on `page` (no full page reload), per quickstart.md §2, FR-011

### Implementation for User Story 2

- [ ] T032 [US2] Verify/finish `NAV_ITEMS` in `web/js/main.js` covers all 6 routes from
      `router.js` in fixed order (data-model.md `NavigationMenu.items` validation rule) — add any
      missing i18n `labelKey`s
- [ ] T033 [US2] Ensure active-state (`aria-current="page"`) recomputation happens synchronously
      inside the same `dispatch(route)` call that updates `currentRoute` in `web/js/main.js`, per
      contracts/navigation.md "no separate re-render pass, no flash of stale state"
- [ ] T034 [US2] Style the persistent (`md:` and above) and collapsible (below `md:`) nav layouts
      with Tailwind utility classes in `web/css/tailwind.css` / view markup, matching
      contracts/navigation.md's responsive-layout requirements exactly (toggle hidden at `md:`+,
      list always visible at `md:`+; toggle visible + `aria-expanded`-driven list below `md:`)

**Checkpoint**: User Stories 1 AND 2 both work independently — consistent presentation plus a
fully labeled, active-state-aware navigation menu.

---

## Phase 5: User Story 3 - Usable Navigation and Layout on Any Screen Size (Priority: P3)

**Goal**: Navigation and data layout adapt correctly from 320px to 2560px viewport width, with no
clipped, overlapping, or horizontally-scrolling content on any view.

**Independent Test**: Resize the viewport from 320px to 2560px and confirm the navigation adapts
(collapsible menu on narrow screens, persistent layout on wide screens) and stays fully usable at
every size, including the yearly comparison chart reflowing without overlap or clipping.

### Tests for User Story 3

- [ ] T035 [P] [US3] Playwright spec `tests/e2e/dashboard-responsive.spec.js`: set viewport widths
      320, 375, 768, 1024, 1440, 2560px in turn, load each of the six views, assert
      `document.documentElement.scrollWidth` never exceeds the viewport width (zero horizontal
      scroll), per quickstart.md §3, SC-002
- [ ] T036 [US3] Extend `tests/e2e/dashboard-responsive.spec.js` with a case for the `compare`
      view (heaviest content — yearly comparison chart) at each breakpoint, asserting no
      overlapping/clipped summary elements or chart content, per quickstart.md §3 acceptance
      scenario 3

### Implementation for User Story 3

- [ ] T037 [US3] Audit and fix any remaining fixed-width/overflow issues in
      `web/js/views/compare-view.js` markup/Tailwind classes so the yearly comparison chart and
      surrounding summary elements reflow at all widths 320px–2560px (FR-004)
- [ ] T038 [P] [US3] Audit and fix responsive Tailwind classes across
      `web/js/views/dashboard.js`, `day-view.js`, `month-view.js`, `year-view.js`,
      `total-view.js` for the same 320px–2560px zero-horizontal-scroll requirement (SC-002)
- [ ] T039 [US3] Confirm ApexCharts instances in `web/js/charts/chart-factory.js` resize with
      their container (`chart.resize()`/responsive option) with no horizontal overflow, per
      contracts/chart-factory.md "Responsive" behavioral requirement

**Checkpoint**: All three user stories independently functional — consistent design, full
navigation with active-state, and confirmed responsive behavior 320px–2560px.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, regression verification, and cleanup spanning all user stories.

- [ ] T040 [P] Update `README.md` and `README.de.md` to describe the new Tailwind-based visual
      design and responsive navigation (plan.md Constitution Check, Documentation Standards)
- [ ] T041 [P] Update `docs/user-guide.md` and `docs/user-guide.de.md` to reflect the new nav
      interaction (hamburger on mobile, persistent on desktop) and ApexCharts tooltip behavior
- [ ] T042 Run `npm run lint` and `npm run format:check`; fix any violations across changed files
      (constitution Technical Standards)
- [ ] T043 Run `npm run test:scripts` (node:test unit suites, including router/aggregates) and
      confirm all pass unchanged (SC-005)
- [ ] T044 Run `npm test` (full Playwright suite): confirm the pre-existing
      `tests/e2e/navigation.spec.js`, `dashboard.spec.js`, `detail-views.spec.js` from
      001-website-modernization pass unchanged, alongside all new specs from Phases 3–5
      (quickstart.md §7, SC-005)
- [ ] T045 Execute quickstart.md's full validation walkthrough (§1–7) manually via `npm start` in
      a browser, confirming each numbered scenario's expected outcome

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001–T006) completion — BLOCKS all user stories
- **User Stories (Phase 3–5)**: All depend on Foundational (Phase 2) completion
  - US1 (P1) has no dependency on US2/US3
  - US2 (P2) reuses the nav skeleton from T009–T010 (Foundational) but is independently testable
  - US3 (P3) reuses Tailwind responsive classes from US1/US2 work but tests/fixes are independent
  - Recommended order: US1 → US2 → US3 (priority order), though all three can proceed in parallel
    once Phase 2 is complete if staffed separately
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### Within Each User Story

- Tests written first (T015–T019, T030–T031, T035–T036), expected to fail until implementation
  tasks land
- View-module migrations (T022–T026, US1) are parallelizable — different files
- Nav behavior tasks (T032–T034, US2) depend on the Foundational nav skeleton (T009–T010)
- Responsive audits (T037–T039, US3) depend on US1's Tailwind class migrations being in place

### Parallel Opportunities

- T003 and T004 (Setup) in parallel — different files
- T009, T010, T011, T012 (Foundational) in parallel — different files
- T015–T019 (US1 tests) in parallel — different spec files
- T022–T026 (US1 view migrations) in parallel — different view files
- T030–T031 (US2 tests) in parallel
- T038 (US3) in parallel across the listed view files (excluding T037's compare-view focus)
- T040–T041 (Polish docs) in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all US1 test specs together:
Task: "Playwright spec tests/e2e/dashboard-consistency.spec.js"
Task: "Playwright spec tests/e2e/dashboard-dark-mode.spec.js"
Task: "Playwright spec tests/e2e/dashboard-charts.spec.js"
Task: "Playwright spec tests/e2e/dashboard-empty-state.spec.js"
Task: "Playwright spec tests/e2e/dashboard-status.spec.js"

# Launch all US1 view-module Tailwind migrations together:
Task: "Migrate web/js/views/day-view.js to Tailwind utility classes"
Task: "Migrate web/js/views/month-view.js to Tailwind utility classes"
Task: "Migrate web/js/views/year-view.js to Tailwind utility classes"
Task: "Migrate web/js/views/total-view.js to Tailwind utility classes"
Task: "Migrate web/js/views/compare-view.js to Tailwind utility classes"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Tailwind + ApexCharts wired in)
2. Complete Phase 2: Foundational (chart-factory ApexCharts rewrite + nav skeleton — CRITICAL,
   blocks all stories)
3. Complete Phase 3: User Story 1 (consistent presentation, light/dark, empty states)
4. **STOP and VALIDATE**: Run quickstart.md §1, §4, §5, §6 manually plus T015–T019
5. Deploy/demo if ready — this alone satisfies FR-001, FR-005, FR-006, FR-009, FR-010, FR-013

### Incremental Delivery

1. Setup + Foundational → ApexCharts and nav skeleton ready
2. Add User Story 1 → validate independently → demo (MVP!)
3. Add User Story 2 → validate independently → demo (full nav with active-state)
4. Add User Story 3 → validate independently → demo (responsive 320px–2560px confirmed)
5. Polish (Phase 6) → docs, lint, full regression suite

---

## Notes

- [P] tasks touch different files with no dependencies on incomplete same-phase tasks
- [Story] label maps each task to US1/US2/US3 for independent-delivery traceability
- No `.js` SolarLog data file is created, modified, or touched by any task (Constitution
  Principle I; FR-008)
- `router.js` route parsing/formatting is never modified — only `main.js`'s `renderNav()`/
  `NAV_ITEMS` consumers (contracts/navigation.md Non-goals)
- Commit after each task or logical group; stop at any phase checkpoint to validate independently
