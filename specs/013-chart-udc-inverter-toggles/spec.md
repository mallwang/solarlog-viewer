# Feature Specification: Chart UDC Toggle & Per-Inverter Stacked Bars

**Feature Branch**: `013-chart-udc-inverter-toggles`

**Created**: 2026-08-12

**Status**: Done

**Input**: User description: "I would like to enhance the diagrams with the following: 1.: the daily chart should also show the UDC value (summary if two strings), but as a disabled chart element, and only show when the user clicks in the legend on the UDC. 2.: the Monatserträge, Jahreserträge and Gesamterträge should allow the user to show the WR1 and WR2 values as part of the existing bar chart - the current single bar can simply be changed to a stacked bar."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Reveal DC voltage on the daily chart (Priority: P1)

A user viewing a single day's production chart wants to inspect the DC input voltage (UDC) alongside the existing feed-in power and efficiency series, but only when they specifically ask for it — the chart should not be cluttered with a third series by default.

**Why this priority**: This is the first of the two requested enhancements and delivers standalone value: it gives users a diagnostic view (voltage sag, string mismatch) they currently have no way to see at all in the day chart.

**Independent Test**: Open a day view for a day with recorded UDC readings. Confirm the UDC series is present in the legend but not drawn on the chart. Click the UDC legend entry and confirm the voltage line appears; click it again and confirm it hides. Reveal UDC, then reload the page (or open a different day) and confirm the UDC line is shown again without needing to click the legend.

**Acceptance Scenarios**:

1. **Given** a day chart with two inverter strings each reporting a DC voltage, and no previously persisted UDC choice, **When** the chart first renders, **Then** the legend shows a "UDC" entry but the chart area shows only the existing feed-in and efficiency series (no UDC line drawn).
2. **Given** the day chart described above, **When** the user clicks the "UDC" legend entry, **Then** a UDC line appears on the chart, plotted as the sum of both strings' voltage readings at each timestamp, and that shown state is persisted.
3. **Given** the UDC line is currently shown, **When** the user clicks the "UDC" legend entry again, **Then** the UDC line is hidden, the chart returns to its default view, and that hidden state is persisted.
4. **Given** a day with only one reporting string (the second string is offline or absent), **When** the user reveals UDC, **Then** the line reflects the single available string's voltage rather than being blank or zero.
5. **Given** the user hovers a data point while the UDC series is visible, **When** the tooltip appears, **Then** it includes the UDC value for that point alongside the existing series values.
6. **Given** the user previously revealed UDC on some day chart, **When** they open a day chart for a different day (including after a page reload), **Then** the UDC line is shown by default, without needing to click the legend entry again.

---

### User Story 2 - Toggle period totals between combined and per-inverter-string bars (Priority: P2)

A user viewing the monthly, yearly, or all-time totals chart (Monatserträge, Jahreserträge, Gesamterträge) wants to see how much of the total yield came from each inverter string (WR1 vs. WR2) as an alternative to the existing combined bar — not merged into it. By default the chart still shows the single "Gesamt" bar exactly as before; a switch lets the user opt into a stacked per-string view instead, and remembers that choice for next time.

**Why this priority**: This is the second requested enhancement. It builds on the existing bar charts already shared by these three views (see `buildBarOptions` reused by month/year/year-months) and delivers comparable diagnostic value, but is scoped after UDC since it touches three views rather than one.

**Independent Test**: Open the monthly totals view. Confirm it shows the single combined "Gesamt" bar by default, with the toggle set to "Gesamt". Switch the toggle to the per-inverter option and confirm each bar becomes a stacked bar (one segment per string) whose combined height equals the "Gesamt" bar's height, with the tooltip showing the combined total plus each string's value. Reload the page and confirm the same toggle selection is still applied.

**Acceptance Scenarios**:

1. **Given** a user opens the monthly totals (Monatserträge) view for the first time, **When** the chart renders, **Then** it shows the single combined "Gesamt" bar (as before this feature) and the toggle control shows "Gesamt" as selected.
2. **Given** the monthly totals view, **When** the user switches the toggle to the per-inverter option, **Then** each bar becomes a stacked bar with one segment per reporting string (WR1, WR2), and the combined bar height matches the "Gesamt" bar's height for that period.
3. **Given** the yearly totals (Jahreserträge) view and the all-time totals (Gesamterträge) view, **When** the user switches the toggle, **Then** the same combined/per-string switching applies to each month's or year's bar respectively.
4. **Given** a period where only one inverter string produced any yield, **When** the per-inverter option is selected, **Then** the bar shows a single visible segment for that string (the absent string contributes zero and is not visually distracting).
5. **Given** the toggle is set to "Gesamt", **When** the user hovers over a bar, **Then** the tooltip shows only the single combined value.
6. **Given** the toggle is set to the per-inverter option, **When** the user hovers over a bar, **Then** the tooltip shows the combined "Gesamt" value plus each string's individual value.
7. **Given** the user switches the toggle on any of the three totals views, **When** the user reloads the page or returns later (including on a different one of the three views), **Then** the same toggle selection is applied again, without the user having to reselect it.
8. **Given** either toggle state, **When** the user clicks a bar to drill into the next-finer view, **Then** the existing click-to-drill-down behavior continues to work exactly as before (clicking any part of a bar, including any segment when stacked, drills into that period).

---

### Edge Cases

