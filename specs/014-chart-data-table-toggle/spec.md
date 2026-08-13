# Feature Specification: Chart Data Table Toggle

**Feature Branch**: `014-chart-data-table-toggle`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "I would like to enable the user to show a datatable based on the tailwind table "With condensed content" under each diagram. It should be able to activate via a button on the top right of each diagram. It should also be stored in the local storage for the whole app and stay across the pages."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Reveal the underlying data as a table (Priority: P1)

A user looking at a chart (day, month, year, or total view) wants to see the exact numbers behind the plotted lines/bars instead of estimating them visually. They click a button in the top-right corner of the chart, and a condensed data table appears directly below the chart, listing each data point (e.g. date/period and its values) in rows.

**Why this priority**: This is the entire feature — without it there is nothing to test or deliver. It provides immediate value by giving users exact figures on demand.

**Independent Test**: Open any chart page, click the table-toggle button, and verify a table with condensed rows appears beneath the chart showing the same data series as the chart. Clicking the button again hides the table.

**Acceptance Scenarios**:

1. **Given** a chart is displayed with its table hidden, **When** the user clicks the top-right toggle button, **Then** a condensed data table listing the chart's underlying data appears directly below that chart.
2. **Given** a chart's data table is visible, **When** the user clicks the toggle button again, **Then** the table is hidden and the button returns to its "off" appearance.
3. **Given** a chart's data table is visible, **When** the underlying chart data changes (e.g. new period selected within the same view), **Then** the table updates to reflect the newly displayed data.

---

### User Story 2 - Preference persists across pages and visits (Priority: P2)

A user who prefers viewing raw numbers turns the table on for one chart. When they navigate to another page (e.g. from the day view to the month view) or reload the app later, the table is shown automatically for every chart of that same view without needing to click the button again.

**Why this priority**: Persistence is what makes the toggle convenient rather than a one-off annoyance; it's explicitly requested but secondary to the table existing at all.

**Independent Test**: Enable the table for one chart, navigate to a different page/view, and confirm the table is visible there too without further interaction. Reload the browser and confirm the preference is still applied.

**Acceptance Scenarios**:

1. **Given** the user has enabled the data table on one chart, **When** they navigate to a different page containing a chart of the same view type, **Then** that chart's table is shown automatically.
2. **Given** the user has enabled the data table, **When** they reload the app or return in a new browser session, **Then** the table is shown by default, matching their last choice.
3. **Given** the user has disabled the data table (or never enabled it), **When** they load any page with a chart, **Then** no table is shown until they opt in.

---

### User Story 3 - Consistent condensed styling matching the design system (Priority: P3)

A user viewing the data table expects it to look and feel like the rest of the dashboard: compact rows, readable numeric alignment, and a look consistent between light and dark themes.

**Why this priority**: Visual polish and consistency matter but do not block the core reveal/hide/persist functionality.

**Independent Test**: Open the table on charts across the app and visually confirm the condensed row styling, alignment, and theme-appropriate colors match the Tailwind "condensed content" table pattern used elsewhere in the app.

**Acceptance Scenarios**:

1. **Given** the app is in light or dark theme, **When** a chart's data table is shown, **Then** its styling remains legible and consistent with the app's existing table conventions in that theme.
2. **Given** a chart with many data points (e.g. a full year), **When** its table is shown, **Then** rows remain compact and the table remains scrollable/usable rather than overflowing the page layout.

---

### Edge Cases

- What happens when a chart has no data for the current period (empty state)? The toggle button is still present, and if enabled, the table shows an empty/"no data" row rather than erroring.
- What happens when a chart type has multiple series (e.g. per-inverter breakdown)? The table includes a column per series shown in the chart, matching whatever breakdown mode (total vs. per-inverter) is currently active.
- What happens when the user toggles the table on a view type (e.g. day) — does it also affect other view types (month/year/total)? The persisted preference is a single app-wide on/off switch that applies to every chart, regardless of view type, per the user's request that it apply "for the whole app."
- What happens if local storage is unavailable or disabled (e.g. private browsing restrictions)? The button still functions for the current page session, defaulting to hidden, without breaking the page.
- What happens when the same page renders more than one chart at once? Each chart has its own toggle button, but since the preference is app-wide, toggling one chart's button updates the shared preference and all currently visible charts' tables accordingly.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display a toggle button in the top-right corner of every chart across the app (day, month, year, total views).
- **FR-002**: Clicking the toggle button MUST show or hide a data table positioned directly below its associated chart.
- **FR-003**: The data table MUST use the app's condensed-content table styling, with one row per data point/period shown in the chart and one column per data series shown in the chart (including per-inverter breakdown columns when that mode is active).
- **FR-004**: The visibility state MUST be persisted in local storage as a single app-wide preference (not per-chart or per-page).
- **FR-005**: On loading any page, each chart MUST render its table shown or hidden according to the persisted app-wide preference, defaulting to hidden when no preference has been stored yet.
- **FR-006**: Toggling the button on one chart MUST update the persisted preference such that all other charts currently rendered on the page (and any charts on subsequently visited pages) reflect the same shown/hidden state.
- **FR-007**: The table MUST stay in sync with the chart it belongs to — when the chart's displayed data changes (e.g. period navigation), the table MUST update to match without requiring the user to re-toggle it.
- **FR-008**: The toggle button MUST visually indicate its current state (e.g. pressed/active appearance when the table is shown).
- **FR-009**: If local storage is unavailable, the system MUST fall back to an in-memory/session default (hidden) without throwing errors or blocking chart rendering.

### Key Entities

- **Chart Table Preference**: A single app-wide boolean setting (shown/hidden) persisted in local storage, read on every page load and updated whenever any chart's toggle button is clicked.
- **Chart Data Row**: One row of the rendered table, corresponding to one plotted data point/period on the chart (e.g. one day, month, or year), containing the same values shown in the chart for that point.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can reveal the exact numeric values behind any chart within one click, with the table appearing in under 200ms of clicking the button.
- **SC-002**: A preference set on one page is honored on 100% of chart pages visited afterward within the same browser, without the user repeating the action.
- **SC-003**: The data table remains fully readable (no overlapping text, no horizontal page overflow) for charts with up to a year's worth of daily data points.
- **SC-004**: Users can distinguish the toggle's on/off state at a glance without needing to open the table to check.

## Assumptions

- "Under each diagram" means the table is inserted directly below the chart it describes, not in a separate panel or modal.
- "The whole app" means the on/off preference is a single shared setting, not tracked separately per view type or per page — consistent with how existing persisted chart preferences (e.g. transparency mode, breakdown mode) already work in this app.
- The "Tailwind condensed content" table refers to Tailwind UI's compact/condensed table pattern (dense padding, small text) already used elsewhere in this app's design language; no new visual design system is introduced.
- The data table reflects whatever the chart currently displays (e.g. per-inverter breakdown columns only when that toggle is active), rather than always showing every possible underlying field.
- No export/download/sorting/filtering capability is required for the table in this feature — it is a read-only reflection of the chart's plotted data.
