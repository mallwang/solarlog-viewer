# Task: Backfill 38 zero-byte min-files

## Background

The day view (bar chart, `visu.html` mode 0) loads a per-day minute file named
`min{YY}{MM}{DD}.js` and draws bars from its `m[]` array. Separately, the month
view and daily statistics read daily totals from `days_hist.js` (`da[]` array),
which is independent of the minute file.

Investigated case: 03.01.2013 shows an empty bar chart in the day view, but the
month diagram and daily statistics correctly show ~5kWh
(`days_hist.js` line ~4957: `da[dx++]="03.01.13|3305;0|1693;0"` → 4998 Wh).

Root cause: `min130103.js` exists but is **0 bytes** — no minute-level data was
ever recorded/backfilled for that day, so the day-view chart has nothing to
plot, even though the daily aggregate total is present.

## Scope: all affected files

A repo-wide scan (`find . -maxdepth 1 -name "min*.js" -size 0`) found **38
zero-byte min-files** (out of 7447 total `min*.js` files), likely all exhibiting
the same empty-bar-chart symptom:

```
min081212.js
min100111.js  min100112.js  min100113.js  min100114.js  min100115.js  min100116.js
min100211.js  min100214.js
min120924.js
min121208.js  min121209.js  min121210.js  min121211.js  min121212.js  min121213.js
min121214.js  min121215.js  min121216.js  min121217.js  min121218.js  min121219.js
min121220.js  min121221.js  min121222.js  min121223.js  min121224.js  min121225.js
min121231.js
min130101.js  min130102.js  min130103.js
min141229.js  min141230.js
min180915.js  min180926.js  min180927.js
min231202.js
```

Two notable clusters: Dec 2012 – Jan 2013 (18 consecutive days) and scattered
singles/pairs elsewhere.

## Format-epoch findings (done)

Checked `docs/data-format-daily.md` epoch boundaries against real neighboring
files. Confirmed the three epochs and boundaries in `scripts/utils.js` match
reality exactly:

- Epoch 1: `2006-03-15` – `2007-03-27` (4|4 fields)
- Epoch 2: `2007-03-28` – `2013-01-03` (4|6 fields, block0=SB2100TL, block1=SB4200TL)
- Epoch 3: `2013-01-04` – present (6|4 fields, block0=SB4200TL, block1=SB2100TL)

All 38 target dates fall unambiguously into epoch 2 or epoch 3 by date — no
file straddles a boundary. `scripts/backfill-min-day.js` already determines
output format from the **target date** (`epochFromDate()`), not from the donor
file's format, and maps Wh values by inverter identity rather than block
position, so donors do not need to be picked from the same epoch — the script
handles cross-epoch backfilling correctly by construction.

**Important discovery**: `days_hist.js`'s `da[]` fields (`wr1;feed1|wr2;feed2`)
are **inverter-identity-based** (field 1 = SB4200 Wh, field 2 = SB2100 Wh),
consistently across all epochs — verified against real epoch-2 files
(`min121207.js`, `min120923.js`). This is *not* block-positional, even though
`scripts/fill-days-hist.js`'s current implementation treats `wr1Wh`/`wr2Wh` as
positional aliases of `parseMinFirstLine()`'s `b0Wh`/`b1Wh`. For epoch 2/1
dates (where block0 ≠ SB4200), this means **`fill-days-hist.js` writes `wr1`/
`wr2` backwards relative to how the historical `days_hist.js` data was
actually recorded**. Not yet fixed — flagged here for a follow-up look,
independent of this backfill task. When manually reading `days_hist.js`
totals to feed into `backfill-min-day.js --sb4200-wh` / `--sb2100-wh`, use the
identity convention (field 1 = SB4200), not the script's positional one.

## Status by file

### Backfilled (3 of 38)

`min130101.js`, `min130102.js`, `min130103.js` — done, via
`scripts/backfill-min-day.js`, using `days_hist.js` totals (identity
convention, see above):

