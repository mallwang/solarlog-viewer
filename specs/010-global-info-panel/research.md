# Research: Global Desktop Info Panel

## 1. Weather condition + today's forecast data source

**Decision**: Extend the same Open-Meteo Forecast API already used by feature
007-dynamic-sky-weather (`web/js/sky/weather-client.js`), with a new request shape:

```text
GET https://api.open-meteo.com/v1/forecast
    ?latitude={lat}&longitude={lon}
    &current=weather_code,temperature_2m
    &daily=weather_code,temperature_2m_max,temperature_2m_min
    &forecast_days=1&timezone=auto
```

Implemented as a new function in `web/js/info-panel/weather-forecast-client.js` rather than
modifying `web/js/sky/weather-client.js` — the sky feature only needs cloud-cover-percent and
sunrise/sunset and its module is scoped and tested around that; this feature needs a discrete
weather _code_ (for a human label like "clear"/"rain") and today's min/max temperature, a
different response shape. Duplicating the small `fetch` + parse (~15 lines) keeps both
modules single-purpose and independently testable, consistent with how `cloud-density.js`
and `solar-arc.js` are already split by concern in the sky feature rather than merged into
one "weather module."

**Rationale**: Open-Meteo is free, keyless, already approved for third-party client-side use
in this codebase (007's Constitution Check precedent), and returns both current condition and
today's forecast in one request — no new dependency class introduced.

**Alternatives considered**:

- _Reuse/extend `fetchWeather()` in `sky/weather-client.js` directly_ — rejected: would widen
  that module's single responsibility (cloud density + solar arc) and couple two features'
  test suites together for no shared benefit; the two `fetch` calls are cheap and independent.
- _A dedicated weather-code icon library_ — rejected: out of scope; the panel needs a short
  text label (e.g. via `weather_code` → i18n string mapping), not icon artwork.

## 2. Location resolution for weather + wetteronline.com link

**Decision**: Reuse `resolveInstallationLocation()` from `web/js/sky/location.js` unchanged
for the weather/forecast coordinates (override → cache → geocode → `null`). For the
wetteronline.com link, use the plant's raw address string (`plant.location`, i.e.
`HPStandort`) directly — not the geocoded lat/lon.

**Rationale**: `resolveInstallationLocation()` already handles the override/cache/geocode
priority chain and is fully tested; re-deriving coordinate resolution would duplicate logic
the constitution's "single source of truth" spirit argues against. For the outbound link,
wetteronline.com's own site search (see §3) works on free-text place names, not coordinates,
so the raw configured address is the more direct and reliable input — it also means the
wetteronline link keeps working even when geocoding to lat/lon fails (FR-012's location
source is `plant.location`, available whenever `base_vars.js` parses at all).

**Alternatives considered**:

- _Reverse-geocode the resolved lat/lon to a place name for the link_ — rejected: adds a
  second geocoding round-trip for a value (`plant.location`) the app already has as a plain
  string.

## 3. wetteronline.com deep-link construction

**Decision**: Link to wetteronline.com's site search results for the plant's address:

```text
https://www.wetteronline.de/suche?q={encodeURIComponent(plant.location)}
```

opened via `<a target="_blank" rel="noopener">`.

**Rationale**: wetteronline.com forecast pages live at place-specific slugs (e.g.
`/wetter/ensdorf`) that aren't derivable from a free-text `HPStandort` address (which may
include postal codes, hyphenated hamlet names, etc. — e.g. `"92266 Ensdorf-Wolfsbach"`) without
a lookup table this project has no authoritative source for. wetteronline.com's own search
already resolves free-text input to the right place page, so linking to the search endpoint
delegates that resolution to the site the plant owner already trusts, and degrades exactly as
FR-007's edge case requires: an address wetteronline.com can't match still lands the visitor
on a normal wetteronline.com search-results page (their generic page for that query), never a
dead link or the wrong location silently shown.

**Alternatives considered**:

