# Implementation Plan: Tailwind CSS Dashboard Redesign

**Branch**: `005-tailwind-css-dashboard-ui` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-tailwind-css-dashboard-ui/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Restyle the existing single-page SolarLog dashboard (`web/`) with **Tailwind CSS**, compiled via
an offline build step into a static CSS file, so all six views (dashboard/current, day, month,
year, total, compare) share one consistent visual design system, and add a responsive, always-
reachable navigation menu that highlights the active view and collapses to a menu on narrow
viewports. All charts across the five visualization modes are re-rendered using **ApexCharts** in
place of the currently vendored Chart.js, as a like-for-like rendering-engine swap with equivalent
or better tooltip/responsiveness behavior. No data format, data-fetching logic, routing scheme, or
view/mode behavior changes — this is a presentation, navigation-chrome, and charting-engine
feature only.

## Technical Context

**Language/Version**: JavaScript (ES2022+, native ES modules), HTML5, CSS3 — no change from
existing `web/` codebase.

**Primary Dependencies**: Tailwind CSS (CLI-compiled, v4) for styling; ApexCharts (vendored ESM
build under `web/vendor/apexcharts/`, replacing `web/vendor/chart.js/`) for charting. No JS
bundler is introduced; JavaScript continues to load via native `<script type="module">`.

**Storage**: N/A — existing static SolarLog `.js` data files under `web/data/`/`web/hist/`,
unchanged (Constitution Principle I; FR-008).

**Testing**: Playwright (`tests/e2e/`, `npm test`) for behavior/visual/accessibility assertions;
Node `node:test` (`npm run test:scripts`) for pure-function unit tests (chart-factory helpers,
nav active-state derivation) — matches existing project testing standard.

**Target Platform**: Static file host (browser-only), any modern evergreen browser — unchanged
from existing deployment model.

**Project Type**: Single project (web frontend only, no backend) — same as `001-website-
modernization`'s "Option 1" structure.

**Performance Goals**: No new perf target introduced; existing pages must continue to load and
render charts within the current interactive-feel expectations (no specific numeric budget was
requested and none is required by the constitution beyond "responsive, no horizontal scroll").

**Constraints**: Compiled Tailwind CSS output MUST be a static file, never a runtime/CDN script
(FR-012, constitution amendment). Navigation and layout MUST remain usable 320px–2560px (FR-004,
Constitution Principle IV). No `.js` SolarLog data file may be touched (Constitution Principle I).
No application server may be introduced (Constitution Principle III).

**Scale/Scope**: 6 views, 5 chart-rendering modes, 1 nav component, 2 languages (DE/EN) — same
scope as the existing single-page app; no new views or data added (spec Assumptions).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle                                    | Applicability | How Satisfied                                                                                                                                                                                            |
| --------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Static-File Data Model is Sacred           | ✅ Core        | No `.js` data file touched; redesign reads existing data exactly as today (FR-008).                                                                                                                     |
| II. Zero Historical Data Loss                 | ✅ Core        | No data parsing/aggregation logic changes; all historical rendering paths preserved unchanged.                                                                                                          |
| III. No Backend Introduction                  | ✅ Core        | Tailwind CSS is produced by a one-time/CI/dev-time build step into a static CSS file (FR-012); nothing new runs server-side or is required at request time.                                            |
| IV. Responsive-First Layout                   | ✅ Core        | Navigation and all views remain usable 320px–2560px (FR-004); validated via Playwright viewport tests (quickstart.md §3).                                                                               |
| V. Modern Charting — No Custom Pixel Math     | ✅ Core        | ApexCharts (established, maintained library) replaces Chart.js as the sole rendering engine for all five modes (FR-013); no custom pixel-positioning engine introduced.                                |
| VI. Preserve All Five Visualization Modes     | ✅ Core        | All five modes (day, month, year, total, compare) preserved with equivalent-or-better fidelity under ApexCharts (FR-013); no mode dropped or merged.                                                   |
| Technical Standards → Frontend (Tailwind)     | ✅ Satisfied via amendment | Constitution amended (v2.0.0 → v2.1.0, this plan) to add a scoped exception permitting Tailwind CSS compiled via an offline build step; JS bundler still not introduced; CSS custom-property tokens remain source of truth (research.md §2). |
| Technical Standards → Testing                 | ✅ Core        | New Playwright specs added per FR/User-Story (quickstart.md §1–6); existing suite re-run unmodified for regression (SC-005, quickstart.md §7).                                                          |
| Technical Standards → Package Manager (npm)   | ✅ Core        | Tailwind CLI and vendored ApexCharts build added via npm/`package-lock.json` only; no yarn/pnpm/bun introduced.                                                                                          |
| Documentation Standards (README, user guides) | ✅ Core        | `README.md`/`README.de.md` and `docs/user-guide.md`/`.de.md` updated during implementation to describe the new nav and visual design (tracked in tasks, not this plan).                                |

