# Tasks: Data Validation & Aggregation

**Input**: Design documents from `/specs/002-data-validation-aggregation/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/cli.md ✅, quickstart.md ✅

**Tests**: Included — FR-013 mandates TDD (tests written and failing before implementation).

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup

**Purpose**: Confirm ESLint config covers `scripts/` for the new files before any TDD work begins.

- [X] T001 Verify `eslint.config.js` includes `scripts/` glob and exports `eslint:recommended`; adjust if needed so `npx eslint scripts/` exits 0 on an empty file

**Checkpoint**: ESLint works on scripts — TDD can begin.

---

## Phase 2: User Story 1 — Detect Data Gaps in Daily Minute Files (Priority: P1) 🎯 MVP

**Goal**: `gap-detect.js` scans `min*.js` filenames, reports missing date ranges in human-readable and JSON form, supports `--since` filter.

**Independent Test**: `node scripts/gap-detect.js` produces a gap report listing all missing date ranges between earliest and latest known file; exits 0 when no gaps.

> **TDD rule**: Write T002 first, confirm tests fail, then implement T003. Wire CLI entry point last (after all exported function tests pass).

- [X] T002 [US1] Write `scripts/gap-detect.test.js` with inline fixture filename lists covering: no gaps → exit 0; single isolated gap → 1 range; multi-day consecutive gap → collapsed range; `--since` filter trims output; empty archive → "no files found" error
- [X] T003 [US1] Implement `scripts/gap-detect.js` — exported: `parseArchiveFilenames(filenames)`, `detectGaps(dates, since?)`, `formatRanges(gaps)`, `buildJsonReport(meta, gaps)`; then wire CLI entry point (`if (process.argv[1] === …)`) with `--since`, `--output json`, `--out-file` flags per `contracts/cli.md`; JSDoc on every export and file-level JSDoc block
- [X] T004 [US1] Lint `scripts/gap-detect.js` and `scripts/gap-detect.test.js` with `npx eslint`; fix all errors to zero

**Checkpoint**: `node scripts/gap-detect.js` works against live archive and `node --test scripts/gap-detect.test.js` is fully green.

---

## Phase 3: User Story 2 — Validate Plausibility of Daily Energy Totals (Priority: P1)

**Goal**: `validate-plausibility.js` cross-checks each `minYYMMDD.js` first-line Wh against `days_hist.js`, flags days exceeding `--tolerance` (default ±1 Wh), supports JSON output.

**Independent Test**: Run against a known-mismatched day; script correctly reports date, minute-derived total, `days_hist.js` total, and per-inverter deltas.

> **TDD rule**: Write T005 first, confirm tests fail, then implement T006.

- [X] T005 [US2] Write `scripts/validate-plausibility.test.js` with inline fixture strings covering: day within tolerance (not flagged); day exceeding tolerance (flagged with correct delta values); day with no `minYYMMDD.js` (skipped, not an error); JSON output mode produces correct structure per `data-model.md` `ValidationReport` JSON schema
- [X] T006 [US2] Implement `scripts/validate-plausibility.js` — exported: `parseMinFile(content)` → `{ wr1Wh, wr2Wh }` using field index 2 per `research.md` Decision 2; `parseDaysHist(content)` → `Map<dateKey, {wr1Wh, wr2Wh}>`; `compareDay(minTotal, histTotal, tolerance)` → mismatch record or null; then wire CLI entry with `--since`, `--tolerance`, `--output json`, `--out-file` per `contracts/cli.md`; JSDoc on every export and file-level JSDoc block
- [X] T007 [US2] Lint `scripts/validate-plausibility.js` and `scripts/validate-plausibility.test.js` with `npx eslint`; fix all errors to zero

**Checkpoint**: `node scripts/validate-plausibility.js` runs against live data and all unit tests pass.

---

## Phase 4: User Story 3 — Fill Gaps and Regenerate Aggregated Files (Priority: P2)

**Goal**: Three fill scripts (`fill-days-hist.js`, `fill-months.js`, `fill-years.js`) repair missing entries using the two-pass strategy (days-file first, min-file fallback) and `--dry-run`/`--force` guards.

**Independent Test**: Run `fill-days-hist.js YYYY-MM --dry-run` on a month where a day is missing in `days_hist.js` but present in `daysall.js`; script reports pass-1 hit sourced from `daysall.js` and prints the correctly formatted `da[dx++]=` line without writing.

> **TDD rule**: Write T008–T010 first (in parallel), confirm all tests fail, then implement T011–T013.

- [X] T008 [P] [US3] Write `scripts/fill-days-hist.test.js` with inline fixture content covering: pass-1 hit from `days.js` entry copies verbatim Wh and feed values; pass-2 fallback from `minYYMMDD.js` sets feed to 0; already-present entry (skip without `--force`); `--dry-run` returns computed value without writing; `--force` overwrites without prompt; unfillable date (no source) flagged; output line is byte-for-byte format-compatible (`da[dx++]="DD.MM.YY|WR1_Wh;WR1_feed|WR2_Wh;WR2_feed"`)
- [X] T009 [P] [US3] Write `scripts/fill-months.test.js` with inline fixture content covering: aggregation from two `minYYMMDD.js` fixtures sums WR1/WR2 correctly; `--dry-run` prints `mo[mx++]=` line without writing; no min files for month → exit 1; output format is `mo[mx++]="01.MM.YY|WR1_Wh|WR2_Wh"`
- [X] T010 [P] [US3] Write `scripts/fill-years.test.js` with inline fixture content covering: aggregation across two monthly fixtures sums correctly; `--dry-run` prints `ye[yx++]=` line without writing; no min files for year → exit 1; output format is `ye[yx++]="01.01.YY|WR1_Wh|WR2_Wh"`
- [X] T011 [US3] Implement `scripts/fill-days-hist.js` — exported: `parseDaysHistFiles(contents[])` → `Map<dateKey, record>`; `findInDaysFiles(date, daysContents[])` → `record | null` (pass 1); `aggregateFromMin(minContent)` → `{ wr1Wh, wr2Wh }` (pass 2); `formatDaysHistEntry(date, record)` → correctly formatted line; `insertEntryInOrder(existingLines, newLine)` (newest-first sort); then wire CLI entry with positional `YYYY-MM`, `--dry-run`, `--force`, `--tolerance` per `contracts/cli.md`; implement confirmation prompt via `node:readline` when not `--force` and not `--dry-run`; JSDoc on every export and file-level JSDoc block
- [X] T012 [P] [US3] Implement `scripts/fill-months.js` — exported: `collectMonthMinFiles(allFilenames, yyyymm)` → matching filenames; `aggregateMonth(minContents[])` → `{ wr1Wh, wr2Wh }`; `formatMonthEntry(yyyymm, totals)` → `mo[mx++]=` line; `upsertInMonths(existingContent, newLine)` → updated content; wire CLI entry with positional `YYYY-MM`, `--dry-run`, `--force`; JSDoc on every export and file-level JSDoc block
- [X] T013 [P] [US3] Implement `scripts/fill-years.js` — exported: `collectYearMinFiles(allFilenames, yyyy)` → matching filenames; `aggregateYear(minContents[])` → `{ wr1Wh, wr2Wh }`; `formatYearEntry(yyyy, totals)` → `ye[yx++]=` line; `upsertInYears(existingContent, newLine)` → updated content; wire CLI entry with positional `YYYY`, `--dry-run`, `--force`; JSDoc on every export and file-level JSDoc block
- [X] T014 [US3] Lint all fill scripts and test files with `npx eslint scripts/fill-days-hist.js scripts/fill-days-hist.test.js scripts/fill-months.js scripts/fill-months.test.js scripts/fill-years.js scripts/fill-years.test.js`; fix all errors to zero

**Checkpoint**: All three fill scripts run against live data with `--dry-run`; all unit tests pass.

---

## Phase 5: User Story 4 — Agentic Gap-Fill Skills (Priority: P2)

**Goal**: Three Claude Code skills wrap the fill scripts, scope to one month/year, and present a structured summary without requiring the user to know script flags.

**Independent Test**: Invoke `/backfill-days-hist 2026-06`; skill reports gaps found, sources used (pass 1 vs pass 2), and entries written.

- [X] T015 [US4] Write `.claude/skills/backfill-days-hist/SKILL.md` following the existing `backfill-min-day` skill pattern: accept single `YYYY-MM` argument, invoke `fill-days-hist.js YYYY-MM --dry-run` first to detect gaps, prompt user to confirm, then run without `--dry-run`; present structured summary (gaps found, pass-1 count, pass-2 count, unfillable count, entries written)
- [X] T016 [P] [US4] Write `.claude/skills/backfill-months/SKILL.md`: accept single `YYYY-MM` argument, invoke `fill-months.js YYYY-MM --dry-run` to preview, confirm with user, then write; present summary (min files read, WR1 total, WR2 total, entry written or already present)
- [X] T017 [P] [US4] Write `.claude/skills/backfill-years/SKILL.md`: accept single `YYYY` argument, invoke `fill-years.js YYYY --dry-run` to preview, confirm with user, then write; present summary (min files read, WR1 total, WR2 total, entry written or already present)

**Checkpoint**: All three skills can be invoked from a Claude Code session for a specific period and complete without requiring the user to look up script flags.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T018 Run all quickstart.md scenarios (1–6) against live archive data to validate end-to-end correctness; fix any discrepancies before marking done
- [X] T019 [P] Update `README.md` with a "Validation & Aggregation Scripts" section describing `gap-detect.js`, `validate-plausibility.js`, and the three fill scripts with example commands
- [X] T020 [P] Update `README.de.md` with the German equivalent of the README section added in T019; keep both files consistent
- [X] T021 [P] Update `docs/user-guide.md` and `docs/user-guide.de.md` with user-facing descriptions of the validation workflow (detect gaps → validate plausibility → fill → verify), following the quickstart.md scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US1 (Phase 2)**: Depends on Phase 1 (ESLint confirmed)
- **US2 (Phase 3)**: Depends on Phase 1 only — **can run in parallel with US1** (independent files)
- **US3 (Phase 4)**: Depends on Phase 1 only — can start in parallel with US1/US2, but logically benefits from US1/US2 being done first for context
- **US4 (Phase 5)**: Depends on US3 (Phase 4) fill scripts being complete and tested
- **Polish (Phase 6)**: Depends on all user story phases being complete

### User Story Dependencies

- **US1 (P1)**: Independent after Setup
- **US2 (P1)**: Independent after Setup — same `parseMinFile` logic but inline copy, no import dependency
- **US3 (P2)**: Independent after Setup; fill script tests (T008–T010) can run in parallel; fill-months and fill-years implementations (T012–T013) can run in parallel after their tests exist
- **US4 (P2)**: Depends on US3 scripts being complete (skills invoke them as subprocesses)

### Within Each User Story

1. Write test file(s) first — run and confirm they **fail** before implementing
2. Implement exported logic functions — run tests until green
3. Wire CLI entry point
4. Lint — zero errors required

---

## Parallel Opportunities

### US3 (Phase 4) — Maximum Parallelism

```
# All three test files can be written simultaneously:
T008: fill-days-hist.test.js
T009: fill-months.test.js        ← parallel with T008
T010: fill-years.test.js         ← parallel with T008

