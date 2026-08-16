# Implementation Plan: Statistics Page

**Branch**: `022-statistics-page` | **Date**: 2026-08-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/022-statistics-page/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

A new top-level "Statistik" route with a split-view layout (topic nav + content), per the
approved [design.md](design.md) mockup: five routable topics (Common, Heatmaps, Streaks, Trends,
Best vs. Worst) surfacing records, calendar heatmaps, streaks, and trend charts, all computed
client-side purely from already-fetched aggregate files (`days.js`, `days_hist.js`/`hist/
days_hist.js`, `months.js`, `years.js`) — never per-day minute files. Two new modules carry the
weight: a pure computation module (`web/js/data/statistics.js`) that turns merged aggregate data
into stat/heatmap/streak/trend results, and a `web/js/views/statistics/` view package (one shell +
one renderer per topic) that mounts them, reusing the existing router/nav/i18n/chart-factory/
stats-panel/empty-state patterns already established by month-view.js/year-view.js/total-view.js.

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

**Performance Goals**: Topic switch renders with no full page reload and no additional network
fetch beyond the one-time full-history load already cached for that session (SC-004); the initial
Statistics page load fetches at most `hist/days_hist.js` (~250 KB, already cached
`Infinity`-TTL elsewhere in the app once visited) + `data/days_hist.js` + `months.js` + `years.js`

- today's `days.js` — the same files month/year/total views already fetch, via the same
  `fetchTextCached`/`fetchFromBothSources` cache, so a user who already opened month/year/total
  views this session pays no extra bytes at all.

**Constraints**: FR-010 (aggregate-file-only; no per-day minute-file iteration over a range) is
the binding constraint — every stat/chart in this feature must be derivable from `DailyTotal[]`
(days.js/days_hist.js-shaped), `MonthlyTotal[]`, or `YearlyTotal[]` records already parsed
elsewhere in the app (`web/js/data/aggregates.js`). The full-history daily series needed for
heatmaps/streaks/trends is `hist/days_hist.js` (frozen, full 2006–2026-07-28 archive) merged with
`data/days_hist.js` (live device's own rolling archive) and today's `data/days.js` entry, via
`mergeDailyTotals` — the same source `specs/001-website-modernization/data-model.md`'s corrected
`YearComparisonSeries` note documents (not `daysall.js`, which the app has never actually fetched;
see research.md R1).

**Scale/Scope**: Up to ~20 years / ~7,300 days of daily records in memory at once (current
history depth per constitution Principle II); five topics, three calendar heatmaps (371 cells
each, plain CSS grid, no charting-library heatmap type), three trend charts (ApexCharts line/bar,
one data point per year or per day-of-year — at most ~366 points per series), one streak
computation over the full daily series. All computation is a handful of array passes over
already-in-memory data — no pagination or virtualization needed at this scale.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                 | Applies? | How satisfied                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Static-File Data Model is Sacred       | Yes      | Reads only existing `.js` aggregate files, unmodified, via the existing `fetchTextCached`/`fetchFromBothSources` layer; writes nothing.                                                                                                                                                                                                                   |
| II. Zero Historical Data Loss             | Yes      | Uses the same merge functions (`mergeDailyTotals`/`mergeMonthlyTotals`/`mergeYearlyTotals`) every existing view uses, so hist+data coverage and the 2026-07-29 boundary merge (FR-013) are inherited, not reimplemented.                                                                                                                                  |
| III. No Backend Introduction              | Yes      | All computation (`web/js/data/statistics.js`) runs client-side in the browser; no new fetch target, no server.                                                                                                                                                                                                                                            |
| IV. Responsive-First Layout               | Yes      | Split-view nav collapses to a stacked mobile layout per design.md; tile grids/heatmaps/charts reflow, no fixed-pixel layout, no horizontal scroll 320–2560px.                                                                                                                                                                                             |
| V. Modern Charting — No Custom Pixel Math | Yes      | Trend charts (YoY cumulative, lifetime cumulative, specific-yield) render via the existing ApexCharts `chart-factory.js`, extended with new modes — no custom pixel-positioning engine. Calendar heatmaps are plain CSS Grid + `color-mix()` cells (not pixel-computed; see research.md R2 for why this isn't routed through ApexCharts' `heatmap` type). |
| VI. Preserve All Five Visualization Modes | N/A      | This feature adds a new page; it doesn't touch modes 0–4.                                                                                                                                                                                                                                                                                                 |

No violations — Complexity Tracking table left empty.

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

**Structure Decision**: New modules go under the existing `web/js/views/` and `web/js/data/`
directories, plus one new subdirectory (`web/js/views/statistics/`) to keep the five topic
renderers out of the already-large `web/js/views/` listing — no new top-level directory, no build
config changes.

```text
web/js/
├── data/
│   ├── statistics.js            # NEW — pure computation: best/worst month & year, max-daily
│   │                               stats, heatmap cell data, streak detection, YoY/lifetime/
│   │                               specific-yield trend series. No DOM, no fetch — takes already-
│   │                               parsed DailyTotal[]/MonthlyTotal[]/YearlyTotal[]/plant, same
│   │                               style as yield-stats.js.
│   └── statistics.test.js       # NEW — node:test coverage per data-model.md entity
├── views/
│   ├── main.js's NAV_ITEMS       # CHANGED — add the "Statistik" nav entry
│   └── statistics/
│       ├── statistics-view.js         # NEW — page shell: fetches once (full daily history +
│       │                                 months + years + plant), renders the topic nav, mounts
│       │                                 the active topic renderer, handles topic-route changes
│       │                                 without refetching.
│       ├── common-topic.js            # NEW — 8-tile grid (FR-002/003/011)
│       ├── heatmaps-topic.js          # NEW — year selector + 3 CSS-grid calendar heatmaps (FR-004/005/015)
│       ├── streaks-topic.js           # NEW — streak stat card (FR-006)
│       ├── trends-topic.js            # NEW — 3 ApexCharts trend charts + degradation caveat (FR-007/008)
│       ├── best-worst-topic.js        # NEW — paired best/worst rows (FR-009/016)
│       └── statistics-view.test.js    # NEW (+ per-topic *.test.js as warranted)
├── charts/
│   └── chart-factory.js         # CHANGED — 3 new modes: 'yoy-cumulative' (multi-series line,
│                                   aligned by day-of-year), 'lifetime-cumulative' (dual-axis
│                                   € + CO2 line), 'specific-yield-trend' (per-year bar)
├── router.js                     # CHANGED — new 'statistics' route: #/statistics/:topic
│                                    (topic ∈ common|heatmaps|streaks|trends|best-worst), default
│                                    topic 'common' when the segment is missing/invalid
├── main.js                       # CHANGED — NAV_ITEMS entry + viewModules['statistics'] entry
└── i18n/
    ├── de.json                   # CHANGED — new `statistics.*` key namespace
    └── en.json                   # CHANGED — same keys, English copy

tests/e2e/
└── statistics-view.spec.js       # NEW — Playwright coverage per constitution Testing standard
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
