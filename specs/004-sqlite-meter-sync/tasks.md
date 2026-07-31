---

description: "Task list for SQLite Meter Data Sync"
---

# Tasks: SQLite Meter Data Sync

**Input**: Design documents from `/specs/004-sqlite-meter-sync/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli.md, contracts/queries.md, quickstart.md

**Tests**: Included — project convention (CLAUDE.md) mandates a co-located `*.test.js` per script, written before implementation (TDD), covering every exported function.

**Organization**: Tasks are grouped by user story. Almost all work lands in two files
(`scripts/sync-sqlite.js`, `scripts/sync-sqlite.test.js`), so most tasks are sequential edits to
those files rather than `[P]` — `[P]` is reserved for genuinely independent files (`.gitignore`).

**Implementation note (discovered during `/speckit-implement`)**: `min_cur.js` is not a growing
list of `m[mi++]=` records — per `docs/data-format.md` and the real file at the repo root, it is a
single real-time snapshot (`Datum`/`Uhrzeit`/`Pac`/`PacArr`/`PdcArr`, no `daily_yield_wh`) in a
format `parseRecordLine` cannot decode. Per user decision, `min_cur.js` is excluded from sync
entirely: `listSourceFiles` only matches dated `minYYMMDD.js` files, all tagged `status: 'complete'`.
Tasks below that referenced `min_cur.js`/status `'current'` handling (T010, T011, T019, T022) were
implemented against this corrected scope instead; the `sync_state.status` column and its
`'current'`-always-reparse code path in `runSync` are retained as-designed for forward
compatibility but are currently unreachable (no source file ever produces `status: 'current'`).

## Path Conventions

Single project (per plan.md Structure Decision). All new code lives in `scripts/`; the only other
touched path is `.gitignore` (to exclude the generated `data/` directory).

---

## Phase 1: Setup

**Purpose**: Repo-level scaffolding shared by every story.

- [X] T001 [P] Add `data/` to `.gitignore` at repository root (generated SQLite cache must not be committed, per plan.md Storage decision).
- [X] T002 Create `scripts/sync-sqlite.js` with the module docstring/header, ESM imports (`node:sqlite`'s `DatabaseSync`, `node:fs`, `node:path`, `node:crypto`, and `epochFromDate` from `./utils.js`), and no logic yet — establishes the file other tasks extend.
- [X] T003 Create `scripts/sync-sqlite.test.js` with the `node:test` header (`import { test } from 'node:test'`, `import assert from 'node:assert/strict'`) and no cases yet, per project TDD convention (write tests before implementation).

**Checkpoint**: Both files exist and `node --test scripts/sync-sqlite.test.js` runs (0 tests, exit 0).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, record decoding, and content-hashing — shared by every user story. No user
story can be implemented until this phase is complete, since US1/US2/US3 all read/write the same
tables and the same per-record decode path.

- [X] T004 [Foundational] Write failing tests in `scripts/sync-sqlite.test.js` for `createSchema(db)`: asserts `sync_state`, `readings`, `daily_yield_summary`, `monthly_yield_summary`, `yearly_yield_summary` tables exist (via `sqlite_master` query) and the unique index on `readings(timestamp, inverter)` exists, using an in-memory `DatabaseSync(':memory:')`.
- [X] T005 [Foundational] Implement and export `createSchema(db)` in `scripts/sync-sqlite.js`: runs the DDL for all five tables plus `idx_readings_date` and the unique `idx_readings_ts_inverter` index from data-model.md, using `db.exec()`. Run tests from T004 until green.
- [X] T006 [P] [Foundational] Write failing tests in `scripts/sync-sqlite.test.js` for `parseRecordLine(line, date)`: given the epoch-1 example line (`03.11.06 15:00:00|1314;1399;6653;406|2529;1346;1339;13059`), asserts it returns two reading objects — `sb2100` (pac_w=1314, pdc_str1_w=1399, daily_yield_wh=6653, udc_str1_v=406, pdc_str2_w=null, udc_str2_v=null, epoch=1) and `sb4200` (pac_w=2529, pdc_str1_w=1346, pdc_str2_w=1339, daily_yield_wh=13059, udc_str1_v=null, udc_str2_v=null, epoch=1) — plus one case for an epoch-3 line verifying block-1/block-2 inverter identity is swapped (`sb4200` first), and one case for a malformed line (wrong field count) returning `null`/throwing a typed error rather than crashing.
- [X] T007 [Foundational] Implement and export `parseRecordLine(line, date)` in `scripts/sync-sqlite.js`: parses the `DD.MM.YY HH:MM:SS|block1|block2` line, calls `epochFromDate` from `utils.js` to get the epoch descriptor (field counts + `b0IsSB4200`), splits each block on `;`, maps fields to `{ inverter, pac_w, pdc_str1_w, pdc_str2_w, daily_yield_wh, udc_str1_v, udc_str2_v, epoch }` per the field-index table in `docs/data-format-daily.md` (Wh at index 2 for 1-string / index 3 for 2-string blocks), and returns `null` for a line whose block field counts don't match any known epoch shape (FR-009 malformed-record handling). Run tests from T006 until green.
- [X] T008 [P] [Foundational] Write failing tests in `scripts/sync-sqlite.test.js` for `hashContent(buffer)`: asserts it returns the sha256 hex digest of the given bytes (deterministic, matches `crypto.createHash('sha256')` computed independently in the test).
- [X] T009 [Foundational] Implement and export `hashContent(buffer)` in `scripts/sync-sqlite.js` using `node:crypto`'s `createHash('sha256')`. Run tests from T008 until green.
- [X] T010 [P] [Foundational] Write failing tests in `scripts/sync-sqlite.test.js` for `listSourceFiles(dataDir)`: given a fixture directory listing (mock via `readdirSync` on a temp dir created with `node:fs`'s `mkdtempSync`, containing `min061103.js`, `min070328.js`, `min_cur.js`, and an unrelated file like `days.js`), asserts it returns only the `min*.js` files sorted with `min_cur.js` last, each tagged with its parsed ISO date (`min_cur.js` tagged with today's date) and `status` (`'complete'` for dated files, `'current'` for `min_cur.js`).
- [X] T011 [Foundational] Implement and export `listSourceFiles(dataDir)` in `scripts/sync-sqlite.js`: reads the directory, filters filenames matching `min(\d{6})\.js` or `min_cur\.js`, derives each file's ISO date and `status`, and returns them sorted oldest-first with `min_cur.js` last. Run tests from T010 until green.

**Checkpoint**: Schema creation, record decoding, content hashing, and file discovery are all
implemented and unit-tested in isolation. User story implementation can now begin.

---

## Phase 3: User Story 1 - Initial full sync of historical data (Priority: P1) 🎯 MVP

**Goal**: Running `node scripts/sync-sqlite.js` against a directory of `min*.js` files spanning
all three epochs creates `data/solarlog.sqlite3` and populates `readings` with one row per
inverter per 5-minute timestamp, correctly decoded per epoch.

**Independent Test**: Point the script at a fixture directory with sample files spanning all
three epochs; verify the resulting database contains one row per record with fields matching
`docs/data-format-daily.md`'s documented examples.

### Tests for User Story 1

- [X] T012 [P] [US1] Write failing integration test in `scripts/sync-sqlite.test.js` using an in-memory `DatabaseSync(':memory:')` and inline fixture file contents (epoch-1 example line from data-format-daily.md, plus one epoch-2 line and one epoch-3 line as separate fixture "files" fed directly into the sync-one-day function): asserts `syncDay(db, { date, sourceFile, content, status })` inserts exactly 2 `readings` rows per record (one per inverter) with fields matching the documented examples, and one `sync_state` row with the correct `content_hash`, `status`, and `record_count`.
- [X] T013 [P] [US1] Write failing integration test in `scripts/sync-sqlite.test.js` for `runSync({ dataDir, dbPath: ':memory:' })` (or an equivalent orchestration entry point) against a fixture directory (via `mkdtempSync`) containing one file per epoch: asserts the final `readings` row count equals the total record count across all fixture files, and spot-checks the epoch-1 example values from acceptance scenario US1.2 (`sb2100`: pac_w=1314 …; `sb4200`: pac_w=2529 …) and the epoch-3 example from US1.3 (block 1 → `sb4200`, block 2 → `sb2100`).

### Implementation for User Story 1

- [X] T014 [US1] Implement and export `syncDay(db, { date, sourceFile, content, status })` in `scripts/sync-sqlite.js`: splits `content` into lines, calls `parseRecordLine` per line (skipping and counting malformed lines per FR-009), inserts all resulting rows into `readings` and upserts one `sync_state` row (hash via `hashContent`, `record_count`), wrapped in a single SQLite transaction (`db.exec('BEGIN')` / `COMMIT`, rollback on error) per the interruption-safety requirement (FR-005, FR-008 edge case). Run tests from T012 until green.
- [X] T015 [US1] Implement and export `runSync({ dataDir, dbPath, dryRun })` in `scripts/sync-sqlite.js`: opens/creates the database (creating the `data/` directory if needed, per `--db` default `data/solarlog.sqlite3`), calls `createSchema` if tables don't exist, calls `listSourceFiles(dataDir)`, and for each file reads its content and calls `syncDay` (or, for a first-time empty database, unconditionally treats every day as new), accumulating and returning summary counters (`{ inserted, updated, unchanged, malformed }`). Run tests from T013 until green.
- [X] T016 [US1] Wire the CLI entry point in `scripts/sync-sqlite.js`: parse `--data-dir` (default `.`), `--db` (default `data/solarlog.sqlite3`), `--dry-run` from `process.argv`, call `runSync`, print the stdout summary line and stderr per-skipped-record warnings per `contracts/cli.md`, and `process.exit(0)` on success / `process.exit(1)` on fatal error (unwritable db, missing `--data-dir`) — guarded by `if (process.argv[1] === new URL(import.meta.url).pathname)` so importing the module for tests doesn't run it.
- [X] T017 [US1] Run `node scripts/sync-sqlite.js --data-dir <fixture-dir>` manually against a small fixture directory with real sample `min*.js` files (one per epoch, copied from repo root) per quickstart.md "First-time full sync", and verify the spot-check query in quickstart.md returns the documented epoch-1 values.

**Checkpoint**: User Story 1 is fully functional — a first-time run against the real archive
populates `readings` correctly for all three epochs. This is the MVP.

---

## Phase 4: User Story 2 - Idempotent delta sync on subsequent runs (Priority: P1)

**Goal**: Re-running the script against unchanged files is a no-op; a newly added day is synced
without re-reading prior days; `min_cur.js` is always re-processed; changed/backfilled files are
detected and refreshed.

**Independent Test**: Run the script twice against the same files (no diff expected), then add
one new day's file and re-run (only that day inserted).

### Tests for User Story 2

- [X] T018 [P] [US2] Write failing tests in `scripts/sync-sqlite.test.js` for the skip/refresh decision inside `runSync`/`syncDay`: given a `sync_state` row with `status='complete'` and a matching `content_hash`, asserts the file is skipped (no `readings` delete/insert, counted as `unchanged`); given a mismatched hash for a `'complete'` row, asserts `readings` for that date are deleted and re-inserted (counted as `updated`) and `sync_state.content_hash`/`record_count` are refreshed.
- [X] T019 [P] [US2] Write failing test in `scripts/sync-sqlite.test.js` asserting a `sync_state` row with `status='current'` (i.e. `min_cur.js`) is **always** re-parsed regardless of hash match — never short-circuited — and its `readings` rows are replaced (delete-then-reinsert) each time `runSync` is called, per FR-008.
- [X] T020 [US2] Write failing end-to-end test in `scripts/sync-sqlite.test.js`: build an in-memory db via `runSync` twice in immediate succession against the same fixture directory with no changes, asserting the second run's summary is `{ inserted: 0, updated: 0 }` and `readings`/`sync_state` row counts are identical before and after (SC-002); then add one new fixture file and re-run, asserting only that day's `sync_state`/`readings` rows appear (SC-003) and prior days' `sync_state.synced_at` timestamps are unchanged (proving they weren't re-processed).

### Implementation for User Story 2

- [X] T021 [US2] Extend `runSync` in `scripts/sync-sqlite.js` to, for each file from `listSourceFiles`, first query the existing `sync_state` row for that date: if `status==='complete'` and `hashContent(content)` matches the stored hash, skip (increment `unchanged`) without calling `syncDay`; otherwise call `syncDay` (increment `inserted` if no prior row existed, else `updated`). Run tests from T018 until green.
- [X] T022 [US2] Ensure the `min_cur.js` branch in `runSync` (status `'current'`) bypasses the hash short-circuit from T021 entirely — always calls `syncDay` — per FR-008. Run tests from T019 until green.
- [X] T023 [US2] Verify `syncDay`'s per-day transaction (from T014) deletes existing `readings` rows for that `date` before re-inserting, so a changed/backfilled file never leaves stale rows alongside fresh ones (edge case: backfilled file replaces a previous reconstruction). Run tests from T020 until green.
- [X] T024 [US2] Run the quickstart.md "Idempotency check" and "Delta sync check" manually against the real archive (two consecutive `node scripts/sync-sqlite.js` runs, then a copied new-day file) and confirm the printed summary lines match the expected `0 inserted, 0 updated` / delta-only outcomes.

**Checkpoint**: User Stories 1 AND 2 both work independently — full sync is correct, and re-runs
are idempotent with correct delta/refresh behavior.

---

## Phase 5: User Story 3 - Powering the diagram views (Priority: P2)

**Goal**: The database exposes precomputed daily/monthly/yearly yield summaries, kept consistent
with `readings` on every sync, queryable per `contracts/queries.md` for all four diagram views.

**Independent Test**: Run the documented queries against a populated database and compare results
to values computed directly from source files for the same period.

### Tests for User Story 3

- [X] T025 [P] [US3] Write failing tests in `scripts/sync-sqlite.test.js` for `recomputeSummaries(db, date)`: given `readings` rows for a date with known `daily_yield_wh` values, asserts `daily_yield_summary` gets one row with `sb4200_yield_wh`/`sb2100_yield_wh` equal to each inverter's `MAX(timestamp)` reading that day and `total_yield_wh` equal to their sum; asserts `monthly_yield_summary` for that date's month equals `SUM(total_yield_wh)` from `daily_yield_summary` for the month; asserts `yearly_yield_summary` for that date's year equals the year's sum.
- [X] T026 [P] [US3] Write failing tests in `scripts/sync-sqlite.test.js` for each of the four query contracts in `contracts/queries.md` (daily/monthly/yearly/total), run directly against a populated in-memory db, asserting the returned column shapes and values match a hand-computed expectation from the same fixture data.

### Implementation for User Story 3

- [X] T027 [US3] Implement and export `recomputeSummaries(db, date)` in `scripts/sync-sqlite.js`: `INSERT OR REPLACE` into `daily_yield_summary` for `date` (derived via `MAX(timestamp)` per inverter from `readings`), then `INSERT OR REPLACE` into `monthly_yield_summary` for `substr(date,1,7)` (summed from `daily_yield_summary`) and `yearly_yield_summary` for `substr(date,1,4)`. Run tests from T025 until green.
- [X] T028 [US3] Call `recomputeSummaries(db, date)` from inside `syncDay`'s existing per-day transaction (T014) immediately after the `readings` insert, so summaries stay consistent with `readings` on every sync (research.md decision 4).
- [X] T029 [US3] Implement and export the four query helpers in `scripts/sync-sqlite.js` (`queryDaily(db, date)`, `queryMonthly(db, month)`, `queryYearly(db, year)`, `queryTotal(db)`) executing the exact SQL from `contracts/queries.md`. Run tests from T026 until green.
- [X] T030 [US3] Run the quickstart.md "Query check" manually: for a known date/month/year, compare `queryDaily`/`queryMonthly`/`queryYearly`/`queryTotal` output against values read directly from the corresponding `.js` files or the existing rendered diagram views (SC-005–SC-008).

**Checkpoint**: All three user stories are independently functional — sync, idempotency, and
precomputed summaries all verified against the real archive.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality gates across the whole feature.

- [X] T031 [P] Run `npx eslint scripts/sync-sqlite.js scripts/sync-sqlite.test.js` and fix all errors (project convention: zero ESLint errors required before finishing).
- [X] T032 [P] Add JSDoc to every exported function in `scripts/sync-sqlite.js` (`createSchema`, `parseRecordLine`, `hashContent`, `listSourceFiles`, `syncDay`, `runSync`, `recomputeSummaries`, `queryDaily`, `queryMonthly`, `queryYearly`, `queryTotal`) per project convention (co-located test file + JSDoc on every export).
- [X] T033 Run `node --test scripts/sync-sqlite.test.js` end-to-end and confirm all tests pass with zero real file I/O (only `:memory:` SQLite and inline/`mkdtempSync` fixtures).
- [X] T034 Run the full quickstart.md walkthrough once more end-to-end (full sync → idempotency check → delta check → query check) against the real archive as a final acceptance pass, confirming SC-001 through SC-008.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (schema, record decoding, hashing, and file discovery are shared by every story).
- **User Story 1 (Phase 3)**: Depends on Foundational only. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational; builds on US1's `syncDay`/`runSync` (extends the same functions with skip/refresh logic) — implement after US1, though the acceptance scenarios remain independently testable.
- **User Story 3 (Phase 5)**: Depends on Foundational and US1's `syncDay` transaction (hooks `recomputeSummaries` into it); per spec.md, US3 explicitly depends on US1+US2 being complete first.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only — no dependency on other stories.
- **User Story 2 (P1)**: Foundational + extends US1's sync functions in place (same file) — sequential by necessity (same functions), not parallelizable with US1.
- **User Story 3 (P2)**: Foundational + hooks into US1's `syncDay` transaction — implement after US1 (and conceptually after US2, per spec.md's stated priority ordering), though its query helpers (T029) have no code dependency on US2.

### Within Each User Story

- Tests written and failing before implementation (T012/T013 before T014-T017; T018-T020 before T021-T023; T025/T026 before T027-T029).
- Manual quickstart verification (T017, T024, T030) after automated tests pass.

### Parallel Opportunities

- T001 (`.gitignore`) is parallelizable with T002/T003 (different files).
- Within Foundational: T004/T006/T008/T010 (writing tests for different functions) can be drafted in parallel, but each must precede its own implementation task (T005/T007/T009/T011 respectively) — true concurrency is limited since all edits land in the same two files.
- Within each user story, the "Tests for User Story N" tasks marked `[P]` can be drafted in parallel with each other before implementation begins.
- T031/T032 in Polish can run in parallel (lint vs. JSDoc pass), though both touch the same file, so coordinate to avoid clobbering edits.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (schema, decoding, hashing, file discovery) — CRITICAL, blocks everything.
3. Complete Phase 3: User Story 1 — first-time full sync working end-to-end.
4. **STOP and VALIDATE**: Run quickstart.md's "First-time full sync" against the real archive; confirm the epoch-1 spot-check matches.
5. This is a usable MVP: the database exists and is populated, even before idempotent re-runs or summaries are added.

### Incremental Delivery

1. Setup + Foundational → shared infrastructure ready.
2. User Story 1 → full sync works → validate against real archive (MVP).
3. User Story 2 → re-runs become safe/idempotent → validate with the two-runs-in-a-row + new-day checks.
4. User Story 3 → summaries + query helpers land → validate against documented queries.
5. Polish → lint, JSDoc, full test suite, full quickstart re-run.

---

## Notes

- Nearly all tasks touch `scripts/sync-sqlite.js` and/or `scripts/sync-sqlite.test.js` — `[P]` is used sparingly and only where files genuinely don't overlap.
- Follow TDD per CLAUDE.md: write the test task for a function, watch it fail, then implement.
- Every exported function must be independently unit-testable with inline fixtures / `:memory:` SQLite — no real file I/O in `scripts/sync-sqlite.test.js` (manual quickstart runs against the real archive are separate, human-run verification steps, not part of the automated suite).
- Commit after each task or logical group, per repository convention.