# After tests exist and fail:
T011: fill-days-hist.js          ← start first (most complex)
T012: fill-months.js             ← parallel with T011/T013
T013: fill-years.js              ← parallel with T011/T012
```

### US4 (Phase 5) — Skills are independent

```
T015: backfill-days-hist/SKILL.md
T016: backfill-months/SKILL.md   ← parallel with T015
T017: backfill-years/SKILL.md    ← parallel with T015
```

### Polish (Phase 6)

```
T019: README.md
T020: README.de.md               ← parallel with T019
T021: user-guide updates         ← parallel with T019
```

---

## Implementation Strategy

### MVP Scope (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: US1 (T002–T004)
3. **STOP and VALIDATE**: `node scripts/gap-detect.js` produces correct gap report on live archive
4. Plant owner now knows the scope of data loss — this is independently valuable

### Incremental Delivery

1. Phase 1 + Phase 2 (US1) → gap report working → **ship**
2. Phase 3 (US2) → plausibility report working → **ship**
3. Phase 4 (US3) → all fill scripts working → **ship**
4. Phase 5 (US4) → agentic skills working → **ship**
5. Phase 6 (Polish) → docs updated → **complete**

---

## Key Implementation Notes (from research.md)

- **Wh field**: `line.split('|').slice(1)` → each block → `block.split(';')[2]` (field index 2, 0-based); mark with `ponytail:` comment per research Decision 2
- **Daily total**: read **first line** of `minYYMMDD.js` (newest record = end-of-day cumulative)
- **days_hist.js ordering**: newest date first (descending) — new entries must be inserted in correct sort position
- **months.js / years.js ordering**: check existing file before inserting — do not assume ordering
- **2-digit year**: `YY ≥ 06` → `20YY`; no ambiguity until 2106
- **Feed-in default**: when sourcing from min file (pass 2), write `WR1_feed=0`, `WR2_feed=0`
- **Confirmation prompt**: use `node:readline`; proceed only on `'y'` or `'Y'`; skip when `--force` or `--dry-run`
