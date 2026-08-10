# Implementation Plan: Dynamic Weather-Driven Sky Background

**Branch**: `007-dynamic-sky-weather` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-dynamic-sky-weather/spec.md`

## Summary

Replace the existing static, always-identical six-cloud CSS backdrop with one driven by
each installation's real current weather and local solar time: cloud density (sparse /
moderate / dense) is set from a polled cloud-cover reading, a sun or moon element tracks a
simplified day/night arc computed from sunrise/sunset timestamps, and low-frequency
decorative flying objects (birds regularly; planes/balloons/a moon-bound rocket rarely)
animate across the sky band. All new state is fetched from the free, keyless Open-Meteo
API (weather + sunrise/sunset in one request) using coordinates resolved from the
installation's existing `HPStandort` config value (manual override first, automatic
geocoding fallback, cached in `localStorage`). Any failure at any stage (no location, no
network, request failure) falls back to today's existing static backdrop appearance
unchanged — a zero-regression default. `prefers-reduced-motion` suppresses flying-object
spawning and drift animation while still reflecting real conditions through static cues.

## Technical Context

**Language/Version**: JavaScript (ES2022+), native ES modules — matches the existing
`web/js/` codebase; no new build-time tooling.

**Primary Dependencies**: None new for the browser runtime. Uses the browser's native
`fetch`, `matchMedia`, and CSS `@keyframes`/custom properties. Reuses
`web/js/data/fetch-text.js`'s error-handling pattern (adapted for JSON) and
`web/js/data/plant.js`'s parsed `location` field. A new external **data source** (not a
library dependency) is introduced: the Open-Meteo Forecast + Geocoding HTTP APIs, called
directly from the browser — see [research.md §1](./research.md#1-weather-data-source).

**Storage**: One `localStorage` entry per installation address (`sky-geocode:<address>` →
`{lat, lon}`), populated only when automatic geocoding is used (see
[data-model.md](./data-model.md#installation-location)). No IndexedDB, no SQLite, no
change to any SolarLog `.js` data file.

**Testing**: `node --test` unit tests for every new pure-logic module under
`web/js/sky/*.test.js` (cloud-density tiering, solar arc math, flying-object scheduling,
location resolution, weather-response parsing — all with injectable clock/RNG/`fetch` so no
real network call happens in unit tests), plus a new Playwright e2e spec
(`tests/e2e/sky.spec.js`) covering weather-driven density, sun/moon positioning, the
network-failure fallback, and `prefers-reduced-motion` behavior, all via route interception
and clock overrides (no dependency on real-world weather/time at test run time).

**Target Platform**: Browser (static site), unchanged — same deployment target as the rest
of `web/`.

**Project Type**: Single web project (existing `web/` tree); no new top-level project.

**Performance Goals**: One weather/solar-time HTTP request per 15 minutes per open tab
(SC-004's 30-minute budget with margin); sun/moon arc recompute is O(1) arithmetic on a
60-second tick; flying-object animation is pure CSS (`@keyframes`), GPU-composited, no
continuous JS animation loop. Must add no perceptible load-time delay — the sky module is
dynamically imported after the existing critical-path `base_vars.js` fetch, not blocking
first render.

**Constraints**: Must never obstruct dashboard content (FR-012); must degrade to today's
exact existing static appearance on any failure, with no visible errors (FR-005); must
respect `prefers-reduced-motion` (FR-013); must not modify any SolarLog `.js` data file
(Principle I); the resolved installation location must come from existing config data, not
a new hand-maintained data file (FR-001, Principle I).

**Scale/Scope**: Roughly 7 new small pure-logic modules + tests in `web/js/sky/`, one new
orchestrator module wiring them to the DOM, edits to `web/index.html` (new sun/moon/flying-
object container markup) and `web/css/app.css` (density tiers, sun/moon/flying-object
styles, reduced-motion overrides), one new config constant in `web/js/config.js`, a few
lines in `web/js/main.js` to lazy-init the module post-bootstrap, and one new Playwright
spec file.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Standard | Applies? | How satisfied |
|---|---|---|
| I. Static-File Data Model is Sacred | Yes (adjacent) | No SolarLog `.js` data file is read, parsed, or modified by this feature. It reads the already-parsed `plant.location` string (from `base_vars.js` via existing `plant.js`) as an *input* to location resolution, but writes nothing back and does not alter `base_vars.js`'s format or contents. |
| II. Zero Historical Data Loss | No | No historical yield/aggregate data is touched. |
| III. No Backend Introduction | Yes | No application server is introduced. The browser makes direct client-side `fetch` calls to a third-party public API (Open-Meteo), exactly as any static page may call a third-party API from client JS — this does not add a server this project runs or depends on, and the static site remains deployable to any plain host with no new runtime dependency. All existing PV-data parsing/aggregation/rendering remains unchanged and fully client-side. |
| IV. Responsive-First Layout | Yes (adjacent) | New sky elements (sun/moon/flying objects) are positioned with relative units (`%`) inside the existing fixed `.sky-clouds` layer and are `aria-hidden`/`pointer-events: none`, so they impose no new layout constraints at any viewport width. |
| V. Modern Charting — No Custom Pixel Math | No | Not a data-visualization chart; no chart library involved. |
| VI. Preserve All Five Visualization Modes | No | No visualization mode is touched. |
| Technical Standards → Frontend | Yes | Vanilla ES modules, no framework/bundler introduced; new CSS uses existing custom-property theming conventions where applicable (density tiers, positions as CSS custom properties consistent with the existing `.cloud` pattern). |
| Testing standard | Yes | New pure-logic modules get `node:test` unit coverage; the visible UI change (dynamic sky) gets a new Playwright spec per the "every feature addition or visible UI change" rule. |
| Linting / Formatting | Yes | `npm run lint` / `npm run format:check` gate, as for any change. |
| Documentation Standards | Yes | README.md/README.de.md and docs/user-guide.md/.de.md updated to describe the new dynamic sky behavior (tracked as an implementation task, not a planning-phase gate). JSDoc required on every new/modified exported function, and a file-level JSDoc block on every new file, per the constitution's JSDoc/File-level description standards. |

**New-dependency note (not a violation, flagged for visibility)**: this is the first
feature in this codebase to make client-side network requests to a *third-party* host
(Open-Meteo) rather than only same-origin static files. Principle III's "No Backend
Introduction" restricts *this project* introducing a server it runs/depends on — it does
not prohibit the browser calling external third-party APIs, and no such restriction exists
elsewhere in the constitution. FR-005 (graceful fallback on any failure) and the 15-minute
poll cadence (well under Open-Meteo's free-tier limits) keep this dependency low-risk and
fully optional to the site's core function: if Open-Meteo is unreachable, blocked, or
deprecated in the future, the dashboard's PV-data functionality is entirely unaffected —
only the decorative backdrop reverts to its current static appearance.

No violations requiring justification — Complexity Tracking section is empty/not
applicable.

## Project Structure

### Documentation (this feature)

```text
specs/007-dynamic-sky-weather/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` directory: this feature exposes no interface of its own to other systems
or users — it *consumes* an external third-party API (documented in research.md) but
publishes no API/CLI/wire format of its own, so contracts are skipped per the Phase 1
instructions ("skip if project is purely internal").

### Source Code (repository root)

```text
web/
├── index.html                        # MODIFIED: add sun/moon + flying-object container markup inside .sky-clouds
├── css/
│   └── app.css                       # MODIFIED: cloud-density tiers, .sky-sun/.sky-moon, .sky-flying-object
│                                      #           kinds, prefers-reduced-motion overrides
├── js/
│   ├── config.js                     # MODIFIED: new SKY_LOCATION_OVERRIDE constant
│   ├── main.js                       # MODIFIED: lazy-init sky-controller after plant/location resolve
│   ├── data/
│   │   └── plant.js                  # unchanged; `location` field already parsed, reused as input
│   └── sky/                          # NEW directory
│       ├── location.js               # NEW: resolveInstallationLocation() — override/cache/geocode
│       ├── location.test.js          # NEW
│       ├── geocode.js                # NEW: Open-Meteo geocoding call + localStorage cache
│       ├── geocode.test.js           # NEW
│       ├── weather-client.js         # NEW: Open-Meteo forecast call → WeatherCondition + sunrise/sunset
│       ├── weather-client.test.js    # NEW
│       ├── cloud-density.js          # NEW: cloudCoverToTier() + per-tier cloud render config
│       ├── cloud-density.test.js     # NEW
│       ├── solar-arc.js              # NEW: computeSkyBodyPosition() — sun/moon arc + crossfade
│       ├── solar-arc.test.js         # NEW
│       ├── flying-objects.js         # NEW: pure spawn-scheduling logic (kind, delay, rocket gating)
│       ├── flying-objects.test.js    # NEW
│       └── sky-controller.js         # NEW: DOM-glue orchestrator (polling, ticking, reduced-motion,
│                                      #      element creation/removal) — not unit tested, covered by
│                                      #      the Playwright spec below
tests/e2e/
└── sky.spec.js                       # NEW: weather-driven density, sun/moon position, network-failure
                                       #      fallback, reduced-motion, via route/clock mocking
README.md / README.de.md              # MODIFIED: document the dynamic sky feature
docs/user-guide.md / .de.md           # MODIFIED: document the feature from a user perspective
```

**Structure Decision**: Extends the existing single-project `web/` layout in place — no new
top-level directory. New pure-logic modules live in their own `web/js/sky/` directory
(mirroring the existing `web/js/data/` and `web/js/views/` per-concern grouping) since they
form a cohesive new subsystem distinct from both data-parsing and view-rendering; the DOM-
glue orchestrator (`sky-controller.js`) lives alongside them as the one file in that
directory that isn't independently unit-tested (analogous to how `main.js` itself wires
pure modules to the DOM without its own unit tests, relying on Playwright instead).
