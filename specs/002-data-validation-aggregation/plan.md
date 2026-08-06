# Implementation Plan: Data Validation & Aggregation

**Branch**: `002-data-validation-aggregation` | **Date**: 2026-07-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-data-validation-aggregation/spec.md`

---

## Summary

Add four ESM validation/aggregation scripts (`gap-detect.js`, `validate-plausibility.js`, `fill-days-hist.js`, `fill-months.js`, `fill-years.js`) plus three agentic Claude Code skills (`backfill-days-hist`, `backfill-months`, `backfill-years`) that detect and repair data mismatches in the SolarLog archive. All scripts run locally in Node.js 22+; no UI changes; no backend introduced.

---

## Technical Context

**Language/Version**: Node.js 22+, ESM JavaScript (ES2022+)

**Primary Dependencies**: `node:fs`, `node:path`, `node:readline`, `node:util` (stdlib only — no new packages)

**Storage**: Flat `.js` data files in repo root (read and selectively written)

**Testing**: `node:test` with inline fixture strings; no I/O in unit tests

**Target Platform**: Linux/WSL2 developer workstation (local CLI tools)

**Project Type**: CLI scripts + agentic skills

**Performance Goals**: Gap-detection over 7,000+ files in < 10 seconds (SC-001)

**Constraints**: Zero ESLint errors (FR-014); TDD — tests before implementation (FR-013)

**Scale/Scope**: 7,152 daily min files (2006-11-03 – 2026-07-30), growing ~365/year

---

## Constitution Check

| Principle                                 | Applicability | How Satisfied                                                                                                                                                                       |
| ----------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Static-File Data Model is Sacred       | ✅ Core       | Scripts never modify raw `minYYMMDD.js` files. Output files (`days_hist.js`, `months.js`, `years.js`) are derived aggregates, not device-push files. `daysall.js` is never written. |
| II. Zero Historical Data Loss             | ✅ Core       | Validation detects gaps; fill scripts require explicit `--force` or confirmation. Dry-run available.                                                                                |
| III. No Backend Introduction              | ✅ Core       | Pure Node.js CLI scripts. No server, database, or build pipeline.                                                                                                                   |
| IV. Responsive-First Layout               | N/A           | No UI changes.                                                                                                                                                                      |
| V. Modern Charting                        | N/A           | No chart changes.                                                                                                                                                                   |
| VI. Preserve All Five Visualization Modes | ✅ Core       | Repaired aggregation files feed the existing viewer unchanged; no viewer code modified.                                                                                             |

**Gate result**: All applicable principles satisfied. No violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/002-data-validation-aggregation/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── cli.md           ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code

```text
scripts/
├── gap-detect.js              # US1: detect missing min*.js files
├── gap-detect.test.js
├── validate-plausibility.js   # US2: cross-check min totals vs days_hist.js
├── validate-plausibility.test.js
├── fill-days-hist.js          # US3: fill gaps in days_hist.js (two-pass)
├── fill-days-hist.test.js
├── fill-months.js             # US3: regenerate months.js entry for one month
├── fill-months.test.js
├── fill-years.js              # US3: regenerate years.js entry for one year
└── fill-years.test.js

.claude/skills/
├── backfill-days-hist/SKILL.md   # US4: agentic gap-fill for days_hist.js
├── backfill-months/SKILL.md      # US4: agentic monthly aggregation
└── backfill-years/SKILL.md       # US4: agentic annual aggregation
```

---

## Implementation Order

Scripts are independent; implement in dependency order:

1. **Shared parser** (inline in each script, not a separate module) — `parseMinFile(content)` returns `{ date, wr1Wh, wr2Wh }`. Reuse the same logic across all scripts via copy or a minimal shared util.
2. **`gap-detect.js`** — reads filenames only, no parsing. Fastest to implement and test; unblocks US1.
3. **`validate-plausibility.js`** — needs `parseMinFile` + `parseDaysHist`. Implements US2.
4. **`fill-days-hist.js`** — needs `parseMinFile` + `parseDaysHist` + `parseDaysAll`. Implements US3 (days).
5. **`fill-months.js`** — needs `parseMinFile`. Implements US3 (months).
6. **`fill-years.js`** — needs `parseMinFile`. Implements US3 (years).
7. **Agentic skills** — thin SKILL.md wrappers that invoke the scripts. Implements US4.

**TDD rule**: Write the `*.test.js` file first, confirm failures, then implement.

---

## Key Implementation Notes

### Min file Wh extraction

The Wh cumulative counter is field index 2 (0-based) within each `|`-delimited inverter block:

```js
// ponytail: field index 2 assumed for Wh; update if firmware changes layout
const blocks = line.split('|').slice(1); // skip timestamp block
const wr1Wh = Number.parseInt(blocks[0].split(';')[2], 10);
const wr2Wh = Number.parseInt(blocks[1].split(';')[2], 10);
```

Read the **first line** (newest record) — it holds the end-of-day cumulative total.

### Two-pass gap-fill for days_hist.js

```
Pass 1: search all days*.js files for a record matching the missing date
         → copy WR1_Wh, WR2_Wh, WR1_feed, WR2_feed verbatim
Pass 2 (only if pass 1 yields nothing): read minYYMMDD.js first-line Wh
         → write WR1_Wh, WR2_Wh from min file; WR1_feed=0, WR2_feed=0
```

### Output format (must be byte-for-byte compatible)

```
da[dx++]="DD.MM.YY|WR1_Wh;WR1_feed|WR2_Wh;WR2_feed"   ← days_hist.js
mo[mx++]="01.MM.YY|WR1_Wh|WR2_Wh"                      ← months.js
ye[yx++]="01.01.YY|WR1_Wh|WR2_Wh"                      ← years.js
```

New entries are inserted in the correct sort position (newest first for `days_hist.js`; check months and years ordering in existing files before inserting).

### Confirmation prompt

When not `--force` and not `--dry-run`, and existing entries would be overwritten:

```js
import { createInterface } from 'node:readline';
// prompt "Overwrite N entries in days_hist.js? [y/N] "
// proceed only on 'y' or 'Y'
```
