# Data Model: Global Desktop Info Panel

No SolarLog `.js` data file format changes and no new persisted storage (Principle I). The
entities below are in-memory shapes passed between the new modules; none are persisted.

## Current Production Reading

Sourced via the existing `web/js/data/min-file.js#parseMinFile` against `data/min_cur.js`
(same path `dashboard.js` already uses — see [research.md §nothing new](./research.md), no
new parser needed).

| Field | Type | Notes |
|---|---|---|
| `totalPacW` | `number` | Sum of `reading.perInverter[*].pacW` across all inverters — the plant's current total output. `0` is a valid, real "idle" reading (nighttime), never treated as missing. |
| `timestamp` | `string` (ISO) | From the parsed reading; used only to detect "no reading returned" (`null`/absent), not displayed verbatim in the panel. |
| `available` | `boolean` | `false` when `fetchText('data/min_cur.js')` fails or `parseMinFile` yields no reading — drives FR-008's independent "unavailable" state for the production side of the panel. |

**Derivation → Production Animation Intensity**: `productionIntensity(totalPacW,
plant.capacityKwp)` (research.md §4) maps this reading to a tier consumed by CSS. Not a
separate stored entity — computed fresh on every poll/render.

## Current Weather Condition

Sourced from a new Open-Meteo request (research.md §1), parsed by
`web/js/info-panel/weather-forecast-client.js`.

| Field | Type | Notes |
|---|---|---|
| `weatherCode` | `number` | Open-Meteo WMO weather code (`current.weather_code`); mapped to a short i18n label (e.g. "clear", "cloudy", "rain") for display — mapping table lives alongside the client module, not a separate entity. |
| `temperatureC` | `number` | `current.temperature_2m`. |
| `available` | `boolean` | `false` on network failure, non-2xx, or malformed response — mirrors the existing `fetchWeather()`/`geocodeAddress()` "never throw, return `null` on any failure" convention from the sky feature. Drives FR-008's independent "unavailable" state for the weather side of the panel, separate from the production side's own `available` flag. |

## Today's Forecast Summary

Sourced from the same Open-Meteo request as Current Weather Condition (one HTTP call covers
both — research.md §1).

| Field | Type | Notes |
|---|---|---|
| `todayWeatherCode` | `number` | `daily.weather_code[0]`; same label mapping as Current Weather Condition's `weatherCode`. |
| `todayMaxC` | `number` | `daily.temperature_2m_max[0]`. |
| `todayMinC` | `number` | `daily.temperature_2m_min[0]`. |

Bundled into the same return object as Current Weather Condition (one fetch, one parsed
result, one `available` flag) rather than a separate fetch — there is no independent failure
mode between "current condition" and "today's forecast" since both come from the same
response.

## Installation Location

Reused as-is from feature 007 (`web/js/sky/location.js#resolveInstallationLocation` — see
[data-model.md in 007](../007-dynamic-sky-weather/data-model.md#installation-location) for
its full derivation/validation rules). No new fields. Two derived uses in this feature:

| Use | Input | Output |
|---|---|---|
| Weather/forecast lookup | Resolved `{ lat, lon }` | Passed to the new Open-Meteo request (research.md §1) |
| wetteronline.com link | Raw `plant.location` (`HPStandort` string, not the resolved coordinates) | Passed to `wetteronline-link.js`'s URL builder (research.md §3) |

## Info Panel View State

The DOM-glue shape `info-panel-controller.js` renders from each poll tick — not a persisted
entity, just the combination of the three sources above plus their independent availability:

| Field | Type | Notes |
|---|---|---|
| `production` | `{ totalPacW: number, available: boolean } \| null` | `null` before the first fetch resolves. |
| `weather` | `{ weatherCode, temperatureC, todayWeatherCode, todayMaxC, todayMinC, available: boolean } \| null` | `null` before the first fetch resolves, or when location resolution itself fails (FR-012's "no location" edge case — treated as `available: false`, matching FR-008). |
| `wetteronlineUrl` | `string \| null` | `null` only when `plant.location` itself is empty/missing (no address to search on at all); otherwise always a valid search URL per research.md §3, even when the underlying place can't be matched by wetteronline.com. |

State transitions: `null` (pre-first-fetch) → populated (`available: true`) → re-populated on
each poll tick, independently for `production` and `weather` — one source's failure never
resets or blocks the other's display (FR-008).