- What happens when a day has no UDC readings at all (older backfilled data, e.g. `day-yield` fallback mode)? The UDC legend entry should not be offered, since there is nothing meaningful to plot.
- How does the per-inverter bar view handle a period with more than two configured inverter strings, if the installation ever has more? The stacking must generalize to however many strings the data contains, not hard-code two.
- How does the UDC line render for timestamps where one string is present and the other reports `null` (temporarily offline mid-day)? Sum only the present values for that point, consistent with how the existing feed-in series already treats missing per-inverter values.
- What happens to the legend toggle state when the user navigates away and back to the same or a different day? The user's last choice is persisted (e.g. via browser local storage) and applied automatically to the next day chart render, the same way the month/year/total toggle (User Story 2) is remembered — so a user who revealed UDC keeps seeing it on subsequent day charts until they hide it again.
- What happens the very first time a user opens the app, before any toggle selection has ever been persisted? The combined "Gesamt" bar is shown (the same default as if the user had explicitly chosen it).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The day chart MUST include a UDC (DC voltage) series representing the sum of all reporting inverter strings' voltage at each timestamp, matching the same per-point null-handling already used for the feed-in series (present values are summed, points with no data show as gaps).
- **FR-002**: The UDC series MUST be present in the day chart's legend but MUST NOT be drawn on the chart on initial render, unless the user has previously chosen to reveal it (FR-002a).
- **FR-002a**: The UDC line's shown/hidden state MUST be persisted (e.g. via browser local storage) and applied automatically the next time any day chart is opened, without requiring the user to reselect it. Absent any persisted choice, the default is hidden (FR-002).
- **FR-003**: Clicking the UDC legend entry MUST toggle the UDC line's visibility on the chart without affecting the visibility or state of the other series (feed-in, efficiency).
- **FR-004**: The day chart's tooltip MUST include the UDC value for the hovered point whenever the UDC series is currently visible, formatted as a voltage value.
- **FR-005**: The UDC legend entry MUST be omitted entirely on days where no UDC data exists (e.g. the `day-yield` fallback chart used for backfilled days).
- **FR-006**: The monthly totals (Monatserträge), yearly totals (Jahreserträge), and all-time totals (Gesamterträge) bar charts MUST offer a switch between two mutually-exclusive display modes: a single combined "Gesamt" bar per period (default), or a stacked bar with one segment per inverter string. The two MUST NOT be shown merged/combined into one option.
- **FR-006a**: The combined "Gesamt" bar mode MUST be the default shown on first use (no persisted selection yet) and MUST render identically to the single-bar chart that existed before this feature.
- **FR-007**: The sum of a stacked bar's segments MUST equal the combined "Gesamt" bar's value for that period, so no yield data is lost or double-counted between the two modes.
- **FR-008**: The tooltip's content MUST depend on the selected mode: in "Gesamt" mode it MUST show only the single combined value; in per-inverter mode it MUST show the combined "Gesamt" value plus every string's individual value for the hovered period.
- **FR-009**: The existing click-to-drill-down behavior on the month/year/year-months bar charts MUST continue to work in either mode, when a user clicks anywhere on a bar (any segment when stacked), navigating to the same next-finer view as before.
- **FR-010**: The per-inverter stacked rendering MUST generalize to the number of inverter strings present in the data rather than assuming exactly two.
- **FR-011**: Series/segment labels for inverter strings MUST be distinguishable per string (e.g. "WR1", "WR2") in both the legend and tooltip.
- **FR-012**: The user's selected display mode MUST be persisted (e.g. via browser local storage) and applied automatically the next time the user opens any of the three totals views, without requiring the user to reselect it each visit.

### Key Entities

- **UDC reading**: A per-inverter-string DC voltage sample recorded alongside each day's existing power readings; summed across strings to produce the chart's single UDC series value at each timestamp.
- **Inverter string yield**: The existing per-inverter yield figure already aggregated for month/year/all-time periods, now optionally surfaced per string as an individual stacked-bar segment instead of only as a pre-summed total, per the user's persisted display-mode selection.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can reveal the UDC line on any day chart with UDC data within a single click, with no page reload or navigation required.
- **SC-002**: The UDC line, once revealed, remains hidden again after a second click 100% of the time (no stuck-on state).
- **SC-002a**: A user's UDC shown/hidden choice on the day chart survives a page reload and carries over to any other day chart they open, 100% of the time.
- **SC-003**: On period-totals views, users can switch to the per-inverter view and identify each inverter string's individual contribution to a bar at a glance, without needing to open a separate view or export data.
- **SC-004**: Existing drill-down navigation (clicking a bar) continues to work without any regression in either display mode, verified across all three totals views (month, year, all-time).
- **SC-005**: Total yield values shown by the per-inverter stacked bars match the "Gesamt" bar's totals exactly (no value discrepancy introduced by switching modes).
- **SC-006**: A user's chosen display mode survives a page reload and carries over between the month/year/total views, 100% of the time.

## Assumptions

- "UDC" refers to the DC input voltage already recorded per inverter string in the underlying day data (`udcV`), summed across strings when both are present — consistent with how the user described it ("summary if two strings").
- The installation currently has two inverter strings (WR1/WR2), matching the existing `perInverter` data keyed `1`/`2`; the per-inverter bar implementation should not hard-code this count, per Edge Cases.
- "Disabled chart element" means the series exists in the chart's legend/data model but is not drawn until the user opts in via a legend click — not that the legend entry itself appears greyed-out or unclickable.
- No new data collection is required — UDC values needed for the day chart already exist in the day data, and per-inverter yield figures needed for the stacked bars already exist in the month/year/all-time data (`perInverter`).
- Chart color/series ordering conventions already established by the existing chart palette will be reused for the new UDC series and per-string bar segments, rather than introducing a new palette; the default "Gesamt" bar keeps its pre-existing color.
- The month/year/total toggle selection is a single shared preference (not per-view), consistent with how the existing language selection is persisted app-wide.
- This feature only concerns chart _visualization_ of existing data; no changes to data collection, storage, or the underlying `.js` data files are in scope.
