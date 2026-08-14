# Data Model: Configurable Weather Backgrounds

All entities are in-memory JS values (plain strings/objects) or a single static config export.
Nothing new is persisted (no `localStorage`, no SolarLog `.js` data file involved) — Principle I
unaffected.

## Weather Background Category

The shared five-way classification driving both the animated background and the nav bar's
weather text while the background setting is `'auto'` (FR-001, FR-002).

| Value    | Meaning                                                        |
| -------- | -------------------------------------------------------------- |
| `sunny`  | Clear / mainly clear sky                                       |
| `mixed`  | Partly cloudy                                                  |
| `cloudy` | Overcast (also the fallback for fog and any unrecognized code) |
| `rain`   | Any drizzle/rain/rain-shower condition (also thunderstorm)     |
| `snow`   | Any snow/snow-shower condition                                 |

**Derivation** (`web/js/weather/weather-category.js`, `weatherCodeToCategory(weatherCode)`):
pure function, WMO `weather_code` → one of the five values above. See research.md §3 for the
full code table. Never returns anything outside the five values (FR-004).

`WEATHER_CATEGORIES` (exported alongside): `['sunny', 'mixed', 'cloudy', 'rain', 'snow']` — the
single source of truth for the five valid names, reused by `config.js` validation (FR-005/FR-008)
and by `weather-render-config.js`'s render-config keys.

## Sky Weather Reading (replaces today's "Weather Condition")

The sky background's latest successfully retrieved reading. Supersedes
`web/js/sky/weather-client.js`'s current `{ cloudCoverPercent, tier, ... }` shape.

| Field         | Type                                                 | Notes                                                                                         |
| ------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `weatherCode` | number                                               | Raw Open-Meteo `current.weather_code` (WMO code).                                             |
| `category`    | `'sunny' \| 'mixed' \| 'cloudy' \| 'rain' \| 'snow'` | `weatherCodeToCategory(weatherCode)` (FR-001).                                                |
| `sunrise`     | string (ISO)                                         | Unchanged from today — today's sunrise, local time (`timezone=auto`).                         |
| `sunset`      | string (ISO)                                         | Unchanged from today.                                                                         |
| `nextSunrise` | string (ISO)                                         | Unchanged from today — tomorrow's sunrise, feeds `computeSkyBodyPosition()`'s night-arc math. |
| `fetchedAt`   | `Date`                                               | Unchanged from today — informational only.                                                    |

`cloudCoverPercent`/`tier` are removed — no longer fetched or needed (research.md §1).

**State transitions**: unchanged from today — a single "last known good" module-level variable
in `sky-controller.js`; a successful poll replaces it, a failed poll (network error, non-2xx,
malformed body) leaves it untouched (FR-009). `null` until the first successful poll, rendering
the pre-existing default fallback appearance (same as `'off'` mode — see below).

## Background Weather Setting

A single site configuration value (`web/js/config.js` export `BACKGROUND_WEATHER`) controlling
how the sky background's category is determined. Mutually exclusive modes (Key Entities).

| Value                                                                              | Behavior                                                              |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `'auto'` (default)                                                                 | Background category = live `Sky Weather Reading.category` (FR-001).   |
| `'off'`                                                                            | Background renders its pre-feature plain default appearance (FR-007). |
| one of `WEATHER_CATEGORIES` (`'sunny'`, `'mixed'`, `'cloudy'`, `'rain'`, `'snow'`) | Background always shows that fixed category (FR-006).                 |
| anything else (typo, unrecognized string, absent)                                  | Treated as `'auto'` (FR-008).                                         |

**Validation** (`sky-controller.js`, read once at `initSkyController()` startup — config is a
static, build-time constant per FR-010, not a runtime-reactive value):

```js
const effectiveMode = ['off', ...WEATHER_CATEGORIES].includes(BACKGROUND_WEATHER)
  ? BACKGROUND_WEATHER
  : 'auto';
```

**Never affects**: the nav bar's own weather/forecast text (`info-panel/`) — that widget always
reads live data regardless of this setting (FR-002, FR-006, FR-007) — nor sun/moon positioning or
flying-object spawning, which continue exactly as today in every mode (spec Assumptions).

## `WEATHER_CATEGORY_RENDER_CONFIG` (renamed from `CLOUD_TIER_RENDER_CONFIG`)

Per-category render config consumed by `sky-controller.js` to drive `.sky-clouds`'s
`data-weather` attribute and `.cloud` visibility (`web/js/weather/weather-render-config.js`,
renamed from `sky/cloud-density.js`).

| Field                    | Type    | Notes                                                                       |
| ------------------------ | ------- | --------------------------------------------------------------------------- |
| `opacity`                | number  | Unchanged mechanism — `.cloud` opacity per category (CSS custom property).  |
| `animationDurationScale` | number  | Unchanged mechanism — drift-speed multiplier.                               |
| `visibleCount`           | number  | Unchanged mechanism — how many of the six `.cloud` elements stay visible.   |
| `hasRainLayer`           | boolean | New — `sky-controller.js` toggles the CSS-only rain-streak layer when true. |
| `hasSnowLayer`           | boolean | New — toggles the CSS-only snow-flake layer when true.                      |

`sunny`/`mixed`/`cloudy` carry over today's `clear`/`partly`/`overcast` values unchanged, both
flags `false`. `rain`/`snow` reuse `cloudy`'s opacity/duration/visibleCount (both visually
overcast) with `hasRainLayer`/`hasSnowLayer` respectively `true` (research.md §4).
