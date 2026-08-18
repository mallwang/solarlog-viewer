# Phase 1 Data Model: Remove SQLite Data Store

## No new or changed data entities

This feature does not introduce, modify, or migrate any data entity. It
removes a derived, disposable cache (the SQLite database and its sync
tooling) that sat _downstream_ of the real data model — the SolarLog
device's `.js` export files — without ever being read by the browser
viewer.

## Entities removed (for completeness, not created)

- **`readings` table** (SQLite): previously held one row per inverter per
  5-minute timestamp, decoded from `min*.js` files by
  `scripts/sync-sqlite.js`. Removed entirely — no replacement, no migration,
  because nothing downstream consumed it (Node CLI tooling only, confirmed
  in `research.md`).
- **Per-day sync-state tracking** (SQLite, content-hash based idempotency
  bookkeeping internal to `sync-sqlite.js`): removed alongside the script
  that maintained it.

## Unaffected data model

The project's actual data model — the SolarLog device's `.js` export files
(`base_vars.js`, `min_cur.js`, `min{YYMMDD}.js`, `days.js`, `months.js`,
`years.js`, `days_hist*.js`, `daysall.js`) parsed client-side in
`web/js/data/` — is entirely unchanged by this feature. See constitution
Principle I and Data Preservation Constraints for the authoritative
description; this feature only makes documentation consistent with the fact
that these files are the _sole_ data source, with no database layer beside
or behind them.
