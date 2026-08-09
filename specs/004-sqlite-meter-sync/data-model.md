# Phase 1 Data Model: SQLite Meter Data Sync

All tables live in the single local SQLite file (`data/solarlog.sqlite3`). Inverter identity is
always stored explicitly (`sb4200` / `sb2100`) — never inferred from source-file column position —
per the spec's Key Entities note that block position varies by epoch.

## `sync_state`

Tracks which calendar days are fully synced vs. still mutable (Key Entity: Sync State).

| Column         | Type             | Notes                                                                                             |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| `date`         | TEXT PRIMARY KEY | ISO `YYYY-MM-DD`, derived from the file's date.                                                   |
| `source_file`  | TEXT NOT NULL    | e.g. `min250701.js` or `min_cur.js`.                                                              |
| `content_hash` | TEXT NOT NULL    | sha256 hex digest of the raw file bytes at last successful sync.                                  |
| `status`       | TEXT NOT NULL    | `'complete'` (immutable historical day) or `'current'` (today / `min_cur.js`, always re-checked). |
| `synced_at`    | TEXT NOT NULL    | ISO 8601 timestamp of the last successful sync of this date.                                      |
| `record_count` | INTEGER NOT NULL | Rows written to `readings` for this date at last sync (diagnostic / SC-001 verification aid).     |

Validation rules: `status` MUST be one of `'complete' | 'current'` (FR-008). A row with
`status = 'current'` MUST always be re-evaluated on the next run regardless of `content_hash`
match (still hashed to short-circuit re-parsing if content is unchanged, but never promoted to
`'complete'` while it is today's file).

## `readings`

One row per 5-minute record per inverter (Key Entity: Daily Reading × Inverter Reading, stored
denormalized as one row per inverter for simple querying — see Contracts for the combined view).

| Column           | Type                              | Notes                                                                                         |
| ---------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `id`             | INTEGER PRIMARY KEY AUTOINCREMENT | Surrogate key.                                                                                |
| `date`           | TEXT NOT NULL                     | ISO `YYYY-MM-DD`; FK-like reference to `sync_state.date`.                                     |
| `timestamp`      | TEXT NOT NULL                     | ISO 8601 `YYYY-MM-DDTHH:MM:SS`, parsed from the record's `DD.MM.YY HH:MM:SS` prefix (FR-004). |
| `inverter`       | TEXT NOT NULL                     | `'sb4200'` or `'sb2100'` — physical inverter identity, epoch-independent (FR-003).            |
| `pac_w`          | INTEGER NOT NULL                  | AC output power, watts.                                                                       |
| `pdc_str1_w`     | INTEGER NOT NULL                  | DC input power, string 1, watts.                                                              |
| `pdc_str2_w`     | INTEGER                           | DC input power, string 2, watts; NULL for `sb2100` (1-string inverter).                       |
| `daily_yield_wh` | INTEGER NOT NULL                  | Cumulative daily yield at this timestamp, Wh.                                                 |
| `udc_str1_v`     | INTEGER                           | DC voltage, string 1; NULL where the epoch doesn't include it (epoch 1, `sb4200` block).      |
| `udc_str2_v`     | INTEGER                           | DC voltage, string 2; NULL for `sb2100` and for epoch 1's `sb4200` block.                     |
| `epoch`          | INTEGER NOT NULL                  | `1`, `2`, or `3` — which block layout produced this row (diagnostic / SC-001 spot-check aid). |

Indexes: `CREATE INDEX idx_readings_date ON readings(date)`;
`CREATE UNIQUE INDEX idx_readings_ts_inverter ON readings(timestamp, inverter)` (enforces no
duplicate rows for the same timestamp+inverter — the idempotency invariant, FR-005).

Validation rules: `inverter` MUST be `'sb4200'` or `'sb2100'`. `pdc_str2_w`/`udc_str1_v`/
`udc_str2_v` presence follows the epoch/inverter-type table in `docs/data-format-daily.md`
(FR-003) — absent fields are stored as SQL `NULL`, never `0` or a sentinel (edge case: "without
requiring null-padding assumptions that lose meaning").

## `daily_yield_summary`

Per calendar day, end-of-day cumulative yield per inverter and combined (Key Entity: Daily Yield
Summary; powers FR-013 / month diagram view).

| Column            | Type             | Notes                                         |
| ----------------- | ---------------- | --------------------------------------------- |
| `date`            | TEXT PRIMARY KEY | ISO `YYYY-MM-DD`.                             |
| `sb4200_yield_wh` | INTEGER NOT NULL | Final `daily_yield_wh` for `sb4200` that day. |
| `sb2100_yield_wh` | INTEGER NOT NULL | Final `daily_yield_wh` for `sb2100` that day. |
| `total_yield_wh`  | INTEGER NOT NULL | `sb4200_yield_wh + sb2100_yield_wh`.          |

Derivation: `MAX(timestamp)` row per inverter per date from `readings` (the last, i.e. highest,
cumulative reading of the day). Recomputed within the same transaction whenever `readings` for
that date changes.

## `monthly_yield_summary`

Per calendar month, combined total yield (Key Entity: Monthly Yield Summary; powers FR-014 /
year diagram view).

| Column           | Type             | Notes                                                            |
| ---------------- | ---------------- | ---------------------------------------------------------------- |
| `month`          | TEXT PRIMARY KEY | ISO `YYYY-MM`.                                                   |
| `total_yield_wh` | INTEGER NOT NULL | `SUM(total_yield_wh)` from `daily_yield_summary` for that month. |

## `yearly_yield_summary`

Per calendar year, combined total yield (Key Entity: Yearly Yield Summary; powers FR-015 / total
diagram view).

| Column           | Type             | Notes                                                           |
| ---------------- | ---------------- | --------------------------------------------------------------- |
| `year`           | TEXT PRIMARY KEY | `YYYY`.                                                         |
| `total_yield_wh` | INTEGER NOT NULL | `SUM(total_yield_wh)` from `daily_yield_summary` for that year. |

## Relationships

```text
sync_state (1) ──date──> (N) readings
readings   (N) ──date, GROUP BY date──> (1) daily_yield_summary
daily_yield_summary (N) ──substr(date,1,7)──> (1) monthly_yield_summary
daily_yield_summary (N) ──substr(date,1,4)──> (1) yearly_yield_summary
```

## State transitions (`sync_state.status`)

```text
(no row) --file first fully parsed, is historical--> 'complete'
(no row) --file first parsed, is min_cur.js/today--> 'current'
'current' --content_hash unchanged on re-run--> 'current' (re-checked, no-op write)
'current' --content_hash changed on re-run--> 'current' (re-parsed, readings replaced)
'current' --day rolls over, historical file for that date now exists--> 'complete'
'complete' --content_hash changed (backfill/correction, FR-007)--> 'complete' (re-parsed, readings replaced)
'complete' --content_hash unchanged--> 'complete' (skipped, no re-parse — FR-006)
```
