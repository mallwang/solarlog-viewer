# Implementation Plan: Welcome Page (Default Landing View)

**Branch**: `015-welcome-page-dashboard` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-welcome-page-dashboard/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Replace the current default route (today's day view) with a new "welcome" view shown for
empty/unrecognized hashes only. The welcome view is a 2/3 + 1/3 (stacking on mobile) layout: left
= a lightweight vanilla-JS photo carousel over static, config-listed plant photos + a plant-details
panel built from the already-parsed `base_vars.js` (`plant` object main.js already passes to every
view); right = a new, minimal ApexCharts option-builder (`day-total` mode) showing only today's
combined feed-in line on the existing fixed `DAY_CHART_AXES.feedInW` axis — no efficiency/UDC
series, reusing chart-factory.js's existing day-chart helpers rather than duplicating them.
`router.js`'s `defaultRoute()` changes to return `{ view: 'welcome', params: {} }`; all explicit
day/month/year/total routes are untouched (FR-002).

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
Principle I). A local SQLite cache (`data/solarlog.sqlite3`, populated by `scripts/sync-sqlite.js`)
exists for developer/CLI tooling only — not a runtime dependency of the browser viewer.

**Testing**: `node --test` (via `npm run test:scripts`) for pure logic in `scripts/*.js` and
`web/js/**/*.test.js`; Playwright (`npx playwright test --reporter=line`) as the primary quality
gate for visible UI changes — every feature with a UI-visible effect MUST get at least one
Playwright test (constitution Testing standard).

**Target Platform**: Static site, deployable to any plain web host (Apache, nginx, GitHub Pages,
S3) with no runtime dependencies; must render correctly 320px–2560px without horizontal scrolling
(constitution Principle IV).

**Project Type**: Single static web app (`web/`) — no frontend/backend split, no server component
(constitution Principle III).

**Performance Goals**: Welcome page's three regions (carousel, plant details, today chart) render
independently — no region blocks another (SC-004); today's-chart data fetch reuses the same
`min{yymmdd}.js` fetch path day-view.js already uses, so no new perf budget beyond the existing day
chart's.

**Constraints**: No new build step or manifest generator — plant photos are static files under a
new `web/img/plant/` directory, listed explicitly by filename in a `config.js` constant (matching
the existing manual-override pattern of `SITE_TITLE`/`SKY_LOCATION_OVERRIDE` in that file) so the
operator adds a file _and_ a one-line config entry, with no build/scan step (constitution Principle
III — no new pipeline). Today's chart MUST NOT show efficiency/UDC series at all (not merely hidden
via the existing legend-toggle state), so it needs its own minimal option-builder rather than
reusing `buildDayOptions` with series hidden.

**Scale/Scope**: Photo count is small (a handful of operator-provided images, not a device-fed
stream) — no pagination/virtualization needed for the carousel. One new view module, one new
chart-factory mode, one new small carousel helper module; no changes to data-parsing modules.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Static-File Data Model is Sacred)**: PASS — no `.js` data file touched; welcome
  view reads `base_vars.js`/`min{yymmdd}.js` exactly as day-view.js already does, no new parser.
- **Principle III (No Backend Introduction)**: PASS — plant photos are static files served as-is;
  no manifest-generation script, no server-side listing. All rendering (carousel, chart) is
  client-side.
- **Principle IV (Responsive-First Layout)**: PASS — 2/3+1/3 desktop split collapses to a single
  stacked column on narrow viewports (FR-005); Tailwind grid utilities per the existing dashboard/
  detail-view pattern (`dashboard.js`'s `grid grid-cols-1 ... lg:grid-cols-3`).
- **Principle V (Modern Charting — No Custom Pixel Math)**: PASS — today's chart is a new
  ApexCharts option-builder mode (`day-total`) inside the existing `chart-factory.js`, not a new
  rendering engine.
- **Principle VI (Preserve All Five Visualization Modes)**: PASS — no existing mode is removed,
  merged, or altered; the welcome page's chart is an additional, minimal presentation of data the
  day chart (Mode 0) already computes, reachable only from the new default route.
- **Technical Standards → Frontend**: PASS — vanilla ES modules, Tailwind utility classes (approved
  exception), no new framework, no bundler.
- **Testing standard**: Every acceptance scenario above needs a Playwright test (welcome page
  render, carousel 0/1/many-image states, chart empty state, deep-link routes unaffected) — see
  quickstart.md.

No violations — Complexity Tracking left empty.

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
`web/js/charts/` for the new chart mode) alongside the current view/component files — no new
top-level code directory. `web/img/plant/` is the one new top-level directory, holding static
image assets only (no code). New/changed files:

```text
web/
├── img/plant/                      # NEW — static plant photo files (operator-added), e.g.
│                                       roof-array.jpg, inverter-room.jpg
├── js/
│   ├── config.js                    # + PLANT_PHOTOS: string[] (paths under img/plant/, empty by
│   │                                   default)
│   ├── router.js                    # defaultRoute() → { view: 'welcome', params: {} }; 'welcome'
│   │                                   case added to formatRoute() (→ '#/')
│   ├── main.js                      # viewModules['welcome'] entry; NAV_ITEMS unchanged (brand
│   │                                   link already points at '#/')
│   ├── charts/
│   │   └── chart-factory.js         # + 'day-total' mode: single total feed-in line series on
│   │                                   DAY_CHART_AXES.feedInW, no efficiency/UDC axes or series
│   └── views/
│       ├── welcome-view.js          # NEW — mounts the 3 regions, independent try/catch per
│       │                               region (FR-013/FR-017/SC-004)
│       ├── photo-carousel.js        # NEW — 0/1/many-image carousel helper (FR-008/009/010),
│       │                               same co-located-helper pattern as period-nav.js
│       └── plant-details-panel.js   # NEW — renders PlantMetadata (title/location/operator/
│                                       capacity/commissioned date/inverter list) from plant.js
├── i18n/                            # + welcome.* keys (de.json / en.json)
└── css/app.css                      # + carousel-specific styles not expressible via Tailwind
                                        utilities alone (e.g. crossfade/slide transition), if any

tests/e2e/
└── welcome-page.spec.js             # NEW — covers Acceptance Scenarios above; existing
                                        dashboard-*.spec.js files (currently testing the day-view
                                        fallback at path '/') get updated, not duplicated, since
                                        '/' now serves the welcome page
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally left empty.
