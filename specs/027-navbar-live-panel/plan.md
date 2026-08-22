# Implementation Plan: Live Navbar Watt Reading

**Branch**: `027-navbar-live-panel` | **Date**: 2026-08-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/027-navbar-live-panel/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

The navbar's live-panel wattage currently comes from `data/min_cur.js`, refreshed on the same
10-minute `DATA_REFRESH_INTERVAL_MS` cycle as the diagrams (`info-panel-controller.js`'s
`fetchCurrentProduction()`). Replace that source with the new live status endpoint
(`https://wolfsbach.synology.me/live/index.php`), polled on its own configurable interval
(new `LIVE_REFRESH_INTERVAL_MS`, default 60 000 ms) that is fully decoupled from the diagram/
yield refresh cycle. A response counts as a successful reading only when it's reachable, parses,
carries a numeric top-level `watt`, and `sources.solarlog.ok === true`; anything else is a failed
reading that keeps the last successful reading on screen (or a distinct "no data yet" state if
none has ever arrived) and retries next interval. The panel re-polls promptly on tab
refocus and guards against out-of-order/overlapping responses with a request sequence token.

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
This feature adds no new dependency — it fetches JSON from a second live HTTPS endpoint
(`https://wolfsbach.synology.me/live/index.php`, same host as the existing `.js` data files) using
the browser's native `fetch()`, exactly like `weather-forecast-client.js` already does against
`api.open-meteo.com`.

**Storage**: Browser `localStorage` for user preferences (see `web/js/settings.js` for the
existing key pattern); the SolarLog device's static `.js` data files under `web/data/` /
`web/hist/` are the source of truth for plant data and MUST NOT be modified (constitution
Principle I). The live endpoint's reading is transient, in-memory-only state (a closure variable
in `info-panel-controller.js`'s module-level poll loop) — never persisted, per the spec's Key
Entities note that a Live Reading is "not persisted or used by the diagrams."

**Testing**: `node --test` (via `npm run test:scripts`) for pure logic in `scripts/*.js` and
`web/js/**/*.test.js`; Playwright (`npx playwright test --reporter=line`) as the primary quality
gate for visible UI changes — every feature with a UI-visible effect MUST get at least one
Playwright test (constitution Testing standard). `tests/e2e/info-panel.spec.js` already mocks
`data/min_cur.js` via `page.route()` and patches `config.js`'s refresh-interval constant to a
tiny value for fast polling assertions (see its existing `**/js/config.js` route handler) — this
feature's tests mock `**/live/index.php` the same way and patch the new `LIVE_REFRESH_INTERVAL_MS`
constant instead.

**Target Platform**: Static site, deployable to any plain web host (Apache, nginx, GitHub Pages,
S3) with no runtime dependencies; must render correctly 320px–2560px without horizontal scrolling
(constitution Principle IV).

**Project Type**: Single static web app (`web/`) — no frontend/backend split, no server component
(constitution Principle III).

**Performance Goals**: Live reading visibly updates within one `LIVE_REFRESH_INTERVAL_MS` interval
(1 minute default, SC-001) of the endpoint's value changing; the poll itself is a single small
JSON fetch, no measurable render cost beyond the existing per-tick DOM updates.

**Constraints**: The live poll loop MUST run as a timer fully independent of
`DATA_REFRESH_INTERVAL_MS`'s yield/weather timers (FR-002/SC-002 — zero observable change to the
diagram/yield refresh behavior). No new authentication or CORS workaround is assumed to be needed
(spec Assumptions) — the endpoint is fetched directly by absolute URL, the same way
`weather-forecast-client.js` fetches `api.open-meteo.com` directly rather than through
`bs-config.cjs`'s dev-only `/data`/`/hist` proxy (which doesn't cover `/live` and isn't needed
for an absolute cross-origin URL).

**Scale/Scope**: One new small client module + edits to one existing controller module and one
config file; no new page, route, or persisted data.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Static-File Data Model is Sacred)**: Not implicated — the live endpoint is a
  separate JSON status API, not one of the device's `.js` data files, and none of those files
  change format or location. ✅
- **Principle II (Zero Historical Data Loss)**: Not implicated — this feature touches only the
  navbar's current-instant reading, never historical files. ✅
- **Principle III (No Backend Introduction)**: The fetch runs entirely client-side against an
  existing externally-hosted endpoint (already reachable per the spec's Assumptions); no
  application server is introduced or required by this feature. ✅
- **Principle IV (Responsive-First Layout)**: No layout change — same panel markup/CSS, only the
  data source and poll cadence change. ✅
- **Principle V / VI (Charting / Five Visualization Modes)**: Not implicated — the navbar live
  panel is not one of the five diagram modes. ✅
- **Testing standard**: A Playwright test update/addition is required (mocking `/live/index.php`
  instead of/alongside `min_cur.js`) per constitution Testing standard — planned under Phase 1/2.
- **Documentation standards**: `README.md`/`README.de.md` and `docs/user-guide.md`/`.de.md` MUST
  be updated to describe the new live-refresh behavior and its config constant — tracked as a task
  in Phase 2 (`/speckit-tasks`), not produced by this planning phase.

No violations — Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/027-navbar-live-panel/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── live-endpoint.md # Phase 1 output — the external live-status JSON contract this feature consumes
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
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
│   ├── info-panel/
│   │   ├── info-panel-controller.js   # CHANGED: fetchCurrentProduction() → live-endpoint-backed
│   │   │                                poll on its own LIVE_REFRESH_INTERVAL_MS timer, last-
│   │   │                                known-good state, race guard, visibility-regain repoll
│   │   ├── live-reading-client.js      # NEW: fetch + parse/validate live/index.php, mirrors
│   │   │                                weather-forecast-client.js's shape/error-handling pattern
│   │   ├── live-reading-client.test.js # NEW: node:test unit tests (success/failure/malformed
│   │   │                                cases), no real network
│   │   ├── weather-forecast-client.js
│   │   ├── production-animation.js     # unchanged — still takes a plain wattage + capacity
│   │   └── wetteronline-link.js
│   ├── views/              # one module per route/component (day-view.js, month-view.js, ...)
│   ├── i18n.js, settings.js, router.js, config.js, format.js, main.js
│   │                        # config.js CHANGED: + LIVE_ENDPOINT_URL, + LIVE_REFRESH_INTERVAL_MS
├── i18n/                  # de.json / en.json translation strings
├── data/, hist/           # SolarLog device's static .js data files — read-only, never modified
└── vendor/                # vendored third-party libraries (e.g. apexcharts), no CDN loads

scripts/                  # ESM helper/CLI scripts (backfill, validation, sync) — see project
                             CLAUDE.md for the mandatory TDD/lint conventions for these

tests/e2e/
└── info-panel.spec.js    # CHANGED: mock **/live/index.php instead of/alongside data/min_cur.js;
                             patch LIVE_REFRESH_INTERVAL_MS for fast-polling assertions

web/js/**/*.test.js        # node:test unit tests, co-located with the module they cover
```

**Structure Decision**: This feature lives entirely inside the existing
`web/js/info-panel/` module (the navbar's global info panel controller already fetches
production/yield/weather independently — see its file-level doc comment) plus two new constants
in `web/js/config.js`. No new top-level directory, view, or route.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally omitted.
