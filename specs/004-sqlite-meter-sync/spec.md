# Feature Specification: SQLite Meter Data Sync

**Feature Branch**: `004-sqlite-meter-sync`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description: "I would like to store all daily meter data from all min*.js files inside a local sqlite database. A migration script should exist to sync the min*.js files to the database. As every day a new minYYMMDD.js gets added, the sync script must be able to sync the delta on its run (idempotency must be possible), already available days should not be synched again. The database must allow all available data fields like described in the docs/data-format-daily.md ."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Initial full sync of historical data (Priority: P1)

A maintainer of the SolarLog viewer runs the sync script for the first time on a system that has years of `min*.js` files (from 2006 to present) but no database yet. The script reads every daily file, decodes the correct block format for the file's date (one of the three known epochs), and stores every 5-minute record's fields in a local database.

**Why this priority**: Without this, there is no database at all — this is the foundational capability every other story depends on.

**Independent Test**: Can be fully tested by pointing the sync script at a directory containing sample `min*.js` files spanning all three epochs and verifying the resulting database contains one row per record with correctly mapped fields, matching the values documented in `docs/data-format-daily.md`.

**Acceptance Scenarios**:

1. **Given** a database that does not yet exist and a folder of `min*.js` files spanning 2006–present, **When** the sync script is run, **Then** the database is created and contains a record for every 5-minute timestamp present in the files, with fields correctly assigned per the file's epoch (4|4, 4|6, or 6|4 layout).
2. **Given** a `min061103.js` (epoch 1) file, **When** it is synced, **Then** the stored record for "03.11.06 15:00:00" matches the concrete example in the format doc (block 1 PAC=1314, PDC_str1=1399, yield=6653, UDC_str1=406; block 2 PAC=2529, PDC_str1=1346, PDC_str2=1339, yield=13059, no UDC values for block 2).
3. **Given** a `min250701.js` (epoch 3) file, **When** it is synced, **Then** the stored record correctly attributes block 1 to the SB 4200 TL (2-string) inverter and block 2 to the SB 2100 TL (1-string) inverter, per the swapped column order.

---

### User Story 2 - Idempotent delta sync on subsequent runs (Priority: P1)

