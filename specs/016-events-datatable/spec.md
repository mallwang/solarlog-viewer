# Feature Specification: Ereignisse (Events) Datatable

**Feature Branch**: `016-events-datatable`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "I would like to add a new page called \"Ereignisse\", which parses the web/data/events.js and web/data/events_day.js and displays them in a sortable and filterable datatable. It uses its own data format which is not documented yet, therefore some research is required to figure out the different event types and its meaning. The only source for this is in the legacy-site, which contains all historical parsing and algorithms."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse the inverter event log (Priority: P1)

A plant owner wants to see the history of state changes and faults reported by their inverters (e.g. "stopped", "derating", "grid undervoltage") as a readable table, instead of the raw semicolon-delimited data files the SolarLog device produces.

**Why this priority**: This is the core value of the feature — without a readable table, the event data is inaccessible to a non-technical user. Every other capability (sorting, filtering) builds on top of this list existing.

**Independent Test**: Open the Ereignisse page with no filters applied and confirm every event from `events.js` and `events_day.js` appears as one row with a human-readable start time, end time (or "ongoing"), inverter label, status description, and error description.

**Acceptance Scenarios**:

1. **Given** the Ereignisse page is opened, **When** the data finishes loading, **Then** a table is shown with one row per recorded event, most recent event first.
2. **Given** an event's end time is blank in the source data (the event is still active), **When** it is rendered, **Then** the row clearly indicates the event is ongoing (e.g. "still active") instead of showing an empty or malformed end time.
3. **Given** an event references a status or error code that has no matching label for that inverter, **When** it is rendered, **Then** the row shows a safe fallback label (e.g. "Offline" for unmatched status codes, "—" for the zero/no-error code) instead of a blank cell or raw numeric code.

---

### User Story 2 - Filter the event log (Priority: P2)

A plant owner troubleshooting a specific problem (e.g. "why did inverter 2 stop producing on a given day") wants to narrow the table down to just the events relevant to that inverter, day, status, or error type.

**Why this priority**: Filtering is what turns the raw list into a diagnostic tool — the legacy site's equivalent page's entire reason for existing is these filter dropdowns. It depends on Story 1's list being in place first.

**Independent Test**: With the full event list loaded, apply an inverter filter and confirm only that inverter's events remain; apply a day filter and confirm only events overlapping that day remain; apply a status or error filter and confirm only matching events remain. Filters can be combined and cleared independently.

**Acceptance Scenarios**:

1. **Given** the plant has more than one inverter, **When** the user selects a single inverter from the filter, **Then** only events for that inverter are shown and the other filter options (day, status, error) update to reflect what's available within that selection.
2. **Given** a day is selected from the filter, **When** applied, **Then** only events whose start or end date falls on that day are shown.
3. **Given** a status or error type is selected from the filter, **When** applied, **Then** only events with that exact status or error label are shown.
4. **Given** one or more filters are active, **When** the user resets/clears filters, **Then** the full event list is shown again.

---

### User Story 3 - Sort the event log by column (Priority: P3)

A user reviewing the table wants to reorder it — for example by duration to find the longest outages, or by inverter to group related events together — rather than only the default chronological order.

**Why this priority**: Sorting is a convenience on top of an already-filterable, already-readable table; valuable but not required for the page to deliver its core diagnostic purpose.

**Independent Test**: With the event list loaded, click each sortable column header in turn and confirm the row order changes accordingly and toggles between ascending/descending.

**Acceptance Scenarios**:

1. **Given** the table is showing its default order, **When** the user clicks the "start time" column header, **Then** rows re-sort chronologically and a second click reverses the order.
2. **Given** the table is showing its default order, **When** the user clicks the "inverter" column header, **Then** rows group and order by inverter.
3. **Given** filters are active, **When** the user changes the sort column, **Then** the sort applies only within the currently filtered rows (the filtered set does not change).

---

### Edge Cases

