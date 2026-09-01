# Phase 1 Data Model: Live Panel Falls Back to Daily Last Value

No new persisted or on-the-wire entity — this feature reduces data the app already fetches
(`data/min_day.js`, parsed by the existing `parseMinFile`, see `web/js/data/min-file.js`) into one
new derived shape, and combines it with 027-navbar-live-panel's existing "current production"
render state at one new precedence point.

## Daily Fallback Reading (derived, in-memory only)

The last entry of today's `min_day.js` trace (already filtered to today's date — see research.md
§3), reduced to just what the panel needs.

| Field       | Type           | Source                                                                                                                                                                                               |
| ----------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `w`         | `number`       | `Object.values(lastReading.perInverter).reduce(pacW summed)` — same reduction `yield-stats.js`'s `maxDailyPowerW()` already does per-reading, applied to the trace's last reading instead of its max |
| `timestamp` | `string` (ISO) | The last reading's own `timestamp` field (`YYYY-MM-DDTHH:MM:SS`), exactly as `maxDailyPowerW()`/`dailyYieldWh()` already read it — never the fetch/render time                                       |

Produced by `lastReadingPower(trace)` in `web/js/data/yield-stats.js`:

```text
lastReadingPower(trace) -> { w: number, timestamp: string } | null
```

- Returns `null` when `trace.readings` is empty (mirrors `dailyYieldWh()`'s `if (!last) return 0`
  guard, but the caller needs "no reading" to be distinguishable from a genuine `0`, so this
  returns `null` rather than a numeric default — matching the Key Entities note that this reading
  simply doesn't exist yet, not that it's zero).
- `w === 0` is a valid, real result (plant idle) — the caller (info panel controller) treats it as
  a genuine zero-production reading, same as a live `0 W` reading today (FR-005, edge cases).

Fetched/produced end to end via the new `fetchTodayMinuteTrace()` in
`web/js/data/today-trace.js`:

```text
fetchTodayMinuteTrace() -> Promise<{ readings: object[] } | null>
```

- `null` when `data/min_day.js` isn't fetchable, doesn't parse, or has zero readings for today
  (mirrors `day-view.js`'s existing `fetchDayTrace()` "isToday" branch contract exactly — see
  research.md §3).

## Production Render State (extends 027-navbar-live-panel's existing state)

`initInfoPanelController()`'s existing closure state, unchanged in shape but with one new sibling
flag governing who may write to it:

| Variable             | Type                                                                                | Changed by this feature?                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lastGoodProduction` | `{ available: false } \| { available: true, totalPacW: number, timestamp: string }` | No shape change — `pollDailyFallback()` writes the same shape `pollProduction()` already writes, just sourced from `lastReadingPower()` instead of `fetchLiveReading()`                           |
| `liveEverSucceeded`  | `boolean`                                                                           | **NEW** — starts `false`; set `true` (never reset) the instant `pollProduction()` sees a successful live reading; gates whether `pollDailyFallback()` is allowed to write to `lastGoodProduction` |

### State transitions

```text
mount: lastGoodProduction = { available: false }, liveEverSucceeded = false

pollDailyFallback() resolves with a reading, liveEverSucceeded === false
  -> lastGoodProduction = { available: true, totalPacW: reading.w, timestamp: reading.timestamp }
  -> render (Story 1)

pollDailyFallback() resolves with null, or liveEverSucceeded === true
  -> no write (Story 2 / Story 3's "stay neutral" / edge case "still loading")

pollProduction() resolves with a successful live reading
  -> liveEverSucceeded = true
  -> lastGoodProduction = { available: true, totalPacW: reading.watt, timestamp: reading.timestamp }
  -> render (Story 1 AC3 — live replaces fallback)

pollProduction() resolves with a failed poll
  -> no write to lastGoodProduction or liveEverSucceeded (existing 027 behavior, unchanged)
  -> render (re-renders whatever lastGoodProduction already held — live or fallback)
```

No entity in this feature is ever persisted (`localStorage` or otherwise) — both
`lastGoodProduction` and `liveEverSucceeded` live only as long as the page/tab session, matching
027-navbar-live-panel's existing Key Entities note that a Live Reading is transient in-memory
state.
