# Research: Dynamic Weather-Driven Sky Background

## 1. Weather data source

**Decision**: [Open-Meteo Forecast API](https://open-meteo.com) (`api.open-meteo.com/v1/forecast`), requested with `current=cloud_cover&daily=sunrise,sunset&forecast_days=2&timezone=auto`.

**Rationale**:

- No API key, no account, no billing — matches the project's zero-infrastructure ethos and
  avoids storing a secret in a static-file-only, publicly deployed site.
- A single request returns both `cloud_cover` (0–100%, current conditions) and `sunrise`/
  `sunset` for today **and** tomorrow (`forecast_days=2`), which is exactly the data this
  feature needs: cloud density (User Story 1) and sun/moon timing (User Story 2). One
  network call serves both stories instead of two.
- Generous free-tier rate limits (10,000 requests/day per IP) comfortably cover a
  single-installation dashboard polled every 15 minutes, with headroom for several
  installations.
- `timezone=auto` returns sunrise/sunset as local ISO timestamps for the requested
  coordinates, removing the need for any timezone/DST handling in our own code.

**Alternatives considered**:

- **OpenWeatherMap** — requires an API key (account signup, key management, rate-limit
  tiers tied to a key that would need to live in a public static site or be proxied through
  a backend — the latter contradicts Principle III). Rejected.
- **wttr.in** — no key required, but its primary output is a text/ASCII format; JSON output
  is less consistently documented/stable for cloud-cover specifically. Rejected in favor of
  Open-Meteo's typed, versioned JSON contract.
- **A local backend proxy to hide an API key** — would introduce an application server,
  directly violating Principle III (No Backend Introduction). Rejected.

## 2. Deriving sun/moon arc position

**Decision**: A simplified, non-astronomical arc: given `sunrise`, `sunset`, and the next
day's `sunrise` (all from Open-Meteo's `daily` block) and the current time `now`:

- If `sunrise <= now < sunset`: daytime. `progress = (now - sunrise) / (sunset - sunrise)`
  (0→1). Horizontal position `xPercent = progress * 100`. Vertical position follows a
  parabolic arc peaking at `progress = 0.5` (solar noon proxy): `yPercent = 100 - 100 *
(1 - (2*progress - 1)^2)` (low near both horizon ends, highest at midpoint) — sun.
- Otherwise: nighttime. `progress = (now - sunset) / (nextSunrise - sunset)`, same arc
  shape — moon.
- A short crossfade window (a few minutes either side of `sunrise`/`sunset`) blends sun and
  moon opacity for a smooth swap (FR-008), rather than an instant visibility flip.

**Rationale**: The spec's own Assumptions section explicitly scopes this to "a simplified
visual representation of solar altitude/azimuth ... rather than an astronomically precise
rendering." A parabolic arc between two known timestamps (sunrise/sunset, already supplied
by the weather API) meets every acceptance scenario in User Story 2 (near-horizon at
sunrise/sunset, high at midday, moon at night, smooth transition) with a handful of pure
arithmetic lines, no trigonometry, no new dependency, and no separate astronomy data feed.

**Alternatives considered**:

- **A full solar-position algorithm (e.g. NOAA SPA, or an astronomy library like SunCalc)**
  — would compute true azimuth/altitude and true moon phase/position. Rejected as
  over-engineered relative to the spec's own "simplified" framing, and it would add a new
  runtime dependency (or a large amount of self-maintained trigonometry) purely for a
  decorative element whose accuracy requirement (SC-003) is "matches horizon vs. midday vs.
  night," not precise degrees.

## 3. Resolving an installation's coordinates from `HPStandort`

**Decision**: A two-tier resolution in a new `location.js` module:

1. **Manual override (primary)** — an optional `SKY_LOCATION_OVERRIDE` constant in
   `web/js/config.js` (`{ lat, lon } | null`), set once per installation.
2. **Automatic geocoding (fallback)** — if no override is configured, geocode the raw
   `HPStandort` string (e.g. `"92266 Ensdorf-Wolfsbach"`) via Open-Meteo's free geocoding
   endpoint (`geocoding-api.open-meteo.com/v1/search?name=...`), caching the resolved
   coordinates in `localStorage` keyed by the address string so the network call happens
   at most once per address per browser.

