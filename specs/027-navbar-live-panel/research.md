# Phase 0 Research: Live Navbar Watt Reading

No items in the spec's Technical Context were left as `NEEDS CLARIFICATION` — the spec itself
(via `/speckit-clarify`-style detail already present in FRs/Edge Cases) and the existing
`info-panel/weather-forecast-client.js` module answer every open design question. This file
records the decisions and the alternatives rejected.

## 1. Fetch mechanism: direct absolute-URL `fetch()`, mirroring `weather-forecast-client.js`

- **Decision**: A new `web/js/info-panel/live-reading-client.js` module fetches
  `https://wolfsbach.synology.me/live/index.php` directly with the browser's native `fetch()`,
  accepting an injectable `fetchImpl` for tests — exactly the shape `fetchWeatherAndForecast()`
  already uses for `api.open-meteo.com`.
- **Rationale**: The endpoint is already a full external HTTPS URL, not a page-relative `/data`
  or `/hist` path. `bs-config.cjs`'s dev-only proxy only rewrites `/data`/`/hist` (so the app can
  be served from `web/` locally without those directories existing on disk); an absolute URL
  bypasses the dev server's proxy entirely in both dev and prod, so no proxy change is needed.
  The spec's Assumptions section states the endpoint is reachable under the same conditions as
  the existing data files and needs no new auth, so a plain cross-origin `fetch()` is expected to
  just work (CORS permitting, same assumption already made for Open-Meteo).
- **Alternatives considered**: Routing it through `bs-config.cjs`'s proxy (rejected — that proxy
  exists only to let the dev server answer page-relative `/data`/`/hist` requests without the
  real files on disk; an absolute-URL endpoint has no such need and adding it would only diverge
  dev from prod behavior for no benefit).

## 2. Decoupled interval: new `LIVE_REFRESH_INTERVAL_MS` config constant, separate timer

- **Decision**: Add `LIVE_REFRESH_INTERVAL_MS` to `config.js`, defaulting to `60 * 1000` (FR-003).
  `initInfoPanelController()` starts a third `setInterval` (alongside the existing data/weather
  ones) that polls only the live reading, independent of `DATA_REFRESH_INTERVAL_MS`'s
  yield/diagram timer.
- **Rationale**: FR-002/SC-002 require the two cycles to never trigger or block each other. Three
  independent `setInterval` timers (data/yield, weather, live) already matches this controller's
  existing pattern of one timer per concern (see its file-level doc comment); adding a fourth
  concern is a natural extension, not a new pattern.
- **Alternatives considered**: Reusing `DATA_REFRESH_INTERVAL_MS` for the live poll too (rejected
  — directly contradicts FR-002/FR-003's explicit "distinct, dedicated" requirement and the
  10×-slower cadence the user asked for is the whole point of the feature).

## 3. Last-known-good state lives in a closure variable, not in the fetch result itself

- **Decision**: `initInfoPanelController()` keeps a `lastGoodProduction` variable (initially
  `{ available: false }`) that is only ever _replaced_ on a successful fetch; every poll tick
  renders whatever `lastGoodProduction` currently holds, regardless of whether that tick's own
  fetch succeeded or failed.
- **Rationale**: This is the key fix needed for FR-005/FR-006. Today's `fetchCurrentProduction()`
  returns `{ available: false }` straight from a failed fetch, and the caller renders that result
  directly — so a single transient failure would blank out a previously-good reading immediately,
  which is exactly what FR-005 forbids. Keeping the last good reading in the controller's closure
  (rather than in the client module, which stays a pure stateless fetch-and-validate function)
  means a failed tick simply re-renders the same state as before, and the "no data yet" state
  (FR-006) naturally falls out of the initial `{ available: false }` value never having been
  replaced — no new i18n string or CSS state needed beyond what `renderProduction()`/
  `productionValueText()` already render for `available: false` today.
- **Alternatives considered**: Having `live-reading-client.js` itself cache the last good value
  (rejected — would make the client stateful/impure, harder to unit-test in isolation, and
  duplicate state the controller already needs to own for rendering purposes).

## 4. Race safety: monotonic request-sequence guard, not an in-flight lock

