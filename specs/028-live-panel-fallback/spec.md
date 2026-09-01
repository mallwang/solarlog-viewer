# Feature Specification: Live Panel Falls Back to Daily Last Value

**Feature Branch**: `028-live-panel-fallback`

**Created**: 2026-09-01

**Status**: Implemented

**Input**: User description: "I would like to adapt the live navbar panel to fallback to the normal daily value (which is displayed in the daily view as last value in the datatable) and use its time in the panel."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - See a real reading instead of "no data" whenever possible (Priority: P1)

A visitor loads the site and the live status endpoint has never answered successfully this session (e.g. it's down, slow, or blocked). Today the navbar panel shows a bare "no data yet" message. Instead, the visitor should see the most recent minute-level reading already available from today's daily data — the same figure they'd find as the last row of the day view's data table — along with the time it was recorded, so the panel almost always shows a real, attributable number rather than an empty state.

**Why this priority**: This is the entire point of the request — the daily minute data is already being fetched and displayed elsewhere in the app for today, so falling back to it costs nothing in new data sources and removes the most jarring failure mode (a panel showing nothing useful) in the overwhelming majority of cases.

**Independent Test**: With the live endpoint mocked to fail on every request, load the site and confirm the navbar panel shows today's daily data table's last recorded wattage and its timestamp instead of the "no data yet" state, whenever today's daily minute data has at least one recorded reading.

**Acceptance Scenarios**:

1. **Given** the live endpoint has never returned a successful reading this session, **When** today's daily minute data has at least one recorded reading, **Then** the navbar panel displays that reading's total wattage.
2. **Given** the panel is showing the daily-data fallback wattage, **When** it renders the "as of" indicator, **Then** the indicator reflects that reading's own recorded time, not the time the browser fetched or rendered it.
3. **Given** the live endpoint later returns a successful reading, **When** the next live poll completes, **Then** the panel switches from the daily-data fallback to the true live reading and its timestamp.

---

### User Story 2 - Fallback never overrides a real live reading already on screen (Priority: P2)

A visitor is looking at a panel that already shows a genuine live reading from earlier in the session. A single live poll then fails (a transient network hiccup). The visitor should keep seeing that live reading — the daily-data fallback must never replace a live reading that is already being shown.

**Why this priority**: Without this guarantee, a single flaky poll could regress the panel from a fresher live value to a coarser (and typically older) daily-data value, which would make the panel feel less reliable than before this feature, undermining the live-freshness goal of the navbar panel.

**Independent Test**: Let the live endpoint succeed once, then mock it to fail on the next poll, and confirm the panel keeps showing the earlier successful live reading and its timestamp rather than switching to the daily-data fallback.

**Acceptance Scenarios**:

1. **Given** the panel is currently showing a successfully-fetched live reading, **When** a subsequent live poll fails, **Then** the panel continues showing that live reading and its original timestamp, unchanged.

---

### User Story 3 - Neutral state remains when no reading of any kind exists (Priority: P3)

A visitor loads the site before today's daily data has recorded any readings yet (e.g. very early in the morning, before the plant has produced anything and before the daily minute file has been fetched or has any entries), and the live endpoint is also unavailable. The panel should show the existing neutral "no data yet" state rather than a misleading value.

**Why this priority**: Preserves the existing, already-shipped safety behavior (027's FR-006) for the residual case where neither data source has anything to offer; lower priority because it's the rarer edge, but it must not regress.

**Independent Test**: Mock the live endpoint to fail and today's daily minute data to have zero entries; confirm the panel still shows the neutral "no data yet" state, not a zero reading or an error.

**Acceptance Scenarios**:

1. **Given** the live endpoint has never succeeded this session, **When** today's daily minute data also has no recorded readings, **Then** the panel shows the same neutral "no data yet" state as before this feature.

---

### Edge Cases

- What happens when today's daily minute data is still loading at the moment the first live poll fails? The panel shows "no data yet" until either source resolves, then updates per Story 1/3 — it does not wait indefinitely for one source before considering the other.
- What happens when the daily-data fallback's last reading is itself old (e.g. the plant stopped producing hours ago and no newer minute entry exists)? It is still shown as-is, with its own recorded time in the "as of" indicator, so its age is honestly conveyed the same way a stale live reading's age would be — this feature does not invent a separate "stale" flag beyond the existing timestamp display.
- What happens when the daily-data fallback reading's wattage is `0`? It is shown as a genuine zero-production reading, the same as a live `0 W` reading is today.
- What happens when today rolls over to a new day while the panel is showing the daily-data fallback? The fallback follows the same "today" data the day view itself follows, so it reflects the new day's (initially empty) minute data on the next refresh, per Story 3's neutral state.
- What happens if the live endpoint starts succeeding again after the panel has been showing the daily-data fallback? Per Story 1's third scenario, the next successful live poll replaces the fallback.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST expose today's daily minute data's most recent recorded reading (total wattage and its own recorded time) to the navbar live panel — the same underlying data already used to render the last row of the day view's data table for today.
- **FR-002**: The navbar panel MUST display this daily-data fallback reading, with its own recorded time as the "as of" indicator, whenever no live-endpoint reading has ever succeeded this session (replacing today's "no data yet" state from 027-navbar-live-panel's FR-006) and today's daily minute data has at least one recorded reading.
- **FR-003**: The navbar panel MUST continue to display the "no data yet" state, unchanged from 027-navbar-live-panel's FR-006, when neither a live-endpoint reading nor a daily-data fallback reading is available.
- **FR-004**: Once the live endpoint has produced any successful reading this session, that live reading (and subsequent successful live readings) MUST take precedence over the daily-data fallback for the remainder of the session, even if a later live poll fails — the daily-data fallback MUST NOT replace an already-shown live reading.
- **FR-005**: The daily-data fallback reading's wattage MUST use the same display formatting/unit conventions as the live reading (FR-010 of 027-navbar-live-panel), and a fallback wattage of exactly `0` MUST render as a genuine zero-production reading, not the "no data yet" state.
- **FR-006**: The daily-data fallback MUST refresh in step with today's daily minute data's own existing refresh cycle (the 10-minute cycle already used for the day view), not the live panel's 1-minute poll — this feature does not add a new independent polling schedule for the fallback data.
- **FR-007**: The system MUST NOT introduce a new network request dedicated to this feature — the daily-data fallback MUST be derived from data the app already fetches for today's day view / daily data table.

### Key Entities

- **Daily Fallback Reading**: The last recorded entry of today's daily minute-level data (total wattage across inverters and its own recorded time), i.e. what the day view's data table already shows as its last row for today. Used by the navbar panel only as a substitute for a live reading that has never succeeded, never persisted separately from the daily minute data it's read from.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: When the live endpoint is unavailable but today has recorded production data, the navbar panel shows a real, timestamped wattage instead of "no data yet" in 100% of cases where today's daily minute data has at least one entry.
- **SC-002**: A live reading already shown on the panel is never replaced by the daily-data fallback for the rest of the session, in 100% of observed cases.
- **SC-003**: The "no data yet" state appears only when both the live endpoint has never succeeded and today's daily data has no entries — never merely because the live endpoint is temporarily down.

## Assumptions

- "Last value in the datatable" refers to today's daily minute-level data's most recent recorded entry, summed across inverters (the same total the live panel already displays) — matching what the day view's data table shows as its bottom row for today's date, not a per-inverter breakdown.
- The daily minute data for today is already being fetched by the app (for the day view / day-table) on its existing 10-minute refresh cycle; this feature reuses that data rather than fetching it independently for the navbar panel. If the navbar panel is visible on a page that would not otherwise fetch today's daily minute data, this feature is responsible for making that data available to the panel, but still on the existing 10-minute cadence rather than a new one.
- The daily-data fallback is scoped to today's date only — it does not fall back further to a previous day's last recorded value when today has no entries yet (Story 3 / edge cases).
- No additional visual treatment (badge, icon, color) distinguishes the daily-data fallback from a true live reading beyond the existing "as of HH:MM" timestamp — consistent with 027-navbar-live-panel's existing principle that the timestamp alone is what conveys a reading's freshness/staleness.
- This feature only changes the navbar panel's fallback behavior; it does not change the day view's data table itself, the live endpoint, or the 10-minute/1-minute refresh cadences established in 027-navbar-live-panel.
