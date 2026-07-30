# CLI Contracts: Validation & Aggregation Scripts

All scripts are ESM JS in `scripts/`. Run with `node scripts/<name>.js [args]`.

---

## `gap-detect.js` — Detect Missing Daily Files

```
node scripts/gap-detect.js [--since YYYY-MM-DD] [--output json] [--out-file PATH]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--since YYYY-MM-DD` | optional | earliest known file | Limit gap reporting to dates on or after this date |
| `--output json` | optional | human-readable | Also emit a JSON report |
| `--out-file PATH` | optional | `gap-report.json` | JSON output path (only used with `--output json`) |

**Exit codes**:
- `0` — no gaps detected (or `--since` filter produced no results)
- `1` — one or more gaps found
- `2` — argument error or archive directory not readable

**Stdout (human-readable)**:
```
Gap Report: 2006-11-03 – 2026-07-30 (7152 files found)

Gaps:
  2015-08-10 – 2015-08-14: 5 days missing
  2018-03-22: 1 day missing

Summary: 2 gap ranges, 6 days total
```

```
No gaps detected. ✓
```

---

## `validate-plausibility.js` — Cross-Check Min Files vs days_hist.js

```
node scripts/validate-plausibility.js [--since YYYY-MM-DD] [--tolerance N] [--output json] [--out-file PATH]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--since YYYY-MM-DD` | optional | earliest known file | Limit check to dates on or after this date |
| `--tolerance N` | optional | `1` (Wh) | Days with abs(delta) ≤ N are not flagged |
| `--output json` | optional | human-readable | Also emit a machine-readable JSON report |
| `--out-file PATH` | optional | `plausibility-report.json` | JSON output path |

**Exit codes**:
- `0` — all checked days within tolerance
- `1` — one or more mismatches found
- `2` — argument error

**Stdout (human-readable, mismatch row)**:
```
Date        WR1 min(Wh)  WR1 hist(Wh)  Δ WR1  Δ%     WR2 min(Wh)  WR2 hist(Wh)  Δ WR2  Δ%
2026-07-14  19100        19200          +100   +0.52%  9408         9408           0      0.00%
```

---

## `fill-days-hist.js` — Fill Gaps in days_hist.js

```
node scripts/fill-days-hist.js YYYY-MM [--dry-run] [--force] [--tolerance N]
```

| Argument/Flag | Type | Required | Description |
|---------------|------|----------|-------------|
| `YYYY-MM` | positional | yes | Target calendar month to process |
| `--dry-run` | flag | no | Print computed values; do not write |
| `--force` | flag | no | Overwrite existing entries without confirmation prompt |
| `--tolerance N` | optional | no | Wh tolerance for considering existing entries as already correct (default 0 = exact match required to skip) |

**Exit codes**:
- `0` — success (or dry-run completed)
- `1` — one or more unfillable dates (no source data)
- `2` — argument error or file write failure

**Stdout summary**:
```
fill-days-hist 2026-06
  Checked: 30 days
  Already present: 28
  Filled from days*.js (pass 1): 1 — 2026-06-15 (source: daysall.js)
  Filled from min file (pass 2): 1 — 2026-06-22 (min260622.js)
  Unfillable: 0
```

---

## `fill-months.js` — Regenerate a Month Entry in months.js

```
node scripts/fill-months.js YYYY-MM [--dry-run] [--force]
```

| Argument/Flag | Type | Required | Description |
|---------------|------|----------|-------------|
| `YYYY-MM` | positional | yes | Target month to aggregate |
| `--dry-run` | flag | no | Print computed values; do not write |
| `--force` | flag | no | Overwrite without confirmation |

**Source**: All `minYYYYMM*.js` files for the given month. Never reads `days_hist.js`.

**Exit codes**: `0` success, `1` no min files found for month, `2` argument error.

**Stdout**:
```
fill-months 2026-06
  Min files: 30
  WR1 total: 570240 Wh
  WR2 total: 282240 Wh
  → months.js: mo[mx++]="01.06.26|570240|282240"
  [dry-run: not written]
```

---

## `fill-years.js` — Regenerate a Year Entry in years.js

```
node scripts/fill-years.js YYYY [--dry-run] [--force]
```

| Argument/Flag | Type | Required | Description |
|---------------|------|----------|-------------|
| `YYYY` | positional | yes | Target year to aggregate |
| `--dry-run` | flag | no | Print computed values; do not write |
| `--force` | flag | no | Overwrite without confirmation |

**Source**: All `minYYYY*.js` files for the given year. Never reads `days_hist.js` or `months.js`.

**Exit codes**: `0` success, `1` no min files found for year, `2` argument error.

**Stdout**:
```
fill-years 2026
  Min files: 211
  WR1 total: 2910255 Wh
  WR2 total: 1493488 Wh
  → years.js: ye[yx++]="01.01.26|2910255|1493488"
  [dry-run: not written]
```
