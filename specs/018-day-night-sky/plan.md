# Implementation Plan: Day/Night Sky Background

**Branch**: `018-day-night-sky` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-day-night-sky/spec.md`

## Summary

Layer a day/night dimension onto the existing weather-driven sky backdrop (`017-background-
weather-config`) using data already fetched: `computeSkyBodyPosition()` in `solar-arc.js`
already derives `body: 'sun' | 'moon'` and a `crossfade` value from the same sunrise/sunset
timestamps `sky-controller.js` polls today, so no new Open-Meteo field or request is needed.
`sky-controller.js`'s existing 60-second `tick()` gains a `data-sky` (`'day'`/`'night'`) write on
`.sky-clouds`/`<body>`, computed from `position.body`, alongside a new `--night-crossfade` custom
property carrying `position.crossfade` for a gradual CSS transition (reusing the exact mechanism
`applySkyBodyPosition()` already uses to fade the sun/moon opacity). A new CSS-only starfield
layer (fixed dot positions, `@keyframes` twinkle, matching `.cloud`'s custom-property/no-canvas
technique) is shown via `.sky-clouds[data-sky='night'][data-weather='sunny'|'mixed']`; a single
falling-star element inside that layer replays an occasional CSS animation on a randomized
interval driven by a small new JS scheduler (mirroring `flying-objects.js`'s poll-based approach,
not a `setTimeout` chain) and respects `prefers-reduced-motion` via the same
`skyClouds.dataset.reduceMotion` flag `applyReducedMotion()` already sets. Clouds, rain/snow, and
flying objects are untouched — `data-weather` keeps driving them exactly as it does today;
`data-sky` only swaps the background gradient/moon-dimming and gates the new starfield.

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

**Primary Dependencies**: No new dependency. Reuses the already-integrated, keyless Open-Meteo
Forecast API response `sky-controller.js` already polls (`sunrise`/`sunset`/`nextSunrise` via
`weather-client.js`) — no new field, no additional request.

**Storage**: Browser `localStorage` for user preferences (see `web/js/settings.js`) — unused by
this feature. No new `config.js` export: the existing `BACKGROUND_WEATHER` setting (auto/off/
fixed category) remains the only control surface per FR-010; day/night state is derived, not
configured. The SolarLog device's static `.js` data files under `web/data/` / `web/hist/` are
unaffected (constitution Principle I).

**Testing**: `node --test` (via `npm run test:scripts`) for the pure-logic addition to
`sky/solar-arc.js` (`computeSkyBodyPosition()` already returns everything needed — no new pure
function is strictly required, but the falling-star scheduler's interval-picking logic, if it
carries any branching, gets its own `*.test.js` alongside `flying-objects.test.js`'s pattern).
Playwright (`npx playwright test --reporter=line`) extends the existing `tests/e2e/sky.spec.js`
with mocked sunrise/sunset windows (the file already mocks these fields, see
`mockOpenMeteo()`) to cover day/night switching, starfield gating per category, and reduced-motion
suppression of the falling star (constitution Testing standard).

**Target Platform**: Static site, deployable to any plain web host (Apache, nginx, GitHub Pages,
S3) with no runtime dependencies; must render correctly 320px–2560px without horizontal scrolling
(constitution Principle IV).

**Project Type**: Single static web app (`web/`) — no frontend/backend split, no server component
(constitution Principle III).

**Performance Goals**: No change to today's polling cadence/footprint — day/night state is
derived from data already fetched on the existing 15-minute `POLL_INTERVAL_MS` weather poll and
recomputed on the existing 60-second `TICK_INTERVAL_MS` sun/moon position tick; no new network
request, no new timer beyond one lightweight scheduler for the falling star (comparable in cost to
the existing `SPAWN_POLL_INTERVAL_MS` flying-object poll). The starfield itself is static CSS
(fixed dot elements + a twinkle `@keyframes`), no per-frame JS.

**Constraints**: Must never regress the existing "any failure → last-known-good state, no console
errors" behavior (FR-012, edge cases) — day/night state is read from the same `lastWeather` object
`tick()` already guards on, so a poll failure simply freezes the current `data-sky` value like it
already freezes `data-weather`. The day/night switch and starfield fade MUST be gradual across the
existing 5-minute crossfade window (`CROSSFADE_WINDOW_MS` in `solar-arc.js`), not an instant flip
— reuse `position.crossfade`, don't add a second transition timer. The starfield/falling-star MUST
be pure CSS (matching `.cloud`/rain/snow's existing technique, no canvas), MUST respect
`prefers-reduced-motion` via the existing `skyClouds.dataset.reduceMotion` flag, and MUST NOT
alter clouds/rain/snow/flying-object rendering in any way (FR-003; constitution Principle IV's
no-horizontal-scroll bar still applies at 320px, satisfied by keeping the starfield inside
`.sky-clouds`'s existing `overflow: hidden` containment).

**Scale/Scope**: One new `data-sky` attribute (day/night) set alongside the existing
`data-weather` attribute on `.sky-clouds` and `<body>`; one new starfield DOM layer (~a dozen
fixed `<div class="sky-star">` dots + one `.sky-falling-star` element) added to `index.html`
inside `.sky-clouds`; CSS additions to `app.css` for the night gradient, moon-dimming-under-cover
reuse, twinkle keyframes, and falling-star animation; small additions to `sky-controller.js`
(`applyDayNightState()` alongside the existing `applyWeatherCategory()`/`applySkyBodyPosition()`,
plus a small falling-star scheduler check folded into the existing `spawnPoll()` or a sibling
timer). No new top-level directory, no new config constant, no new route.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Static-File Data Model is Sacred)** — PASS. No SolarLog `.js` data file is read,
  written, or reinterpreted; this feature only derives new UI state from Open-Meteo data already
  fetched for `017-background-weather-config`.
- **Principle II (Zero Historical Data Loss)** — N/A. No historical data touched.
- **Principle III (No Backend Introduction)** — PASS. Purely client-side; no server, no new
  request, no build-time pipeline change.
- **Principle IV (Responsive-First Layout)** — PASS. The starfield/falling-star layer lives inside
  `.sky-clouds`'s existing fixed, full-width, `overflow: hidden` backdrop — same containment
  already relied on by `.cloud`/rain/snow — so it cannot introduce horizontal scroll or a new
  interactive surface at any width.
- **Principle V (Modern Charting — No Custom Pixel Math)** — N/A. No chart involved.
- **Technical Standards → Frontend (no framework/bundler except the approved Tailwind exception)**
  — PASS. Native ES modules only; starfield/falling-star are hand-written CSS, not a new
  dependency.
- **Testing standard (every UI-visible feature gets a Playwright test)** — PASS, planned: extends
  `tests/e2e/sky.spec.js` with mocked sunrise/sunset windows for day/night switching, starfield
  gating per weather category, and reduced-motion suppression, per quickstart.md §6.

No violations. Complexity Tracking table left empty.

_Re-checked after Phase 1 design: still PASS — no new entity beyond what's listed above (Day/Night
State, Starfield, Falling Star Event are all derived/rendering concerns, no new persisted or
fetched data shape), no new dependency, nothing crosses into SolarLog data or a server._

## Project Structure

### Documentation (this feature)

```text
specs/018-day-night-sky/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── design.md            # Approved mockup/layout notes (from /speckit-ux-review)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