**Gate result**: PASS. The one amendment required (Frontend/Tailwind exception) has been recorded
in `.specify/memory/constitution.md` (v2.1.0) as part of this planning step, per the spec's
Assumptions section. No unresolved violations remain; Complexity Tracking table is intentionally
omitted below.

## Project Structure

### Documentation (this feature)

```text
specs/005-tailwind-css-dashboard-ui/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── chart-factory.md  # renderChart() contract: Chart.js -> ApexCharts
│   └── navigation.md     # Nav markup/behavior contract (FR-002–FR-004, FR-011)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
web/
├── index.html                      # add nav toggle button + tailwind.generated.css link
├── css/
│   ├── tokens.css                  # UNCHANGED — source of truth for theme values (light/dark)
│   ├── tailwind.css                # NEW — @import "tailwindcss"; + @theme mapping to tokens.css vars
│   ├── tailwind.generated.css      # NEW — compiled output of `npm run build:css`, committed
│   └── app.css                     # trimmed as rules are migrated to Tailwind utility classes
├── js/
│   ├── main.js                     # extend renderNav()/NAV_ITEMS for responsive nav + a11y toggle
│   ├── router.js                   # UNCHANGED — route parsing/formatting contract untouched
│   ├── i18n.js / de.json / en.json # extended with nav toggle / aria-label / empty-state strings
│   ├── charts/
│   │   └── chart-factory.js        # REWRITTEN internals per contracts/chart-factory.md; same public API shape
│   ├── data/                       # UNCHANGED — aggregates.js, plant.js, min-file.js, etc.
│   └── views/
│       ├── dashboard.js            # summary-stat cards + chart container migrated to Tailwind classes
│       ├── day-view.js             # <canvas> -> <div> chart mount (contracts/chart-factory.md)
│       ├── month-view.js           # same
│       ├── year-view.js            # same
│       ├── total-view.js           # same
│       └── compare-view.js         # same
└── vendor/
    ├── chart.js/                   # REMOVED once ApexCharts swap is complete
    └── apexcharts/                 # NEW — vendored ApexCharts ESM/UMD build (research.md §4)

tests/e2e/
├── navigation.spec.js              # existing legacy-frameset spec — UNCHANGED, must keep passing
└── dashboard-*.spec.js             # NEW specs for redesign: consistency, nav, responsive, dark
                                     # mode, empty state, ApexCharts rendering (quickstart.md §1–6)

package.json                        # add `build:css` script + Tailwind CLI devDependency;
                                     # `start` runs Tailwind --watch alongside browser-sync
```

**Structure Decision**: Single project (Option 1), unchanged from `001-website-modernization`.
This feature modifies the existing `web/` frontend in place — no `backend/`/`frontend/` split
(Constitution Principle III), no new top-level source directory. The documentation-artifact
directory above is new only in that it belongs to this feature's `specs/` folder; the `web/`
source tree it describes is the same one `001-website-modernization` established.

## Complexity Tracking

_No unresolved violations — table intentionally omitted. The one constitution deviation this
feature introduces (Tailwind's compiled build step) is not a "violation requiring justification"
but a spec-anticipated, now-recorded constitution amendment (see Constitution Check above and
`.specify/memory/constitution.md` v2.1.0)._
