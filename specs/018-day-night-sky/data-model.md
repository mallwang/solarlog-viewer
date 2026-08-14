# Data Model: Day/Night Sky Background

All shapes here are in-memory/render state derived from data `017-background-weather-config`
already fetches (Open-Meteo `sunrise`/`sunset`/`nextSunrise`) — nothing new crosses the network,
`localStorage`, or a SolarLog `.js` data file.

## Day/Night State

Derived, not stored: the existing `computeSkyBodyPosition()` return value already carries it.

| Field       | Type              | Source                                                 | Notes                                                                                                                                                            |
| ----------- | ----------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `body`      | `'sun' \| 'moon'` | `computeSkyBodyPosition()` (`solar-arc.js`, unchanged) | `'sun'` = day, `'moon'` = night (FR-001/FR-002). Already computed every `tick()`.                                                                                |
| `crossfade` | `number` (0–1)    | `computeSkyBodyPosition()` (unchanged)                 | 0 outside the 5-minute boundary window, 1 at the sunrise/sunset instant. Reused as `--night-crossfade` for the gradual day/night blend (FR-009, research.md §2). |

**Rendered as**: `data-sky="day" | "night"` on `.sky-clouds` and `<body>` (same dual-target pattern
`data-weather` already uses, since `.sky-overcast`/`.sky-ceiling` are siblings of `.sky-clouds`
and need the attribute on `<body>` to key off it) plus a `--night-crossfade` CSS custom property
carrying `crossfade`, set once per `tick()` call by a new `applyDayNightState()` function
alongside the existing `applyWeatherCategory()`/`applySkyBodyPosition()`.

**Persistence/failure behavior**: Not persisted — recomputed every tick from `lastWeather`, the
same last-known-good object `tick()` already guards on (`if (!lastWeather || !sunEl || !moonEl)
return;`). A poll failure leaves `data-sky`/`--night-crossfade` at their last-applied values,
matching FR-012 and the existing `data-weather` failure behavior.

## Starfield

A purely presentational, boolean-derived visibility state — no JS-tracked object at all.

| Concept           | Representation                                                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Visible           | CSS selector match: `.sky-clouds[data-sky='night'][data-weather='sunny']` or `[data-weather='mixed']` (FR-004–FR-006)                                                                                                                            |
| Star positions    | Fixed `<div class="sky-star">` elements in `index.html` (mirrors `.cloud`'s fixed-markup, JS-only-toggles-visibility approach) — no runtime placement algorithm (per design.md, deferred as a mockup-only concern, not a functional requirement) |
| Twinkle animation | Pure CSS `@keyframes` per star (opacity/scale pulse), independent of `prefers-reduced-motion` since it carries no positional motion (FR-011 explicitly exempts the static starfield)                                                             |

No JS entity is created for this — `sky-controller.js` never queries or manipulates `.sky-star`
elements directly; `applyDayNightState()` setting `data-sky` (combined with `applyWeatherCategory()`
already setting `data-weather`) is sufficient for `app.css` to gate visibility entirely.

## Falling Star Event

The one genuinely new piece of JS-tracked state: a scheduler for _when_ to next replay the
falling-star CSS animation, structurally identical to `flying-objects.js`'s existing
`createFlyingObjectScheduler()`.

| Field          | Type     | Notes                                                                                                                                                                                                                                                      |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nextFireAtMs` | `number` | Internal to `falling-star-scheduler.js`; epoch ms of the next randomized replay, picked from an infrequent range (implementation detail per spec.md Assumptions, tuned during implementation — not a fixed requirement value).                             |
| `poll(nowMs)`  | function | Pure function: returns whether a replay should fire now, and (if so) resets `nextFireAtMs` to a new randomized future time. Mirrors `flying-objects.js`'s poll shape so `sky-controller.js`'s existing `spawnPoll()`-style call site pattern can drive it. |

**Gating** (not part of the scheduler itself — checked by the `sky-controller.js` call site before
even polling, same as `spawnPoll()` already gates on `reducedMotion`/`lastWeather`):

- Only polled while `data-sky === 'night'` and `data-weather` is `'sunny'` or `'mixed'` (FR-008) —
  i.e., only while the starfield is actually visible.
- Suppressed entirely when `reducedMotion` is true (FR-011), reusing the existing
  `skyClouds.dataset.reduceMotion` flag `applyReducedMotion()` already maintains.
- Reset on `visibilitychange` return-from-background the same way
  `createFlyingObjectScheduler()` is already reset today, so a throttled background tab can't
  queue up a burst of replays.

**Rendered as**: toggling a replay-trigger class (e.g. `sky-falling-star--play`, exact naming an
implementation detail) on the single `.sky-falling-star` element in `index.html`, whose `app.css`
`@keyframes` animation runs once and the class is removed on `animationend` (same
`animationend`-cleanup idiom `spawnFlyingObject()` already uses for flying objects).

## Relationship to existing entities (017-background-weather-config)

- **Weather Background Category** (`sunny`/`mixed`/`cloudy`/`rain`/`snow`, unchanged) — Starfield
  visibility is a function of this category _and_ the new Day/Night State; the category itself is
  untouched by this feature (FR-010).
- **`WEATHER_CATEGORY_RENDER_CONFIG`** (unchanged) — no new fields; day/night is an orthogonal
  attribute (`data-sky`), not folded into this per-category config table, since cloud/rain/snow
  rendering is explicitly unaffected by day/night (FR-003).
