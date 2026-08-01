You're continuing a data migration in /home/markus/projects/solarlog-viewer. This repo archives historical SolarLog 5-minute interval files (minYYMMDD.js). Files before 2013-01-04 use an older block layout (see docs/data-format-daily.md) that needs migrating to the current Epoch 3 layout (block 0 = SB 4200 TL, block 1 = SB 2100 TL) using scripts/migrate-min-epoch.js. 2006 and 2007 are already fully migrated and reviewed. Your job is to do the same for **2008 only** (366 files, `min080101.js` … `min081231.js`, leap year), then stop — do not proceed to 2009 or any other year.

2008 falls entirely in Epoch 2 (2007-03-28 … 2013-01-03, 4|6 fields, block1=SB2100 4-field, block2=SB4200 6-field in the raw source).

Follow this exact procedure:

1. **Migrate.** For every `min08MMDD.js` file, run:

```
node scripts/migrate-min-epoch.js --date DD.MM.YY
```

(no `--dry-run` — this archives the original to `scripts/archive/min-original/` and rewrites the file in place, or `archive/min-original/` — check which path the script actually uses this run, it may differ from the top-level `archive/` dir observed for 2007). Loop over all files for the year via a bash script deriving `DD.MM.YY` from the filename. Capture output to a log file and report total files processed, real error count (grep for `, [1-9][0-9]* error` — do NOT naively grep `-i error`, it matches the `0 error(s)` success text too), and warning count (the script warns when a file's first line shows SB2100 Wh > SB4200 Wh).

2. **Check the SB4200/SB2100 ratio for every file in the year.** Use `parseMinFirstLine` from `scripts/utils.js` — it takes the **full file content**, not just the first line — to get `sb4200Wh`/`sb2100Wh` from each file's first (newest) line, and compute `sb4200Wh / sb2100Wh`. The physical baseline for this plant is ~1.95 (SB4200 TL is the ~2x larger inverter and should almost always yield roughly double SB2100 TL). Flag any file where the ratio is reversed (< 1) or wildly off baseline (e.g. < 1.3 or > 3) as a candidate for review.

3. **Before concluding a flagged file is a genuine reversal, inspect the actual data, not just the ratio:**
   - Pull the migrated file's full day of records (`cat min08MMDD.js`) and look at the PAC/PDC columns (not just the yield/Wh field) for both blocks.
   - Compare against immediate neighboring days' totals for physical plausibility (does the "swapped" interpretation fit the neighbor pattern better than the as-recorded one? does either interpretation exceed a physical cap — SB2100 maxes out around ~21000 Wh/day, SB4200 around ~42000 Wh/day?).
   - A low ratio caused by a generally low-output day (foggy/winter, small absolute Wh on both sides, PAC/PDC traces near-zero all day for both blocks) is **not** a bug — leave it alone.
   - A low ratio caused by one inverter's yield counter being stuck (e.g. stuck at 0 all day) while its PAC/PDC trace still shows a normal-looking curve is **not** a block swap — it's an isolated counter fault. Leave it alone.
   - Only treat it as a genuine source-side block swap if the yield values are physically implausible as recorded (e.g. one exceeds its inverter's cap) AND the swapped interpretation matches the neighbor-day pattern. This was the case for exactly one file in 2007 (`min070422.js`) — expect 2008 to have zero or very few genuine swaps; don't assume every flagged file needs fixing.

4. **If a genuine reversal is found**, fix it by re-deriving that single file from its archived original (the raw pre-migration file, wherever the script archives it — confirm the path), **not** the already-migrated working file. Do this with a small one-off script, not by reusing `blockToReading` with flipped `isSB4200` flags blindly — that function's positional destructuring does NOT correctly relabel a 4-field block as SB4200 or a 6-field block as SB2100 (field positions don't line up: e.g. treating a 4-field `[pac,pdc1,wh,udc1]` array as SB4200-shaped `[pac,pdc1,pdc2,wh,udc1,udc2]` puts the real `wh` value into the `pdc2` slot). Instead manually construct the swapped readings from the raw fields' true positional meaning:

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { formatEpoch3Blocks } from './scripts/migrate-min-epoch.js';

const content = readFileSync('archive/min-original/min08MMDD.js', 'utf8'); // confirm exact archive path first
const rawLines = content.split('\n').map((l) => l.trim()).filter(Boolean);

const lines = rawLines.map((raw) => {
  const match = /^m\[mi\+\+\]="(\d{2}\.\d{2}\.\d{2}) (\d{2}:\d{2}:\d{2})\|([^|]+)\|([^"]+)"$/.exec(raw);
  const [, date, time, b0raw, b1raw] = match;
  const b0 = b0raw.split(';').map((n) => Number.parseInt(n, 10)); // [pac, pdc1, wh, udc1] — 1-string block
  const b1 = b1raw.split(';').map((n) => Number.parseInt(n, 10)); // [pac, pdc1, pdc2, wh, udc1, udc2] — 2-string block

  const sb4200 = { pac: b0[0], pdc1: b0[1], pdc2: 0, wh: b0[2], udc1: b0[3], udc2: 0 };
  const sb2100 = { pac: b1[0], pdc1: b1[1], wh: b1[3], udc1: b1[4] };

  const [sb4200Block, sb2100Block] = formatEpoch3Blocks(sb4200, sb2100);
  return `m[mi++]="${date} ${time}|${sb4200Block}|${sb2100Block}"`;
});

writeFileSync('min08MMDD.js', lines.join('\n') + '\n');
```

Do not modify the archived original — it stays as the true source-of-truth for reverting. Only rewrite the working-tree file. Delete the one-off script when done.

5. **Report and stop.** Summarize: files processed, error/warning counts, every ratio anomaly considered with the neighbor-day evidence you checked (not just "flagged, ok, moved on"), and what — if anything — was fixed and why you're confident it's a genuine swap rather than a low-output day or counter fault. Then stop and wait for explicit approval before touching 2009.
