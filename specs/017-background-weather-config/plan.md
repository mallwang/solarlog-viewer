# Implementation Plan: Configurable Weather Backgrounds

**Branch**: `017-background-weather-config` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/017-background-weather-config/spec.md`

## Summary

Unify the sky background's weather classification and the nav bar's weather text around one
shared, pure `weatherCodeToCategory()` classifier producing exactly five categories (sunny,
mixed, cloudy, rain, snow) from Open-Meteo's `weather_code`. The sky background switches its
Open-Meteo request from `cloud_cover` to `weather_code` (one fewer field, not more), gains two
new CSS-only animated treatments (rain streaks, snow flakes) alongside the three renamed
existing cloud-density tiers, and reads a new `BACKGROUND_WEATHER` config constant (`'auto'`
default, `'off'`, or a fixed category name, invalid values falling back to `'auto'`) that gates
whether the poll-driven category or a fixed/plain appearance is shown. The nav bar's weather
text is untouched in behavior — always live, in every mode — only its underlying classification
is re-derived from the same shared five-category table so it agrees with the background whenever
both are reading live data.

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

**Primary Dependencies**: No new dependency. Continues using the browser's native `fetch` against
the already-integrated, keyless Open-Meteo Forecast API (`api.open-meteo.com/v1/forecast`) — see
research.md §1 for the request-shape change (`weather_code` replaces `cloud_cover` for the sky
poll; the info-panel's request is unchanged).

**Storage**: Browser `localStorage` for user preferences (see `web/js/settings.js` for the
existing key pattern) — unused by this feature. The new `BACKGROUND_WEATHER` setting is a static
`web/js/config.js` export (build-time constant, not persisted state), matching that file's
existing `SITE_TITLE`/`SKY_LOCATION_OVERRIDE` pattern. The SolarLog device's static `.js` data
files under `web/data/` / `web/hist/` are unaffected (constitution Principle I).

**Testing**: `node --test` (via `npm run test:scripts`) for the new pure-logic
`web/js/weather/weather-category.js` / `weather-render-config.js` modules and the updated
`sky/weather-client.js` / `info-panel/weather-forecast-client.js` parsers; Playwright
(`npx playwright test --reporter=line`) extends the existing `tests/e2e/sky.spec.js` and
`tests/e2e/info-panel.spec.js` — every user-visible mode (auto/off/fixed, all five categories)
gets at least one scenario (constitution Testing standard).

**Target Platform**: Static site, deployable to any plain web host (Apache, nginx, GitHub Pages,
S3) with no runtime dependencies; must render correctly 320px–2560px without horizontal scrolling
(constitution Principle IV).

**Project Type**: Single static web app (`web/`) — no frontend/backend split, no server component
(constitution Principle III).

**Performance Goals**: No change to today's polling cadence/footprint — the sky's Open-Meteo
request stays one call per `POLL_INTERVAL_MS` (15 min) per open tab, now requesting one field
(`weather_code`) in place of another (`cloud_cover`), not an additional one; the info-panel's
request is byte-for-byte unchanged. Classification itself is O(1) (a small lookup table), no
measurable cost added to either poll path.

**Constraints**: Must never regress the existing "any failure → last-known-good or plain default,
no console errors" behavior (FR-009, edge cases); the two new rain/snow layers must be pure CSS
(matching `.cloud`'s existing `@keyframes`/custom-property technique, no canvas, no continuous JS
animation loop) and must respect `prefers-reduced-motion` exactly like the existing cloud-drift
and flying-object animations (edge cases; constitution Principle IV's no-horizontal-scroll bar
still applies at 320px). The nav bar's weather text must never be switched by the background
setting (FR-002, FR-006, FR-007 — the central risk this plan must not regress).

**Scale/Scope**: Two renamed/extended files (`sky/weather-client.js`, `sky/cloud-density.js` →
`weather/weather-render-config.js`), one new pure-logic file
(`weather/weather-category.js`), small updates to `sky-controller.js` (read `BACKGROUND_WEATHER`,
set `data-weather` instead of `data-cloud-density`), `info-panel/weather-forecast-client.js`
(use the shared classifier), `app.css` (two new layers, attribute rename), `config.js` (one new
export), and `en.json`/`de.json` (five new `weatherCategory.*` keys replacing the old
`weatherCode.*` set). No new route, view, or top-level directory beyond `web/js/weather/`.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Static-File Data Model is Sacred)** — PASS. No SolarLog `.js` data file is
  read, written, or reinterpreted; this feature only touches Open-Meteo (already-integrated,
  external) weather data and a static config constant.
- **Principle II (Zero Historical Data Loss)** — N/A. No historical data touched.
- **Principle III (No Backend Introduction)** — PASS. Purely client-side; no server, no build-time
  pipeline beyond the existing offline CSS build. `BACKGROUND_WEATHER` is a static JS constant
  read in-browser, not a server-rendered or fetched setting.
- **Principle IV (Responsive-First Layout)** — PASS. No new layout region; the two new rain/snow
  layers extend the existing fixed, full-width `.sky-clouds` backdrop with the same
  `overflow: hidden`/`pointer-events: none` containment as `.cloud`, so they cannot introduce
  horizontal scroll or new interactive surface at any width.
- **Principle V (Modern Charting — No Custom Pixel Math)** — N/A. No chart involved.
- **Technical Standards → Frontend (no framework/bundler except the approved Tailwind exception)**
  — PASS. Native ES modules only; rain/snow layers are hand-written CSS (matching `.cloud`'s
  existing approach), not a new dependency.
- **Testing standard (every UI-visible feature gets a Playwright test)** — PASS, planned: extends
  `tests/e2e/sky.spec.js` (new categories/modes) and `tests/e2e/info-panel.spec.js` (shared
  classification), per quickstart.md §6.

No violations. Complexity Tracking table left empty.

_Re-checked after Phase 1 design: still PASS — no new entity, dependency, or architectural
element introduced beyond what's listed above; data-model.md's shapes are all in-memory/config,
nothing crosses into SolarLog data or a server._

## Project Structure

### Documentation (this feature)

```text
specs/017-background-weather-config/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── design.md            # Approved mockup/layout notes (from /speckit-ux-review)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` — this feature exposes no external interface (API, CLI schema); its only
"interface" is the `BACKGROUND_WEATHER` config constant, already fully specified in data-model.md
and covered by the existing `config.js` manual-override precedent (matches spec 007's own
precedent of skipping `contracts/` for the same reason).

