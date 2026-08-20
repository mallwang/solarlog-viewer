# Implementation Plan: Compact Weather Display with Hover Detail

**Branch**: `025-weather-icon-compact` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-weather-icon-compact/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Collapse both weather indicators in the global info panel — current conditions and the
today/tomorrow forecast — from inline "icon + label, temp" / "prefix: icon + label (range)"
sentences to a compact icon-over-value stack (icon on top, temperature or range beneath),
separated by a vertical divider, per the approved mockup (`design.md`). The condition label,
day prefix, and unit text that used to render inline are removed from the default view and
instead become each indicator's accessible name (`aria-label`, always available to
keyboard/AT users on focus) and the content of a decorative floating tooltip revealed on
hover/focus (and tap, via a small JS toggle for touch). This is primarily a render-only change
confined to `web/js/info-panel/info-panel-controller.js`'s `renderWeather()`, `web/index.html`'s
weather markup, and `web/css/app.css`'s weather-indicator rules; the full-text string building
is extracted into a small new pure module (`web/js/weather/weather-text.js`) so the visible
short value, the `aria-label`, and the tooltip text can never drift apart — they're all built
from the same source strings. No new dependency, no new i18n keys, no data-fetching change.

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
No feature-specific addition — this feature reuses the existing `weather/weather-category.js`
classifier, `weather/weather-icon.js` glyph lookup, and `i18n.js`'s `t()`, adding one new
dependency-free pure module (`weather/weather-text.js`) for string assembly.

**Storage**: Browser `localStorage` for user preferences (see `web/js/settings.js` for the
existing key pattern); the SolarLog device's static `.js` data files under `web/data/` /
`web/hist/` are the source of truth for plant data and MUST NOT be modified (constitution
Principle I). Not touched by this feature — no new storage, no change to the Open-Meteo fetch.

**Testing**: `node --test` (via `npm run test:scripts`) for pure logic in `scripts/*.js` and
`web/js/**/*.test.js` — the new `weather-text.js` gets a unit test covering current-conditions
short/full text, forecast short/full text (both day prefixes), and the unavailable case for
each. Playwright (`npx playwright test --reporter=line`) as the primary quality gate for visible
UI changes — `tests/e2e/info-panel.spec.js` gets its existing text-content assertions rewritten
(they currently assert the label text is visible inline, which this feature removes) plus new
assertions for the `aria-label`/tooltip full text, the divider, hover/focus tooltip reveal, tap
reveal, and independent current/forecast unavailable states (constitution Testing standard).

**Target Platform**: Static site, deployable to any plain web host (Apache, nginx, GitHub Pages,
S3) with no runtime dependencies; must render correctly 320px–2560px without horizontal scrolling
(constitution Principle IV).

**Project Type**: Single static web app (`web/`) — no frontend/backend split, no server component
(constitution Principle III).

**Performance Goals**: No measurable impact — same poll cadence (`WEATHER_REFRESH_INTERVAL_MS`),
same two panel DOM copies; `renderWeather()` builds a constant number of extra DOM nodes per
indicator (icon, value, tooltip) instead of a flat text node, no additional network requests, no
JS-computed tooltip positioning (CSS-only).

**Constraints**: Reuses existing i18n keys as-is (`infoPanel.weatherCategory.*`,
`infoPanel.todayLabel`, `infoPanel.tomorrowLabel`, `infoPanel.unavailable`) — no new translation
strings (assumption in spec.md). The compact value text and the full accessible/tooltip text
MUST be built from the same underlying label/prefix/temperature source data (`weather-text.js`)
so they cannot drift out of sync with each other or with the previous inline wording (FR-004).
The tooltip is a decorative (`aria-hidden="true"`) floating bubble positioned with CSS only
(`position: absolute`, centered under/over the icon) — no JS layout math, consistent with the
project's "no custom pixel math" preference; it MUST NOT overflow the viewport at 320px width
(clamp horizontal offset if needed). Each indicator (current, forecast) carries its own
`data-available` and independently falls back to a dash-icon "unavailable" state per FR-007 —
this changes the forecast's existing "render nothing when unavailable" shape (023-weather-panel-
icons) to match the mockup's uniform per-indicator unavailable treatment. Touch/no-hover parity
(FR-006) is provided primarily via native focusability (`tabindex="0"` on each indicator +
`:focus-within` revealing the tooltip, working for both keyboard and most touch browsers) plus a
minimal `click`/`touchstart` JS toggle as a purely-visual fallback for browsers where a bare tap
doesn't focus a non-form element — the `aria-label` itself needs no such fallback since it's
always present on the accessibility tree regardless of hover/tap state.

**Scale/Scope**: Two indicators (current-conditions, forecast) × two panel DOM copies
(`.info-panel--desktop`, `.info-panel--mobile`) = four indicator elements total, each with one
tooltip child — same order of magnitude as the existing markup, no per-feature data growth.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Static-File Data Model is Sacred)**: N/A — no `.js` SolarLog data file is read
  or touched; this feature only reformats already-fetched Open-Meteo weather data client-side.
