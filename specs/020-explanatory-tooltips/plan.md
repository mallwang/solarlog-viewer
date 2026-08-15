# Implementation Plan: Explanatory Tooltips

**Branch**: `020-explanatory-tooltips` | **Date**: 2026-08-15 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/020-explanatory-tooltips/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a small, focusable "i" info button next to any stats-panel label that has a registered
explanation (initially: "Tagesertrag/Monatsertrag/Jahresertrag/Gesamtertrag in €", "Soll", "Soll
(auflaufend)", "Ist", "Vermiedenes CO2"). Hovering or keyboard-focusing the button reveals a
short German tooltip describing that stat's calculation; on touch-only devices the button is not
rendered at all. The explanation text lives in the existing i18n JSON files (`web/i18n/de.json` /
`en.json`) under a new `explanations.*` namespace — the same single-source-of-truth mechanism
already used for every other UI label — so adding or editing wording never touches rendering
code. Rendering, hover/focus disclosure, touch-device omission, and edge-of-viewport flipping are
all implemented once in the shared `stats-panel.js` module (used by day/month/year/total/welcome
views), not duplicated per view.

## Technical Context

<!--
  These fields are fixed for this repository (solarlog-viewer) — a single static web app with no
  backend, per .specify/memory/constitution.md. Only override a field below if this feature
  genuinely changes it (e.g. adds a real dependency, needs a constitution amendment for a new
  storage mechanism) — note the override and why. Performance Goals/Constraints/Scale still vary
  per feature and MUST be filled in for real, not left as the example text.
-->

**Language/Version**: Vanilla JavaScript (ES2022+), native ES modules (`type="module"`) — no
bundler, no JS framework (constitution Technical Standards → Frontend). No new dependency for
this feature.

**Primary Dependencies**: ApexCharts (vendored at `web/vendor/apexcharts/`, via
`web/js/charts/chart-factory.js`); Tailwind CSS (approved exception — compiled offline via
`npm run build:css` into `web/css/tailwind.generated.css`, never loaded from a CDN at runtime).
This feature adds no new dependency — the tooltip's disclosure behavior (hover/focus reveal,
touch-device omission) is implemented with plain CSS (`@media (hover: hover) and (pointer:
fine)`, `:focus-visible`) plus a small vanilla-JS edge-flip helper; no tooltip/positioning library
is introduced.

**Storage**: Browser `localStorage` for user preferences (see `web/js/settings.js` for the
existing key pattern); the SolarLog device's static `.js` data files under `web/data/` /
`web/hist/` are the source of truth for plant data and MUST NOT be modified (constitution
Principle I). A local SQLite cache (`data/solarlog.sqlite3`, populated by `scripts/sync-sqlite.js`)
exists for developer/CLI tooling only — not a runtime dependency of the browser viewer. This
feature adds no new storage; explanation text lives in the existing `web/i18n/*.json` files
alongside every other UI label.

**Testing**: `node --test` (via `npm run test:scripts`) for pure logic in `scripts/*.js` and
`web/js/**/*.test.js`; Playwright (`npx playwright test --reporter=line`) as the primary quality
gate for visible UI changes — every feature with a UI-visible effect MUST get at least one
Playwright test (constitution Testing standard). This feature needs both: a `node --test` unit
test for the new markup-building helper (icon/tooltip HTML shape, explanation-present-vs-absent
branching) and Playwright coverage for hover-reveal, focus-reveal, touch-device omission, and
edge-flip, against a real (desktop + mobile emulated) viewport.

**Target Platform**: Static site, deployable to any plain web host (Apache, nginx, GitHub Pages,
S3) with no runtime dependencies; must render correctly 320px–2560px without horizontal scrolling
(constitution Principle IV).

**Project Type**: Single static web app (`web/`) — no frontend/backend split, no server component
(constitution Principle III).

**Performance Goals**: Tooltip reveal must feel instantaneous — pure CSS `:hover`/`:focus-visible`
transitions (no JS-driven show/hide), so there is no measurable delay between pointer-in/focus and
the tooltip appearing. The one JS-driven step (edge-flip measurement, see Research) runs only once
per hover/focus event on a single already-visible element (`getBoundingClientRect`), not on page
load or scroll, so it has no measurable effect on initial render or scrolling performance.

**Constraints**: Must not change `.stats-panel`/`.summary-table` layout, spacing, or visual
weight for stats that have no registered explanation (FR-009, mobile pixel-parity in User Story 2) — the icon is additive markup only rendered when an explanation exists, and is `display: none`
outside `(hover: hover) and (pointer: fine)`. Must not introduce a new design language — icon and
tooltip styling reuse existing CSS custom properties (colour/spacing/radius tokens), matching the
approved mockup (`design.md`, `mockup.html`).

