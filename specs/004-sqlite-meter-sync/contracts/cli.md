# Contract: `scripts/sync-sqlite.js` CLI

## Invocation

```bash
node scripts/sync-sqlite.js [--data-dir <path>] [--db <path>] [--dry-run]
```

| Flag         | Default                 | Meaning                                                                                                                                                             |
| ------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--data-dir` | repository root (`.`)   | Directory containing `min*.js` files, matching existing scripts' convention (e.g. `scripts/gap-detect.js`).                                                         |
| `--db`       | `data/solarlog.sqlite3` | Path to the SQLite database file; created if it doesn't exist.                                                                                                      |
| `--dry-run`  | off                     | Parse and report what would change without writing to the database, matching the `--dry-run` convention used by `scripts/fill-months.js` / `scripts/fill-years.js`. |

## Exit codes

| Code | Meaning                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0`  | Sync completed; zero or more files skipped/malformed-record warnings were logged but the run finished.                                           |
| `1`  | Fatal error (e.g. database file unwritable, `--data-dir` does not exist). Individual malformed records/files never cause exit code `1` (FR-009). |

## stdout / stderr contract

- Progress/summary lines (files processed, days inserted, days skipped, records written) go to
  stdout, one summary at the end of the run (e.g.
  `Synced 3 day(s): 2 inserted, 1 updated, 7147 unchanged (skipped), 0 malformed records`).
- Per-skipped-record/file warnings go to stderr, one line each, including file name and, where
  applicable, line number (FR-009): e.g.
  `WARN min070328.js:142: unexpected field count (3) for epoch 2 block 1, skipping record`.

## Idempotency contract (FR-005, SC-002)

Running the script twice in immediate succession with no new/changed source files MUST:

- Produce identical `readings`, `daily_yield_summary`, `monthly_yield_summary`,
  `yearly_yield_summary` table contents after both runs.
- Report `0 inserted, 0 updated` in the second run's summary.

## Delta-sync contract (FR-006, SC-003)

Given a database already synced through day N, adding one new day N+1's file and re-running
MUST:

- Only insert rows for day N+1 (verified via `sync_state` row count delta = 1, `readings` row
  count delta = that day's record count only).
- Not re-read or re-parse any file whose `sync_state.status = 'complete'` and whose content hash
  is unchanged.

## Current-day contract (FR-008)

`min_cur.js` MUST be re-parsed and its `readings` rows replaced on every run (never skipped via
the `'complete'` short-circuit), matching acceptance scenario US2/3.
