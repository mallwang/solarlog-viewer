# Developer Guide: Validation & Aggregation Scripts

This guide is for developers running the Node.js scripts in `scripts/` to detect data gaps,
validate totals, and repair aggregated files. It assumes familiarity with the repo layout and a
terminal — if you're looking for how to use the deployed dashboard instead, see the
[User Guide](user-guide.md).

## Prerequisites

- Node.js 22+
- Run all commands from the **repo root** (where `days_hist.js`, `months.js`, `years.js`, and
  `min*.js` files live)

> **⚠️ Currently unusable without manual setup.** Every script below reads `web/data/`/`web/hist/`
> straight off the filesystem, but those directories were deleted from the repo (see the
> [README's Dev server section](../README.md#getting-started--dev-server)) and
> `scripts/ftp-sync.js`/`sync-ftp` no longer fetch them. To run any of these, first manually
> repopulate the directories you need — e.g. `tar -xzf archive/web-hist.tar.gz -C web` for
> `web/hist/`, and a manual FTP/SCP copy of the device's `data/` folder to `web/data/` for the
> live side — then delete them again afterward.

## Step 1 — Detect gaps in archive data

`gap-detect.js` can check two data sources:

| Source              | Flag                 | What it checks                                      |
| ------------------- | -------------------- | --------------------------------------------------- |
| Min files (default) | _(none)_             | Scans `min*.js` filenames for missing calendar days |
| `days_hist.js`      | `--source days_hist` | Missing entries in the aggregated history file      |

Both modes produce the same output format: a human-readable list of missing date ranges, or
"No gaps detected." The `--since`, `--output json`, and `--out-file` flags work with both sources.

```bash
node scripts/gap-detect.js
node scripts/gap-detect.js --since 2020-01-01
node scripts/gap-detect.js --output json --out-file gap-report.json

node scripts/gap-detect.js --source days_hist
node scripts/gap-detect.js --source days_hist --since 2020-01-01
```

## Step 2 — Validate daily totals against days_hist.js

```bash
node scripts/validate-plausibility.js
```

Compares each `minYYMMDD.js` first-line Wh total against the matching entry in `days_hist.js`.
Days that differ by more than ±1 Wh (default tolerance) are flagged with per-inverter deltas.

| Need               | Command                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| Override tolerance | `node scripts/validate-plausibility.js --tolerance 10`                           |
| JSON output        | `node scripts/validate-plausibility.js --output json --out-file validation.json` |

## Step 3 — Fill gaps in days_hist.js

For a month where entries are missing in `days_hist.js`:

| Need                    | Command                                            |
| ----------------------- | -------------------------------------------------- |
| Preview without writing | `node scripts/fill-days-hist.js 2026-06 --dry-run` |
| Apply (confirms first)  | `node scripts/fill-days-hist.js 2026-06`           |
| Apply without prompt    | `node scripts/fill-days-hist.js 2026-06 --force`   |

The script uses a two-pass strategy per missing day:

- **Pass 1**: looks for the date in any `days*.js` file and copies Wh and feed values verbatim
- **Pass 2**: if not found in days files, reads the first line of `minYYMMDD.js` for Wh totals
  (feed set to 0)

Dates with no source in either pass are reported as unfillable.

## Step 4 — Regenerate monthly totals

```bash
node scripts/fill-months.js 2026-06 --dry-run
node scripts/fill-months.js 2026-06 --force
```

Reads all `min2606*.js` files, sums WR1 and WR2 Wh totals, and writes or updates the `mo[mx++]=`
entry for that month in `months.js`.

## Step 5 — Regenerate annual totals

```bash
node scripts/fill-years.js 2026 --dry-run
node scripts/fill-years.js 2026 --force
```

Reads all `min26*.js` files for the year and writes or updates the `ye[yx++]=` entry in
`years.js`.

## Agentic skills (Claude Code)

If you use Claude Code, the following skills wrap the fill scripts with a dry-run → confirm →
apply flow:

```
/backfill-days-hist 2026-06
/backfill-months 2026-06
/backfill-years 2026
```

Each skill shows a preview first, asks for confirmation, then applies the change and reports a
summary.

## Typical workflow

```
gap-detect → validate-plausibility → fill-days-hist → fill-months → fill-years
```

Run in order: detect what is missing, validate what is present, then fill from the bottom up.
</content>
</invoke>
