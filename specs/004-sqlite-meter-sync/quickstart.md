# Quickstart: SQLite Meter Data Sync

## Prerequisites

- Node.js 24+ (provides the built-in `node:sqlite` module — verify with
  `node -e "require('node:sqlite')"`; it must not throw).
- A checkout of this repository with its `min*.js` files present at the repository root (or point
  `--data-dir` at a folder containing sample files spanning the three epochs for a scoped test).

## First-time full sync (validates US1)

```bash
node scripts/sync-sqlite.js
```

Expected outcome: `data/solarlog.sqlite3` is created; the summary line reports one `readings` row
inserted per 5-minute record across all `min*.js` files. Spot-check against the documented
examples in `docs/data-format-daily.md`:

```bash
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/solarlog.sqlite3');
console.log(db.prepare(
  \"SELECT * FROM readings WHERE timestamp = '2006-11-03T15:00:00'\"
).all());
"
```

Expected: two rows (one per inverter) for `2006-11-03T15:00:00` matching the epoch-1 example in
`docs/data-format-daily.md` (`sb2100`: pac_w=1314, pdc_str1_w=1399, daily_yield_wh=6653,
udc_str1_v=406; `sb4200`: pac_w=2529, pdc_str1_w=1346, pdc_str2_w=1339, daily_yield_wh=13059,
udc_str1_v/udc_str2_v = NULL).

## Idempotency check (validates US2, SC-002)

```bash
node scripts/sync-sqlite.js   # first run — see above
node scripts/sync-sqlite.js   # second run, no new files
```

Expected: second run's summary reports `0 inserted, 0 updated`.

## Delta sync check (validates US2, SC-003)

```bash
# Simulate a new day arriving (only if a suitable sample file exists / can be copied):
cp min250701.js /tmp/staging/min260801.js   # example — adjust date per actual test setup
node scripts/sync-sqlite.js --data-dir /tmp/staging
```

Expected: only the new day's records are inserted; run duration is small and does not scale with
total archive size (verified qualitatively — the run should visibly not re-read all 7,000+
historical files).

## Query check (validates US3)

Run the queries documented in [contracts/queries.md](contracts/queries.md) against
`data/solarlog.sqlite3` for a known date/month/year and compare the results to values read
directly from the corresponding `.js` files (or the existing rendered diagram views) for the same
period — they must match (SC-005–SC-008).

## Running the script's own tests

```bash
node --test scripts/sync-sqlite.test.js
```

All tests use inline fixture strings and an in-memory SQLite database (`:memory:`) — no real
file I/O, per project testing conventions.
