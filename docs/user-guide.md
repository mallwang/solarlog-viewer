# User Guide: Validation & Aggregation Workflow

This guide describes how to detect data gaps, validate totals, and repair aggregated files using the scripts in `scripts/`.

## Prerequisites

- Node.js 22+
- Run all commands from the **repo root** (where `days_hist.js`, `months.js`, `years.js`, and `min*.js` files live)

---

## Step 1 — Detect missing daily files

```bash
node scripts/gap-detect.js
```

Scans all `min*.js` filenames and reports which calendar days have no file. Output is a human-readable list of missing date ranges, or "No gaps detected."

Limit to recent history:
```bash
node scripts/gap-detect.js --since 2020-01-01
```

Export as JSON:
```bash
node scripts/gap-detect.js --output json --out-file gap-report.json
```

---

## Step 2 — Validate daily totals against days_hist.js

```bash
node scripts/validate-plausibility.js
```

Compares each `minYYMMDD.js` first-line Wh total against the matching entry in `days_hist.js`. Days that differ by more than ±1 Wh (default tolerance) are flagged with per-inverter deltas.

Override the tolerance:
```bash
node scripts/validate-plausibility.js --tolerance 10
```

JSON output:
```bash
node scripts/validate-plausibility.js --output json --out-file validation.json
```

---

## Step 3 — Fill gaps in days_hist.js

For a month where entries are missing in `days_hist.js`:

Preview without writing:
```bash
node scripts/fill-days-hist.js 2026-06 --dry-run
```

Apply (confirms before writing):
```bash
node scripts/fill-days-hist.js 2026-06
```

Apply without prompt:
```bash
node scripts/fill-days-hist.js 2026-06 --force
```

The script uses a two-pass strategy per missing day:
- **Pass 1**: looks for the date in any `days*.js` file and copies Wh and feed values verbatim
- **Pass 2**: if not found in days files, reads the first line of `minYYMMDD.js` for Wh totals (feed set to 0)

Dates with no source in either pass are reported as unfillable.

---

## Step 4 — Regenerate monthly totals

```bash
node scripts/fill-months.js 2026-06 --dry-run
node scripts/fill-months.js 2026-06 --force
```

Reads all `min2606*.js` files, sums WR1 and WR2 Wh totals, and writes or updates the `mo[mx++]=` entry for that month in `months.js`.

---

## Step 5 — Regenerate annual totals

```bash
node scripts/fill-years.js 2026 --dry-run
node scripts/fill-years.js 2026 --force
```

Reads all `min26*.js` files for the year and writes or updates the `ye[yx++]=` entry in `years.js`.

---

## Agentic skills (Claude Code)

If you use Claude Code, the following skills wrap the fill scripts with a dry-run → confirm → apply flow:

```
/backfill-days-hist 2026-06
/backfill-months 2026-06
/backfill-years 2026
```

Each skill shows a preview first, asks for confirmation, then applies the change and reports a summary.

---

## Typical workflow

```
gap-detect → validate-plausibility → fill-days-hist → fill-months → fill-years
```

Run in order: detect what is missing, validate what is present, then fill from the bottom up.
