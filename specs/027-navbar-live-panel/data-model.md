# Phase 1 Data Model: Live Navbar Watt Reading

This feature has no persisted data model (no `localStorage` key, no `.js` data file) — everything
below is in-memory shape passed between the new client module and the existing controller.

## Live Reading (parsed client-side output)

The validated, minimal shape `live-reading-client.js` returns to the controller — corresponds to
the spec's "Live Reading" Key Entity.

| Field       | Type      | Notes                                                                                                                                                                            |
| ----------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `available` | `boolean` | `true` only when the full FR-004 validation (research.md §7) passed.                                                                                                             |
| `watt`      | `number`  | Only present when `available: true`. Top-level `watt`, unrounded.                                                                                                                |
| `timestamp` | `string`  | Only present when `available: true`. Endpoint's own `timestamp` field, verbatim (`"YYYY-MM-DDTHH:MM:SS"`) — used for the "as of" display (FR-007), not the browser's fetch time. |

`{ available: false }` is the sole failure shape — no `status`/error detail is surfaced to the UI,
since the panel's fallback behavior (FR-005/FR-006) doesn't distinguish _why_ a reading failed,
only _that_ it did. (An error is still safe to log to the console for diagnosis if useful, but is
not part of this contract.)

Deliberately **excluded** from this shape (see research.md §6): `sources`, `sources.solarlog.*`,
and `inverters[]` — the endpoint's per-inverter/per-source detail. `sources.solarlog.ok` is
consumed only internally by the validation step, never passed through.

## Panel Display State (owned by `info-panel-controller.js`)

Not a new type — an extension of the existing `production` shape already passed into
`renderProduction()`/`productionValueText()`/`productionTimestampText()`. The controller derives
it each poll tick from the closure-held last-known-good state (research.md §3):

| State                                          | `available` | `totalPacW`      | `timestamp`           | Rendered as (existing logic, unchanged)                                                                                                                    |
| ---------------------------------------------- | ----------- | ---------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Never fetched successfully                     | `false`     | —                | —                     | `t('infoPanel.unavailable')`, pulse `idle` — FR-006                                                                                                        |
| Has a last-known-good reading (fresh or stale) | `true`      | last good `watt` | last good `timestamp` | `"${totalPacW} W"` (or `t('widget.notProducing')` when `totalPacW === 0`, FR-011), timestamp text `"Stand: HH:MM"` from the _reading's_ timestamp (FR-007) |

Note there is intentionally **no third "stale" visual state** distinct from "fresh" — the spec's
Acceptance Scenarios (User Story 2, Scenario 1) only require that the last good value keep
showing with its own "as of" time intact; a viewer can already tell staleness from that timestamp
lagging behind the current wall-clock time, same as today's existing behavior for `min_cur.js`
gaps.

### State transitions

```text
[never fetched] --successful poll--> [has reading: value=V1, ts=T1]
[has reading: V1, T1] --failed poll--> [has reading: V1, T1]   (unchanged — FR-005)
[has reading: V1, T1] --successful poll (V2, T2)--> [has reading: V2, T2]
```

The only way to _leave_ "never fetched" is a successful poll; once any successful poll has
happened, the panel can never return to the "never fetched" state for the lifetime of the page
session (matches FR-005/FR-006's wording — failures only pause progress, they don't erase it).

## Config additions (`web/js/config.js`)

| Constant                   | Type     | Default                                          | Notes                                              |
| -------------------------- | -------- | ------------------------------------------------ | -------------------------------------------------- |
| `LIVE_ENDPOINT_URL`        | `string` | `'https://wolfsbach.synology.me/live/index.php'` | Fetched by absolute URL — see research.md §1.      |
| `LIVE_REFRESH_INTERVAL_MS` | `number` | `60 * 1000`                                      | FR-003; independent of `DATA_REFRESH_INTERVAL_MS`. |
