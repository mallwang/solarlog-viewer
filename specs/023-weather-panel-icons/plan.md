# Implementation Plan: Weather Panel Icons

**Branch**: `023-weather-panel-icons` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-weather-panel-icons/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Rework the global info panel's weather/forecast text so both lines lead (or continue) with a
small decorative icon matching the existing five-category weather classification
(`weather/weather-category.js`), instead of relying on the "Aktuell:" text prefix. The
current-conditions line drops "Aktuell:" entirely and becomes `<icon> <label>, <temp>°C`; the
forecast line keeps "Heute:" and becomes `Heute: <icon> <label> (<low>°C - <high>°C)`. The
current-conditions line additionally gets a nighttime-only override (FR-011): when the
classification is "sunny" and the current time is between today's sunset and the next sunrise, it
shows a moon icon and a new "clear" label instead of the sunny icon/label — the forecast line is
unaffected by that specific override (FR-012) and the underlying five-category classification is
unchanged. Separately, the forecast line itself now switches which day it summarizes: before a
fixed local-time cutoff hour (`FORECAST_DAY_SWITCH_HOUR` in `config.js`, default 18) it shows
today's forecast under "Heute:" as before; at/after the cutoff it shows tomorrow's forecast under
"Morgen:" instead (FR-004/FR-014) — a developer-set constant, not a user-facing setting. This is
primarily a render-only change confined to `web/js/info-panel/info-panel-controller.js`'s
`renderWeather()` and two new small pure modules (icon lookup, day/night check); the non-render
changes are extending `fetchWeatherAndForecast()`'s existing single Open-Meteo request to also
ask for today's `sunrise`/`sunset` (already-precedented in `sky/weather-client.js` for the same
purpose) and for `forecast_days=2` instead of `1` so tomorrow's weather code/min/max are
available too — still one HTTP request, no change to the shared classifier.

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2022+), native ES modules (`type="module"`) — no
bundler, no JS framework (constitution Technical Standards → Frontend).

**Primary Dependencies**: ApexCharts (vendored at `web/vendor/apexcharts/`, via
`web/js/charts/chart-factory.js`); Tailwind CSS (approved exception — compiled offline via
`npm run build:css` into `web/css/tailwind.generated.css`, never loaded from a CDN at runtime).
No feature-specific addition — this feature reuses the existing `weather/weather-category.js`
classifier and adds two small, dependency-free pure modules: a static Unicode-emoji icon-lookup
(no icon font/SVG sprite/library), and a day/night boundary check reusing the same
sunrise/sunset-comparison approach `sky/solar-arc.js` already established for the sky backdrop
(FR-011/FR-013).

**Storage**: Browser `localStorage` for user preferences (see `web/js/settings.js` for the
existing key pattern); the SolarLog device's static `.js` data files under `web/data/` /
`web/hist/` are the source of truth for plant data and MUST NOT be modified (constitution
Principle I). Not touched by this feature — no new storage.