- **Principle II (Zero Historical Data Loss)**: N/A — no historical data involved.
- **Principle III (No Backend Introduction)**: Satisfied — purely a browser-side render change,
  no new fetch target, no server component.
- **Principle IV (Responsive-First Layout)**: Applies — the compact indicators and their
  tooltips must render correctly and not overlap/clip from 320px up (SC-001 implies a _smaller_
  footprint than before, which only reduces wrap risk); the floating tooltip specifically must
  clamp to stay within the viewport at 320px. Verified via the existing mobile
  `.info-panel--mobile` Playwright coverage plus a 320px-viewport tooltip-visibility assertion.
- **Principle V / VI (Charting / Visualization Modes)**: N/A — no chart involved.
- **Technical Standards → Frontend**: Satisfied — vanilla JS/CSS only, no new library, no
  bundler change, CSS custom properties reused for spacing/color (divider uses
  `--color-border`, tooltip uses `--color-text`/`--color-bg`).
- **Testing standard**: Applies — Playwright coverage required for this visible UI change
  (rewriting/extending `tests/e2e/info-panel.spec.js`); a `node --test` unit test is added for
  the new `weather-text.js` pure module since its branching (current vs. forecast, available vs.
  unavailable, today vs. tomorrow prefix) is non-trivial.
- **Documentation Standards**: `README.md`/`README.de.md` and `docs/user-guide.md`/
  `docs/user-guide.de.md` must be checked for any mention/screenshot of the old inline weather
  text format and updated to describe the compact icon + hover-detail behavior.

No violations — Complexity Tracking table not needed.

## Project Structure

### Documentation (this feature)

```text
specs/025-weather-icon-compact/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── design.md              # UX-review mockup writeup (/speckit-ux-review, already done)
├── mockup.html            # Durable copy of the approved mockup
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
web/
├── css/
│   └── app.css                              # MODIFIED — .info-panel__weather-current/-forecast
│                                               become icon-over-value flex columns; NEW
│                                               .info-panel__weather-tooltip (floating bubble +
│                                               arrow, opacity/pointer-events toggled by
│                                               :hover/:focus-within/[data-open]); NEW divider
│                                               (border-left on the forecast indicator, using
│                                               --color-border); focus-visible outline on each
│                                               indicator
├── js/
│   ├── weather/
│   │   ├── weather-category.js               # unchanged — reused classifier
│   │   ├── weather-icon.js                    # unchanged — reused glyph lookup
│   │   ├── weather-text.js                    # NEW — pure functions building the compact value
│   │   │                                        text and the full descriptive text (used for
│   │   │                                        both aria-label and tooltip) for current
│   │   │                                        conditions and forecast, plus their unavailable-
│   │   │                                        state text; single source of truth so the three
│   │   │                                        renderings can't drift apart (FR-004)
│   │   └── weather-text.test.js               # NEW — node:test covering both indicators ×
│   │                                            available/unavailable × today/tomorrow prefix
│   ├── info-panel/
│   │   └── info-panel-controller.js           # MODIFIED — renderWeather() rebuilt: builds
│   │                                             icon+value+tooltip DOM per indicator via
│   │                                             weather-text.js, sets aria-label from the full
│   │                                             text, sets data-available per indicator (not
│   │                                             just per link), wires the touch tap-toggle
│   │                                             (click/touchstart + outside-tap/Escape close)
│   └── config.js                              # unchanged
├── i18n/
│   ├── de.json                                # unchanged — no new keys (assumption in spec.md)
│   └── en.json                                # unchanged
└── index.html                                 # MODIFIED — both weather blocks
                                                   (`.info-panel--desktop`/`--mobile`) restructured:
                                                   current/forecast each get an icon span + value
                                                   span + tooltip span, `tabindex="0"`, wrapped by
                                                   the existing `data-role="weather-current"` /
                                                   `data-role="weather-forecast"` hooks

tests/e2e/
└── info-panel.spec.js                         # MODIFIED — rewrite assertions that currently
                                                   check inline label text (now moved to
                                                   aria-label/tooltip); add divider, tooltip
                                                   reveal on hover/focus/tap, and independent
                                                   per-indicator unavailable-state coverage
```

**Structure Decision**: No new top-level directory. The new pure string-building module lives
beside the existing classifier/icon-lookup in `web/js/weather/` (mirroring how `weather-icon.js`
and `daytime.js` already sit next to `weather-category.js`), keeping `info-panel-controller.js`
focused on DOM glue rather than string formatting. `index.html` needs markup changes this time
(unlike 023) because the icon-over-value layout requires new wrapper/tooltip elements that
didn't exist before; the existing `[data-role]` hooks are preserved so `info-panel-controller.js`
keeps selecting elements the same way.

## Complexity Tracking

_No violations — table not needed._