**Scale/Scope**: 5 initial explanation entries (`yieldEuro`, `soll`, `sollAuflaufend`, `ist`,
`co2`), rendered across up to 4 stats-panel instances per page load (day/month/year/total/welcome
views each mount one panel; only one view is ever mounted at a time). Expected to grow slowly
(a handful of entries per future feature) — no pagination/virtualization concerns.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Static-File Data Model is Sacred)**: N/A — no `.js` data file is read, written,
  or reinterpreted. PASS.
- **Principle II (Zero Historical Data Loss)**: N/A — purely a presentational addition to already-
  computed stats; no historical record is touched. PASS.
- **Principle III (No Backend Introduction)**: All new logic (markup building, hover/focus CSS,
  edge-flip measurement) runs client-side in the existing static viewer. PASS.
- **Principle IV (Responsive-First Layout)**: The icon is native-focusable, keyboard-operable, and
  omitted entirely (not just hidden) on touch-only viewports so it never affects mobile layout
  width/height (FR-004, User Story 2, SC-002). Tooltip stays within the viewport via the edge-flip
  behavior (FR-007). PASS.
- **Principle V (Modern Charting — No Custom Pixel Math)**: N/A — no chart is touched; the only
  "positioning" logic is a two-state (centered/right-anchored) CSS class toggle driven by a single
  `getBoundingClientRect` check, not a custom pixel-math rendering engine. PASS.
- **Principle VI (Preserve All Five Visualization Modes)**: N/A — no visualization mode is
  changed. PASS.
- **Technical Standards → Frontend** (vanilla JS/CSS, no framework, CSS custom properties for
  theme values): satisfied — no new dependency, all styling via existing tokens. PASS.
- **Testing standard** (Playwright + `node --test`): a Playwright spec and a `node --test` unit
  test are both planned (see Technical Context → Testing, and Phase 1 quickstart.md). PASS
  (pending; tests written before implementation per Development Workflow §3).
- **Documentation Standards** (README/README.de, user-guide/user-guide.de, JSDoc, file-level
  JSDoc): all new/modified exported functions get JSDoc; README and user-guide updates are part
  of the implementation tasks (not optional). PASS (pending; tracked as tasks).

No violations requiring justification — Complexity Tracking is not filled in.

## Project Structure

### Documentation (this feature)

```text
specs/020-explanatory-tooltips/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── info-tooltip.md
├── design.md              # Already exists — approved mockup (input to this plan)
├── mockup.html             # Already exists — approved mockup HTML
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
web/
├── css/
│   └── app.css                       # + .stat-label / .info-trigger / .info-tooltip rules
│                                        (hover/focus-visible disclosure, touch-device omission,
│                                        edge-flip modifier class) — mirrors mockup.html's
│                                        approved styles
├── js/
│   ├── views/
│   │   ├── stats-panel.js             # statsRow()/statsPanelMarkup() extended to accept an
│   │   │                                optional explanation i18n key per row and render the
│   │   │                                info button/tooltip; wires the one shared edge-flip
│   │   │                                listener (new: initInfoTooltips())
│   │   ├── stats-panel.test.js        # + tests for the explanation-key branch
│   │   ├── day-view.js                # dayStatsRows(): pass explanation keys for yieldEuro/
│   │   │                                soll/ist/co2
│   │   ├── month-view.js              # monthStatsRows(): pass explanation keys for yieldEuro/
│   │   │                                sollAuflaufend|sollTotal/ist/co2
│   │   ├── year-view.js               # yearStatsRows(): same, for year-view's rows
│   │   ├── total-view.js              # totalStatsRows(): same, for total-view's rows
│   │   ├── welcome-view.js            # co2 row: same explanation key as total-view's co2
│   │   └── main.js                    # calls initInfoTooltips() once at startup (document-level
│   │                                     delegated listener, not per-view)
│   └── i18n.js                        # unchanged — t() already resolves nested keys
├── i18n/
│   ├── de.json                        # + explanations.{yieldEuro,soll,sollAuflaufend,ist,co2}
│   └── en.json                        # + same keys, English wording
tests/e2e/
└── explanatory-tooltips.spec.js       # new Playwright spec (hover reveal, focus reveal, touch
                                          omission, edge-flip, disappears-on-pointer-out)
```

**Structure Decision**: No new top-level directory. All markup/behavior changes land in the
existing `web/js/views/stats-panel.js` (the single shared module every stats panel already goes
through per `design.md`), with each view module only adding a third tuple element (an explanation
i18n key) to its existing row arrays. Explanation wording lives in the existing `web/i18n/*.json`
files, not a new data file, per FR-006's "single centrally maintained place" requirement.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

_No violations — table omitted._
