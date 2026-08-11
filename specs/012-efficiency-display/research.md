# Phase 0 Research: Inverter Efficiency Display (PAC/PDC)

No `NEEDS CLARIFICATION` markers remain in the Technical Context — this is a
small, well-bounded display addition to an existing, well-understood data
model. The items below record the concrete decisions taken, not open
unknowns.

## Decision: Where the PAC/PDC summing + ratio logic lives

**Decision**: A new pure module, `web/js/data/efficiency.js`, exporting a
single function `efficiencyPercent(perInverter)` that sums `pacW` and (all
elements of) `pdcW` across every inverter in a reading's `perInverter` map,
and returns `null` when the summed PDC is `0`, missing, or non-finite —
otherwise `(sumPac / sumPdc) * 100`.

**Rationale**: Both consumers (info panel's single live reading, day view's
per-reading chart series) operate on the exact same `perInverter` shape
already produced by `parseMinFile` (`min-file.js`). Centralizing avoids
duplicating the "what counts as unavailable" guard (FR-003, FR-005, edge case
on partial-string data) in two places. This mirrors the existing
`production-animation.js` pattern: a pure, DOM-free module under
`web/js/info-panel/` consumed by the controller — except this one is shared by
a second consumer (the chart factory), so it belongs in `web/js/data/`
alongside `min-file.js`, not under `info-panel/`.

**Alternatives considered**:
- Inlining the sum/ratio in both `info-panel-controller.js` and
  `chart-factory.js` separately — rejected: duplicates the zero/missing-PDC
  guard and risks the two surfaces disagreeing on edge-case behavior.
- Computing efficiency inside `min-file.js`'s parse step (adding an
  `efficiencyPercent` field to each reading) — rejected: `min-file.js` is a
  pure format parser (SolarLog wire format → structured readings); deriving a
  display metric there conflates parsing with presentation logic, and would
  compute efficiency for readings that never need it (e.g. month/year views
  that don't use per-inverter PDC at all).

## Decision: No-value representation (undefined efficiency)

**Decision**: `efficiencyPercent()` returns `null` (not `0`, not `NaN`, not
`Infinity`) whenever PDC sums to `0` or no PDC data is present. Both
consumers treat `null` as "omit" — the info panel skips the `%` suffix
entirely, and the day chart's series has a `null` data point (ApexCharts
already treats `null` as a gap for the existing `dailyYieldWh`/`pacW` series
— see `sumPerInverter` in `chart-factory.js`, which does exactly this today).

**Rationale**: Matches FR-003/FR-005/SC-003 exactly and reuses a pattern the
codebase already established (`sumPerInverter`'s `null`-for-absent
convention) rather than inventing a new sentinel.

**Alternatives considered**: Displaying `0%` or `—` inline — rejected per
spec's explicit edge case ("omitted/gapped rather than plotted as 0% or an
error value").

## Decision: Day chart rendering approach (secondary y-axis vs. separate chart)

**Decision**: Add the efficiency series to the *existing* `buildDayOptions`
chart as a second ApexCharts series plotted against a secondary y-axis
(0–100%+, on the right), rather than a second chart instance below the power
chart.

**Rationale**: Keeps the existing single-chart-per-view structure
(`chart-mount` div, one `ApexCharts` instance per `renderChart` call — see
`chart-factory.js`'s `charts` WeakMap) and lets a viewer directly correlate a
time-of-day dip in efficiency with the power curve at the same x position,
which is the actual value proposition (spec SC-002). ApexCharts natively
supports multiple series with independent y-axes without any custom pixel
math, satisfying Constitution Principle V.

**Alternatives considered**: A second, stacked mini-chart — rejected as
higher-effort for no correlation benefit over a shared x-axis; a toggle to
switch between power/efficiency views — rejected as out of spec scope (spec
asks for "alongside", not a switchable view) and adds UI surface not
requested.

## Decision: Percentage formatting

**Decision**: Round to a whole number (`Math.round`), reusing the existing
`formatNumber`/`formatKwh` helpers' `{ decimals, lang }` convention from
`web/js/format.js` for locale-aware number formatting, with a bare `%` suffix
(no new i18n string needed for the symbol itself — matches how "W" and "Wh"
suffixes are already hardcoded next to formatted numbers elsewhere, e.g.
`productionValueText` in `info-panel-controller.js`).

**Rationale**: FR-009 requires whole-number rounding; reusing `formatNumber`
keeps locale (de/en) digit-grouping consistent with every other numeric
display in the app rather than a bespoke `toFixed(0)` call.

**Alternatives considered**: A new dedicated `formatPercent` helper —
considered but not required: `formatNumber(value, { decimals: 0, lang })` +
a literal `%` already covers this without new abstraction (existing
`day.stats.ist` row in `day-view.js` does exactly this: `` `${ist}%` ``).
