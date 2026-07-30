# Skill: backfill-days-hist

Fill missing day entries in `days_hist.js` for a given calendar month.

## Usage

```
/backfill-days-hist YYYY-MM
```

## What this skill does

1. Run `node scripts/fill-days-hist.js YYYY-MM --dry-run` from the repo root and show the user the preview output.
2. Ask the user: "Apply these changes? [y/N]"
3. If yes, run `node scripts/fill-days-hist.js YYYY-MM --force`.
4. Present the summary output to the user.

## How it works

`fill-days-hist.js` iterates every calendar day in the given month:
- Days already in `days_hist.js` are skipped.
- **Pass 1**: searches all `days*.js` files for a matching entry; copies Wh and feed values verbatim.
- **Pass 2**: if no days file has the date, reads the first line of the corresponding `minYYMMDD.js` file for Wh totals (feed set to 0).
- Unfillable dates (no days file entry, no min file) are reported but do not abort.

New entries are inserted newest-first.

## Exit codes

- `0` — all days filled or already present
- `1` — one or more unfillable dates (reported, not written)
- `2` — argument error

## Notes

- Must be run from the repo root (where `days_hist.js` and `min*.js` files live).
- Never modifies raw `min*.js` files.
