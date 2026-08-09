# Data Model: Data Validation & Aggregation

---

## Entities

### MinuteFile

One file per calendar day. The source of truth for all calculations.

**Filename**: `minYYMMDD.js` (e.g., `min260728.js` = 2026-07-28)

**Format**: One record per 5-minute interval, newest first:

```
m[mi++]="DD.MM.YY HH:MM:SS|<inv1_fields>|<inv2_fields>"
```

**Inverter field layout** (`;`-separated within each `|`-delimited block):

- Field index 2 (0-based) = cumulative Wh counter for that inverter
- WR1 may have 4 or 6 fields depending on firmware version
- WR2 may have 4 or 6 fields depending on firmware version

**Daily total extraction**: Read the **first line** of the file (newest record = end-of-day). Split on `|`, skip field 0 (timestamp block), read `fields[i].split(';')[2]` for each inverter block `i`.

**Validation rules**:

- File must be non-empty
- At least one record must parse successfully
- Date in filename must match dates inside records
- Cumulative Wh counter must be monotonically non-decreasing from last to first record (within day)

---

### DaysHist

Per-inverter daily energy totals. Write target for gap-fill scripts.

**Files**: `days_hist.js` (main, 2010–present), `days_hist_06.js`, `days_hist_07.js`, `days_hist_08.js`, `days_hist_09.js` (year splits, read-only sources).

**Format**:

```
da[dx++]="DD.MM.YY|WR1_Wh;WR1_feed|WR2_Wh;WR2_feed"
```

**Field meanings**:

- `WR1_Wh`: WR1 daily energy total (Wh, integer)
- `WR1_feed`: WR1 feed-in value (Wh or tariff unit — read-only when sourced from existing files; set to `0` when derived from min files)
- Same for WR2

**Record ordering**: newest date first (descending).

**State transitions**:

- `PRESENT`: date exists in the file with non-zero Wh values
- `GAP`: date is within the archive range but absent from all `days_hist*.js` files
- `SOURCE_FROM_DAYS`: gap filled from another `days*.js` file (pass 1)
- `SOURCE_FROM_MIN`: gap filled by aggregating from `minYYMMDD.js` (pass 2)
- `UNFILLABLE`: gap with no source data in either `days*.js` or `min*.js`

---

### DaysAll

Device-generated flat daily total list. **Never modified by these scripts.** Used as pass-1 source only.

**File**: `daysall.js`

**Format**:

```
dal[dxl++]="DD.MM.YY|TotalWh"
```

---

### Months

Monthly energy totals per inverter. Regenerated exclusively from `minYYMMDD.js` files.

**File**: `months.js`

**Format**:

```
mo[mx++]="01.MM.YY|WR1_Wh|WR2_Wh"
```

**Record key**: Always `01` for day (first of month). `YY` is 2-digit year.

**Aggregation rule**: Sum of all daily WR1_Wh (resp. WR2_Wh) values from `minYYMMDD.js` files for the target month. Never derived from `days_hist.js`.

---

### Years

Annual energy totals per inverter. Regenerated exclusively from `minYYMMDD.js` files.

**File**: `years.js`

**Format**:

```
ye[yx++]="01.01.YY|WR1_Wh|WR2_Wh"
```

**Record key**: Always `01.01.YY`.

**Aggregation rule**: Sum of all daily WR1_Wh (resp. WR2_Wh) values from `minYYMMDD.js` files for the target year. Never derived from `days_hist.js` or `months.js`.

---

### ValidationReport

Output of gap-detection and plausibility scripts. Not persisted as a `.js` data file.

**Human-readable fields**:

- Date range scanned
- Total files found
- Gap list: date ranges of consecutive missing files (e.g., `2015-08-10 – 2015-08-14: 5 days`)
- Mismatch list per day: `date | min-derived WR1 | days_hist WR1 | delta WR1 | delta% | same for WR2`
- Summary statistics: gap count, gap days, mismatch count

**JSON fields** (emitted with `--output json`):

```json
{
  "scannedRange": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
  "filesFound": 7152,
  "gaps": [{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "days": 5 }],
  "mismatches": [
    {
      "date": "YYYY-MM-DD",
      "wr1": { "minDerived": 19008, "daysHist": 19100, "delta": 92, "deltaPct": 0.48 },
      "wr2": { "minDerived": 9408, "daysHist": 9408, "delta": 0, "deltaPct": 0 }
    }
  ]
}
```

---

## Relationships

```
minYYMMDD.js (source of truth)
    ↓ read-only by all validation scripts
    ↓ aggregation by fill-months.js, fill-years.js, fill-days-hist.js (pass 2)

days_hist*.js (read for pass-1 gap-fill; days_hist.js is the write target)
daysall.js, days*.js (read-only pass-1 sources; never written)

    → ValidationReport (gap-detect.js, validate-plausibility.js output)
    → days_hist.js (fill-days-hist.js write target)
    → months.js (fill-months.js write target)
    → years.js (fill-years.js write target)
```

---

## Date Encoding Conventions

| Context                     | Format                  | Example                     |
| --------------------------- | ----------------------- | --------------------------- |
| Filename                    | `YYMMDD`                | `min260728.js` = 2026-07-28 |
| Record timestamp            | `DD.MM.YY`              | `28.07.26`                  |
| CLI argument (gap-detect)   | `YYYY-MM-DD`            | `--since 2015-01-01`        |
| CLI argument (fill scripts) | `YYYY-MM` or `YYYY`     | `2026-07` or `2026`         |
| JSON output                 | `YYYY-MM-DD` (ISO 8601) | `"2026-07-28"`              |

2-digit year `YY` maps to: `YY ≥ 06` → `20YY` (device started 2006, so no ambiguity until 2106).
