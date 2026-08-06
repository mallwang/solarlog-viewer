# Research: Data Validation & Aggregation

**Phase 0 output for feature `002-data-validation-aggregation`**

---

## Decision 1 — Daily Energy Total from Min Files

**Decision**: Read the cumulative Wh counter from the **first line** of each `minYYMMDD.js` file (newest record = end-of-day cumulative), not by summing PAC × 5/60 across all records.

**Rationale**: The cumulative Wh field is already present in every record and is computed by the SolarLog device's own firmware. The alternative (power-based integration) requires knowing which sub-field within each pipe-separated inverter block is PAC, and the field layout differs between WR1 and WR2 and has changed across device firmware versions. The cumulative counter avoids this variability and matches how `backfill-min-day.js` already extracts daily totals.

**Alternatives considered**: PAC-based trapezoidal integration — rejected because field positions are unstable across years and would need separate handling for partial days.

---

## Decision 2 — Min File Field Layout Variability

**Decision**: Parse each inverter block independently using a flexible field extractor that treats field index 2 (0-based, within each `|`-delimited block) as the Wh cumulative counter.

**Rationale**: Observed formats in the archive:

- Older files (2006–2009): `m[mi++]="29.03.07 HH:MM:SS|pdc1;pac1;wh1;v1|pdc2;dc2;pac2;wh2;v2a;v2b"` (4 + 6 fields)
- Newer files (2024+): `m[mi++]="28.07.26 HH:MM:SS|pdc1;dc1;something;wh1;v1;v2|pdc2;pac2;wh2;v"` (6 + 4 fields)

The Wh cumulative counter is always the **third field (index 2)** of its inverter block in the known file set. The `backfill-min-day.js` regex confirms this for the 4-field WR1 block (group 5 = wh1) and 6-field WR2 block (group 10 = wh2). A flexible parser splits on `|`, then splits each block on `;`, and reads `fields[2]` for Wh.

**Ceiling**: If a future firmware version changes the Wh field position, the parser must be updated. Comment the assumption in the parser with `ponytail:` annotation.

**Alternatives considered**: A strict per-format regex (like `backfill-min-day.js`) — rejected because it would fail on mixed-format archives.

---

## Decision 3 — `days_hist.js` Split File Strategy

**Decision**: The gap-fill script loads all `days_hist*.js` files (main + year splits) into a single in-memory map keyed by date string (`DD.MM.YY`). The output target is always `days_hist.js` (the main file); year-split files are read-only sources for the two-pass lookup.

**Rationale**: Per spec, `days_hist_06.js` through `days_hist_09.js` exist as year-split files with the same `da[dx++]=` format. They cover dates not present in `days_hist.js`. Treating all of them as sources for pass 1 is simpler than knowing which specific split file to check.

**Alternatives considered**: Routing writes to the corresponding year-split file — rejected; the spec says `days_hist.js` is the sole write target and the split files are device-generated read-only data.

---

## Decision 4 — Plausibility Comparison Target

**Decision**: Compare minute-derived daily totals against **`days_hist.js` only** (not `daysall.js`).

**Rationale**: Per spec FR-005 and US2: "`daysall.js` is not a validation target." `daysall.js` uses a different format (`dal[dxl++]=`) and stores only aggregate totals without per-inverter breakdown, making per-inverter mismatch detection impossible.

---

## Decision 5 — Gap Range Representation

**Decision**: Consecutive missing dates are collapsed into ranges in human-readable output (e.g., `2015-08-10 – 2015-08-14: 5 days missing`). Individual dates are preserved in JSON output.

**Rationale**: With 7,000+ files over 20 years, individual-line output for multi-day gaps would be unreadable. JSON output preserves the raw date list for programmatic use.

---

## Decision 6 — Months/Years Aggregation Window

**Decision**: `fill-months.js` accepts `YYYY-MM` and processes all `minYYYYMM*.js` files. `fill-years.js` accepts `YYYY` and processes all `minYYYY*.js` files. Date parsing uses the filename (not records inside).

**Rationale**: Filename-based selection is O(1) per file and avoids opening files that are out of scope. The spec requires single-month/year scoping to keep context small (FR-012).

---

## Decision 7 — Output Format Fidelity

**Decision**: Generated lines use the exact same JS assignment patterns as device-generated files:

- `da[dx++]="DD.MM.YY|WR1_Wh;WR1_feed|WR2_Wh;WR2_feed"`
- `mo[mx++]="01.MM.YY|WR1_Wh|WR2_Wh"`
- `ye[yx++]="01.01.YY|WR1_Wh|WR2_Wh"`

**Rationale**: FR-007 requires byte-for-byte format compatibility. Feed-in values (`WRx_feed`) in `days_hist` are separate from energy totals; when aggregating from `minYYMMDD.js` (which has no feed-in field), feed-in is written as `0`.

**Alternatives considered**: Writing new entries with feed-in calculated from known tariff — rejected; tariff data is not in the min files and would require an external source.

---

## Decision 8 — Tolerance Default

**Decision**: Default plausibility tolerance is **±1 Wh** (per FR-005). Overridable with `--tolerance N` (integer Wh).

**Rationale**: The SolarLog device records integer Wh values; rounding in 5-min power accumulation can cause ±1 Wh discrepancy even on correct days. Values differing by more than 1 Wh indicate a genuine data issue.
