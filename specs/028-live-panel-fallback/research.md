# Phase 0 Research: Live Panel Falls Back to Daily Last Value

All items below were resolvable directly from the existing codebase (027-navbar-live-panel's
implementation and `views/day-view.js`) — no external research was needed. No `NEEDS
CLARIFICATION` markers remain in plan.md's Technical Context.

## 1. Where does the fallback reading come from?

- **Decision**: Fetch and parse `data/min_day.js` (the same rolling today-file `day-view.js`
  already fetches via `fetchText` + `parseMinFile`), take its last-filtered-to-today reading, and
  sum `pacW` across `perInverter` — mirroring `yield-stats.js`'s existing `maxDailyPowerW()`
  reduction, but for the _last_ reading instead of the peak.
- **Rationale**: FR-001/FR-007/the spec's Assumptions are explicit that this must be "the same
  underlying data already used to render the last row of the day view's data table for today" and
  must not add a new network request — `min_day.js` is that exact file, already fetched
  elsewhere in the app.
- **Alternatives considered**:
  - _Read `data/min_cur.js` instead_ — rejected: that's the SolarLog device's own live snapshot
    file, a different (and, per 027's plan.md, deliberately abandoned) source from the new live
    HTTP endpoint; using it would reintroduce the staleness/format issues 027 moved away from, and
    isn't what the spec calls "the daily value ... displayed in the daily view as last value in
    the datatable."
  - _Read `data/days.js` (daily totals)_ — rejected: that file holds only the day's cumulative
    Wh yield, not an instantaneous wattage reading with its own timestamp; it can't produce a "W"
    figure or an "as of HH:MM" time the way the day table's last row does.

## 2. How does the info panel controller get `min_day.js` without a new fetch schedule?

- **Decision**: Add a `pollDailyFallback()` call fired on the same `DATA_REFRESH_INTERVAL_MS`
  `setInterval` tick `pollYield()` already uses (both called from mount, then both re-invoked by
  one shared interval), rather than a second `setInterval`.
- **Rationale**: FR-006/FR-007 require reusing the existing 10-minute cadence, not adding a new
  one; `pollYield()` already establishes exactly that interval in
  `initInfoPanelController()`. Combining is simplest and keeps a single source of truth for "the
  slow poll tick."
- **Alternatives considered**: A dedicated third `setInterval` at the same
  `DATA_REFRESH_INTERVAL_MS` value — rejected as needless duplication (two timers with identical
  periods drifting relative to each other for no benefit) when one tick can drive both calls.

## 3. How is duplicate fetch/parse/filter logic between `day-view.js` and the info panel avoided?

- **Decision**: Extract `day-view.js`'s `fetchDayTrace()` `isToday` branch (fetch `min_day.js`,
  parse with `ddmmyyFromParams(todayParams())`, filter `readings` to entries whose timestamp
  starts with today's ISO date) into a new shared `web/js/data/today-trace.js` exporting
  `fetchTodayMinuteTrace()`. `day-view.js` calls it for its `isToday` case; the info panel
  controller calls it directly.
- **Rationale**: The two call sites need identical behavior (today-only filtering handles the
  post-midnight "`min_day.js` still has yesterday's readings until the device's next sync" edge
  case, per `day-view.js`'s existing comment) — duplicating it risks the two copies drifting.
  Sharing it also keeps `day-view.js`'s own behavior byte-for-byte unchanged, so no new Playwright
  coverage is needed for the day view itself, only for the info panel's new consumer.
- **Alternatives considered**: Duplicate the ~10 lines directly in
  `info-panel-controller.js` — rejected per the codebase's general preference (seen throughout
  `web/js/data/`) for one parse/fetch helper per file shape rather than per call site; the
  existing precedent of small _pure_ per-file helpers like `todayIso()`/`todayParams()` being
  duplicated across view/controller files does not extend to this fetch-plus-parse-plus-filter
  logic, which is meaningfully more than a one-line date formatter.

## 4. How is "fallback never overrides an already-shown live reading" (FR-004) enforced?

- **Decision**: A single closure-scoped `let liveEverSucceeded = false;` in
  `initInfoPanelController()`, set to `true` the moment `pollProduction()` sees a successful live
  reading (alongside the existing `lastGoodProduction` write), and checked by
  `pollDailyFallback()` before it ever writes into `lastGoodProduction`: it writes only when
  `!liveEverSucceeded`.
- **Rationale**: Matches the existing `lastGoodProduction`/`requestSeq` pattern already in the
  file (research.md §3/§4 of 027-navbar-live-panel) — a plain one-way flag is the simplest
  mechanism that can never be un-set mid-session, which is exactly FR-004's guarantee ("for the
  remainder of the session").
- **Alternatives considered**: Reusing `lastGoodProduction.available` itself as the guard (skip
  the fallback write whenever `lastGoodProduction.available` is already `true`) — rejected: once
  the fallback itself has written a reading, `available` is already `true`, which would then
  incorrectly block the _next_ fallback refresh (FR-006 requires the fallback to keep refreshing
  on its own cadence until a live reading arrives) and, if a live reading later fails, would also
  read as "already available" without telling the two sources apart. A dedicated flag is
  unambiguous.

## 5. Does the fallback poll need the existing `requestSeq` out-of-order guard?

- **Decision**: No — `requestSeq` stays scoped to `pollProduction()` (the live poll) only.
- **Rationale**: The guard exists to stop a slow live response from overwriting a newer live
  response. The fallback poll never competes with itself the same way (it's on a single slower
  interval, not re-triggered by tab-refocus like the live poll), and per §4 above it can only ever
  write while `liveEverSucceeded` is `false` — the moment a live poll succeeds, every subsequent
  fallback tick becomes a no-op regardless of arrival order, so no ordering guard is needed for
  it to satisfy FR-004.
- **Alternatives considered**: Extending `requestSeq` to cover both polls — rejected as
  unnecessary complexity; the two polls never need to race against each other, only the
  `liveEverSucceeded` flag needs to be checked at write time.
