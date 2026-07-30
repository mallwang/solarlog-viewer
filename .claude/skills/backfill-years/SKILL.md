# Skill: backfill-years

Regenerate or update a year entry in `years.js` from the corresponding daily min files.

## Usage

```
/backfill-years YYYY
```

## What this skill does

1. Run `node scripts/fill-years.js YYYY --dry-run` from the repo root and show the user the preview output.
2. Ask the user: "Apply these changes? [y/N]"
3. If yes, run `node scripts/fill-years.js YYYY --force`.
4. Present the summary output to the user.

## How it works

`fill-years.js` reads all `minYY*.js` files for the given year, sums the WR1 and WR2 Wh totals from the first line of each file (end-of-day cumulative counter), and writes or replaces the `ye[yx++]="01.01.YY|WR1|WR2"` entry in `years.js`.

## Exit codes

- `0` — success
- `1` — no min files found for the given year
- `2` — argument error

## Notes

- Must be run from the repo root.
- Never reads `days_hist.js` or `months.js`; uses only min files as the source of truth.
- Never modifies raw `min*.js` files.