- What happens when `events.js` and `events_day.js` together contain zero events (e.g. a fresh install with no history yet)? The table shows an empty state rather than an error.
- What happens when the same event window appears in both `events.js` and `events_day.js` (day-file entries later folded into the historical file)? Duplicate rows MUST NOT be shown.
- How does the page handle an event whose inverter index has no corresponding inverter in the plant configuration (e.g. stale data after an inverter is removed)? It is still shown, labeled generically (e.g. "Inverter N") rather than dropped silently.
- How does the page handle a status or error code list that is shorter than the referenced code (device firmware reports a code beyond the known label list)? Fall back to the same "unlabeled code" handling as an unmatched code, showing the raw code number so the value is not lost.
- How does the page handle malformed or truncated lines in the source data (fewer fields than expected)? Skip the line rather than showing a broken row, without failing the whole page load.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST load and combine events from both `web/data/events.js` (historical archive) and `web/data/events_day.js` (current day, including any still-active/ongoing event), presenting them as a single unified list.
- **FR-002**: System MUST decode each event record's per-inverter status code and error code into their human-readable labels, using the same label lists (`StatusCodes`/`FehlerCodes`, keyed by inverter) the legacy site derives from `web/data/base_vars.js`.
- **FR-003**: System MUST display, per event row: the inverter, the start date/time, the end date/time (or an "ongoing" indicator when absent), the decoded status label, and the decoded error label (or a "no error" indicator for the zero/no-error code).
- **FR-004**: System MUST render the table with a default sort of most-recent event first.
- **FR-005**: Users MUST be able to sort the table by start time, inverter, and duration, toggling ascending/descending on repeated clicks of the same column.
- **FR-006**: Users MUST be able to filter the table by inverter, by day, by status label, and by error label, matching the filter dimensions offered on the legacy Ereignisse page.
- **FR-007**: Users MUST be able to combine multiple active filters and to clear all filters back to the unfiltered list.
- **FR-008**: System MUST deduplicate events that appear in both source files (an event carried over from `events_day.js` into `events.js` once the day rolls over) so it is shown exactly once.
- **FR-009**: System MUST skip malformed event lines (unexpected field count) without failing to load the remaining valid events.
- **FR-010**: System MUST apply the same "unmatched code" fallback behavior as the legacy site: a status code beyond the known label list displays as "Offline"; an error code of zero displays as no error; any other code with no matching label falls back to showing the raw numeric code.
- **FR-011**: System MUST NOT modify, rewrite, or preprocess `web/data/events.js` or `web/data/events_day.js` on disk — both are read and parsed client-side exactly as produced by the SolarLog device, consistent with the project's static-file data model.
- **FR-012**: The page MUST be reachable from the site's existing navigation alongside the other views (dashboard, daily/monthly/yearly charts, etc.), under a label reading "Ereignisse".

### Key Entities

- **Event**: A single state-change or fault record reported by one inverter. Attributes: start timestamp, end timestamp (nullable — absent means the event is still ongoing), inverter reference, status code, error code. Sourced from one line of `events.js` or `events_day.js`.
- **Status Label**: The human-readable meaning of an event's status code (e.g. "Stop", "Derating", "MPP search"), resolved per-inverter from the plant's configured status code list. Independent of Error Label — every event has exactly one status.
- **Error Label**: The human-readable meaning of an event's error code (e.g. "Grid overvoltage", "EEPROM fault", or "no error" for code zero), resolved per-inverter from the plant's configured error code list.
- **Inverter**: The plant's individual solar inverter that reported the event, identified by its index/number, already modeled elsewhere in the site (existing per-inverter configuration/labels).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can open the Ereignisse page and see the full combined event history rendered as a table within 3 seconds on a typical broadband connection.
- **SC-002**: A user can narrow thousands of events down to a single inverter's events for a single day using the provided filters in under 15 seconds, without needing to read raw data files.
- **SC-003**: 100% of event rows show a readable status and error description — no row displays a raw, undecoded numeric code as its only status/error information unless that code is genuinely unknown to the plant's configured label lists.
- **SC-004**: Sorting by any supported column reorders the full filtered set correctly on the first click, with no duplicate or missing rows compared to the unsorted view.

## Assumptions

- The status and error code label lists, and their per-inverter meaning, are sourced from `web/data/base_vars.js` (`StatusCodes[]`, `FehlerCodes[]`), the same source the legacy `events.html` page already uses — no new configuration file is introduced.
- The five semicolon-delimited fields in each event line are, in order: start date/time, end date/time (optional), inverter index, status code, error code — matching the field layout the legacy site's parser (`EventFields = 5`) expects.
- "Sortable and filterable" refers to client-side table interaction (no server round-trip), consistent with the project's fully static, client-side data model.
- Pagination/virtualization strategy for very large event histories (thousands of rows) is an implementation detail left to the planning phase; this spec only requires that the full filtered/sorted set be reachable, not that every row renders unpaginated at once.
- The event log is read-only in this feature — there is no requirement to acknowledge, dismiss, or annotate events from the UI.
