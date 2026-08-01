# validate-min-consistency — min file consistency checks

`scripts/validate-min-consistency.js` validates every `minYYMMDD.js` file in a
directory against seven internal-consistency rules. It exits `0` when every
checked file passes and `1` when at least one issue is found (suitable for CI).

```bash
node scripts/validate-min-consistency.js
# or, via the package script:
npm run validate:min-consistency
```

Sample output:

```
min260503.js:
  fiveMinuteIntervals: 3 issues
    {"index":15,"fromTime":"22:45:00","toTime":"22:10:00","deltaMinutes":35}
    {"index":17,"fromTime":"22:05:00","toTime":"21:35:00","deltaMinutes":30}
    {"index":18,"fromTime":"21:35:00","toTime":"21:00:00","deltaMinutes":35}

7444 file(s) checked, 551 with issues.
```

---

## Checks

Each check can be run in isolation with its `--check-*` flag (see
[CLI flags](#cli-flags) below). With no `--check-*` flag given, all seven run.

| #   | `--check-*` flag     | Issue key             | What it verifies                                                                             |
| --- | -------------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| 1   | `--check-line`       | `lineFormat`          | Every line starts with `m[mi++]="`.                                                          |
| 2   | `--check-date`       | `date`                | Every line's embedded date matches the filename's date.                                      |
| 3   | `--check-epoch3`     | `epoch3Format`        | Every line matches the Epoch 3 block layout (block 1 = 6 fields, block 2 = 4 fields).        |
| 4   | `--check-interval`   | `fiveMinuteIntervals` | Consecutive lines are exactly 5 minutes apart.                                               |
| 5   | `--check-start-zero` | `startNearZero`       | The last (earliest, "lowest") line has near-zero total Wh — the start of the inverters' day. |
| 6   | `--check-monotonic`  | `monotonicWh`         | Cumulative Wh never decreases further down the file (i.e. further back in time).             |
| 7   | `--check-hist`       | `daysHistMatch`       | The first line's combined total Wh matches the corresponding entry in `days_hist.js`.        |

---

## CLI flags

| Flag                         | Default | Description                                                                                          |
| ---------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `--data-dir <dir>`           | `.`     | Directory containing the `minYYMMDD.js` files and `days_hist.js`.                                    |
| `--near-zero-threshold <Wh>` | `50`    | Max total Wh on the file's last line still considered "near zero" (check 5).                         |
| `--hist-tolerance <Wh>`      | `0`     | Max absolute Wh delta between a file's total and its `days_hist.js` entry before flagging (check 7). |
| `--check-line`               | off     | Run only check 1 (line format).                                                                      |
| `--check-date`               | off     | Run only check 2 (date consistency).                                                                 |
| `--check-epoch3`             | off     | Run only check 3 (Epoch 3 layout).                                                                   |
| `--check-interval`           | off     | Run only check 4 (5-minute intervals).                                                               |
| `--check-start-zero`         | off     | Run only check 5 (near-zero start).                                                                  |
| `--check-monotonic`          | off     | Run only check 6 (monotonic Wh).                                                                     |
| `--check-hist`               | off     | Run only check 7 (days_hist.js match).                                                               |

Multiple `--check-*` flags can be combined — only the selected checks run.
With none given, all seven run.

---

## Examples

Validate the whole archive with every check (default):

```bash
node scripts/validate-min-consistency.js
```

Validate a different directory (e.g. a staging copy):

```bash
node scripts/validate-min-consistency.js --data-dir /tmp/staging
```

Only check that every line's `m[mi++]="` prefix is intact — useful after a
bulk sed/text edit:

```bash
node scripts/validate-min-consistency.js --check-line
```

Only check the 5-minute interval spacing:

```bash
node scripts/validate-min-consistency.js --check-interval
```

Combine two checks — Epoch 3 layout and cumulative-Wh monotonicity — e.g.
right after running `migrate-min-epoch.js` on a batch of files:

```bash
node scripts/validate-min-consistency.js --check-epoch3 --check-monotonic
```

Only check totals against `days_hist.js`, allowing up to 20 Wh of rounding
drift (device-reported Wh counters aren't always exact):

```bash
node scripts/validate-min-consistency.js --check-hist --hist-tolerance 20
```

Raise the near-zero threshold for the day-start check to 100 Wh:

```bash
node scripts/validate-min-consistency.js --check-start-zero --near-zero-threshold 100
```

---

## Why `--check-hist` compares combined totals, not per-inverter

`days_hist.js` totals are compared as `wr1Wh + wr2Wh` against the min file's
combined total, not per-inverter. The Epoch 3 migration
(`migrate-min-epoch.js`) reorders each min file's blocks to a consistent
SB4200-first / SB2100-second layout, but `days_hist.js` was never migrated and
still reflects each day's original (pre-2013) block order. A per-inverter
comparison would flag every pre-2013 day as a mismatch even when the totals
agree — see `checkDaysHistMatch` in `scripts/validate-min-consistency.js` for
the full rationale.

## Related scripts

- `scripts/validate-plausibility.js` — cross-checks min file totals against
  `days_hist.js` only (per-inverter, with a `--tolerance` flag); see
  `npm run validate:plausibility`.
- `scripts/migrate-min-epoch.js` — migrates a single min file to the Epoch 3
  block layout (run `--check-epoch3` afterwards to confirm).
- `scripts/gap-detect.js` — finds missing min/days_hist files rather than
  malformed ones.

## Tests

```bash
node --test scripts/validate-min-consistency.test.js
```
