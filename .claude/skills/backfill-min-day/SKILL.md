---
name: backfill-min-day
description: Reconstruct a missing SolarLog daily minute file (min09MMDD.js) by scaling a neighbouring day's profile to a known daily total. Use when asked to "backfill", "rekonstruieren", or "rückerstellen" a missing min file.
---

# Backfill a missing SolarLog daily minute file

Reconstructs a `minYYMMDD.js` file by borrowing the intraday curve shape from a
donor day that is selected automatically — same calendar month, closest daily Wh
total within 2% tolerance.

## Inputs (ask the user if not provided)

| Parameter | Example | Source |
|-----------|---------|--------|
| **Target date** | `07.09.09` | the day to reconstruct |
| **Known daily total** | inv1=11764 Wh, inv2=23219 Wh | `days_hist_09.js` or `daysall.js` |

No `--template` flag is needed — the script finds the best donor automatically.

## Steps

### 1. Confirm sources

```bash
# Check target file is actually missing
ls min090907.js 2>/dev/null || echo "missing — OK to backfill"

# Find known totals in days_hist
grep "07.09.09" days_hist_09.js
```

### 2. Run the backfill script

```bash
node scripts/backfill-min-day.js \
  --target  07.09.09 \
  --inv1-wh 11764 \
  --inv2-wh 23219
```

The script will:
- Scan all `min*.js` files in the same calendar month across all available years
- Pick the donor whose daily Wh total is closest to the target (within 2%)
- Scale the donor's cumulative Wh curve proportionally, zeroing PDC/PAC/Volt
- Write the new `minYYMMDD.js` and print a summary

If no donor is within 2%, use `--tolerance 0.05` to widen to 5%.

### 3. Verify

```bash
# First line = end-of-day total (newest record)
head -1 min090907.js
# Should show inv1 cumulative ≈ 11764, inv2 cumulative ≈ 23219

# Last line = start of day (oldest record, Wh should be ~0)
tail -1 min090907.js

# Line count should match the donor
wc -l min090907.js
```

### 4. Stage the new file

```bash
git add min090907.js
git status
```

---

## Script reference: `scripts/backfill-min-day.js`

```
node scripts/backfill-min-day.js
  --target   DD.MM.YY    # date to create
  --inv1-wh  N           # known inv1 daily total (Wh)
  --inv2-wh  N           # known inv2 daily total (Wh)
  [--tolerance 0.02]     # max fractional Wh diff for donor selection (default 2%)
```

Output file format (descending time, 5-min intervals):
```
m[mi++]="DD.MM.YY HH:MM:SS|0;0;Wh1_cumul;0|0;0;0;Wh2_cumul;0;0"
```

PDC, PAC, and Volt are written as 0 — only Wh is reconstructed.
