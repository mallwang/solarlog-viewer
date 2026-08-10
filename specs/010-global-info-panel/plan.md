# Implementation Plan: Global Desktop Info Panel

**Branch**: `010-global-info-panel` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-global-info-panel/spec.md`

## Summary

Add a persistent, desktop-only header panel — mounted once in `main.js`'s `bootstrap()`
alongside the existing transparency toggle and sky controller, so it survives in-app route
changes — that shows the plant's current production (reusing `min_cur.js` +
`parseMinFile`, the same data path `dashboard.js`'s widget already uses), the current
weather condition and today's remaining forecast for the installation's location (a new
`current=weather_code,temperature_2m&daily=weather_code,temperature_2m_max,temperature_2m_min`
Open-Meteo request, reusing the existing `resolveInstallationLocation()` coordinate
resolution from the sky feature), and a CSS-driven production animation whose intensity is
derived from `currentPacW / plant.capacityKwp`. Clicking the weather/forecast area opens
`https://www.wetteronline.de/suche?q=<installation address>` in a new tab — a search-results
URL rather than a guessed place slug, so it degrades gracefully for any address without
extra geocoding-to-wetteronline mapping logic. The panel polls production and weather on a
~10-minute cadence (FR-004: matches the SolarLog device's own minimum update interval, so a
tighter poll would just re-read an unchanged file) and hides entirely below the existing
`md:` (768px) breakpoint already used to switch the nav between its mobile burger menu and
its persistent desktop bar — the only existing mobile/desktop layout gate in this codebase.

## Technical Context

**Language/Version**: JavaScript (ES2022+), native ES modules — matches the existing
`web/js/` codebase; no new build-time tooling.