- **Decision**: A `let requestSeq = 0` counter increments on every poll tick; each tick captures
  its own `seq = ++requestSeq` before awaiting the fetch, and only applies its result (updates
  `lastGoodProduction` and re-renders) if `seq === requestSeq` when it resolves — i.e., it was the
  most recently _started_ request.
- **Rationale**: Satisfies FR-008 ("only the most recently completed valid response is reflected")
  without blocking a new poll from starting while an old one is still pending. This matters
  because FR-009 (repoll promptly on tab refocus) needs to be able to fire an extra poll even if
  the regular interval's poll is still in flight — a simple "skip if already in-flight" lock would
  make that repoll a no-op in exactly the slow-response case where it's most useful.
- **Alternatives considered**: A boolean in-flight lock that skips starting a new request while
  one is pending (rejected — would silently drop the visibility-regain repoll in the one scenario
  — a slow/hanging prior request — where FR-009's "refresh promptly on refocus" matters most).

## 5. Visibility-regain repoll: `document.visibilitychange`, live reading only

- **Decision**: `initInfoPanelController()` adds a `document.visibilitychange` listener that
  calls the live-reading poll function immediately when `document.visibilityState === 'visible'`
  (and is removed by the controller's returned cleanup function). Yield/weather are not repolled
  on refocus.
- **Rationale**: FR-009 is scoped to the live reading ("the panel"/"the live reading") — it's the
  one figure explicitly sold on being near-real-time; the diagrams/yield/weather panels already
  have their own multi-minute cadences and aren't described as needing an immediate refresh on
  refocus. Reusing the same request-sequence guard (#4) means a refocus-triggered poll racing a
  scheduled one already resolves safely without extra logic.
- **Alternatives considered**: Repolling everything on refocus (rejected — out of scope per the
  spec's User Story framing, and would reintroduce coupling between the live and 10-minute cycles
  that FR-002 explicitly forbids).

## 6. Per-inverter efficiency suffix is dropped for the live-sourced reading

- **Decision**: The live-sourced production object no longer carries a `perInverter` field (the
  shape `productionValueText()` uses to compute the optional "· NN%" efficiency suffix via
  `efficiencyPercent()`). `efficiencyPercent(undefined)` already returns `null` safely (its
  existing null-guard sums `Object.values(undefined ?? {})`), so `productionValueText()` falls
  back to its plain `"${totalPacW} W"` branch with no code change needed there.
- **Rationale**: The spec's Key Entities section scopes "Live Reading" to exactly
  wattage + timestamp + health flag, and Edge Cases explicitly puts `sources.solarlog.inverters[]`
  detail out of scope for the navbar panel ("per-inverter detail is not required to be exposed in
  this feature"). The efficiency percentage is derived from that per-inverter breakdown
  (`pacW`/`pdcW` per inverter), so computing it from the live endpoint's `ac_w`/`dc_w[]` fields
  would be reaching back into the scoped-out detail for a figure the spec never asks this feature
  to preserve. FR-010 only requires preserving the wattage's _number formatting_ convention, which
  is unaffected.
- **Alternatives considered**: Mapping `inverters[].ac_w`/`dc_w[]` into the same
  `{ pacW, pdcW }` shape `efficiencyPercent()` expects, to keep showing the efficiency suffix
  (rejected — adds a field-mapping layer for a figure the spec doesn't list as in scope, and risks
  a subtly wrong percentage if the live endpoint's per-inverter semantics ever diverge from
  `min_cur.js`'s; can be revisited as a follow-up feature if wanted).

## 7. Success/failure classification (FR-004)

- **Decision**: `live-reading-client.js` treats a response as successful only when: the `fetch()`
  itself doesn't throw, `response.ok` is true, the body parses as JSON, the top-level `watt` field
  is `Number.isFinite`, and `sources.solarlog.ok === true`. Any other outcome (network error,
  non-2xx, unparseable JSON, missing/non-numeric `watt`, `ok: false`) returns
  `{ available: false }`, mirroring `fetchWeatherAndForecast()`'s never-throws contract.
- **Rationale**: Directly matches FR-004's wording; keeping the whole check inside a single
  `try/catch` (network + JSON-parse errors) plus explicit field checks (missing/invalid data)
  mirrors the existing `weather-forecast-client.js` pattern exactly, so the two client modules
  stay easy to read side by side.
