# Implementation Plan: Live Panel Falls Back to Daily Last Value

**Branch**: `028-live-panel-fallback` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-live-panel-fallback/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

The navbar info panel's production reading currently shows "no data yet" (027-navbar-live-panel's
FR-006) until the live status endpoint succeeds at least once. Give it a second, coarser source to
fall back to: today's rolling `min_day.js` minute-trace — the exact file `views/day-view.js`
already fetches and parses for the day view's chart/data table — read for its last recorded
reading's total wattage (summed across inverters) and that reading's own timestamp. A new shared
helper (`web/js/data/today-trace.js`) fetches/parses/filters that file so `day-view.js` and the
info panel controller share one implementation instead of duplicating the "prefer `min_day.js`,
filter to today's date" logic; a new pure `lastReadingPower()` (alongside `yield-stats.js`'s
existing `dailyYieldWh`/`maxDailyPowerW`) reduces a trace to `{ w, timestamp }`. The info panel
controller polls this on the existing `DATA_REFRESH_INTERVAL_MS` cadence (piggybacking on the same
tick as `pollYield()`, not a new interval) and only ever writes the result into the panel's
last-known-good production state while a live-endpoint reading has never yet succeeded this
session — a one-way `liveEverSucceeded` flag guarantees the fallback can never displace a live
reading already on screen (FR-004), and needs no request-sequence guard since a slower fallback
poll losing a race to a faster live poll is already the desired outcome.

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
This feature adds no new dependency and no new endpoint — it reads `data/min_day.js`, a file the
app already fetches for the day view (`views/day-view.js`), via the existing `parseMinFile`
parser (`web/js/data/min-file.js`).

**Storage**: Browser `localStorage` for user preferences (unaffected by this feature); the
SolarLog device's static `.js` data files under `web/data/` are the source of truth and MUST NOT
be modified (constitution Principle I). The daily fallback reading is transient, in-memory-only
state (a closure variable in `info-panel-controller.js`'s module-level poll loop, same as the live
reading it may substitute for) — never persisted, per the spec's Key Entities note.

**Testing**: `node --test` (via `npm run test:scripts`) for pure logic — the new
`lastReadingPower()` (`web/js/data/yield-stats.test.js`) and the new shared
`fetchTodayMinuteTrace()` (`web/js/data/today-trace.test.js`); Playwright
(`npx playwright test --reporter=line`) as the primary quality gate for the visible panel
behavior — `tests/e2e/info-panel.spec.js` gets new cases mocking `**/min_day.js` alongside its
existing `**/live/index.php` mock (`mockProduction()`) to cover Stories 1–3.

**Target Platform**: Static site, deployable to any plain web host (Apache, nginx, GitHub Pages,
S3) with no runtime dependencies; must render correctly 320px–2560px without horizontal scrolling
(constitution Principle IV). No layout/markup change — this feature only changes which data feeds
the existing production value/timestamp elements.

**Project Type**: Single static web app (`web/`) — no frontend/backend split, no server component
(constitution Principle III).

**Performance Goals**: The fallback reading appears on the very first render whenever it's
available (no visible flash of "no data yet" while only the live poll is pending — Story 1 AC1)
and updates in step with `DATA_REFRESH_INTERVAL_MS` (10 minutes), matching the day view's own
cadence for the same file (FR-006). No new perceptible cost — one extra small text-file fetch/parse
already paid for elsewhere in the app's lifecycle.

**Constraints**: MUST NOT introduce a new network request schedule dedicated to this feature
(FR-007) — the fallback fetch reuses `DATA_DIR/min_day.js` on the existing
`DATA_REFRESH_INTERVAL_MS` cadence, the same file/cadence `day-view.js` already uses for today,
per the spec's Assumptions ("if the navbar panel is visible on a page that would not otherwise
fetch today's daily minute data, this feature is responsible for making that data available to the
panel, but still on the existing 10-minute cadence"). MUST NOT let the fallback ever replace an
already-shown live reading (FR-004) — enforced by a one-way `liveEverSucceeded` flag, never reset
within a session.

