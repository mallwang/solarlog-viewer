# Feature Specification: Chart UDC Toggle & Per-Inverter Stacked Bars

**Feature Branch**: `013-chart-udc-inverter-toggles`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "I would like to enhance the diagrams with the following: 1.: the daily chart should also show the UDC value (summary if two strings), but as a disabled chart element, and only show when the user clicks in the legend on the UDC. 2.: the Monatserträge, Jahreserträge and Gesamterträge should allow the user to show the WR1 and WR2 values as part of the existing bar chart - the current single bar can simply be changed to a stacked bar."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reveal DC voltage on the daily chart (Priority: P1)

A user viewing a single day's production chart wants to inspect the DC input voltage (UDC) alongside the existing feed-in power and efficiency series, but only when they specifically ask for it — the chart should not be cluttered with a third series by default.

**Why this priority**: This is the first of the two requested enhancements and delivers standalone value: it gives users a diagnostic view (voltage sag, string mismatch) they currently have no way to see at all in the day chart.

**Independent Test**: Open a day view for a day with recorded UDC readings. Confirm the UDC series is present in the legend but not drawn on the chart. Click the UDC legend entry and confirm the voltage line appears; click it again and confirm it hides.

**Acceptance Scenarios**:

1. **Given** a day chart with two inverter strings each reporting a DC voltage, **When** the chart first renders, **Then** the legend shows a "UDC" entry but the chart area shows only the existing feed-in and efficiency series (no UDC line drawn).
2. **Given** the day chart described above, **When** the user clicks the "UDC" legend entry, **Then** a UDC line appears on the chart, plotted as the sum of both strings' voltage readings at each timestamp.
3. **Given** the UDC line is currently shown, **When** the user clicks the "UDC" legend entry again, **Then** the UDC line is hidden and the chart returns to its default view.
4. **Given** a day with only one reporting string (the second string is offline or absent), **When** the user reveals UDC, **Then** the line reflects the single available string's voltage rather than being blank or zero.
5. **Given** the user hovers a data point while the UDC series is visible, **When** the tooltip appears, **Then** it includes the UDC value for that point alongside the existing series values.

---

### User Story 2 - Break down period totals by inverter string (Priority: P2)

A user viewing the monthly, yearly, or all-time totals chart (Monatserträge, Jahreserträge, Gesamterträge) wants to see how much of the total yield came from each inverter string (WR1 vs. WR2), instead of only seeing a single combined bar per period.

**Why this priority**: This is the second requested enhancement. It builds on the existing bar charts already shared by these three views (see `buildBarOptions` reused by month/year/year-months) and delivers comparable diagnostic value, but is scoped after UDC since it touches three views rather than one.

**Independent Test**: Open the monthly totals view for a period with two active inverter strings. Confirm each bar is visually divided into two segments (one per string) whose combined height equals today's existing single-bar total, and that hovering shows both string values plus the combined total.

**Acceptance Scenarios**:

1. **Given** the monthly totals (Monatserträge) view for a period with two reporting inverter strings, **When** the chart renders, **Then** each bar is a stacked bar with one segment per string (WR1, WR2), and the combined bar height matches the previous single-bar total for that period.
2. **Given** the yearly totals (Jahreserträge) view, **When** the chart renders, **Then** the same per-string stacking applies to each month's bar.
3. **Given** the all-time totals (Gesamterträge) view, **When** the chart renders, **Then** the same per-string stacking applies to each year's bar.
4. **Given** a period where only one inverter string produced any yield, **When** the chart renders, **Then** the bar shows a single visible segment for that string (the absent string contributes zero and is not visually distracting).
5. **Given** a stacked bar, **When** the user hovers over it, **Then** the tooltip lists each string's individual yield plus the existing combined total.
6. **Given** a stacked bar chart in the monthly or yearly view, **When** the user clicks a bar to drill into the next-finer view, **Then** the existing click-to-drill-down behavior continues to work exactly as before (clicking any segment of a bar drills into that period).

---

### Edge Cases

