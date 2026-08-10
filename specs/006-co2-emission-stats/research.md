# Phase 0 Research: CO2 Emission Avoidance Statistics

## R1: Source and exact values for the yearly emission-factor reference table

**Decision**: Use the "Emissionsfaktor Strommix" column (direct CO2 emissions per kWh of the
German electricity grid mix, average/territorial method, _not_ the trade-balance-adjusted
"Strominlandsverbrauch" variant) from Umweltbundesamt's Tabelle 2 in:

> Icha, P.; Lauf, T. (2026): _Entwicklung der spezifischen Treibhausgas-Emissionen des
> deutschen Strommix in den Jahren 1990–2025_. Umweltbundesamt, Climate Change 16/2026,
> Dessau-Roßlau, März 2026. DOI: https://doi.org/10.60810/openumwelt-8399
> PDF: https://www.umweltbundesamt.de/system/files/medien/11850/publikationen/2026-03/16_2026_CC.pdf

This is the same "average German grid mix" concept the legacy site's flat `sum*0.7` used
(legacy-site/visu.html:1414-1424), just year-specific instead of a single hardcoded figure, and
is the most recently published UBA edition as of this feature's creation date (2026-08-09).

**Values extracted (g CO2/kWh, "Emissionsfaktor Strommix" column of Tabelle 2), 2006–2025**:

| Year | g/kWh | Year | g/kWh | Year | g/kWh | Year     | g/kWh |
| ---- | ----- | ---- | ----- | ---- | ----- | -------- | ----- |
| 2006 | 608   | 2011 | 570   | 2016 | 524   | 2021     | 406   |
| 2007 | 626   | 2012 | 572   | 2017 | 490   | 2022     | 433   |
| 2008 | 582   | 2013 | 572   | 2018 | 473   | 2023     | 379   |
| 2009 | 571   | 2014 | 559   | 2019 | 409   | 2024\*   | 353   |
| 2010 | 559   | 2015 | 529   | 2020 | 365   | 2025\*\* | 344   |

\* vorläufig (preliminary) · \*\* geschätzt (estimated) — both are still UBA-published figures for
a completed calendar year, so per FR-006 they are entered as specific factors, not treated as
"no entry yet". Only 2026 onward (no data published) falls back to the constant.

Implementation converts each to kg/kWh (`÷ 1000`) when populating the reference table, per
FR-003's kg CO2/kWh unit.

**Rationale**: FR-003 requires "published UBA values for the German electricity grid mix
(average mix, consistent with the legacy site's approach)" for 2006 onward; this is the
authoritative, current, single source covering the full requested range in one document.

**Alternatives considered**:

- Statista's derived table (secondary source, re-publishes the same UBA numbers with less
  precision/context) — rejected in favor of citing the primary UBA publication directly.
- The trade-balance-adjusted "Emissionsfaktor Strominlandsverbrauch" column — rejected; it
  double counts import/export effects rather than reflecting straightforward average grid-mix
  generation emissions, which is not what the legacy site or the feature request describe.

## R2: Fallback constant vs. the sourced series

**Decision**: Keep FR-005's fallback constant literally as specified (0.363 kg CO2/kWh); no
change needed. It does not need to equal any single year in the sourced table — it exists only
for years with no published entry (current year 2026 onward until UBA publishes), and the spec
explicitly names 0.363 as the required fallback value.

**Rationale**: FR-005 is unambiguous and the spec's Assumptions section already settles this;
no further research needed.

## R3: kg vs. tonne display threshold and unit label

**Decision**: Port the legacy threshold exactly — values `< 10,000 kg` render as kg (locale
decimal convention, 0 decimals, matching legacy's `Math.floor`), values `>= 10,000 kg` render in
tonnes with 2 decimals (matching legacy's `Math.floor(sum/1000*100)/100`). Use unit label `t`
for tonnes in both languages (legacy used non-standard `to`; `t` is the standard German/English
abbreviation and avoids a stray legacy typo carrying into new code) and `kg` for kilograms,
consistent with the existing `formatKwh`/`formatCurrency` unit-suffix pattern in `format.js`.

**Rationale**: FR-007 mandates the legacy threshold/unit-scaling behavior; the label itself is
an implementation-detail formatting choice not otherwise constrained by the spec.

**Alternatives considered**: Reusing legacy's literal `to` suffix — rejected as a likely typo
for `t`/`to.` with no real-world meaning; not worth preserving verbatim given FR-007 only
requires the _threshold behavior_, not the exact string.

## R4: Where per-year yield breakdown already exists vs. needs deriving

**Decision**: No new yield-aggregation logic is needed.

- **Total/lifetime view** (`total-view.js`) already computes `summary.byYear` (one entry per
  calendar year, see `deriveLifetimeSummary` in `aggregates.js`) — apply each year's factor to
  that year's yield and sum (FR-002, FR-008).
- **Year view** (`year-view.js`) is already scoped to a single routed year — one factor lookup.
- **Month view** (`month-view.js`) and **day view** (`day-view.js`) are always scoped to a single
  calendar year by construction (a month/day never spans a year boundary) — one factor lookup
  using `route.params.year`.

**Rationale**: Confirmed by reading all four view modules (`web/js/views/*.js`) — yield data is
already organized per-year or per-single-year-period; the edge case in the spec (a Dec 31 day
view not spanning years) is already true of the existing routing/data model, so FR's "each
portion of yield matched to the emission factor of the calendar year it occurred in" requires no
special-case handling beyond a plain per-year lookup.

## R5: Existing flat CO2 calculation to replace

**Decision**: `web/js/data/aggregates.js` already computes `co2SavedKg` in
`deriveLifetimeSummary` using a flat `CO2_KG_PER_KWH = 0.7` constant — but this value is never
actually rendered in any view today (`total-view.js`'s `totalStatsRows` does not include it).
This feature replaces the flat constant with the new per-year calculation _and_ adds the missing
display row to all four views' stats panels (FR-001).

**Rationale**: Grep across `web/js/views/*.js` confirms `co2SavedKg` has no consumer; this is a
pre-existing latent field, not a currently-visible regression risk beyond what FR-001 already
requires fixing.