**Rationale**: FR-001 requires location to be _derived from existing configuration data_,
which both tiers satisfy — the override still keys off the same `HPStandort` value
conceptually (a human resolves it once instead of a geocoder resolving it every session).
This matters in practice: `HPStandort` values in this codebase are free-text German postal
addresses including small hamlets (`"Ensdorf-Wolfsbach"`), which general-purpose geocoders
frequently fail to resolve precisely, while resolving the _postal code_ alone is coarse
enough for weather purposes (weather doesn't vary meaningfully across a village). The
override gives an escape hatch without hand-rolling a geocoding pipeline, while the
automatic tier keeps the feature generically correct for other installations (FR-014)
that configure it. `localStorage` caching keeps this to one network call per install per
browser rather than one per page load.

**Alternatives considered**:

- **Always auto-geocode, no override** — simpler, but risks silently mis-locating this
  project's own reference installation (rural hamlet), which would visibly break User
  Story 1's acceptance criteria. Rejected.
- **Hardcode lat/lon directly in `base_vars.js`** — `base_vars.js` is SolarLog-device-owned
  (Principle I: "MUST NOT be changed... unmodified by the modernization effort"); adding a
  new hand-maintained field there would violate that principle. Rejected in favor of a
  viewer-owned config constant.

## 4. Cloud density rendering strategy

**Decision**: Reuse the existing `.sky-clouds` / `.cloud` markup and gooey-blur CSS
technique unchanged. Drive density purely via a `data-cloud-density="clear|partly|overcast"`
attribute set on `.sky-clouds` by JS; CSS rules per tier adjust each `.cloud`'s `opacity`
and `animation-duration` (denser + slower for overcast, sparse + unchanged speed for
clear), and JS toggles a `hidden` state on a subset of the six existing cloud elements for
the `clear` tier so fewer are rendered at all.

**Rationale**: The existing six-cloud layer is well-tuned CSS (blur+contrast fusion,
staggered drift timings) — replacing it would be pure risk for no user-visible gain.
Driving it from a single data attribute keeps the change additive and keeps the _default_
(no-JS, or JS-failed) appearance identical to today's static look, which conveniently
**is** the correct FR-005 fallback appearance for free — no separate fallback markup to
build or maintain.

**Alternatives considered**:

- **Procedurally generate cloud count/position in JS** — more flexible but throws away the
  tuned hand-authored CSS animation and risks jank/layout differences. Rejected as
  unnecessary churn for a three-tier density need.

## 5. Flying objects (birds/planes/balloons/rockets)

**Decision**: A pure scheduling module (`flying-objects.js`) that, given a clock and an RNG
(both injectable for testing), decides _when_ the next object of each rarity tier should
spawn and _which_ kind to pick; a thin DOM-glue layer in `sky-controller.js` creates a
short-lived absolutely-positioned element with a CSS `@keyframes` cross-screen animation
and removes it on `animationend`. Birds: random delay in a tight band (~3–8 min) so they
recur "at a light, regular cadence" (FR-009) independent of weather/time. Planes/balloons:
much wider random delay band (~20–45 min). Rocket: only rolled when the moon is currently
visible, wider still (~45–90 min) and lower selection probability, matching the "easter
egg" framing (FR-011).

**Rationale**: Separating the _decision_ (pure, unit-testable, deterministic given a fixed
RNG seed) from the _DOM effect_ (only verifiable end-to-end) matches this codebase's
existing testing split (small pure `data/` modules with `node:test` unit coverage; DOM
behavior covered by Playwright per the constitution's Testing standard). CSS-driven
cross-screen animation (rather than a JS animation loop) keeps this cheap, GPU-composited,
and trivially skippable under `prefers-reduced-motion`.

**Alternatives considered**:

- **`requestAnimationFrame`-driven JS positioning** — more control over path shape (e.g.
  arcing balloon drift) but heavier and unnecessary for a straight-line cross-screen
  flight; CSS `@keyframes` handles the acceptance criteria (FR-012: never obstructs
  content, since objects fly at fixed sky heights outside the content column) with no JS
  animation loop running continuously. Rejected in favor of the cheaper approach.

## 6. Refresh cadence

**Decision**: Poll Open-Meteo every 15 minutes while the dashboard tab is open (well inside
the SC-004 "no more than 30 minutes" budget, with margin for one missed/failed poll still
landing inside the window). Sun/moon arc position recomputed from already-cached
sunrise/sunset every 60 seconds (no network call — pure arithmetic).

**Rationale**: 15 minutes matches Open-Meteo's own current-weather update cadence (their
current-conditions data itself typically refreshes on a similar interval), so polling
faster would not surface materially fresher data. It also leaves comfortable headroom
under SC-004's 30-minute budget even if a single poll fails and the next one succeeds.

## 7. Reduced motion

**Decision**: A single `matchMedia('(prefers-reduced-motion: reduce)')` check in
`sky-controller.js`, re-evaluated on the media query's `change` event. When reduced:
skip flying-object scheduling entirely, and add a `data-reduce-motion="true"` attribute
that CSS uses to zero out `.cloud`'s drift animation and the sun/moon position transition
duration — the _state_ (cloud tier, sun/moon position, day/night) still updates, just
without animated movement, per FR-013 and the spec's Edge Cases section.

**Rationale**: Matches the standard web platform mechanism already implied by the spec's
own Assumptions ("Reduced-motion support follows standard OS/browser accessibility signals
already used elsewhere on the web"), and requires no new dependency.