**Primary Dependencies**: None new for the browser runtime. Reuses the browser's native
`fetch`, `setInterval`, and CSS `@keyframes`/custom properties. Reuses
`web/js/data/fetch-text.js` (`data/min_cur.js` fetch), `web/js/data/min-file.js`
(`parseMinFile`), `web/js/sky/location.js` (`resolveInstallationLocation`) and
`web/js/data/plant.js` (`location`, `capacityKwp`). Extends the existing Open-Meteo
integration with one new request shape (current weather code/temperature + today's daily
forecast) — see [research.md §1](./research.md#1-weather-condition--todays-forecast-data).

**Storage**: None new. No `localStorage` entry, no IndexedDB, no SQLite, no change to any
SolarLog `.js` data file.

**Testing**: `node --test` unit tests for every new pure-logic module under
`web/js/info-panel/*.test.js` (production-animation intensity tiering, weather-code → label
mapping, wetteronline URL construction — all pure functions), plus a new Playwright e2e spec
(`tests/e2e/info-panel.spec.js`) covering: panel visible + populated on desktop width, panel
absent on mobile width, weather-area click opens the correct wetteronline.com URL in a new
tab, and the "unavailable" fallback state when production/weather data can't be fetched —
all via route interception and `page.setViewportSize`, no dependency on real-world weather
or production data at test run time.

**Target Platform**: Browser (static site), unchanged — same deployment target as the rest
of `web/`.

**Project Type**: Single web project (existing `web/` tree); no new top-level project.

**Performance Goals**: One combined weather/forecast HTTP request and one `min_cur.js` fetch
per ~10-minute poll per open tab (FR-004); production-animation intensity recompute is O(1)
arithmetic per poll; the animation itself is pure CSS (`@keyframes`), GPU-composited, no
continuous JS animation loop. The panel must add no perceptible load-time delay — like the
sky controller, its data-fetching module is dynamically imported after the critical-path
`base_vars.js` fetch, not blocking first render (SC-001's 2-second budget).

**Constraints**: Must never overlap or displace existing header/nav/main content on desktop
widths (SC-004); must be fully absent (no layout space) below the `md:` breakpoint (FR-002);
must show independent "unavailable" states per data source rather than a fully broken panel
when only one of production/weather fails (FR-008, SC-005); must not modify any SolarLog
`.js` data file (Principle I); must derive location from the existing `plant.location` /
sky-feature resolution rather than a new manually-maintained config value (FR-012).

**Scale/Scope**: One new `web/js/info-panel/` directory (~4 small pure-logic modules + tests,
one DOM-glue controller module not unit-tested but covered by the Playwright spec), edits to
`web/index.html` (new header panel markup), `web/css/app.css` (panel layout, animation
keyframes, `md:` visibility), a few lines in `web/js/main.js` to lazy-init the controller
post-bootstrap, and one new Playwright spec file.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Standard | Applies? | How satisfied |
|---|---|---|
| I. Static-File Data Model is Sacred | Yes (adjacent) | Reads `data/min_cur.js` exactly as `dashboard.js` already does, via the existing `fetchText` + `parseMinFile` path. No SolarLog `.js` data file is modified. |
| II. Zero Historical Data Loss | No | No historical yield/aggregate data is touched; the panel shows only the live current-production reading. |
| III. No Backend Introduction | Yes | No application server introduced. Direct client-side `fetch` calls to the already-approved third-party Open-Meteo API (per feature 007's precedent) plus a plain `<a target="_blank">` link to wetteronline.com — not a dependency the site requires to function. |
| IV. Responsive-First Layout | Yes | The panel is hidden entirely (no layout space) below `md:`, and on desktop widths is laid out with relative units inside the existing header chrome so it never causes horizontal scroll or overlaps `app-main`. |
| V. Modern Charting — No Custom Pixel Math | No | Not a data-visualization chart; the production animation is CSS-driven (scale/opacity/keyframe intensity), not pixel-positioned chart data. |
| VI. Preserve All Five Visualization Modes | No | No visualization mode is touched. |
| Technical Standards → Frontend | Yes | Vanilla ES modules, no framework/bundler introduced; new CSS uses existing custom-property theming (`tokens.css`) and the existing `md:` Tailwind breakpoint already used by the nav. |
| Testing standard | Yes | New pure-logic modules get `node:test` unit coverage; the visible UI change gets a new Playwright spec per the "every feature addition or visible UI change" rule. |
| Linting / Formatting | Yes | `npm run lint` / `npm run format:check` gate, as for any change. |
| Documentation Standards | Yes | README.md/README.de.md and docs/user-guide.md/.de.md updated to describe the new panel (tracked as an implementation task). JSDoc required on every new/modified exported function, and a file-level JSDoc block on every new file. |

No violations requiring justification — Complexity Tracking section is empty/not
applicable.

## Project Structure

### Documentation (this feature)

```text
specs/010-global-info-panel/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature exposes no interface of its own to other systems or
users — it consumes the existing SolarLog `min_cur.js` file and the third-party Open-Meteo
API (documented in research.md) and links out to wetteronline.com, but publishes no
API/CLI/wire format of its own.

### Source Code (repository root)

```text
web/
├── index.html                          # MODIFIED: add <div id="info-panel"> markup in app-header,
│                                        #           populated/shown by info-panel-controller.js
├── css/
│   └── app.css                         # MODIFIED: .info-panel layout, md:-only visibility,
│                                        #           production-animation keyframes/intensity tiers
├── js/
│   ├── main.js                         # MODIFIED: lazy-init info-panel-controller after bootstrap,
│   │                                   #           same pattern as sky-controller
│   ├── data/
│   │   ├── fetch-text.js               # unchanged; reused for data/min_cur.js
│   │   ├── min-file.js                 # unchanged; reused for parseMinFile
│   │   └── plant.js                    # unchanged; `location` + `capacityKwp` reused as input
│   ├── sky/
│   │   └── location.js                 # unchanged; resolveInstallationLocation() reused as-is
│   └── info-panel/                     # NEW directory
│       ├── weather-forecast-client.js  # NEW: Open-Meteo current-weather-code + today's
│       │                               #      forecast fetch, parsed for the panel's needs
│       ├── weather-forecast-client.test.js  # NEW
│       ├── production-animation.js     # NEW: pure production-ratio → intensity-tier mapping
│       ├── production-animation.test.js     # NEW
│       ├── wetteronline-link.js        # NEW: pure address → wetteronline.com search URL builder
│       ├── wetteronline-link.test.js   # NEW
│       └── info-panel-controller.js    # NEW: DOM-glue orchestrator (polling, rendering,
│                                       #      unavailable states) — not unit tested, covered by
│                                       #      the Playwright spec below
tests/e2e/
└── info-panel.spec.js                  # NEW: desktop visibility/population, mobile absence,
                                         #      wetteronline click-through, unavailable states
web/i18n/
├── en.json                             # MODIFIED: new info-panel.* strings
└── de.json                             # MODIFIED: new info-panel.* strings
README.md / README.de.md                # MODIFIED: document the new panel
docs/user-guide.md / .de.md             # MODIFIED: document the new panel
```

**Structure Decision**: Follows the existing single-project `web/` layout and mirrors
feature 007's `web/js/sky/` pattern exactly — a new self-contained `web/js/info-panel/`
directory of small pure-logic modules (each with a co-located `node:test` unit test) plus
one DOM-glue controller module, wired into `main.js`'s `bootstrap()` via a dynamic import so
it never blocks first render, with the one visible UI surface covered by a new Playwright
spec. No new top-level directories or build tooling.

## Complexity Tracking

*No violations — table intentionally omitted.*
