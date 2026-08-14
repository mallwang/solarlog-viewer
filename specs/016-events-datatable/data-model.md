# Data Model: Ereignisse (Events) Datatable

## RawEventLine (transient, parsing-only)

The literal `;`-split shape of one `e[ev++]="..."` line from `events.js`/`events_day.js`, before
any enrichment. Never exposed outside `web/js/data/events.js`.

| Field         | Type               | Source field index | Notes                                                                                |
| ------------- | ------------------ | ------------------ | ------------------------------------------------------------------------------------ |
| `startRaw`    | `string`           | 0                  | `"DD.MM.YY HH:mm:ss"`, always present.                                               |
| `endRaw`      | `string`           | 1                  | Same format, or `""` — empty means the event is still ongoing.                       |
| `inverterIdx` | `number` (0-based) | 2                  | Matches `WR` field in the legacy parser; index into `StatusCodes[]`/`FehlerCodes[]`. |
| `statusCode`  | `number`           | 3                  | Index into that inverter's status label list, or ≥ its length → "Offline".           |
| `errorCode`   | `number`           | 4                  | `0` = no error; index into that inverter's error label list otherwise.               |

A line is **malformed** (skipped, FR-009) if the `;`-split doesn't yield exactly 5 fields, or if
`inverterIdx`/`statusCode`/`errorCode` don't parse as integers.

## Event (the enriched, UI-facing entity)

Produced by `enrichEvent(rawLine, { statusCodes, errorCodes })` — pure, one raw line in, one
`Event` out.

| Field          | Type             | Derivation                                                                                                                                            |
| -------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`        | `Date`           | `parseEventTimestamp(startRaw)` (research.md R4) — never `null`.                                                                                      |
| `end`          | `Date \| null`   | `parseEventTimestamp(endRaw)` — `null` means ongoing.                                                                                                 |
| `isOngoing`    | `boolean`        | `end === null`.                                                                                                                                       |
| `durationMs`   | `number \| null` | `end - start` when `end` is set, else `null` (spec: no duration for an ongoing event — the "Dauer" column shows the ongoing badge's context instead). |
| `inverterIdx`  | `number`         | Pass-through from RawEventLine (0-based).                                                                                                             |
| `statusCode`   | `number`         | Pass-through.                                                                                                                                         |
| `statusLabel`  | `string`         | `resolveStatusLabel(...)` (research.md R3) — never empty; `"Offline"` fallback.                                                                       |
| `errorCode`    | `number`         | Pass-through.                                                                                                                                         |
| `errorLabel`   | `string \| null` | `resolveErrorLabel(...)` — `null` = render as dash (no error); non-null = render as the error pill.                                                   |
| `errorRawCode` | `number \| null` | Set only when `errorCode` has no label at all (R3's final fallback) — UI renders `"Code {errorRawCode} (unbekannt)"`.                                 |
| `dedupeKey`    | `string`         | The original raw line's 5 `;`-joined fields, used only during merge (R5) — not rendered.                                                              |

**Validation rules**: every `Event` in the rendered list has a valid `start`; `inverterIdx` is
always a non-negative integer (events with an out-of-range `inverterIdx` — Edge Case: stale
inverter — still produce an `Event`, just with `statusLabel`/`errorLabel` resolved via the same
"Offline"/unknown-code fallback path, and the UI labels the inverter generically, e.g.
"Inverter 3", when `inverterIdx >= plant.inverters.length`).

## EventCodes (extension to PlantMetadata, from `web/data/base_vars.js`)

Added to the object `parseBaseVars()` returns (`web/js/data/plant.js`) — see research.md R2.

| Field         | Type         | Shape                                                                                                                                                                                     |
| ------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `statusCodes` | `string[][]` | Outer index = inverter (0-based); inner = that inverter's comma-split status label list, in device-defined order.                                                                         |
| `errorCodes`  | `string[][]` | Same shape, error labels; index `0` is always `"-------"` (no-error marker) in observed data, but callers use the `code === 0` check (R3), not this literal string, to detect "no error." |

## FilterState (events-view.js, in-memory UI state)

| Field      | Type              | Meaning                                                                                               |
| ---------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| `inverter` | `number \| 'all'` | Selected inverter index (0-based) or `'all'`.                                                         |
| `day`      | `string \| 'all'` | Selected day as `"DD.MM.YY"` (matches the source format directly, no reformatting needed) or `'all'`. |
| `status`   | `string \| 'all'` | Selected `statusLabel` value or `'all'`.                                                              |
| `error`    | `string \| 'all'` | Selected `errorLabel` value or `'all'`.                                                               |

An event matches the active `FilterState` when every non-`'all'` dimension matches exactly
(inverter: `event.inverterIdx === filter.inverter`; day: event's `start` or `end` date equals
`filter.day`; status/error: label equality) — see contracts/events.md for the exact function
signature.

## SortState (events-view.js, in-memory UI state)

| Field       | Type                                  | Meaning                                                                    |
| ----------- | ------------------------------------- | -------------------------------------------------------------------------- |
| `column`    | `'start' \| 'inverter' \| 'duration'` | Which column is currently sorted.                                          |
| `direction` | `'asc' \| 'desc'`                     | Sort direction; default `{ column: 'start', direction: 'desc' }` (FR-004). |

## State transitions

There is no persisted/multi-session state for this feature (no `localStorage`, per plan.md's
Storage section) — `FilterState`/`SortState` reset to their defaults every time the Ereignisse
page is (re)navigated to. Within a single page visit:

- Selecting a filter dropdown value updates the matching `FilterState` field and re-renders the
  filtered+sorted table; the other dropdowns' _available options_ narrow to what's still present
  in the currently-filtered set (Acceptance Scenario, User Story 2 #1), but their _own selected
  value_ is untouched unless it's no longer a valid option (in which case it resets to `'all'`).
- Clicking a sortable column header: same column clicked again → toggles `direction`; different
  column clicked → `column` changes, `direction` resets to a sensible default (`'desc'` for
  `start`/`duration` — most-recent/longest first; `'asc'` for `inverter` — WR1 before WR2).
- Clicking "Filter zurücksetzen" resets `FilterState` to all-`'all'`, leaving `SortState`
  untouched.
