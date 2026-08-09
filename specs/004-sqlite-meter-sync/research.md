# Phase 0 Research: SQLite Meter Data Sync

## 1. SQLite access from Node

**Decision**: Use the built-in `node:sqlite` module (`DatabaseSync`), imported as
`import { DatabaseSync } from 'node:sqlite'`.

**Rationale**: Verified available and synchronous on the project's Node 24.16.0 runtime
(`node -e "require('node:sqlite')"` succeeds; `DatabaseSync`, `.exec()`, `.prepare().run()`,
`BEGIN`/`COMMIT` all work as expected in a smoke test). Using the built-in avoids adding
`better-sqlite3` or any native-module npm dependency, keeping `package.json` unchanged and
sidestepping native-addon build issues in CI/WSL2. Synchronous API matches the project's simple
CLI-script style (no async ceremony needed, mirrors `fs.readFileSync` usage already common in
`scripts/*.js`).

**Alternatives considered**:

- `better-sqlite3` (npm, native addon) — also synchronous and battle-tested, but adds a
  dependency with native compilation, rejected in favor of the zero-dependency built-in now that
  Node ships one.
- `sqlite3` (npm, async/callback) — more ceremony (callbacks/promises) for no benefit here, and
  still an added dependency.
- A hand-rolled flat-file/JSON cache instead of SQLite — rejected because the spec explicitly
  requires SQLite and range/aggregate queries (FR-010, FR-012–FR-015) are naturally served by SQL.

## 2. Epoch-aware record decoding

**Decision**: Reuse `scripts/utils.js`'s existing `epochFromDate(ddmmyy)` and
`epochFromFieldCounts(b0Len, b1Len)` rather than re-implementing epoch boundary logic.

**Rationale**: This logic already encodes the exact three epochs and transition dates from
`docs/data-format-daily.md` (2006-11-03, 2007-03-28, 2013-01-04) and is exercised by
`scripts/utils.test.js` and consumed by `scripts/backfill-min-day.js`. Re-deriving it in the new
script would duplicate a subtle date-boundary computation. `epochFromDate` selects the rule from
the record's own date (edge case: transition dates must use the record's date, independent of
adjacent files — satisfied since decoding is per-record, not per-file).

**Alternatives considered**: Inline epoch switch statement in the new script — rejected, DRY
violation and risk of drift from `utils.js`'s already-tested boundaries.

## 3. Idempotent delta sync / sync-state tracking

**Decision**: A `sync_state` table keyed by calendar date, storing a content hash
(`sha256` of the raw file bytes) and a `status` (`'complete'` for historical, immutable days vs.
`'current'` for `min_cur.js`/today). On each run: for every `min*.js` file, compute its date and
content hash; if the date's stored hash matches and status is `'complete'`, skip; otherwise
(re)parse the file and, inside a single SQLite transaction per day, delete that day's existing
`readings` rows and re-insert the freshly parsed ones, then upsert `sync_state` with the new hash
and status. `min_cur.js` is always treated as `status = 'current'` and always re-processed
(never marked `'complete'`) until superseded by a same-day historical file with a fixed name.

**Rationale**: Satisfies FR-005 (idempotent — unchanged hash ⇒ no-op), FR-006 (skip
already-synced complete days), FR-007 (changed content ⇒ hash mismatch ⇒ re-sync), FR-008
(current day always re-checked), and the interruption edge case (per-day transaction means a
kill mid-run leaves previously-committed days intact and only the in-flight day needs
re-processing on the next run — no partial-day state is ever visible to readers). Delete+re-insert
per day (rather than diffing individual records) is simple, correct, and cheap at day granularity
(≤288 rows), avoiding complex row-level upsert logic for a case (backfill/correction) that the
project's own tooling (`scripts/backfill-min-day.js`) already shows is rare.

**Alternatives considered**:

- File mtime instead of content hash — rejected, mtime is not a reliable change signal (file could
  be rewritten with identical mtime by some tooling, or touched without content change) and the
  spec explicitly calls for detecting _content_ changes.
- Row-level upsert (`INSERT ... ON CONFLICT UPDATE`) per record instead of delete+re-insert per
  day — rejected as unnecessary complexity; a day's rows are cheap to fully replace and the
  simpler approach is easier to reason about for correctness/idempotency.

## 4. Precomputed yield summaries for diagram views (US3)

**Decision**: Maintain `daily_yield_summary`, `monthly_yield_summary`, and `yearly_yield_summary`
tables, recomputed (via `INSERT OR REPLACE` from `readings`/`daily_yield_summary`) for the
affected day/month/year as part of the same per-day transaction that (re)inserts `readings`.

**Rationale**: FR-016 requires monthly/yearly values to be derivable from stored data "whether
computed on demand or maintained as precomputed aggregates" — precomputing at sync time keeps
read queries for the month/year/total diagram views (FR-013–FR-015) simple and fast (SC-006–SC-008)
without a separate aggregation pass, and keeps the aggregate always consistent with `readings`
since it's recomputed in the same transaction whenever a day's records change.

**Alternatives considered**: Compute aggregates on demand via `SUM()`/`GROUP BY` queries at read
time — viable and simpler to implement, but rejected as the primary design since the spec's Key
Entities section explicitly names Daily/Monthly/Yearly Yield Summary as first-class entities;
kept as a fallback approach that remains equally valid since the schema doesn't preclude either
being computed later.

## 5. Malformed record/file handling

**Decision**: Wrap per-line record parsing in a try/catch; on failure, log the file name, line
number, and raw line to stderr, increment a skip counter, and continue to the next line/file
rather than aborting the run.

**Rationale**: Directly satisfies FR-009 and the malformed-record edge case; matches the existing
project convention (`scripts/gap-detect.js`, `scripts/validate-plausibility.js`) of reporting
skipped/invalid entries rather than throwing.

**Alternatives considered**: Abort-on-first-error — rejected, spec explicitly requires continuing
past malformed records/files (edge case, FR-009).