No `contracts/` — this feature exposes no external interface (API, CLI schema); it derives new
render state entirely from data `017-background-weather-config` already fetches, with no new
config constant or external contract (matches that spec's own precedent of skipping `contracts/`
for the same reason).

### Source Code (repository root)

<!--
  This repo has one fixed layout (below) — there is no frontend/backend or mobile/API split to
  choose between. ACTION REQUIRED: expand the tree with the actual new/changed files for this
  feature (mirroring how prior specs/*/plan.md did it), not just the unchanged skeleton.
-->

```text
web/
├── index.html                           # .sky-clouds gains a starfield layer: ~12 fixed
│                                           .sky-star dots + one .sky-falling-star element,
│                                           placed after the rain/snow particle layers so it
│                                           paints above the night gradient but the clouds still
│                                           drift in front of it (same "clouds on top" ordering
│                                           .sky-sun/.sky-moon already use)
├── css/
│   └── app.css                          # new body[data-sky='night'] / .sky-clouds[data-sky=
│                                           'night'] gradient + moon-dimming-under-cover rules;
│                                           --night-crossfade-driven gradual blend (reusing the
│                                           existing crossfade custom-property technique from
│                                           .sky-sun/.sky-moon opacity); .sky-star twinkle
│                                           @keyframes; .sky-falling-star streak @keyframes,
│                                           gated by [data-sky='night'][data-weather='sunny'|
│                                           'mixed'] and suppressed under
│                                           [data-reduce-motion='true'] (motion only — static
│                                           .sky-star dots stay visible per FR-011)
├── js/
│   └── sky/
│       ├── sky-controller.js            # tick() also computes/applies data-sky + the
│       │                                   --night-crossfade property (new applyDayNightState()
│       │                                   alongside applyWeatherCategory()/
│       │                                   applySkyBodyPosition()); a new small scheduler
│       │                                   (mirrors flying-objects.js's poll pattern) triggers
│       │                                   the falling-star replay at a randomized infrequent
│       │                                   interval, gated on data-sky/data-weather and reusing
│       │                                   the existing reducedMotion flag
│       ├── solar-arc.js                 # unchanged — computeSkyBodyPosition()'s existing
│       │                                   { body, crossfade } already supplies everything
│       │                                   applyDayNightState() needs; no signature change
│       └── falling-star-scheduler.js    # NEW — pure poll-based interval picker for the
│           falling-star-scheduler.test.js  falling star (same shape as flying-objects.js's
│                                           createFlyingObjectScheduler(), unit-tested the same
│                                           way), kept out of sky-controller.js per that file's
│                                           existing "kind-specific logic lives in its own
│                                           module" convention
└── data/, hist/                         # unaffected — read-only SolarLog device output

tests/e2e/
└── sky.spec.js                          # extended: mocked sunrise/sunset windows to assert
                                            data-sky day/night switching, starfield shown only on
                                            night+sunny/mixed, absent on night+cloudy/rain/snow
                                            and on day (any category), falling-star element
                                            suppressed under prefers-reduced-motion, clouds/rain/
                                            snow/flying-objects unaffected by data-sky
```

**Structure Decision**: No new directory. One new pure-logic file,
`web/js/sky/falling-star-scheduler.js`, matching the existing split between DOM-effect code
(`sky-controller.js`, Playwright-tested) and pure poll/scheduling logic (`flying-objects.js`,
unit-tested) that `017-background-weather-config` and the original sky feature already
established. Everything else is an in-place extension of `sky-controller.js`, `index.html`, and
`app.css` — no new view, route, or config constant, since day/night state is fully derived from
data already flowing through `solar-arc.js`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table intentionally left empty.
