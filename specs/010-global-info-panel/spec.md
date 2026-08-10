# Feature Specification: Global Desktop Info Panel

**Feature Branch**: `010-global-info-panel`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "I would like to introduce a global information field for using on desktop clients, that shows the current produced energy, the current weather, the forecast for today. Furthermore, clicking on the weather information, it should forward to the wetteronline.com for the given location (this is what the plant owner normally uses for weather forecasts). There should also be a animation for the produced energy that adapts to the amount of energy."

## User Scenarios & Testing _(mandatory)_

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - At-a-glance production status on desktop (Priority: P1)

A visitor viewing the dashboard on a desktop-sized screen sees a persistent information panel showing the plant's current produced energy, without having to navigate into a specific day/month/year view.

**Why this priority**: This is the core value of the feature — surfacing the plant's live status at a glance from anywhere in the dashboard. Without it, the rest of the panel (weather, forecast, animation) has nothing to anchor to.

**Independent Test**: Load the dashboard on a desktop-width viewport and verify the panel displays a current production value that matches the plant's latest available production reading.

**Acceptance Scenarios**:

1. **Given** the dashboard is open on a desktop-sized screen, **When** the page loads, **Then** the info panel is visible and shows the current produced energy value.
2. **Given** the info panel is visible, **When** new production data becomes available (e.g. periodic refresh), **Then** the displayed value updates to reflect the latest reading without a full page reload.
3. **Given** current production data cannot be retrieved, **When** the panel renders, **Then** it shows a clear "no data" state instead of a stale or misleading value.
4. **Given** the dashboard is viewed on a narrow/mobile-sized screen, **When** the page loads, **Then** the panel is hidden or not rendered, so it does not crowd the mobile layout.

---

### User Story 2 - Current weather and today's forecast alongside production (Priority: P2)

A visitor looks at the same info panel and also sees the current weather conditions and the forecast for the rest of today at the plant's installation location, so they can relate production to expected conditions without leaving the page.

**Why this priority**: This builds directly on the panel established in User Story 1 and answers the natural follow-up question ("why is production high/low right now"), but the panel is still useful without it.

**Independent Test**: Load the dashboard and verify the panel shows the current weather condition and a same-day forecast summary for the installation's configured location, matching what a weather source reports for that location and time.

**Acceptance Scenarios**:

1. **Given** the info panel is visible, **When** the page loads, **Then** it shows the current weather condition (e.g. clear, cloudy, rain) for the installation's location.
2. **Given** the info panel is visible, **When** the page loads, **Then** it shows a forecast summary for the remainder of today (e.g. expected conditions and/or temperature range) for the installation's location.
3. **Given** weather/forecast data cannot be retrieved, **When** the panel renders, **Then** the weather and forecast area shows a clear "unavailable" state while the production value continues to display normally.

---

### User Story 3 - Jump to detailed forecast on wetteronline.com (Priority: P2)

A visitor clicks or taps the weather/forecast area of the info panel and is taken to the corresponding location's forecast page on wetteronline.com in a new tab, matching the source the plant owner already relies on for planning.

**Why this priority**: This is a small but concrete, explicitly requested piece of value — a one-click shortcut to the plant owner's trusted, more detailed weather source. It depends on the weather area from User Story 2 existing first.

**Independent Test**: Click the weather/forecast area of the panel and verify a new browser tab opens to a wetteronline.com forecast page for the installation's configured location.

**Acceptance Scenarios**:

1. **Given** the info panel shows current weather/forecast, **When** the visitor clicks or taps that area, **Then** a new tab opens to the wetteronline.com forecast page for the installation's location.
2. **Given** the installation's location cannot be resolved to a wetteronline.com location, **When** the visitor clicks the weather area, **Then** the click either does nothing or opens wetteronline.com's generic/search page rather than an error or a wrong location's forecast.

---

### User Story 4 - Production animation that reflects the amount of energy (Priority: P3)

A visitor watching the info panel sees a visual animation next to the current produced energy value whose intensity (e.g. speed, size, or activity level) increases as production increases and decreases as production drops, giving an immediate, glanceable sense of "how much" beyond the raw number.

**Why this priority**: This is a polish/delight layer on top of the numeric value from User Story 1. The panel remains fully useful without it, so it is the lowest priority.

**Independent Test**: Observe the panel under a known low-production reading and a known high-production reading (or simulate both) and verify the animation is visibly calmer/sparser at low production and visibly more active at high production.

**Acceptance Scenarios**:

1. **Given** current production is at or near zero (e.g. nighttime), **When** the panel is viewed, **Then** the animation is at its calmest/idle state.
2. **Given** current production is at or near the plant's typical peak output, **When** the panel is viewed, **Then** the animation is at its most active/intense state.
3. **Given** production is between zero and peak, **When** the panel is viewed, **Then** the animation's intensity scales proportionately between the idle and most-active states.
4. **Given** the production value updates, **When** the new value differs meaningfully from the previous one, **Then** the animation transitions smoothly rather than jumping abruptly.

---

### Edge Cases

