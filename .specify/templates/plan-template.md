# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]

**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  These fields are fixed for this repository (solarlog-viewer) — a single static web app with no
  backend, per .specify/memory/constitution.md. Only override a field below if this feature
  genuinely changes it (e.g. adds a real dependency, needs a constitution amendment for a new
  storage mechanism) — note the override and why. Performance Goals/Constraints/Scale still vary
  per feature and MUST be filled in for real, not left as the example text.
-->

**Language/Version**: Vanilla JavaScript (ES2022+), native ES modules (`type="module"`) — no
bundler, no JS framework (constitution Technical Standards → Frontend).

**Primary Dependencies**: ApexCharts (vendored at `web/vendor/apexcharts/`, via
`web/js/charts/chart-factory.js`); Tailwind CSS (approved exception — compiled offline via
`npm run build:css` into `web/css/tailwind.generated.css`, never loaded from a CDN at runtime).
Note any feature-specific addition here explicitly.

**Storage**: Browser `localStorage` for user preferences (see `web/js/settings.js` for the
existing key pattern); the SolarLog device's static `.js` data files under `web/data/` /
`web/hist/` are the source of truth for plant data and MUST NOT be modified (constitution
Principle I).

**Testing**: `node --test` (via `npm run test:scripts`) for pure logic in `scripts/*.js` and
`web/js/**/*.test.js`; Playwright (`npx playwright test --reporter=line`) as the primary quality
gate for visible UI changes — every feature with a UI-visible effect MUST get at least one
Playwright test (constitution Testing standard).

**Target Platform**: Static site, deployable to any plain web host (Apache, nginx, GitHub Pages,
S3) with no runtime dependencies; must render correctly 320px–2560px without horizontal scrolling
(constitution Principle IV).

**Project Type**: Single static web app (`web/`) — no frontend/backend split, no server component
(constitution Principle III).

**Performance Goals**: [domain-specific to this feature, e.g., "table appears in <200ms of click" — fill in for real]

**Constraints**: [domain-specific to this feature, beyond the constitution's standing constraints above — fill in for real]

**Scale/Scope**: [domain-specific to this feature, e.g., expected max row/data-point count — fill in for real]

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

<!--
  This repo has one fixed layout (below) — there is no frontend/backend or mobile/API split to
  choose between. ACTION REQUIRED: expand the tree with the actual new/changed files for this
  feature (mirroring how prior specs/*/plan.md did it), not just the unchanged skeleton.
-->

```text
web/
├── css/                  # app.css (hand-written, CSS custom properties), tailwind.css (source),
│                            tailwind.generated.css (build output, not hand-edited), tokens.css
├── js/
│   ├── charts/            # chart-factory.js — ApexCharts option-builders per visualization mode
│   ├── data/               # .js data-file parsing/aggregation (client-side only, see Principle I)
│   ├── views/              # one module per route/component (day-view.js, month-view.js, ...)
│   ├── i18n.js, settings.js, router.js, config.js, format.js, main.js
├── i18n/                  # de.json / en.json translation strings
├── data/, hist/           # SolarLog device's static .js data files — read-only, never modified
└── vendor/                # vendored third-party libraries (e.g. apexcharts), no CDN loads

scripts/                  # ESM helper/CLI scripts (backfill, validation, sync) — see project
                             CLAUDE.md for the mandatory TDD/lint conventions for these

tests/e2e/                 # Playwright specs
web/js/**/*.test.js        # node:test unit tests, co-located with the module they cover
```

**Structure Decision**: New modules for this feature go under the existing `web/js/views/` (and
`web/js/charts/` if a chart-factory.js change is needed) alongside the current view/component
files — no new top-level directory. Document the specific new/changed files above under the
generic tree.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