**Testing**: `node --test` (via `npm run test:scripts`) for pure logic in `scripts/*.js` and
`web/js/**/*.test.js` — the new icon-lookup module gets a unit test covering all five
categories plus the unavailable fallback; a new day/night-check module gets a unit test covering
before-sunrise, daytime, after-sunset, and (if `nextSunrise` is used) post-midnight-before-
next-sunrise cases. Playwright (`npx playwright test --reporter=line`) as the primary quality
gate for visible UI changes — `tests/e2e/info-panel.spec.js` gets updated/new assertions for the
icon presence, `aria-hidden`, the dropped "Aktuell:" prefix, the retained "Heute:" prefix, the
parenthesized low–high range text, and (using `page.clock.install()` with a fixed nighttime/
daytime timestamp, the same technique `tests/e2e/sky.spec.js` already uses, alongside a mocked
Open-Meteo response's `sunrise`/`sunset`) the nighttime "sunny" → moon icon + "clear" label
override (constitution Testing standard).

**Target Platform**: Static site, deployable to any plain web host (Apache, nginx, GitHub Pages,
S3) with no runtime dependencies; must render correctly 320px–2560px without horizontal scrolling
(constitution Principle IV).

**Project Type**: Single static web app (`web/`) — no frontend/backend split, no server component
(constitution Principle III).

**Performance Goals**: No measurable impact — same poll cadence
(`WEATHER_REFRESH_INTERVAL_MS`), same two DOM text nodes per panel variant now built via a
constant-time string/DOM-fragment assembly instead of a single `textContent` set.

**Constraints**: Icons are static Unicode emoji glyphs (no icon font, no SVG sprite, no new
vendored asset) to stay within the "no new dependency" default and to match the existing
`018-day-night-sky/mockup.html` visual precedent (`☀️`/`☁️`/`🌧️`/`❄️`), plus one new moon glyph
(`🌙`) for the nighttime "sunny" override. Icons MUST be marked `aria-hidden="true"` (FR-009)
since the adjacent label text is already the accessible name for the condition. Layout must not
wrap the icon away from its label at 320px viewport width (FR-010, SC-003). The nighttime
override (FR-011) applies only to the current-conditions line's "sunny" case and must default to
the existing daytime "sunny" display whenever sunrise/sunset can't be resolved (FR-013) — it must
never leave the icon/label blank or introduce a sixth classification category. The forecast
line's Heute→Morgen cutoff (FR-014) is a single fixed hour read from `config.js`
(`FORECAST_DAY_SWITCH_HOUR`, default 18) compared against the viewer's browser-local hour (same
"today" boundary convention `todayParams()` already uses elsewhere in this file) — not a
per-visitor setting, not persisted, no UI control. If tomorrow's forecast fields fail to parse
while today's/current data are fine and the cutoff has passed, the forecast line falls back to
its existing empty "unavailable" state rather than showing a mismatched day/label pair (FR-015).

**Scale/Scope**: Two lines × two panel DOM copies (`.info-panel--desktop`,
`.info-panel--mobile`, per `index.html`) — four `[data-role="weather-current"]`/
`[data-role="weather-forecast"]` elements total, all already selected/updated together by the
existing `renderWeather()`. Five fixed icon glyphs (one per Weather Background Category) plus one
additional moon glyph + one additional "clear" label for the current-conditions line's nighttime
override, no per-feature data growth otherwise.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Static-File Data Model is Sacred)**: N/A — no `.js` SolarLog data file is read
  or touched; this feature only reformats already-fetched Open-Meteo weather data client-side
  (plus one additional field pair, `sunrise`/`sunset`, added to the same existing Open-Meteo
  request for the nighttime override — still not a SolarLog data file).
- **Principle II (Zero Historical Data Loss)**: N/A — no historical data involved.
- **Principle III (No Backend Introduction)**: Satisfied — purely a browser-side render change,
  no new fetch target, no server component.
- **Principle IV (Responsive-First Layout)**: Applies — FR-010/SC-003 require the icon+label to
  stay together and not wrap or overlap from 320px up; verified via the existing mobile
  `.info-panel--mobile` Playwright coverage plus a viewport-width assertion if not already
  present.
- **Principle V / VI (Charting / Visualization Modes)**: N/A — no chart involved.
- **Technical Standards → Frontend**: Satisfied — vanilla JS/CSS only, static emoji glyphs (no
  new library, no bundler change), CSS custom properties reused for any new icon spacing/size
  rule.
- **Testing standard**: Applies — Playwright coverage required for this visible UI change
  (updating `tests/e2e/info-panel.spec.js`); a `node --test` unit test is added for the new pure
  icon-lookup function since it's non-trivial branching (five categories + fallback).
- **Documentation Standards**: `README.md`/`README.de.md` and `docs/user-guide.md`/
  `docs/user-guide.de.md` must be checked for any mention of the "Aktuell:"/"Heute:" panel text
  and updated if they describe the old text-only format.