- What happens when the dashboard is viewed for an installation whose location data is missing or incomplete? → Panel still shows current production; weather/forecast area shows an "unavailable" state; the weather area is not clickable (or links to wetteronline.com's generic search) since no location is available.
- What happens when production data momentarily spikes or drops due to a sensor glitch? → The animation and displayed value should reflect the latest confirmed reading; the feature does not need to filter or smooth sensor noise beyond what existing production-data handling already does.
- How does the panel behave while a page navigation (e.g. switching from day to month view) occurs? → The panel persists across in-app navigation rather than disappearing and re-appearing, since it is a global element.
- What happens if the visitor resizes the browser window from desktop to mobile width while the panel is visible? → The panel hides once the viewport crosses into the mobile breakpoint, consistent with it being a desktop-only element.
- What happens when the plant has multiple inverters/strings? → The current produced energy value represents the plant's total current output, not a single inverter.
- What happens if the panel polls before the SolarLog device has written its next update (device updates only every 10 minutes)? → The panel keeps showing the last retrieved value rather than flickering to "no data"; a value is only replaced once a genuinely newer reading is available.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display a persistent information panel on desktop-width screens, visible across all dashboard views (day/month/year/overview).
- **FR-002**: System MUST hide the info panel on mobile-width screens.
- **FR-003**: The info panel MUST show the plant's current total produced energy (power output), using the most recent available reading.
- **FR-004**: System MUST refresh the displayed production value periodically without requiring a full page reload, polling no more often than every 10 minutes — the SolarLog device's own data-file update interval (its minimum configurable interval), so more frequent polling would not surface newer data.
- **FR-005**: The info panel MUST show the current weather condition for the installation's configured location.
- **FR-006**: The info panel MUST show a forecast summary for the remainder of the current day for the installation's configured location.
- **FR-007**: The weather/forecast area of the panel MUST be clickable and open, in a new browser tab, the corresponding forecast page on wetteronline.com for the installation's configured location.
- **FR-008**: System MUST show a clear "no data" or "unavailable" state for the production value and/or the weather/forecast area independently, when either data source cannot be retrieved, without blocking the other from displaying.
- **FR-009**: The info panel MUST include a visual animation associated with the current produced energy value, whose intensity scales with the magnitude of current production (idle/calm near zero, most active near the plant's typical peak output).
- **FR-010**: The production animation MUST transition smoothly as the underlying value changes rather than changing abruptly between refreshes.
- **FR-011**: The info panel MUST remain visible and retain its state as the visitor navigates between in-app dashboard views (it is a global element, not tied to one view).
- **FR-012**: System MUST derive the installation's location for both the weather/forecast data and the wetteronline.com link from the existing installation configuration, without requiring separate manual entry.

### Key Entities

- **Current Production Reading**: The plant's most recent total power output value and its timestamp; drives both the displayed number and the animation intensity.
- **Current Weather Condition**: The present weather state (e.g. clear, cloudy, rain) at the installation's location, sourced the same way as the existing dashboard weather integration.
- **Today's Forecast Summary**: A same-day outlook (expected conditions and/or temperature range) for the installation's location.
- **Installation Location**: The configured geographic location of the plant, used to resolve both weather data and the corresponding wetteronline.com forecast page.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A visitor on a desktop-width screen can see the plant's current production, current weather, and today's forecast within 2 seconds of the dashboard finishing its initial load, without navigating away from the page they landed on.
- **SC-002**: A visitor can reach the plant owner's usual detailed weather source (wetteronline.com, at the correct location) in a single click from anywhere in the dashboard.
- **SC-003**: The production animation's activity level visibly and correctly distinguishes low-production from high-production states in side-by-side observation, without reading the numeric value.
- **SC-004**: The info panel never displaces or overlaps existing dashboard content on desktop widths, and is fully absent (contributes no layout space) on mobile widths.
- **SC-005**: When either the production feed or the weather feed is temporarily unavailable, the other continues to display correctly, with 100% of observed failure cases showing a clear unavailable state rather than a broken or blank panel.

## Assumptions

- "Desktop clients" means the existing desktop breakpoint already used elsewhere in the dashboard's responsive layout (as distinct from the existing mobile/burger-menu breakpoint); the panel is not shown below that breakpoint.
- "Current produced energy" refers to the plant's current total power output (not cumulative energy for the day), consistent with what visitors typically mean by "how much is it producing right now."
- The installation's location for weather and the wetteronline.com link is the same location already used by the existing dynamic weather/sky background feature (resolved from the installation's configured coordinates/address), so no new location input is introduced.
- The wetteronline.com link opens in a new tab so visitors do not lose their place on the dashboard.
- "Typical peak output" for scaling the animation is derived from the installation's known/configured plant capacity, consistent with how peak output is referenced elsewhere in the dashboard (e.g. existing charts), rather than a newly invented threshold.
- The forecast summary is a lightweight, glanceable summary (not a full multi-day or hourly breakdown) — visitors wanting more detail are expected to use the wetteronline.com link.
- Refresh cadence for the production value is tied to the SolarLog device's own update behavior: the device writes fresh data to the data folder every 10 minutes (the shortest interval the device supports), so the panel polls on a matching ~10-minute cadence rather than a shorter interval that would only re-read the same unchanged file.
