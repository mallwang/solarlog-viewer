# Feature Specification: Inverter Efficiency Display (PAC/PDC)

**Feature Branch**: `012-efficiency-display`

**Created**: 2026-08-11

**Status**: Done

**Input**: User description: "Zusätzlich zur aktuellen Energieproduktion soll der Wirkungsgrad angezeigt werden, welcher sich aus PAC zu PDC errechnet — sowohl im Info-Panel (Live-Wert) als auch im Day-View-Chart (Tagesverlauf)."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Live efficiency in the info panel (Priority: P1)

A visitor looking at the site's top navigation, where the current AC production ("1234 W") is already shown, also sees how efficiently the inverter is currently converting DC input to AC output, expressed as a percentage.

**Why this priority**: This is the most visible, always-present surface (both desktop and mobile info panel) and gives immediate, at-a-glance insight without navigating anywhere — it's the direct extension of what's already displayed today.

**Independent Test**: Can be fully tested by loading the site while the plant is actively producing and confirming a percentage value appears next to the current production wattage, updating on the existing ~10-minute poll cycle.

**Acceptance Scenarios**:

1. **Given** the plant is producing (PAC > 0 W) and DC input is available and non-zero, **When** the info panel renders the current production, **Then** it also displays the efficiency as a percentage (PAC ÷ PDC × 100, rounded to a whole number) next to the wattage.
2. **Given** the plant is idle at night (PAC = 0 W, PDC = 0 W), **When** the info panel renders, **Then** no efficiency percentage is shown (existing "not producing" state is unchanged).
3. **Given** the live production reading is unavailable (fetch failure), **When** the info panel renders, **Then** it shows the existing "unavailable" state and no efficiency value.
4. **Given** the plant reports PAC > 0 but PDC = 0 or missing (e.g. malformed/partial live reading), **When** the info panel renders, **Then** the wattage is shown without an efficiency percentage rather than an error or a misleading value (e.g. infinite/undefined %).

---

### User Story 2 - Efficiency curve in the day view (Priority: P2)

A visitor viewing a specific day's production chart (Mode 0 day detail view) can see how the inverter's efficiency changed over the course of that day, alongside the existing power curve.

**Why this priority**: More effort than the single live number, but far more informative — it shows patterns (e.g. lower efficiency at dawn/dusk or during partial shading) that a single instantaneous reading cannot. Depends on the same underlying calculation as User Story 1.

**Independent Test**: Can be fully tested by opening a day that has recorded power data and confirming an efficiency series/curve is visible on the chart alongside the power curve, with correct values at a few sampled points cross-checked against the raw PAC/PDC data for that day.

**Acceptance Scenarios**:

1. **Given** a day with recorded power data (PAC and PDC readings present across the day), **When** the day view chart renders, **Then** an efficiency curve is shown alongside the existing power curve, one value per reading.
2. **Given** a specific 5-minute reading where PDC = 0 (e.g. before sunrise or after sunset), **When** the efficiency curve is drawn, **Then** that point is omitted/gapped rather than plotted as 0% or an error value.
3. **Given** a backfilled/archived day where only the cumulative daily yield survived (PAC/PDC zeroed — see existing "day.powerUnavailable" fallback), **When** the day view renders, **Then** no efficiency curve is shown, consistent with the existing yield-only fallback for that case.
4. **Given** a day with normal power data, **When** hovering over the chart, **Then** the tooltip shows the efficiency percentage for that point alongside (or near) the power value.

---

### Edge Cases

- What happens when PDC is reported by only one inverter/string of several (partial data)? → Sum whatever PDC values are present across inverters/strings for that reading; do not treat partially-missing strings as zero for the whole reading unless all are missing.
- What happens when PAC exceeds PDC (efficiency > 100%), e.g. due to measurement rounding or SolarLog's own accuracy limits? → Display the computed value as-is, uncapped; this is a real-world data-quality artifact, not something the display should silently hide or clamp.
- How does the system handle days/readings where PDC data was never collected historically (older archived files with a different field layout)? → Treated the same as PDC = 0/missing: point omitted from the efficiency curve, no error shown.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST compute efficiency as total AC power (PAC) divided by total DC power (PDC), summed across all inverters and, for PDC, across all reported strings/trackers per inverter, expressed as a percentage.
- **FR-002**: The info panel MUST display the current efficiency percentage alongside the existing current-production wattage whenever both a valid PAC and a non-zero PDC reading are available.
- **FR-003**: The info panel MUST omit the efficiency percentage (without displaying an error) when PDC is zero, missing, or when the production reading itself is unavailable — matching the existing "not producing"/"unavailable" states' behavior of not fabricating a value.
- **FR-004**: The day view chart MUST display an efficiency curve derived from each reading's PAC/PDC values, shown together with the existing power curve for days that have power data.
- **FR-005**: The day view chart MUST omit individual points from the efficiency curve where that reading's PDC is zero or missing, rather than plotting a misleading 0% or undefined value.
- **FR-006**: The day view chart MUST NOT show an efficiency curve for days that fall back to the yield-only display (backfilled/archived days with zeroed PAC/PDC), consistent with the existing fallback behavior.
- **FR-007**: The day view chart's tooltip MUST show the efficiency percentage for a given point alongside its power value.
- **FR-008**: Efficiency values MUST NOT be capped/clamped at 100% — readings that compute above 100% (measurement artifacts) are displayed as-is.
- **FR-009**: The efficiency percentage MUST be rounded to a whole number for display, matching the existing wattage/percentage formatting conventions used elsewhere in the panel and charts.

### Key Entities

- **Efficiency reading**: A derived value per timestamp (live or historical), computed from the existing PAC/PDC figures already present in `min_cur.js` / `min{YYMMDD}.js` readings — not a new stored data point, purely a display-time calculation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A visitor can determine the plant's current conversion efficiency within the same glance as the current production wattage, with no additional navigation.
- **SC-002**: A visitor viewing any day with recorded power data can identify at what time of day efficiency was lowest/highest without leaving the day view.
- **SC-003**: No efficiency value is ever displayed for a reading where the underlying DC input data is zero or missing — 100% of such points are gapped/omitted rather than shown as misleading numbers.
- **SC-004**: The efficiency display introduces no additional network requests — it is derived entirely from data already being fetched for the current-production and day-view features.

## Assumptions

- "Wirkungsgrad" (efficiency) is defined purely as PAC ÷ PDC (AC output over DC input) — no temperature, irradiance, or other normalization is in scope.
- PDC values across multiple strings/trackers on the same inverter, and across multiple inverters, are simply summed before dividing, matching how the existing yield/power totals are already aggregated elsewhere in the codebase.
- The live snapshot (`min_cur.js`) sometimes lacks a `PdcArr` entry (see existing parsing fallback to an empty array); this is treated identically to "PDC unavailable" for that reading.
- No historical/month/year aggregate efficiency is in scope — only the live info-panel value (User Story 1) and the day view's per-reading curve (User Story 2).
- Values above 100% are left visible rather than flagged/explained in the UI (e.g. no disclaimer text), consistent with the app's existing practice of showing raw derived figures without editorializing.
