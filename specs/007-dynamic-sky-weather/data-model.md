# Data Model: Dynamic Weather-Driven Sky Background

All entities here are in-memory JS values (plain objects/strings/numbers) produced and
consumed entirely client-side. Nothing is persisted except the small `localStorage`
geocoding cache noted under Installation Location. No SolarLog `.js` data file is read,
written, or reinterpreted by this feature (Principle I unaffected).

## Installation Location

Resolved coordinates used to look up weather and solar times for one installation.

| Field | Type | Notes |
|---|---|---|
| `lat` | number | Decimal degrees. |
| `lon` | number | Decimal degrees. |
| `source` | `'override' \| 'geocoded' \| 'cache'` | Where the coordinates came from; informational only, drives no branching. |

**Derivation** (`web/js/sky/location.js`, `resolveInstallationLocation(plant, override)`):

1. If `override` (from `SKY_LOCATION_OVERRIDE` in `config.js`) is non-null → `source:
   'override'`.
2. Else look up `plant.location` (the parsed `HPStandort` string) in the `localStorage`
   geocode cache (key: `sky-geocode:<address>`) → `source: 'cache'` on hit.
3. Else call the Open-Meteo geocoding API with `plant.location`, cache the first result,
   return it → `source: 'geocoded'`.
4. If all three fail (no override, cache miss, geocoding request fails or returns zero
   results) → resolution yields `null`. Callers treat `null` as "location unavailable" and
   fall back to the default static backdrop (FR-005, FR-015) — no sun/moon/weather-driven
   state is ever computed.

**Validation rules**: `lat` ∈ [-90, 90], `lon` ∈ [-180, 180]; a cached or override value
outside that range is treated as invalid (falls back to `null`) rather than fed to the
weather API.

## Weather Condition

The latest successfully retrieved sky state for a location.

| Field | Type | Notes |
|---|---|---|
| `cloudCoverPercent` | number (0–100) | Raw value from Open-Meteo `current.cloud_cover`. |
| `tier` | `'clear' \| 'partly' \| 'overcast'` | Derived via `cloudCoverToTier()`: `<20 → clear`, `20–70 → partly`, `>70 → overcast` (FR-003). |
| `fetchedAt` | `Date` | When this reading was retrieved; used only for staleness logging, not for expiry logic (expiry is handled by the 15-min poll interval itself). |

**State transitions**: Held in a single module-level "last known good" variable inside
`sky-controller.js`. A successful poll replaces it. A failed poll (network error, non-2xx,
malformed body) leaves it untouched — per FR-005/Edge Cases, "the last successfully
retrieved condition continues to be shown." If no successful poll has ever occurred, the
value stays `null` and the backdrop renders in its default fallback appearance.

## Solar Time State

Derived, not fetched — computed on every 60-second tick from cached `sunrise`/`sunset`/
`nextSunrise` timestamps (part of the same Open-Meteo response as Weather Condition, so
they share the same fetch/fallback lifecycle above).

| Field | Type | Notes |
|---|---|---|
| `body` | `'sun' \| 'moon'` | Which body is currently primary. |
| `xPercent` | number (0–100) | Horizontal position across the sky, left→right. |
| `yPercent` | number (0–100) | Vertical position, 0 = top of sky band, 100 = horizon. |
| `crossfade` | number (0–1) | Opacity blend factor for the other body during the
  sunrise/sunset transition window (FR-008); `0` = fully `body`, values >0 mean the other
  body is fading in/out alongside it. |

Computed by `web/js/sky/solar-arc.js` per the parabolic-arc formula in
[research.md §2](./research.md#2-deriving-sunmoon-arc-position). Pure function of
`(now, sunrise, sunset, nextSunrise)` — no hidden state, directly unit-testable.

## Sky Flying Object

A transient, self-removing animated DOM element. Not modeled as persistent state — each
instance is a short-lived value passed from the scheduler to the DOM-glue layer.

| Field | Type | Notes |
|---|---|---|
| `kind` | `'bird' \| 'plane' \| 'balloon' \| 'rocket'` | Determines sprite/animation/CSS class. |
| `spawnedAt` | `Date` | For debugging/tests only. |
| `laneYPercent` | number | Vertical lane it flies along, kept within the upper sky band so it never overlaps main content (FR-012). |

**Scheduling state** (internal to `web/js/sky/flying-objects.js`, not exposed): per-kind
next-spawn timers, each reset to a new random delay (per the bands in
[research.md §5](./research.md#5-flying-objects-birdsplanesballoonsrockets)) after firing.
Rocket spawns are additionally gated on `Solar Time State.body === 'moon'` at roll time
(FR-011).

## Relationships

```text
Installation Location  ──feeds──▶  Weather Condition   ──drives──▶  cloud density (tier)
                        ──feeds──▶  Solar Time State     ──drives──▶  sun/moon element + rocket gating
Solar Time State (body) ──gates──▶  Sky Flying Object (rocket kind only)
prefers-reduced-motion  ──suppresses──▶  Sky Flying Object scheduling + CSS drift animations
```

No entity here is written back to `base_vars.js` or any other SolarLog data file, and none
persists beyond `localStorage`'s single geocode-cache entry per installation address.