- What happens when a day has no UDC readings at all (older backfilled data, e.g. `day-yield` fallback mode)? The UDC legend entry should not be offered, since there is nothing meaningful to plot.
- How does the stacked bar chart handle a period with more than two configured inverter strings, if the installation ever has more? The stacking must generalize to however many strings the data contains, not hard-code two.
- How does the UDC line render for timestamps where one string is present and the other reports `null` (temporarily offline mid-day)? Sum only the present values for that point, consistent with how the existing feed-in series already treats missing per-inverter values.
- What happens to the legend toggle state when the user navigates away and back to the same or a different day? Default is reset to hidden on every fresh chart render (no persistence across navigation), consistent with how ApexCharts resets its own state per render.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The day chart MUST include a UDC (DC voltage) series representing the sum of all reporting inverter strings' voltage at each timestamp, matching the same per-point null-handling already used for the feed-in series (present values are summed, points with no data show as gaps).
- **FR-002**: The UDC series MUST be present in the day chart's legend but MUST NOT be drawn on the chart on initial render.
- **FR-003**: Clicking the UDC legend entry MUST toggle the UDC line's visibility on the chart without affecting the visibility or state of the other series (feed-in, efficiency).
- **FR-004**: The day chart's tooltip MUST include the UDC value for the hovered point whenever the UDC series is currently visible, formatted as a voltage value.
- **FR-005**: The UDC legend entry MUST be omitted entirely on days where no UDC data exists (e.g. the `day-yield` fallback chart used for backfilled days).
- **FR-006**: The monthly totals (Monatserträge), yearly totals (Jahreserträge), and all-time totals (Gesamterträge) bar charts MUST render each bar as a stacked bar with one segment per inverter string, replacing today's single combined-total bar.
- **FR-007**: The sum of a stacked bar's segments MUST equal the combined total value currently shown by the single bar, so no yield data is lost or double-counted in the transition.
- **FR-008**: Each stacked bar chart's tooltip MUST show every string's individual value for the hovered period.
- **FR-009**: The existing click-to-drill-down behavior on the month/year/year-months bar charts MUST continue to work when a user clicks anywhere on a stacked bar (any segment), navigating to the same next-finer view as before.
- **FR-010**: The stacked bar rendering MUST generalize to the number of inverter strings present in the data rather than assuming exactly two.
- **FR-011**: Series/segment labels for inverter strings MUST be distinguishable per string (e.g. "WR1", "WR2") in both the legend and tooltip.

### Key Entities

- **UDC reading**: A per-inverter-string DC voltage sample recorded alongside each day's existing power readings; summed across strings to produce the chart's single UDC series value at each timestamp.
- **Inverter string yield**: The existing per-inverter yield figure already aggregated for month/year/all-time periods, now surfaced per string as an individual stacked-bar segment instead of only as a pre-summed total.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can reveal the UDC line on any day chart with UDC data within a single click, with no page reload or navigation required.
- **SC-002**: The UDC line, once revealed, remains hidden again after a second click 100% of the time (no stuck-on state).
- **SC-003**: On period-totals views, users can identify each inverter string's individual contribution to a bar at a glance, without needing to open a separate view or export data.
- **SC-004**: Existing drill-down navigation (clicking a bar) continues to work without any regression after the switch to stacked bars, verified across all three totals views (month, year, all-time).
- **SC-005**: Total yield values shown by the stacked bars match the previously-shown single-bar totals exactly (no value discrepancy introduced by the visual change).

## Assumptions

- "UDC" refers to the DC input voltage already recorded per inverter string in the underlying day data (`udcV`), summed across strings when both are present — consistent with how the user described it ("summary if two strings").
- The installation currently has two inverter strings (WR1/WR2), matching the existing `perInverter` data keyed `1`/`2`; the stacked-bar implementation should not hard-code this count, per Edge Cases.
- "Disabled chart element" means the series exists in the chart's legend/data model but is not drawn until the user opts in via a legend click — not that the legend entry itself appears greyed-out or unclickable.
- No new data collection is required — UDC values needed for the day chart already exist in the day data, and per-inverter yield figures needed for the stacked bars already exist in the month/year/all-time data (`perInverter`).
- Chart color/series ordering conventions already established by the existing chart palette will be reused for the new UDC series and per-string bar segments, rather than introducing a new palette.
- This feature only concerns chart _visualization_ of existing data; no changes to data collection, storage, or the underlying `.js` data files are in scope.
