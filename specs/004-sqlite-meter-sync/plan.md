# Implementation Plan: SQLite Meter Data Sync

**Branch**: `004-sqlite-meter-sync` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-sqlite-meter-sync/spec.md`

## Summary

Add a standalone, idempotent Node sync script (`scripts/sync-sqlite.js`) that reads every
`min*.js` file (historical days plus the in-progress `min_cur.js`) and copies their decoded
5-minute records into a local SQLite database, using the existing epoch-detection logic in
`scripts/utils.js` to select the correct block layout (4|4, 4|6, or 6|4) per record's date.
Sync state is tracked per calendar day via a content hash so re-runs skip unchanged historical
days, always re-process the current day, and detect/refresh backfilled or corrected files.
The database additionally exposes precomputed daily/monthly/yearly yield summaries so the
four diagram views (daily, monthly, yearly, total) can query pre-aggregated values instead of
recomputing them from raw records. This is a local, additive cache — the browser-based viewer
continues to read `.js` files directly and is unaffected by this feature (per Constitution v2.0.0,
Principle I & III narrow exceptions).

## Technical Context

**Language/Version**: Node.js (ESM), matching the project's existing `scripts/*.js` — developed
against Node 24.16.0, which includes the built-in `node:sqlite` module.

**Primary Dependencies**: `node:sqlite` (Node's built-in SQLite bindings, no new npm dependency
required — avoids adding a native-module dependency like `better-sqlite3` and keeps the project's
dependency footprint minimal per Technical Standards). Reuses `scripts/utils.js` for epoch
detection (`epochFromDate`, `epochFromFieldCounts`).

**Storage**: SQLite, single local file (e.g. `data/solarlog.sqlite3`, gitignored — derived/
rebuildable cache per Constitution Principle I exception).

**Testing**: `node --test scripts/sync-sqlite.test.js` (node:test, per project convention);
inline fixture strings for `min*.js` content, no real file I/O in unit tests. An integration-style
test may use `node:sqlite`'s in-memory mode (`:memory:`) to verify idempotency and delta-sync
behavior end-to-end without touching the real data directory.

**Target Platform**: Linux/WSL2 developer machine (and any Node 24+ host) — CLI script, not
browser code; explicitly outside the browser bundle per Constitution Principle III.

**Project Type**: Single project — this feature adds one CLI helper script plus its test file
to the existing `scripts/` directory; no new top-level project structure.

**Performance Goals**: Initial full sync of ~7,150 historical files (~2M five-minute records,
2006–present) MUST complete in a reasonable single run (target: a few minutes, not hours) on a
developer machine. Delta syncs (1 new day) MUST complete in well under a second of file
processing, scaling with new data volume only (SC-003).

**Constraints**: Idempotent and interruption-safe (FR-005, FR-008, edge case: killed mid-run) —
each day's records MUST be written transactionally so a crash never leaves partial data for a
day. Must not modify, delete, or move any source `.js` file (Constitution Principle I).

**Scale/Scope**: ~7,150 daily files today, growing by 1 file/day; ~288 records/day/file culminating
in roughly 2M total 5-minute records; 3 known epochs with 2 transition dates (2007-03-28,
2013-01-04).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution version in effect: **2.0.0** (amended 2026-07-31 specifically to accommodate this
feature — see Sync Impact Report in `.specify/memory/constitution.md`).

| Principle | Applies? | How satisfied |
|---|---|---|
| I. Static-File Data Model is Sacred | Yes | Sync script only reads `min*.js` files; never writes/moves/deletes them. Uses the Principle I narrow exception (offline sync script → local SQLite cache) explicitly added for this feature. |
| II. Zero Historical Data Loss | Yes | Full-archive sync (US1) covers all files 2006–present across all 3 epochs; SC-001 requires record count parity with source files; malformed records are logged/skipped, not silently dropped, and the source files remain the durable record regardless of sync outcome. |
| III. No Backend Introduction | Yes | Uses the Principle III narrow exception: SQLite file with no long-running process, not a deploy dependency of the static site, not consumed by the browser viewer. The CLI script is standalone, matching FR-011. |
| IV. Responsive-First Layout | No | No UI change in this feature. |
| V. Modern Charting — No Custom Pixel Math | No | No chart-rendering change in this feature; US3 only prepares queries a future chart-consuming change could use. |
| VI. Preserve All Five Visualization Modes | No | No viewer change in this feature; existing modes keep reading `.js` files unchanged. |

No violations requiring Complexity Tracking. Gate: **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/004-sqlite-meter-sync/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
scripts/
├── sync-sqlite.js       # New: sync min*.js -> SQLite (CLI entry + exported logic functions)
├── sync-sqlite.test.js  # New: node:test unit + integration tests (in-memory SQLite)
├── utils.js             # Existing: epoch detection, reused by sync-sqlite.js
└── utils.test.js        # Existing, unchanged

docs/
└── data-format-daily.md # Existing: authoritative epoch/field-layout reference (read-only input)

data/                     # New: gitignored output directory for the local SQLite file
└── solarlog.sqlite3      # Generated by sync-sqlite.js, not committed
```

**Structure Decision**: Single project (Option 1). This feature is one additional helper script
(plus its test file) inside the existing `scripts/` directory, following the same conventions as
`scripts/backfill-min-day.js`, `scripts/gap-detect.js`, etc. No new top-level directories beyond a
gitignored `data/` output folder for the SQLite file itself. No `src/`, `frontend/`, or `backend/`
split is needed — the browser viewer under `src/`/root HTML is untouched by this feature.

## Complexity Tracking

*No violations — table intentionally omitted.*
