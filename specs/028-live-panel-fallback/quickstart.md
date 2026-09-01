# Quickstart: Validating Live Panel Falls Back to Daily Last Value

## Prerequisites

```bash
npm install
npm start   # browser-sync dev server; copy the printed URL into your browser (WSL2 can't auto-open)
```

`bs-config.cjs` proxies `/data/*` to the live device, so `data/min_day.js` is real device data in
dev — use Playwright's `page.route()` mocks (below) for deterministic scenarios instead of relying
on whatever the plant happens to be producing right now.

## Unit tests (pure logic)

```bash
node --test web/js/data/yield-stats.test.js     # lastReadingPower()
node --test web/js/data/today-trace.test.js     # fetchTodayMinuteTrace()
```

Expected: all pass, including new cases for `lastReadingPower()` returning `null` on an empty
trace and a correct `{ w: 0, timestamp }` on an all-zero last reading (genuine idle reading, not
"no data").

## Playwright scenarios (`tests/e2e/info-panel.spec.js`)

Mirrors the existing `mockProduction()` (mocks `**/live/index.php`, see that file's top comment)
with a new `mockDailyFallback()` mocking `**/min_day.js`, and reuses
`overrideLiveRefreshInterval()`'s pattern for `DATA_REFRESH_INTERVAL_MS` where a scenario needs to
wait out a fallback refresh tick.

1. **Story 1 — fallback shown when live has never succeeded**
   - Mock `**/live/index.php` to abort every request.
   - Mock `**/min_day.js` with a trace whose last `m[mi++]=` line carries a known wattage/time.
   - Load the site; assert the panel's `[data-role="production-value"]` shows that wattage and
     `[data-role="production-timestamp"]` shows that reading's own `HH:MM`, not "no data yet"
     (`data-available="true"` on `[data-role="production"]`).

2. **Story 1 AC3 — live later succeeds and replaces the fallback**
   - Start as in scenario 1 (fallback showing), then re-route `**/live/index.php` to a successful
     fixed-wattage response and advance past one `LIVE_REFRESH_INTERVAL_MS` tick (patched small,
     per `overrideLiveRefreshInterval()`).
   - Assert the panel now shows the live endpoint's wattage/timestamp, not the fallback's.

3. **Story 2 — a single failed live poll never regresses an already-shown live reading to the
   fallback**
   - Mock `**/live/index.php` to succeed once, then fail; mock `**/min_day.js` with a _different_
     wattage so the two are distinguishable.
   - Load the site (first live poll succeeds); advance past one `LIVE_REFRESH_INTERVAL_MS` tick
     (live poll now fails) and one `DATA_REFRESH_INTERVAL_MS` tick (fallback poll fires).
   - Assert the panel still shows the first live reading's wattage/timestamp, unchanged.

4. **Story 3 — neutral state preserved when neither source has data**
   - Mock `**/live/index.php` to abort and `**/min_day.js` to return an empty/no-readings-for-
     today file (or 404).
   - Load the site; assert the panel still shows the existing "no data yet" state
     (`data-available="false"`), not a zero reading or an error.

## Manual smoke check

1. With the dev server running and the live device unreachable (e.g. temporarily block
   `wolfsbach.synology.me/live` in devtools' network conditions), reload the site.
2. Confirm the navbar/mobile info panel shows a real wattage + "Stand: HH:MM" sourced from today's
   day view — cross-check against `#/day/<today>`'s data table's last row, which must match
   exactly (same wattage, same time).
3. Unblock the live endpoint and wait up to `LIVE_REFRESH_INTERVAL_MS` (1 minute default); confirm
   the panel switches to the live reading.
