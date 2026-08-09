# Quickstart: Data Validation & Aggregation

Validates and repairs aggregated SolarLog data files. Run from the repo root.

---

## Prerequisites

- Node.js 22+
- All `min*.js` files in the repo root (the SolarLog FTP-push target)
- `days_hist.js`, `months.js`, `years.js`, `daysall.js` present in repo root

---

## Scenario 1 — Detect missing daily files

```bash
node scripts/gap-detect.js
```

Expected: human-readable gap report listing missing date ranges, or "No gaps detected."

Limit to recent history:

```bash
node scripts/gap-detect.js --since 2020-01-01
```

Machine-readable output:

```bash
node scripts/gap-detect.js --output json --out-file gap-report.json
cat gap-report.json
```

---

## Scenario 2 — Validate daily totals against days_hist.js

```bash
node scripts/validate-plausibility.js
```

Expected: table of mismatching days (or empty if all within ±1 Wh tolerance).

Override tolerance to flag anything off by more than 10 Wh:

```bash
node scripts/validate-plausibility.js --tolerance 10 --output json
```

---

## Scenario 3 — Fill gaps in days_hist.js for a specific month

Preview without writing:

```bash
node scripts/fill-days-hist.js 2026-06 --dry-run
```

Apply:

```bash
node scripts/fill-days-hist.js 2026-06
# → prompts for confirmation if days_hist.js already has entries for this month
node scripts/fill-days-hist.js 2026-06 --force
# → overwrites without prompt
```

Expected output: summary showing which dates were filled from `days*.js` (pass 1) vs `minYYMMDD.js` (pass 2), and any unfillable dates.

---

## Scenario 4 — Regenerate a monthly total in months.js

```bash
node scripts/fill-months.js 2026-06 --dry-run
node scripts/fill-months.js 2026-06 --force
```

Expected: script reads all `min2606*.js` files (30 files for June 2026), sums WR1 and WR2 daily totals, and writes/updates the `mo[mx++]="01.06.26|...|..."` line in `months.js`.

---

## Scenario 5 — Regenerate an annual total in years.js

```bash
node scripts/fill-years.js 2026 --dry-run
node scripts/fill-years.js 2026 --force
```

Expected: script reads all `min26*.js` files for 2026, sums WR1 and WR2 totals, and writes/updates the `ye[yx++]="01.01.26|...|..."` line in `years.js`.

---

## Scenario 6 — Agentic skills (Claude Code)

```
/backfill-days-hist 2026-06
/backfill-months 2026-06
/backfill-years 2026
```

Each skill: detects gaps for the period, invokes the corresponding fill script, and presents a structured summary without requiring the user to know script flags.

---

## Running tests

```bash
node --test scripts/gap-detect.test.js
node --test scripts/validate-plausibility.test.js
node --test scripts/fill-days-hist.test.js
node --test scripts/fill-months.test.js
node --test scripts/fill-years.test.js
```

All tests use inline fixture strings; no real data files are read.

## Linting

```bash
npx eslint scripts/gap-detect.js scripts/gap-detect.test.js
npx eslint scripts/validate-plausibility.js scripts/validate-plausibility.test.js
npx eslint scripts/fill-days-hist.js scripts/fill-days-hist.test.js
npx eslint scripts/fill-months.js scripts/fill-months.test.js
npx eslint scripts/fill-years.js scripts/fill-years.test.js
```

Zero errors required before tasks are considered done.