- _Hand-maintained address → wetteronline slug mapping_ — rejected: a new manually-maintained
  data source is exactly what Principle I's spirit (dynamic, config-driven UI) warns against;
  a single-installation site has no way to keep such a mapping current or verify it.
- _wetteronline.com's API_ — rejected: no public/free API is documented; site search is a
  plain, stable, unauthenticated URL pattern.

## 4. Production-animation intensity scaling

**Decision**: A pure function `productionIntensity(currentPacW, capacityKwp)` in
`web/js/info-panel/production-animation.js` maps `currentPacW / (capacityKwp)` (both already
in watts — `AnlagenKWP`/`capacityKwp` is stored as a raw watt value, e.g. `6200`, per
`web/js/data/plant.js`) to one of a small number of discrete intensity tiers (e.g.
`idle` at ~0, `low`/`medium`/`high` bands up to `peak` at ratio ≥ ~0.9), clamped to `[0, 1]`
before tiering so above-nameplate readings (possible under real sun, per SolarLog's own
"Peak"/derating status codes) don't overflow the animation. Each tier maps to a CSS custom
property (e.g. `--intensity: 0|1|2|3`) consumed by `app.css` `@keyframes` for animation
speed/scale, matching the sky feature's `cloud-density.js` → CSS-custom-property pattern.

**Rationale**: Discrete tiers (not continuous interpolation) keep the CSS simple (a handful
of keyframe variants, like `cloud-density.js`'s tiers) while still satisfying FR-009/SC-003's
requirement that low vs. high production be visibly distinguishable. Reusing
`plant.capacityKwp` (already parsed, no new config) satisfies the Assumptions section's
"typical peak output" derivation from existing configured capacity.

**Alternatives considered**:

- _Continuous CSS custom-property scaling (`--ratio: 0.0–1.0`) driving `animation-duration`
  directly_ — considered viable and not excluded by the spec, but discrete tiers were chosen
  for consistency with the existing `cloud-density.js` precedent and to bound the number of
  visually-tested states in the Playwright spec (four fixed states vs. an unbounded range).

## 5. Panel visibility breakpoint

**Decision**: Reuse Tailwind's `md:` breakpoint (768px, `min-width`) — the same breakpoint
already gating `.app-nav__toggle`/`.app-nav__list` between mobile-burger and persistent-bar
layout (`web/css/tailwind.css`). The panel renders with `hidden md:flex` (or equivalent),
contributing zero layout space below 768px.

**Rationale**: This is the only existing mobile/desktop layout gate in the codebase; reusing
it means "desktop clients" in the spec maps to a concrete, already-tested value rather than
inventing a second breakpoint that could disagree with the nav's own mobile/desktop split.

**Alternatives considered**:

- _`lg:` (1024px, used by the dashboard's `lg:grid-cols-3`)_ — rejected: that breakpoint
  governs a content-density decision (how many widget columns fit), not a mobile-vs-desktop
  identity split; using it here would make the panel disappear on tablet-width windows that
  the nav still treats as "desktop."

## 6. Poll cadence

**Decision**: ~10-minute (`10 * 60 * 1000` ms) `setInterval` for both the production fetch
and the weather/forecast fetch, started after an immediate first fetch on mount — mirroring
`dashboard.js`'s `LIVE_REFRESH_MS` pattern but at 10 rather than 5 minutes.

**Rationale**: Per FR-004/spec Assumptions, the SolarLog device only writes new data every 10
minutes (its minimum configurable interval), so a shorter poll would just re-read an unchanged
file. `dashboard.js`'s existing 5-minute widget poll predates this clarification and is out of
scope for this feature to change (touching it would be an unrelated behavior change to an
existing, already-shipped widget); the new info-panel controller uses its own interval
constant rather than importing `dashboard.js`'s.

**Alternatives considered**:

- _Match `dashboard.js`'s existing 5-minute interval for consistency_ — rejected per the
  user's explicit clarification that 10 minutes is the device's real update floor; polling at
  5 minutes only doubles requests without ever finding new data half the time.