| Date | SB4200 Wh | SB2100 Wh | Donor | Result |
|---|---|---|---|---|
| 01.01.13 | 4165 | 2132 | min230121.js (6295 Wh) | 106 records, Epoch 2 |
| 02.01.13 | 4959 | 2539 | min240101.js (7521 Wh) | 102 records, Epoch 2 |
| 03.01.13 | 3305 | 1693 | min190102.js (5014 Wh) | 84 records, Epoch 2 |

Not yet spot-checked in the browser (step 5 below still pending for these 3).

### Blocked — zero aggregate in days_hist.js (19 of 38)

`min121208.js` – `min121225.js` (18 files) and `min121231.js` (1 file) all
have `da[]` = `"0;0|0;0"` in `days_hist.js` for their date — **no known daily
total exists to scale a donor day against**. Per the original task
instructions ("flag, don't guess"), these were **not** backfilled.

Cross-check against `months.js`: December 2012's monthly total is
`74348;39550` (113,898 Wh), but the 5 known days in that month with real data
(`26.12.12`–`30.12.12`, `13225;6773` each, not in the missing-file list) only
sum to 99,990 Wh — leaving **~13,908 Wh unaccounted for** across the 19 zero
days. This means the zero aggregates are very likely a genuine upstream data
gap (real generation happened, was never recorded in `days_hist.js`), not
"zero production" days. There's no per-day split available for that
remainder, so a scaled backfill for these 19 would require either:

- fabricating a plausible per-day split of the ~13,908 Wh (synthetic, would
  need explicit marking as estimated), or
- root-causing why `days_hist.js` itself is missing these entries first
  (possibly via the `backfill-days-hist` skill) and fixing that upstream, then
  backfilling the min-files from the corrected aggregates.

**Awaiting user decision on which approach to take** before proceeding with
these 19.

### Not yet investigated (16 of 38)

Steps 1–2 (look up daily totals, backfill) have not yet been run for:

```
min081212.js
min100111.js  min100112.js  min100113.js  min100114.js  min100115.js  min100116.js
min100211.js  min100214.js
min120924.js
min141229.js  min141230.js
min180915.js  min180926.js  min180927.js
min231202.js
```

These are all single/paired days outside the Dec 2012–Jan 2013 cluster and
are expected to have valid non-zero `days_hist.js` totals (not yet confirmed
individually) — should be straightforward with the same
`backfill-min-day.js` workflow used above.

## Next steps for the fresh agent

1. Get user's decision on the 19 zero-aggregate Dec 2012 files (see above).
2. Look up `days_hist.js` totals (identity convention: field 1 = SB4200 Wh,
   field 2 = SB2100 Wh) for the remaining 16 unstarted dates and run
   `scripts/backfill-min-day.js --target DD.MM.YY --sb4200-wh N --sb2100-wh N`
   for each. Report any with a zero/missing aggregate the same way as above.
3. Follow the project's CLAUDE.md conventions: ESM JS scripts only, tests in
   `scripts/*.test.js` written before implementation, `node --test` to run
   them, `npx eslint` clean before finishing (only relevant if script changes
   are needed — the existing `backfill-min-day.js` already covers the
   mechanics used so far).
4. After backfilling, spot-check the 3 completed days plus a few more
   (e.g. 03.01.2013) in the browser via `npm start` + Playwright per
   CLAUDE.md's debugging guidance, confirming the day-view bar chart now
   renders and its total roughly matches the `days_hist.js` aggregate for
   that date.
5. Consider filing/fixing the `fill-days-hist.js` `wr1`/`wr2` positional-vs-
   identity bug noted above as a separate follow-up (affects any future writes
   to `days_hist.js` for epoch 1/2 dates, not just this backfill task).
6. Delete this file (`TASK_backfill_empty_min_files.md`) once all 38 files are
   resolved (backfilled or explicitly flagged with user sign-off) and
   committed.
