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
the pre-existing default fallback appearance. `'off'` mode is different — it's handled before
this variable is ever touched (see below), not a state this reading can end up in.

## Background Weather Setting

A single site configuration value (`web/js/config.js` export `BACKGROUND_WEATHER`) controlling
how the sky background's category is determined. Mutually exclusive modes (Key Entities).

| Value                                                                              | Behavior                                                                           |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `'auto'` (default)                                                                 | Background category = live `Sky Weather Reading.category` (FR-001).                |
| `'off'`                                                                            | Sky animation fully disabled — no clouds, no sun/moon, no flying objects (FR-007). |
| one of `WEATHER_CATEGORIES` (`'sunny'`, `'mixed'`, `'cloudy'`, `'rain'`, `'snow'`) | Background always shows that fixed category (FR-006).                              |
| anything else (typo, unrecognized string, absent)                                  | Treated as `'auto'` (FR-008).                                                      |

**Validation** (`sky-controller.js`, read once at `initSkyController()` startup — config is a
static, build-time constant per FR-010, not a runtime-reactive value):

```js
const effectiveMode = ['off', ...WEATHER_CATEGORIES].includes(BACKGROUND_WEATHER)
  ? BACKGROUND_WEATHER
  : 'auto';
```

`'off'` is checked immediately after this and short-circuits the whole function (`skyClouds.hidden
= true; return;`) — before location resolution, weather polling, or any timer setup — so no sun/
moon positioning or flying-object spawning happens either in this mode (research.md §6).

**Never affects**: the nav bar's own weather/forecast text (`info-panel/`) — that widget always
reads live data regardless of this setting (FR-002, FR-006, FR-007) — nor, for `'auto'`/fixed
modes specifically, sun/moon positioning or flying-object spawning, which continue exactly as
today. `'off'` is the one mode that _does_ additionally disable those (spec Assumptions).

## `WEATHER_CATEGORY_RENDER_CONFIG` (renamed from `CLOUD_TIER_RENDER_CONFIG`)

Per-category render config consumed by `sky-controller.js` to drive `.sky-clouds`'s
`data-weather` attribute and `.cloud` visibility (`web/js/weather/weather-render-config.js`,
renamed from `sky/cloud-density.js`).

| Field                    | Type    | Notes                                                                                     |
| ------------------------ | ------- | ----------------------------------------------------------------------------------------- |
| `opacity`                | number  | Unchanged mechanism — `.cloud` opacity per category (CSS custom property).                |
| `animationDurationScale` | number  | Unchanged mechanism — drift-speed multiplier.                                             |
| `visibleCount`           | number  | Unchanged mechanism — how many of the sixteen `.cloud` elements stay visible (see below). |
| `hasRainLayer`           | boolean | New — `sky-controller.js` toggles the CSS-only rain-streak layer when true.               |
| `hasSnowLayer`           | boolean | New — toggles the CSS-only snow-flake layer when true.                                    |

| Category | `opacity` | `animationDurationScale` | `visibleCount` |
| -------- | --------- | ------------------------ | -------------- |
| `sunny`  | 0.35      | 0.85                     | 2 (of 16)      |
| `mixed`  | 0.8       | 1.1                      | 10 (of 16)     |
| `cloudy` | 0.95      | 1.3                      | 16 (of 16)     |
| `rain`   | 0.95      | 1.3                      | 16 (of 16)     |
| `snow`   | 0.95      | 1.3                      | 16 (of 16)     |

`sunny` carries over today's pre-feature `clear` values unchanged. `mixed` (post-review
refinement — see design.md's "Revision during review") was widened beyond a direct `partly`
carry-over: it now shows five times as many visible clouds (10, up from the original 4) at a
higher opacity/duration, so it reads as noticeably cloudier than `sunny` per the operator's
follow-up request, while still leaving the sun/moon visible. `cloudy`/`rain`/`snow` reuse the
same opacity/duration/visibleCount (all visually "fully overcast", all sixteen `.cloud` elements
shown) with `hasRainLayer`/`hasSnowLayer` respectively `true` only for their own category
(research.md §4). `index.html` ships sixteen `.cloud` elements total — the original six visible
by default (the pre-feature/no-JS fallback appearance) plus ten more that start `hidden` and are
revealed per category via `visibleCount`.

## Sky Body Visibility (post-review refinement)

Whether `.sky-sun`/`.sky-moon` render at all, layered on top of `applySkyBodyPosition()`'s
existing crossfade opacity (data-model.md's "Sky Weather Reading" §tick-driven positioning,
unchanged): real overcast/rain/snow skies block the sun/moon out completely, not just dim it.

| Category                 | Sun/moon visibility                                                                                                                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sunny`, `mixed`         | Normal crossfade opacity, unaffected — clouds drift in front of it (markup order: `.sky-sun`/`.sky-moon` are placed _before_ the `.cloud` elements in `index.html`, so clouds always paint on top, mimicking the real sky). |
| `cloudy`, `rain`, `snow` | Forced fully hidden (`opacity: 0 !important` in app.css, overriding `sky-controller.js`'s own inline opacity) — no sun/moon shows at all.                                                                                   |

This is a refinement beyond design.md's original mockup wording ("sun mostly obscured" for
`cloudy`) — implementation settled on fully hiding the sun/moon for all three
fully-overcast categories, consistent with `rain`/`snow` already implying the same dense cover.

## Full-coverage overcast backdrop (post-review addition)

`cloudy`/`rain`/`snow` also toggle two additional static/slow-drift layers, both siblings of
`.sky-clouds` (not descendants — kept outside its `contrast()` filter so they read as smooth
flat color instead of the gooey fused-circle cloud look), driven by the same `data-weather`
value `sky-controller.js` now also sets on `<body>` (in addition to `.sky-clouds`, since these
two elements aren't descendants of it):

| Layer           | Markup element                                    | Purpose                                                                                                                                                                 |
| --------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.sky-overcast` | `index.html`, sibling before `.sky-clouds`        | Full-viewport flat color fill (tinted per category) so gaps between the drifting `.cloud` puffs show solid cloud cover instead of the page background bleeding through. |
| `.sky-ceiling`  | `index.html`, sibling after `.sky-flying-objects` | A dense, slow-drifting band of sixteen chunkier cloud puffs pinned just below the nav bar, giving a "close overhead cloud ceiling" texture on top of `.sky-overcast`.   |

`body[data-weather]` also switches the page's own background-gradient top color (`cloudy`: a
muted blue-grey; `rain`/`snow`: a darker grey), replacing the default bright-blue gradient,
so the whole page — not just the `.sky-clouds` region — reads as overcast.

`rain`/`snow` additionally tint every `.cloud`/`.sky-ceiling__puff` element gray instead of
white (`rain`: a flat neutral gray; `snow`: two alternating neutral grays for a mixed, wintery
look) — see app.css's `[data-weather='rain'|'snow'] .cloud` rules for why this requires lowering
`.sky-clouds`'s `contrast()` filter for those two categories specifically (an extreme contrast
value pushes any non-neutral color toward a hue instead of gray).