Every day, a new `minYYMMDD.js` file is added (or the current day's `min_cur.js` is updated) as new readings accumulate. The maintainer re-runs the same sync script daily (e.g., via a cron job or manually). The script must only process files/days not already fully stored, without re-inserting or duplicating existing data, and without erroring out.

**Why this priority**: This is the core ongoing value of the feature — a one-time import is not sufficient since new data arrives daily; this is equally critical as the initial import.

**Independent Test**: Can be fully tested by running the sync script twice in a row against the same unchanged set of files and verifying the database record count and contents are identical after both runs (no duplicates, no errors), then adding one new day's file and verifying only that day's records are added on the next run.

**Acceptance Scenarios**:

1. **Given** a database already fully synced with all existing `min*.js` files, **When** the sync script is run again with no new files added, **Then** no new rows are inserted and no existing rows are modified.
2. **Given** a database synced through `min260730.js`, **When** a new `min260731.js` file appears and the sync script is run, **Then** only the records from `min260731.js` are inserted, leaving all prior days untouched.
3. **Given** the current day's file (`min_cur.js`) whose contents grow throughout the day, **When** the sync script is run multiple times during that day, **Then** the script re-evaluates and updates only that day's (in-progress) records rather than treating the whole file as immutable, without duplicating rows already stored for that day.

---

### User Story 3 - Powering the diagram views (Priority: P2)

The existing viewer shows four zoom levels of charts — daily, monthly, yearly, and total (all-years) — each needing a different granularity of data. A developer wants to query the database for exactly the values each view needs, without recomputing them from raw 5-minute records every time.

**Why this priority**: This is the payoff of having structured storage, but it depends on stories 1 and 2 being complete first; querying is a consumer of the sync output rather than the sync mechanism itself.

**Independent Test**: Can be fully tested by running the queries each view depends on against a populated database and verifying the returned values match those computed directly from the source files for the same period.

**Acceptance Scenarios**:

1. **Given** a populated database, **When** the daily diagram view queries a specific date, **Then** it receives every 5-minute record for that date with inverter 1 AC power, inverter 2 AC power, and the sum of both, sufficient to plot the daily AC power graph.
2. **Given** a populated database, **When** the month diagram view queries a specific month, **Then** it receives, per day in that month, inverter 1 yield, inverter 2 yield, and the combined total yield for that day.
3. **Given** a populated database, **When** the year diagram view queries a specific year, **Then** it receives, per month in that year, the combined total yield for that month (not per-inverter, not per-day).
4. **Given** a populated database, **When** the total (all-years) diagram view is queried, **Then** it receives, per year, the cumulative combined total yield for that year.

---

### Edge Cases

- What happens when a `min*.js` file is malformed or contains a record that doesn't parse (wrong field count for its epoch)? The sync should skip and log the offending record/file rather than aborting the entire run.
- What happens when a file for a date already exists in the database is re-synced and its content has changed (e.g., a corrected/backfilled file replaces a previous reconstruction)? The sync must detect the change and update the stored records for that day rather than skipping it as already-synced.
- How does the system handle the transition dates between epochs (2007-03-28 and 2013-01-04) where block layout changes? The sync must pick the correct decoding rule based on the file's date, independent of adjacent files.
- What happens when the sync script is interrupted mid-run (e.g., process killed)? On the next run, it must resume without leaving the database in a state with partial/incomplete data for a given day.
- What happens when two inverters' fields differ in count between blocks (4 vs 6 fields) within the same record? The database schema must accommodate both without requiring null-padding assumptions that lose meaning.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a migration/sync script that reads all `min*.js` files (historical daily files and the current in-progress file) from the existing data directory and stores their decoded records in a local SQLite database.
- **FR-002**: The system MUST correctly decode each record according to the epoch-specific block layout documented in `docs/data-format-daily.md` (4|4 fields for 2006-11-03 to 2007-03-27, 4|6 fields for 2007-03-28 to 2012-12-04, 6|4 fields for 2013-01-04 to present), selecting the decoding rule based on the record's date.
- **FR-003**: The system MUST store every documented field for each inverter block: AC output power (PAC), per-string DC input power (PDC_str1, PDC_str2 where present), cumulative daily yield (daily_yield_Wh), and per-string DC voltage (UDC_str1, UDC_str2 where present), preserving which physical inverter (SB 4200 TL vs SB 2100 TL) each block belongs to regardless of column order in the source file.
- **FR-004**: The system MUST associate each stored record with its full timestamp (date and time) parsed from the record's `DD.MM.YY HH:MM:SS` prefix.
- **FR-005**: The sync script MUST be safely re-runnable (idempotent): running it multiple times against the same input files MUST NOT create duplicate records or alter already-correct stored data.
- **FR-006**: The sync script MUST detect which days are already fully synced and skip re-parsing those days' files on subsequent runs, processing only new or changed days (delta sync).
- **FR-007**: The sync script MUST detect when a previously-synced day's file content has changed (e.g., a backfilled/corrected file) and refresh that day's stored records rather than permanently skipping it.
- **FR-008**: The sync script MUST treat the current day's file (`min_cur.js` or equivalent in-progress file) as mutable and re-sync it on every run until the day is complete, rather than marking it as permanently synced.
- **FR-009**: The system MUST continue processing remaining files/records when it encounters a malformed record or file, and MUST report which records/files were skipped.
- **FR-010**: The database schema MUST support querying all stored records for a given date or date range, with each inverter's fields distinguishable from the other inverter's fields in the same record.
- **FR-011**: The sync script MUST be runnable as a standalone command (e.g., invoked manually or via a scheduled job) without requiring the browser-based viewer to be running.
- **FR-012**: The system MUST make the AC output power of inverter 1, inverter 2, and their sum available per 5-minute record, to support the daily diagram view.
- **FR-013**: The system MUST make the daily yield of inverter 1, inverter 2, and their combined total available per calendar day, to support the month diagram view.
- **FR-014**: The system MUST make the combined total yield available per calendar month, to support the year diagram view.
- **FR-015**: The system MUST make the combined total yield available per calendar year, to support the total (all-years) diagram view.
- **FR-016**: Values required at monthly and yearly granularity (FR-014, FR-015) MUST be derivable from the stored per-record/per-day data without loss of accuracy, whether computed on demand or maintained as precomputed aggregates.

### Key Entities

- **Daily Reading**: A single 5-minute-interval measurement, identified by its timestamp, containing readings for both inverter blocks present in that record. Distinct source files may use different physical inverters per block position depending on epoch, but the stored representation must consistently identify readings by inverter (SB 4200 TL vs SB 2100 TL), not by raw source-file column position.
- **Inverter Reading**: The set of fields belonging to one inverter within a Daily Reading — AC power, one or two DC string powers, cumulative daily yield, and zero, one, or two DC string voltages, depending on the epoch and inverter type.
- **Sync State**: Tracking of which source days have been fully and correctly synced, used to determine which files can be skipped versus re-processed on the next run. Must distinguish "complete, immutable historical day" from "current, still-changing day."
- **Daily Yield Summary**: Per calendar day, the final (end-of-day) cumulative yield for inverter 1, inverter 2, and their combined total — the figures the month diagram view plots per day.
- **Monthly Yield Summary**: Per calendar month, the combined total yield across both inverters — the figure the year diagram view plots per month.
- **Yearly Yield Summary**: Per calendar year, the combined total yield across both inverters — the figure the total diagram view plots per year.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A first-time sync of the entire historical archive (2006–present) completes and results in a database record count matching the total number of 5-minute-interval entries across all source files, with zero data-mapping errors when spot-checked against the documented examples.
- **SC-002**: Running the sync script twice in immediate succession with no new source data produces zero additional rows and zero modified rows on the second run.
- **SC-003**: After a new day's file is added, a subsequent sync run completes and makes that day's data queryable without re-processing any prior day's files (verified by sync duration scaling with new data volume, not total archive size).
- **SC-004**: A user can query the database for any historical date and receive readings for both inverters with all documented fields (PAC, PDC per string, daily yield, UDC per string) correctly populated or correctly absent (for fields that epoch doesn't include).
- **SC-005**: For any given day, the queried inverter 1 AC power, inverter 2 AC power, and their sum at each 5-minute mark reproduce the daily diagram view's existing graph without visible deviation.
- **SC-006**: For any given month, the queried per-day inverter 1 yield, inverter 2 yield, and combined total yield reproduce the month diagram view's existing graph without visible deviation.
- **SC-007**: For any given year, the queried per-month combined total yield reproduces the year diagram view's existing graph without visible deviation.
- **SC-008**: For the full archive, the queried per-year combined total yield reproduces the total diagram view's existing graph without visible deviation.

## Assumptions

- The SQLite database is local to the machine running the sync script (no shared/networked database server required).
- The sync script is one of the project's existing ESM `scripts/*.js` helper scripts, following the same conventions (co-located test file, exported logic functions) as other scripts in `scripts/` — per project-level engineering standards, not specified further here.
- "Already available days" means calendar days for which a complete, non-current source file (not `min_cur.js`) has been fully parsed and stored; the current day's in-progress file is always re-checked.
- Malformed records are rare (data corruption/edge cases already partially handled by existing gap-detection/backfill scripts) and should be logged and skipped rather than halting the whole sync.
- The database is additive/local storage for the existing viewer's data; this feature does not require changing how the browser-based viewer currently reads `min*.js` files directly, only adding the sync/storage capability.
