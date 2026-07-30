# Skill: backfill-months

Regenerate or update a month entry in `months.js` from the corresponding daily min files.

## Usage

```
/backfill-months YYYY-MM
```

## What this skill does

1. Run `node scripts/fill-months.js YYYY-MM --dry-run` from the repo root and show the user the preview output.
2. Ask the user: "Apply these changes? [y/N]"
3. If yes, run `node scripts/fill-months.js YYYY-MM --force`.
4. Present the summary output to the user.

## How it works

`fill-months.js` reads all `minYYMM*.js` files for the given month, sums the WR1 and WR2 Wh totals from the first line of each file (end-of-day cumulative counter), and writes or replaces the `mo[mx++]="01.MM.YY|WR1|WR2"` entry in `months.js`.

## Exit codes

- `0` — success
- `1` — no min files found for the given month
- `2` — argument error

## Notes

- Must be run from the repo root.
- Never reads `days_hist.js`; uses only min files as the source of truth.
- Never modifies raw `min*.js` files.
