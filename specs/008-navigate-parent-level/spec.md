# Feature Specification: Navigate to Parent Period

**Feature Branch**: `008-navigate-parent-level`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "I would like to enable the user to navigate from the child page to the parent page, e.g. from the current day to the month, from the month to the year, from the year to the total. A button similar like the "Heute" / "Dieser Monat" would be nice to have for the user to click on it to navigate"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Jump from a day to its containing month (Priority: P1)

A user viewing the yield data for a single day wants to see how that day fits into the wider month, without manually editing the URL or navigating back through the app's home page.

**Why this priority**: The day view is the most granular level users land on (e.g. from a "Heute" link or a deep link), and needing to zoom back out to monthly context is the most common escape hatch users will look for. It also proves out the pattern the other two levels reuse.

**Independent Test**: Open a day view for any date, click the new "parent" navigation control, and confirm the app shows the month view for the month that day belongs to. Deliverable on its own — no other level needs to exist for this to be useful.

**Acceptance Scenarios**:

1. **Given** the user is viewing the day view for 2026-03-15, **When** they click the "go to month" control, **Then** the app navigates to the month view for March 2026.
2. **Given** the user is viewing a day view reached via a deep link (no prior in-app navigation history), **When** they click the "go to month" control, **Then** the app still navigates to the correct containing month (the control does not depend on browser history).

---

### User Story 2 - Jump from a month to its containing year (Priority: P2)

A user viewing a month's yield data wants to step out to the year view to compare that month against the rest of the year.

**Why this priority**: Same pattern as day→month, one level up. Independently valuable and testable, but slightly less frequently needed than the day→month jump since users often arrive at month view directly from the year view already.

**Independent Test**: Open a month view for any year/month, click the "go to year" control, and confirm the app shows the year view for that year.

**Acceptance Scenarios**:

1. **Given** the user is viewing the month view for March 2026, **When** they click the "go to year" control, **Then** the app navigates to the year view for 2026.

---

### User Story 3 - Jump from a year to the all-time total (Priority: P3)

A user viewing a specific year's yield data wants to step out to the all-time total/overview page.

**Why this priority**: Least frequently needed of the three (the total view is typically an entry point, not a destination reached repeatedly), but completes the symmetric navigation model across all levels.

**Independent Test**: Open a year view for any year, click the "go to total" control, and confirm the app shows the total/overview view.

**Acceptance Scenarios**:

1. **Given** the user is viewing the year view for 2026, **When** they click the "go to total" control, **Then** the app navigates to the total/overview view.

---

### Edge Cases

- The total/overview view has no parent level: it MUST NOT display a "go to parent" control.
- The parent-navigation control is always enabled and always navigates to a real, valid parent period — unlike the existing "Heute"/"Dieser Monat" jump-to-current control, there is no "already there" state to disable for, since the parent period is always a distinct level from the child.
- Parent navigation must work identically regardless of how the child view was reached (deep link, prev/next stepping, "Heute" jump, or a previous parent-navigation click), since it derives the parent from the currently routed period rather than from navigation history.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The day view MUST display a control that navigates the user to the month view containing the currently displayed day.
- **FR-002**: The month view MUST display a control that navigates the user to the year view containing the currently displayed month.
- **FR-003**: The year view MUST display a control that navigates the user to the all-time total/overview view.
- **FR-004**: The total/overview view MUST NOT display a parent-navigation control, since it is the top of the hierarchy.
- **FR-005**: Each parent-navigation control MUST be labeled with text that clearly identifies its destination (e.g. the target month name, "This Year", or "Overview"), consistent with the existing localized labeling used by "Heute" / "Dieser Monat".
- **FR-006**: Parent-navigation controls MUST be visually and structurally consistent with the existing prev/next/"jump to current" navigation row already present on each view (same placement and styling family), so the addition reads as a natural extension of existing navigation rather than a separate feature.
- **FR-007**: Parent-navigation controls MUST be available in both supported UI languages (German and English), matching the localization already applied to "Heute" / "Dieser Monat".
- **FR-008**: Parent-navigation controls MUST always be actionable (never rendered disabled), since a valid parent period always exists for day, month, and year views.

### Key Entities

- **Period Hierarchy**: The four navigable levels — Day, Month, Year, Total — each nested inside the next (Day ⊂ Month ⊂ Year ⊂ Total). This feature adds one-directional "zoom out" links from each level to its immediate parent; it does not change the existing prev/next stepping or "jump to current period" behavior.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: From any day, month, or year view, a user can reach the correct parent view in a single click.
- **SC-002**: Users navigating from a child view always land on the parent period that actually contains the child period they started from (100% correctness — no mismatched month/year).
- **SC-003**: The total/overview view shows no broken or dead-end "go to parent" control, since none is displayed there.
- **SC-004**: The new controls are usable by German- and English-language users without any untranslated text appearing.

## Assumptions

- The app's existing four-level view hierarchy (Day, Month, Year, Total) and its routing scheme remain unchanged by this feature; this feature only adds new outward navigation links between existing views.
- "Parent" is defined purely by calendar containment (the month a day falls in, the year a month falls in), matching how the existing prev/next controls already reason about periods.
- The new controls are placed alongside the existing prev/next/"jump to current" navigation row on each view, not in a separate location, since the user's request explicitly compared them to the existing "Heute"/"Dieser Monat" control.
- No new keyboard shortcuts or gestures are required beyond a standard clickable/tappable control.
