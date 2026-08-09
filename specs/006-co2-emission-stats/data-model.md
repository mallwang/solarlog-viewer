# Phase 1 Data Model: CO2 Emission Avoidance Statistics

No new persisted/external data format is introduced — this feature adds one static, in-repo
JavaScript reference module and derives display values from data structures the existing
codebase (`web/js/data/aggregates.js`, `web/js/data/yield-stats.js`) already parses. Entities
below describe those structures for implementation reference.

## Yearly CO2 Emission Factor

Static reference data, hand-maintained in a new module `web/js/data/co2-factors.js` (per FR-003,
FR-004, FR-006).

| Field | Type | Notes |
|-------|------|-------|
| `year` | integer (map key) | Calendar year, 2006 onward. |
| `factorKgPerKwh` | number | kg CO2 per kWh, e.g. `0.608` for 2006. Sourced from UBA Tabelle 2 (see research.md R1); stored pre-converted from the source's g/kWh figures (`÷ 1000`). |

Represented as a plain object literal (map of year → factor), not an array, so lookup is O(1)
and adding a new year (FR-006) is a single new key — no code change required elsewhere.

```js
export const CO2_FACTOR_KG_PER_KWH_BY_YEAR = {
  2006: 0.608,
  2007: 0.626,
  // ... through the latest published year
};
export const CO2_FALLBACK_FACTOR_KG_PER_KWH = 0.363; // FR-005
```

**Validation rules**:
- Keys MUST be integer calendar years ≥ 2006 (Assumption: plant data begins 2006; the fallback
  constant already covers any earlier/unexpected date per the spec's Edge Cases).
- Values MUST be positive numbers in kg/kWh (source data is always positive; no zero/negative
  emission year exists in the historical record).

**Derived lookup** (pure function, not stored state):
- `co2FactorForYear(year)` → `CO2_FACTOR_KG_PER_KWH_BY_YEAR[year] ?? CO2_FALLBACK_FACTOR_KG_PER_KWH`
  — implements FR-005's fallback for any year absent from the table (future years, and the
  current in-progress year until its factor is published).

## Period CO2 Result

Not a stored entity — the computed output of applying the above lookup to yield data already
available in each view, per FR-002/FR-008:

| Field | Type | Notes |
|-------|------|-------|
| `co2SavedKg` | number | For a single-year period (day/month/year view): `yieldKwh * co2FactorForYear(year)`. For a multi-year period (total/lifetime view): `Σ (yearlyYieldKwh * co2FactorForYear(year))` over `summary.byYear`, i.e. never `totalYieldKwh * oneFactor` (FR-008). |

This mirrors the existing `Energy Yield Period` entity already implicit in `aggregates.js`'s
`YearlyTotal`/`MonthlyTotal`/`DailyTotal` shapes (see file header comments there) — no new yield
entity is introduced; CO2 is a derived display value computed alongside the existing
`yieldKwh`/`feedInEuro` figures in each view's `*StatsRows` function.

## Relationships

```
YearlyTotal[] (existing, aggregates.js)
   │  one entry per calendar year with data
   ▼
co2FactorForYear(year) ──▶ CO2_FACTOR_KG_PER_KWH_BY_YEAR / fallback constant (new)
   │
   ▼
co2SavedKg (per view, summed across years for the total view only)
   │
   ▼
formatCo2(valueKg) (new, format.js) ──▶ "1.234 kg" | "12,3 t"  (FR-007)
```
