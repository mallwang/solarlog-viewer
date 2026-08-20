# Feature Specification: Compact Weather Display with Hover Detail

**Feature Branch**: `025-weather-icon-compact`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "I would like to display the weather information in a smaller way, just the icon and beneath the temperature. When the user hovers over the icon, the weather text should be shown (same that is now displayed as text)."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Compact weather glance (Priority: P1)

A visitor viewing the info panel sees the current weather condition as a small icon with the temperature shown beneath it, instead of the current full-width icon-plus-sentence layout (e.g. "☀️ Klar, 21°C").

**Why this priority**: This is the core visual change requested — reducing the footprint of the weather display is the entire point of the feature and delivers value on its own.

**Independent Test**: Load the info panel with weather data available; confirm the current-conditions area renders only an icon and a temperature value (no condition label text visible by default), and takes up visibly less horizontal space than before.

**Acceptance Scenarios**:

1. **Given** current weather data is available, **When** the info panel renders, **Then** the current-conditions area shows the weather icon with the temperature (e.g. "21°C") displayed beneath it, and the condition label (e.g. "Klar") is not shown as visible text.
2. **Given** the info panel has rendered the compact weather display, **When** compared to the previous layout, **Then** the weather area occupies less horizontal space in the panel.

---

### User Story 2 - Reveal full detail on hover (Priority: P2)

A visitor who wants to know the exact weather condition (not just the temperature) hovers over the weather icon and sees the same descriptive text that used to be displayed inline (condition label and temperature).

**Why this priority**: Preserves the information that was removed from the default view, so no data is lost — it's just tucked behind a hover interaction. This depends on User Story 1 existing first.

**Independent Test**: With the compact display in place, hover the pointer over the weather icon and verify a tooltip appears showing the same text previously shown inline (e.g. "Klar, 21°C"); moving the pointer away hides the tooltip.

**Acceptance Scenarios**:

1. **Given** the compact weather display is showing an icon and temperature, **When** the user hovers over the icon, **Then** a tooltip appears containing the condition label and temperature text that was previously shown directly in the panel.
2. **Given** the tooltip is visible, **When** the user moves the pointer away from the icon, **Then** the tooltip disappears.
3. **Given** a user relying on a keyboard or screen reader (no mouse hover available), **When** they reach the weather icon via focus/navigation, **Then** the same descriptive text is available to them through an accessible equivalent (e.g. focus-triggered tooltip or accessible name), not only via mouse hover.

---

### Edge Cases

- What happens when weather data is unavailable? The existing "weather unavailable" state must still be shown clearly (not hidden behind a hover-only interaction), matching the current behavior for the unavailable case.
- What happens on touch devices where hover doesn't exist? The full descriptive text must still be reachable, e.g. via tap-to-reveal or an always-accessible text equivalent, so touch users are not permanently blocked from the information.
- What happens if the temperature value is missing or invalid but the icon is available? The compact display should not show a broken/blank value; it should fall back to the existing unavailable-state handling.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The current-conditions weather display MUST show the weather icon with the temperature value positioned beneath it, replacing the current inline "icon + label, temperature" text layout.
- **FR-002**: The condition label text (e.g. "Klar", "Regen") MUST NOT be permanently visible in the compact display; it MUST be revealed only through the hover/detail interaction described in FR-003.
- **FR-003**: Hovering over the weather icon MUST reveal the same descriptive text previously shown inline (condition label and temperature, in the existing wording/format).
- **FR-004**: The revealed detail text MUST disappear when the pointer moves away from the icon.
- **FR-005**: The descriptive text MUST also be available to users who cannot hover (keyboard/touch/assistive technology), via an accessible equivalent such as focus-triggered display or an accessible name/description on the icon.
- **FR-006**: The existing "weather unavailable" state MUST remain visible by default (not hidden behind a hover interaction) — the compact layout applies only when weather data is available.
- **FR-007**: The change applies to the current-conditions weather display; the forecast entries (today/tomorrow, shown with a low–high temperature range) are unaffected by this feature and keep their existing layout.

### Key Entities

- **Current Weather Condition**: The live weather snapshot shown in the info panel, comprising a condition icon, a condition label (localized text), and a temperature value. This feature changes how it is displayed, not the underlying data.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The default weather display's on-screen footprint (width) is reduced compared to the previous text-based layout, as confirmed by visual inspection of the info panel.
- **SC-002**: 100% of the descriptive text previously visible by default remains accessible to users — either via mouse hover or an accessible equivalent for non-mouse users — with zero information loss.
- **SC-003**: Users can retrieve the full weather description (condition + temperature) within a single hover or focus interaction, with no additional clicks or navigation required.

## Assumptions

- "The weather text" refers to the current-conditions line only (e.g. "Klar, 21°C"), not the forecast entries, since the forecast shows a temperature range rather than a single temperature value that fits "beneath the icon."
- The temperature shown beneath the icon is the current temperature value already computed today (`Math.round(weather.temperatureC)°C`); no new calculation is introduced.
- The tooltip/hover text reuses the exact same wording and localization currently produced for the inline display (label + temperature), so no new translation strings are required beyond what's already used for the previous format string.
- Touch-device users get the descriptive text via tap-to-reveal or an always-present accessible label, consistent with standard tooltip accessibility patterns; the exact interaction mechanism is an implementation detail for the planning phase.
