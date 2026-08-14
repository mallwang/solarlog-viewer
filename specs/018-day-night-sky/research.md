# Research: Day/Night Sky Background

No NEEDS CLARIFICATION markers remained in the Technical Context — the spec's own Assumptions
section resolves the only open design question (falling-star frequency is an implementation
detail, not a requirement to pin down). This file records the technical decisions the plan is
built on.

## 1. Deriving day/night state — reuse `computeSkyBodyPosition()`, no new data

**Decision**: Read the day/night state off `computeSkyBodyPosition()`'s existing `body: 'sun' |
'moon'` return value (`solar-arc.js`) inside `sky-controller.js`'s existing `tick()` function,
rather than fetching or computing anything new.

**Rationale**: `tick()` already calls `computeSkyBodyPosition(new Date(), lastWeather.sunrise,
lastWeather.sunset, lastWeather.nextSunrise)` every 60 seconds to position the sun/moon, and the
function already classifies "now" as daytime (`sun`) or night-time (`moon`) using exactly the
sunrise/sunset/nextSunrise window FR-001/FR-002 require. `body === 'sun'` _is_ "current local time
is between sunrise and sunset"; `body === 'moon'` _is_ the night window. No new Open-Meteo field,
no new poll, no new pure function — `applyDayNightState()` just reads the same `position` object
`applySkyBodyPosition()` already receives.

**Alternatives considered**:

- _New standalone `isNight(now, sunrise, sunset, nextSunrise)` helper_ — rejected: would
  duplicate `computeSkyBodyPosition()`'s boundary logic (`isDaytime` computation) for no benefit;
  `tick()` already has the answer in hand every time it runs.
- _Compute day/night independently in a new module reading raw sunrise/sunset_ — rejected: two
  independent computations of the same boundary could drift out of sync (e.g. off-by-one at the
  exact sunset instant) in a way a single source of truth can't.

## 2. Gradual transition — reuse the existing crossfade window, don't add a second one

**Decision**: The day/night switch and starfield fade use `position.crossfade` (already computed
by `computeSkyBodyPosition()`, 0 outside the 5-minute `CROSSFADE_WINDOW_MS` boundary window, 1 at
the boundary) as a new `--night-crossfade` CSS custom property, blended via `app.css` the same way
`.sky-sun`/`.sky-moon` opacity is already blended in `applySkyBodyPosition()`.

**Rationale**: FR-009 requires the day/night switch (including the starfield's fade) to be
"gradual across the existing sunrise/sunset crossfade window" — explicitly the _same_ window, not
a new one. `crossfade` already encodes "how far into the transition are we, 0 to 1" from the exact
same sunrise/sunset timestamps. Piping it into a CSS variable lets `app.css` do a linear
`opacity`/gradient blend with zero new JS timing logic, and guarantees the sun/moon crossfade and
the sky-gradient/starfield crossfade are pixel-synchronized (driven by one shared number computed
once per tick).

**Alternatives considered**:

- _CSS `transition` on `data-sky` attribute change_ — rejected: a CSS attribute-selector swap
  isn't itself transitionable, and a `transition: background 5min` approach can't be paused/resumed
  correctly across page reloads or `tick()`'s 60s granularity the way an explicit 0–1 value can;
  it also can't express "already 40% through the window at page load" (FR edge case: gradual
  transition must work correctly even in the moment the page loads mid-crossfade).
- _A second, independent crossfade timer for the sky background_ — rejected: duplicates
  `CROSSFADE_WINDOW_MS`/`crossfadeFromDistance()` logic and risks the two fades disagreeing near
  the boundary, which is exactly what FR-009 says must not happen (the _same_ transition).

## 3. Starfield & falling star — pure CSS layer, JS only decides _when_ to trigger

**Decision**: A fixed set of `.sky-star` dot elements (visibility/opacity gated purely by CSS
attribute selectors `.sky-clouds[data-sky='night'][data-weather='sunny']` /
`[data-weather='mixed']`) plus one `.sky-falling-star` element whose CSS animation is (re)played by
toggling a class from JS on a randomized interval. A new small pure module,
`falling-star-scheduler.js`, decides _when_ to trigger the next replay (poll-based, like
`flying-objects.js`'s `createFlyingObjectScheduler()`); `sky-controller.js` only flips a class.

**Rationale**: FR-004–FR-006 are pure CSS-selector logic — no different in kind from how
`data-weather` already gates `.sky-rain`/`.sky-snow` visibility, so the starfield needs no new JS
beyond setting the `data-sky` attribute `applyDayNightState()` already sets. FR-007's "occasional,
randomized, not constant, not on every load" is exactly the shape `flying-objects.js`'s scheduler
already solves for bird/plane/balloon spawns (a poll function returning zero-or-more "spawn now"
events from an internally tracked next-fire timestamp) — reusing that pattern keeps the falling
star's timing logic pure, unit-testable, and consistent with the rest of the sky's spawn-timing
code rather than inventing a second timing idiom.

**Alternatives considered**:

- _Canvas-drawn starfield/falling star_ — rejected: constitution/plan precedent
  (`017-background-weather-config`) explicitly keeps all sky visuals CSS-only, no canvas, no
  continuous JS animation loop; a falling star is a single element replaying a CSS `@keyframes`
  streak, well within that constraint.
- _`setTimeout`-chain for the falling star's next replay_ — rejected in favor of the existing
  poll-based scheduler pattern: `sky-controller.js`'s comments already call out why
  `setInterval`/poll beats `setTimeout` chains here — background-tab throttling (`visibilitychange`
  handling already resets `flying-objects.js`'s scheduler on tab return) would otherwise cause the
  same "burst on return" problem FR-007 (`not continuously`) must avoid.
- _A CSS-only random-interval trick (e.g. long `animation-delay` with `infinite` and hoping for
  perceived randomness)_ — rejected: CSS can't produce true per-load randomization or "infrequent,
  not on a fixed schedule" (FR-007) without JS picking the next interval; a fixed CSS
  `animation-delay`/`iteration-count` would replay on a perfectly predictable schedule, which the
  requirement explicitly rules out.

## 4. Moon dimming under cloud cover at night — reuse the existing sun-dimming precedent

**Decision**: Night + cloudy/rain/snow dims `.sky-moon` opacity via a `data-weather`-scoped CSS
rule, the same mechanism `017-background-weather-config` already uses to hide the sun entirely
under those categories (`design.md`'s reviewed "moon dimmed to ~15% opacity... mirrors how the sun
is already dimmed under cloud cover today").

**Rationale**: Matches the approved mockup (`design.md`) and requires no new JS — `data-weather`
is already set on both `.sky-clouds` and `<body>` by `applyWeatherCategory()`; a `data-sky='night'`
combinator selector in `app.css` is all that's needed, following the exact selector-composition
pattern already used by `body[data-weather='cloudy'] .sky-overcast` etc.

**Alternatives considered**: None seriously — this is a direct, already-reviewed extension of an
existing pattern; no technology choice to weigh.
