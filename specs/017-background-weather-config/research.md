# Research: Configurable Weather Backgrounds

## 1. Shared classification data source

**Decision**: Classify the shared "Weather Background Category" (sunny/mixed/cloudy/rain/snow)
from the Open-Meteo **`weather_code`** (WMO code), not `cloud_cover` percent. Both consumers keep
their own independent fetch/poll (sky background: 15 min via `sky/weather-client.js`; nav bar:
`WEATHER_REFRESH_INTERVAL_MS` via `info-panel/weather-forecast-client.js`, unchanged) but both run
the same new pure classifier — `weatherCodeToCategory()` — over their own `weather_code` reading,
so the same underlying condition always yields the same one of five categories on both sides
(FR-002). Poll cadence is intentionally allowed to stay independent per-consumer — spec's User
Story 1 AS6 explicitly describes the nav bar as "already independently polling" — only the
_classification_ must be shared, not the network call itself.

**Rationale**:

- `weather_code` already distinguishes clear/mainly-clear/partly-cloudy/overcast **and**
  fog/drizzle/rain/snow/thunderstorm in one discrete value — exactly the five-way split FR-001
  needs. `cloud_cover` (today's sky-background input) only ever distinguishes cloud density; it
  has no way to represent "rain" or "snow" at all, so it cannot answer FR-001 on its own.
- `info-panel/weather-forecast-client.js` already fetches `weather_code` and already has a
  code→bucket mapping (`weatherCodeToLabelKey`) covering nearly the same boundaries FR-004's
  default mapping asks for (clear / 1-2-3-cloudy / fog / rain-family / snow-family / storm). The
  new shared classifier is a light refinement of that existing table (see §3), not a new design.
- Switching `sky-controller.js` from `cloud_cover` to `weather_code` lets one Open-Meteo request
  (`current=weather_code&daily=sunrise,sunset&forecast_days=2&timezone=auto`) serve cloud density,
  rain/snow, _and_ sun/moon timing — actually **one fewer** field than today's sky request, not
  more (`cloud_cover` is dropped; nothing new is added to that request).
- A literal single shared HTTP fetch (one request feeding both the sky and the nav bar) was
  considered and is unnecessary to satisfy FR-002 (see AS6 above) — it would also force the two
  features onto one poll interval, coupling them for no requirement gain, and cross the module
  boundary the codebase already deliberately drew between `sky/` (backdrop-focused) and
  `info-panel/` (nav-bar-focused) per `weather-forecast-client.js`'s own file-level comment ("
  deliberately separate from `web/js/sky/weather-client.js`").

**Alternatives considered**:

- **Derive category from `cloud_cover` alone, add a separate precipitation flag** — Open-Meteo's
  `current` block doesn't expose a plain boolean/precipitation-probability field usable this way
  without pulling in additional fields (`precipitation`, `rain`, `snowfall`) and reconciling them
  against cloud cover, which is strictly more fields and more edge cases than just reading the one
  `weather_code` that already encodes precipitation type. Rejected.
- **One shared fetch/poll for both consumers** — see Rationale above; rejected as unnecessary
  coupling not required by any acceptance scenario.

## 2. Shared classifier module location

**Decision**: New module `web/js/weather/weather-category.js`, exporting
`weatherCodeToCategory(weatherCode)` and the `WEATHER_CATEGORIES` list (`['sunny', 'mixed',
'cloudy', 'rain', 'snow']`). A new top-level `web/js/weather/` directory, imported by both
`web/js/sky/sky-controller.js` and `web/js/info-panel/weather-forecast-client.js`.

**Rationale**: Neither `sky/` nor `info-panel/` owns this logic — it's the one piece FR-002
requires both to share, so it doesn't belong nested under either existing feature directory
(nesting it under one would misleadingly imply the other imports "into" it). A new
`web/js/weather/` sibling directory, mirroring the existing `web/js/sky/` and
`web/js/info-panel/` one-concern-per-directory convention, keeps that shared ownership explicit.
Pure logic, no DOM, unit-tested directly (`weather-category.test.js`) per this project's
established split between pure-logic modules (unit-tested) and DOM-glue controllers
(Playwright-only).

**Alternatives considered**:

- **Add to existing `sky/cloud-density.js`** — that module is scoped to cloud-cover-percent →
  three-tier _render config_ (opacity/animation), a different concern (rendering, not
  classification) that `info-panel/` has no reason to import. Rejected.
- **Add to `info-panel/weather-forecast-client.js`** — same problem in reverse; `sky/` importing
  from `info-panel/` would invert the existing "info-panel is the newer, more specific module"
  layering. Rejected.

## 3. WMO weather-code → five-category mapping

**Decision**: Extends the existing `weatherCodeToLabelKey` buckets in
`info-panel/weather-forecast-client.js` (which already grouped WMO codes sensibly) into exactly
five categories, dropping the old separate "fog"/"storm"/"unknown" buckets per FR-004's explicit
fallback mapping:

| WMO `weather_code`(s)                                          | Category | Note                                                                                                                   |
| -------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| 0, 1                                                           | `sunny`  | Clear sky, mainly clear                                                                                                |
| 2                                                              | `mixed`  | Partly cloudy                                                                                                          |
| 3, 45, 48                                                      | `cloudy` | Overcast; fog/depositing rime fog → closest visual match (FR-004, spec Assumptions)                                    |
| 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99 | `rain`   | Drizzle/rain/freezing-rain/rain-showers; thunderstorm → closest precipitation-bearing match (FR-004, spec Assumptions) |
| 71, 73, 75, 77, 85, 86                                         | `snow`   | Snow fall/grains/showers                                                                                               |
| any other/unrecognized code                                    | `cloudy` | Safe neutral fallback (never "unknown" — FR-004 requires always resolving to one of five)                              |

**Rationale**: Reuses the boundaries the codebase already chose in
`weatherCodeToLabelKey` (same WMO code table, https://open-meteo.com/en/docs) rather than
inventing new ones, just re-partitioned from seven buckets (clear/cloudy/fog/rain/snow/
storm/unknown) into exactly five per FR-001, with fog/thunderstorm folded in per spec's own
documented default mapping and any wholly unrecognized code (API adds a new WMO code in the
future) falling back to `cloudy` rather than a sixth "unknown" state, satisfying FR-004's "never
unclassified" requirement.

**Alternatives considered**:

- **Fall back unrecognized codes to `sunny`** — `sunny` is the most visually committal state
  (bright, no clouds); `cloudy` is the closer neutral default when a truly unknown condition is
  reported, consistent with how fog (itself an "unusual" condition) already resolves to `cloudy`.
  Rejected.

## 4. `sky-controller.js`'s cloud-density render config

**Decision**: Rename `sky/cloud-density.js`'s tier concept from `CLOUD_TIER_RENDER_CONFIG`
(`clear`/`partly`/`overcast`) to `WEATHER_CATEGORY_RENDER_CONFIG` keyed by all five categories.
The three existing entries carry over unchanged (`sunny` ← today's `clear`, `mixed` ← today's
`partly`, `cloudy` ← today's `overcast`); `rain` and `snow` reuse `cloudy`'s cloud
opacity/density (both are visually overcast conditions) and each additionally flags a new
particle layer (`hasRainLayer` / `hasSnowLayer`) that `sky-controller.js` toggles via
`data-weather="rain"` / `data-weather="snow"` on `.sky-clouds`, driving new CSS-only rain-streak /
snow-flake layers (a handful of absolutely-positioned pseudo-elements or small generated
elements, matching the existing `.cloud`'s pure-CSS-animation approach — no new JS animation
loop, no canvas). The existing `data-cloud-density` attribute is renamed to `data-weather` (same
five-vs-three value set) since it now drives strictly more than cloud density; `cloud-density.js`
itself is renamed `weather-render-config.js` to match.

**Rationale**: FR-003 requires reusing/extending the existing two-and-a-half treatments rather
than a redesign; keeping `rain`/`snow` visually "dense-cloud + an added layer" (per design.md's
approved mockup: "darker grey-blue gradient, dense clouds, new diagonal rain-streak layer" /
"pale grey gradient, dense clouds, new falling-snowflake layer") is the smallest change that adds
two genuinely new animated treatments without inventing a new rendering technique. Renaming the
attribute avoids a misleading name (`data-cloud-density='rain'` reads oddly) for a handful of
mechanical renames.

**Alternatives considered**:

- **Keep `data-cloud-density`, add a second orthogonal `data-precipitation` attribute** — two
  attributes for what is, per this feature, one classification (Key Entities: "Weather Background
  Category... exactly five values") adds indirection (two things to keep in sync) for no benefit,
  since precipitation and cloud density aren't actually independent in the five-category model
  (rain/snow always imply dense cloud). Rejected.

**Post-review refinement (operator follow-up after initial implementation)**: The first
implementation pass shipped `rain`/`snow` reusing `cloudy`'s carried-over `overcast` values
exactly (opacity 0.95, six of six clouds visible) and left the sun/moon merely dimmed
(`blur(3px) brightness(0.75)`) under all three dense categories. Manual review judged this too
subtle — `mixed` barely read as cloudier than `sunny`, and a dimmed-not-hidden sun looked wrong
for genuinely overcast/rainy/snowy sky. Follow-up changes (data-model.md's "Sky Weather Reading"
render-config table and "Sky Body Visibility"/"Full-coverage overcast backdrop" sections have the
current numbers):

- Grew the `.cloud` pool from six to sixteen elements (`index.html`) so `cloudy`/`rain`/`snow`
  can show a genuinely dense sky (`visibleCount: 16`) and `mixed` a noticeably denser one
  (`visibleCount: 10`, up from a direct `partly` carry-over of 4) without cloud instances
  overlapping identically.
- `cloudy`/`rain`/`snow` now hide the sun/moon entirely (`opacity: 0 !important`) instead of
  dimming it — real overcast/rain/snow skies block it out completely — and `.sky-sun`/
  `.sky-moon` were reordered before the `.cloud` elements in `index.html` so clouds always visibly
  drift in front of the sun/moon (for `sunny`/`mixed`, where it's still shown), not behind it.
- Added two new sibling layers (`.sky-overcast`, a full-viewport flat color fill; `.sky-ceiling`,
  a dense slow-drifting band below the nav bar) plus a `body[data-weather]` background-gradient
  swap, so `cloudy`/`rain`/`snow` read as a "completely clouded heaven" rather than gaps of blue
  sky showing between individual drifting `.cloud` puffs.
- `rain`/`snow` additionally tint every cloud shape gray (`rain`: one flat gray; `snow`: two
  alternating grays) instead of leaving them white, requiring `.sky-clouds`'s `contrast()` filter
  to drop from 30 to 3 for those two categories specifically (see app.css's tint-rule comment for
  why extreme contrast pushes a non-neutral color toward a hue instead of staying gray).

This refinement changed _values_, not the render-config's _shape_ — `hasRainLayer`/`hasSnowLayer`
and the rain-streak/snow-flake particle layers from the original decision above are unaffected.

## 5. Background-weather config setting

**Decision**: New `web/js/config.js` export `BACKGROUND_WEATHER = 'auto'` (default), following
the file's existing manual-override documentation pattern (`SITE_TITLE`, `SKY_LOCATION_OVERRIDE`).
Accepted values: `'auto'`, `'off'`, or one of the five category names. `sky-controller.js` reads
it once at `initSkyController()` startup (config is a static build-time constant per FR-010 — "no
other code change" — not a runtime-reactive value) and validates it against
`['auto', 'off', ...WEATHER_CATEGORIES]`; anything else (including a stray typo) is treated as
`'auto'` (FR-008), logged nowhere (matching the file's existing silent-fallback precedent for
`SKY_LOCATION_OVERRIDE` resolution failures).

**Rationale**: Matches spec Assumptions ("lives alongside the project's existing manual-override
style settings... no in-app UI required") and FR-010 ("next load, no other code change") exactly.
Validating once at startup (not per-poll) is sufficient since the value cannot change without a
reload/deploy anyway.

**Alternatives considered**:

- **`localStorage`-backed, user-toggleable setting** (like `web/js/settings.js`'s existing
  preference pattern) — rejected: spec explicitly frames this as an _operator_ config, not a
  visitor preference (User Story 2/3 both say "as the site operator... without touching any
  code" / "config file", not "as a visitor").

## 6. `'off'` mode fully disables the sky animation

**Decision (revised)**: `'off'` is a hard escape hatch, not just a way to skip weather
classification. `initSkyController()` checks `effectiveMode === 'off'` immediately after
resolving it — before location resolution, before any weather fetch — and if so sets
`skyClouds.hidden = true` and returns. That hides `.sky-clouds` and every descendant (the
`.cloud` elements, `.sky-sun`, `.sky-moon`, the rain/snow particle layers) in one shot;
`.sky-overcast`/`.sky-ceiling` already default to `display: none` until a `data-weather` value
they key off is set, which `'off'` never sets; and since no timers are ever started, no flying
object ever spawns into `.sky-flying-objects` either. No geocoding lookup or weather poll
happens in this mode.

**Rationale**: The original decision below (reusing the "no `data-weather` attribute" fallback
appearance) conflated two different situations that should read differently to visitors: a
_failed_ weather lookup (FR-005/FR-009, "keep the last known-good look") and a _deliberate_
operator choice to turn the feature off (FR-007). The operator's own framing — "an escape hatch
... to reduce visual noise" — implies turning the visuals off, not merely freezing them at the
pre-feature default. Hiding the container outright is also simpler than the previous approach:
one `hidden = true` assignment instead of routing every downstream call through an `effectiveMode
=== 'off'` check.

**Superseded originally-recorded decision** (kept for history): `'off'` renders the _pre-feature_
static appearance: `.sky-clouds` gets no `data-weather` attribute at all (the same no-attribute
state already defined as the fallback-on-failure appearance). Sun/moon positioning (`tick()`) and
flying-object spawning would continue polling/rendering exactly as today — only the
`poll()`-driven `data-weather`/category assignment was skipped in `'off'` mode. This is no longer
correct; see the revised decision above.
