# Phase 1 Data Model: Inverter Efficiency Display (PAC/PDC)

No new persisted entity is introduced — this feature adds one derived,
display-time value computed from data structures `min-file.js` already
produces. Documented here for traceability against the spec's Key Entities
section.

## Derivation: Efficiency Percentage

**Source data** (unchanged, already produced by `parseMinFile` in
`web/js/data/min-file.js`):

```text
reading.perInverter = {
  [inverterId]: {
    pacW: number,           // AC output, single value
    pdcW: number[],         // DC input, one value per string/tracker
    dailyYieldWh: number | null,
    udcV: number[] | null,
  },
  ...
}
```

**Derived value** — `efficiencyPercent(perInverter)`:

| Field | Type | Description |
|---|---|---|
| Input | `Record<string\|number, { pacW: number, pdcW: number[] }>` | One reading's `perInverter` map (live or historical). |
| `sumPac` | `number` | Σ `pacW` across all inverters. |
| `sumPdc` | `number` | Σ every element of every inverter's `pdcW` array. |
| Output | `number \| null` | `(sumPac / sumPdc) * 100` when `sumPdc > 0` and both sums are finite; `null` otherwise (no fabricated 0%/Infinity/NaN — FR-003/FR-005). |

**Validation rules** (from spec Requirements):

- FR-001: sum across *all* inverters and *all* strings/trackers per inverter
  before dividing (not a per-inverter or per-string efficiency).
- FR-003/FR-005: `sumPdc === 0` (or non-finite) → `null`, never `0%` or an
  error.
- FR-008: no clamping — a `sumPac > sumPdc` result (>100%) is returned as-is.
- FR-009: rounding to a whole number happens at display time (via
  `formatNumber(value, { decimals: 0, lang })`), not inside the derivation —
  keeps `efficiencyPercent()` a precise, testable pure function independent of
  locale formatting.

**State/relationships**: None — this is a stateless, pure calculation with no
identity, lifecycle, or persistence of its own; it exists only as long as the
reading it was computed from is in memory (one call per live poll tick for
the info panel, one call per reading when building the day chart's series).

## Consumers

1. **Info panel** (`info-panel-controller.js`): calls
   `efficiencyPercent(reading.perInverter)` once per poll tick (existing
   10-minute interval, existing `min_cur.js` fetch — no new request), renders
   the rounded value next to the existing wattage or omits it on `null`.
2. **Day view chart** (`chart-factory.js`'s `buildDayOptions`): calls it once
   per reading when building the chart's `series` array, producing a second
   series (`null`-gapped per point where unavailable) plotted on a secondary
   y-axis alongside the existing power series.