### Source Code (repository root)

<!--
  This repo has one fixed layout (below) — there is no frontend/backend or mobile/API split to
  choose between. ACTION REQUIRED: expand the tree with the actual new/changed files for this
  feature (mirroring how prior specs/*/plan.md did it), not just the unchanged skeleton.
-->

```text
web/
├── css/
│   └── app.css                          # rename data-cloud-density → data-weather; new
│                                           .sky-clouds[data-weather='rain'|'snow'] layers
├── js/
│   ├── weather/                         # NEW directory — shared classification, used by
│   │   │                                  both sky/ and info-panel/ (research.md §2)
│   │   ├── weather-category.js          # NEW — weatherCodeToCategory(), WEATHER_CATEGORIES
│   │   ├── weather-category.test.js     # NEW
│   │   ├── weather-render-config.js     # renamed from sky/cloud-density.js — adds rain/snow
│   │   │                                  entries (hasRainLayer/hasSnowLayer)
│   │   └── weather-render-config.test.js # renamed from sky/cloud-density.test.js
│   ├── sky/
│   │   ├── sky-controller.js            # reads BACKGROUND_WEATHER; sets data-weather;
│   │   │                                  imports weather/ instead of ./cloud-density.js
│   │   ├── weather-client.js            # fetch weather_code instead of cloud_cover; parses
│   │   │                                  into { weatherCode, category, sunrise, sunset,
│   │   │                                  nextSunrise, fetchedAt } (data-model.md)
│   │   └── weather-client.test.js       # updated fixtures/assertions
│   ├── info-panel/
│   │   ├── weather-forecast-client.js   # weatherCodeToLabelKey → uses shared classifier;
│   │   │                                  i18n key namespace changes (see below)
│   │   └── weather-forecast-client.test.js
│   └── config.js                        # NEW export: BACKGROUND_WEATHER
├── i18n/
│   ├── en.json                          # infoPanel.weatherCode.* → infoPanel.weatherCategory.*
│   │                                       (sunny/mixed/cloudy/rain/snow, 5 keys replacing 7)
│   └── de.json                          # same key/value changes, German text
└── data/, hist/                         # unaffected — read-only SolarLog device output

tests/e2e/
├── sky.spec.js                          # extended: all 5 categories, off/fixed/invalid modes,
│                                           rain/snow layer presence, reduced-motion
└── info-panel.spec.js                   # extended: weather text uses shared category labels
```

**Structure Decision**: One new directory, `web/js/weather/`, holding the logic FR-002 requires
`sky/` and `info-panel/` to share (research.md §2) — neither existing directory is the right
owner for shared classification logic. Everything else is an in-place rename/extension of
existing modules; no new view, route, or chart-factory change.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally left empty.