No violations — Complexity Tracking table not needed.

## Project Structure

### Documentation (this feature)

```text
specs/023-weather-panel-icons/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
web/
├── css/
│   └── app.css                              # add/adjust .info-panel__weather-icon rule
│                                               (inline-flex/vertical-align, sizing, spacing —
│                                               reuse existing CSS custom properties)
├── js/
│   ├── weather/
│   │   ├── weather-category.js               # unchanged — reused classifier (5 categories)
│   │   ├── weather-icon.js                    # NEW — category → decorative emoji glyph map,
│   │   │                                        plus the standalone moon glyph for the
│   │   │                                        nighttime "sunny" override
│   │   ├── weather-icon.test.js               # NEW — node:test covering all 5 categories
│   │   ├── daytime.js                         # NEW — isDaytime(now, sunrise, sunset) pure
│   │   │                                        boolean check, mirrors sky/solar-arc.js's own
│   │   │                                        sunrise/sunset comparison (FR-011/FR-013)
│   │   └── daytime.test.js                    # NEW — node:test: before sunrise, daytime, after
│   │                                            sunset, unresolvable-input fallback
│   ├── info-panel/
│   │   ├── weather-forecast-client.js         # MODIFIED — Open-Meteo request also asks for
│   │   │                                        today's `sunrise`/`sunset` and uses
│   │   │                                        `forecast_days=2`; response shape gains
│   │   │                                        `sunrise`/`sunset` + tomorrow's
│   │   │                                        weatherCode/min/max fields
│   │   └── info-panel-controller.js           # MODIFIED — renderWeather() builds icon + text
│   │                                             markup for current-conditions/forecast lines,
│   │                                             drops "Aktuell:" prefix, picks "Heute:"/"Morgen:"
│   │                                             + today's/tomorrow's data per
│   │                                             FORECAST_DAY_SWITCH_HOUR, formats low–high range
│   │                                             in parentheses, and applies the nighttime
│   │                                             "sunny"→moon/"clear" override (via daytime.js)
│   │                                             to the current-conditions line only
│   └── config.js                              # MODIFIED — new FORECAST_DAY_SWITCH_HOUR = 18
│                                                 constant (developer-set, not user-facing)
├── i18n/
│   ├── de.json                                # MODIFIED — currentLabel entry removed/unused;
│   │                                             new weatherCategory.clear = "Klar";
│   │                                             new tomorrowLabel = "Morgen"
│   └── en.json                                # MODIFIED — same, weatherCategory.clear = "Clear";
│                                                 tomorrowLabel = "Tomorrow"
└── index.html                                 # unchanged — [data-role] hooks already exist

tests/e2e/
└── info-panel.spec.js                         # MODIFIED — assert icon presence + aria-hidden,
                                                   no "Aktuell:" text, "(low°C - high°C)" range
                                                   format, and (via page.clock.install() for both
                                                   time-of-day and cutoff-hour scenarios) the
                                                   nighttime moon/"clear" override, the
                                                   Heute→Morgen switch at the configured cutoff
                                                   hour, and the daytime-unaffected forecast icon
```

**Structure Decision**: No new top-level directory. The new pure icon-lookup and day/night-check
modules live beside the existing classifier in `web/js/weather/` (mirroring how
`weather-render-config.js` already sits next to `weather-category.js` as a second per-category
lookup table); `daytime.js` deliberately mirrors — rather than imports — `sky/solar-arc.js`'s
sunrise/sunset comparison, since that module's exported function computes full arc-position data
this feature doesn't need and lives in the `sky/` feature directory, not `weather/`. The DOM-glue
change is inside the existing `info-panel-controller.js`; `weather-forecast-client.js` gets a
small, additive change (two more Open-Meteo `daily` params) to source the sunrise/sunset the
nighttime override needs. `index.html` needs no changes since the `[data-role]` hooks are already
correct for this rework.

## Complexity Tracking

_No violations — table not needed._