**Scale/Scope**: One new small shared data module (`today-trace.js`), one new pure function in
`yield-stats.js`, edits to `info-panel-controller.js` (new fallback poll + precedence flag) and
`day-view.js` (delegate its `isToday` fetch branch to the new shared module instead of duplicating
it); no new page, route, endpoint, or persisted data.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Static-File Data Model is Sacred)**: Not implicated — reads the existing
  `data/min_day.js` file exactly as `day-view.js` already does, via the existing `parseMinFile`;
  no format/location change. ✅
- **Principle II (Zero Historical Data Loss)**: Not implicated — only reads today's rolling file
  for its most recent entry; no historical file touched, no data dropped or rewritten. ✅
- **Principle III (No Backend Introduction)**: The new fetch/parse/precedence logic runs entirely
  client-side, reusing an existing static file over an existing fetch pattern; no server
  introduced. ✅
- **Principle IV (Responsive-First Layout)**: No layout/markup change — same panel elements, only
  the data source feeding them gains a fallback. ✅
- **Principle V / VI (Charting / Five Visualization Modes)**: Not implicated — the navbar info
  panel is not one of the five diagram modes; `day-view.js`'s Mode 0 chart itself is unchanged
  (only its internal fetch is refactored to call the shared helper, same output). ✅
- **Testing standard**: New `node --test` unit tests for `lastReadingPower()` and
  `fetchTodayMinuteTrace()`, plus new/updated Playwright cases in `tests/e2e/info-panel.spec.js`
  covering Stories 1–3 (fallback shown, fallback never overrides live, neutral state preserved) —
  planned under Phase 2 tasks.
- **Documentation standards**: `README.md`/`README.de.md` and
  `docs/user-guide.md`/`docs/user-guide.de.md` MUST be updated to describe the new fallback
  behavior — tracked as a task.
- **JSDoc / file-level description**: New/modified functions and the new module get JSDoc per the
  constitution's format — planned as part of implementation, not a gate blocker.

No violations — Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/028-live-panel-fallback/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` — this feature adds no external interface (API, endpoint, CLI, or UI contract
beyond the existing rendered panel markup); it only wires an existing internal data source into an
existing display path.

### Source Code (repository root)

```text
web/
├── js/
│   ├── data/
│   │   ├── today-trace.js        # NEW — fetchTodayMinuteTrace(): fetch+parse+filter min_day.js
│   │   │                            to today's readings only; extracted from day-view.js's
│   │   │                            isToday branch so both call sites share one implementation
│   │   ├── today-trace.test.js   # NEW — node:test coverage for the above
│   │   ├── yield-stats.js        # MODIFIED — add lastReadingPower(trace): { w, timestamp } | null
│   │   ├── yield-stats.test.js   # MODIFIED — new test cases for lastReadingPower()
│   │   └── min-file.js           # unchanged — existing parser reused as-is
│   ├── info-panel/
│   │   └── info-panel-controller.js  # MODIFIED — new pollDailyFallback() on the existing
│   │                                    DATA_REFRESH_INTERVAL_MS tick (alongside pollYield()),
│   │                                    liveEverSucceeded precedence flag guarding
│   │                                    lastGoodProduction writes
│   └── views/
│       └── day-view.js           # MODIFIED — fetchDayTrace()'s isToday branch now calls
│                                    fetchTodayMinuteTrace() instead of duplicating the fetch +
│                                    date-filter logic (no behavior change for the day view itself)

tests/e2e/
└── info-panel.spec.js            # MODIFIED — new cases mocking **/min_day.js for Stories 1-3

docs/user-guide.md, docs/user-guide.de.md, README.md, README.de.md  # MODIFIED — document fallback
```

**Structure Decision**: No new top-level directory. The one new module lives in the existing
`web/js/data/` (alongside `min-file.js`, `yield-stats.js`, `aggregates.js` — all pure/browser-
fetch data helpers), matching where `day-view.js` and `info-panel-controller.js` already source
their data logic from.

## Complexity Tracking

> Not applicable — no Constitution Check violations.
