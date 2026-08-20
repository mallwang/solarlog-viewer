# Feature Specification: Compact Weather Display with Hover Detail

**Feature Branch**: `025-weather-icon-compact`

**Created**: 2026-08-20

**Status**: Draft

**Input**: User description: "I would like to display the weather information in a smaller way, just the icon and beneath the temperature. When the user hovers over the icon, the weather text should be shown (same that is now displayed as text)."

**Design**: [design.md](./design.md) — approved layout mockup for both indicators and the divider between them.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Compact weather glance (Priority: P1)

A visitor viewing the info panel sees both the current weather condition and the forecast as small icons with their temperature shown beneath, instead of the current full-width icon-plus-sentence layout (e.g. "☀️ Klar, 21°C" and "Morgen: 🌧️ Regen (11°C - 17°C)"). The two indicators sit side by side, separated by a visible divider so they read as two distinct pieces of information rather than one run-on line.

**Why this priority**: This is the core visual change requested — reducing the footprint of the weather display is the entire point of the feature and delivers value on its own.

**Independent Test**: Load the info panel with weather data available; confirm the current-conditions area renders only an icon and a temperature value, and the forecast area renders only an icon and a temperature range (no condition label text visible by default in either), separated by a divider, and takes up visibly less horizontal space than before.

**Acceptance Scenarios**:

1. **Given** current weather data is available, **When** the info panel renders, **Then** the current-conditions indicator shows the weather icon with the temperature (e.g. "21°C") displayed beneath it, and the condition label (e.g. "Klar") is not shown as visible text.
2. **Given** forecast data is available, **When** the info panel renders, **Then** the forecast indicator shows the forecast icon with the temperature range (e.g. "11°C - 17°C") displayed beneath it, and the condition label (e.g. "Regen") and the "Heute:"/"Morgen:" prefix are not shown as visible text.
3. **Given** both indicators are rendered, **When** the info panel is viewed, **Then** a visible divider (e.g. a vertical bar or border) separates the current-conditions indicator from the forecast indicator.
4. **Given** the info panel has rendered the compact weather display, **When** compared to the previous layout, **Then** the weather area occupies less horizontal space in the panel.

---

### User Story 2 - Reveal full detail on hover (Priority: P2)

A visitor who wants the full description hovers over either weather icon and sees the same descriptive text that used to be displayed inline for that indicator: the condition label and temperature for current conditions, or the day prefix, condition label, and temperature range for the forecast.

**Why this priority**: Preserves the information that was removed from the default view, so no data is lost — it's just tucked behind a hover interaction. This depends on User Story 1 existing first.

**Independent Test**: With the compact display in place, hover the pointer over the current-conditions icon and verify a tooltip shows the previous inline text (e.g. "Klar, 21°C"); hover over the forecast icon and verify its tooltip shows the previous inline text including the day prefix (e.g. "Heute: Regen (15°C - 19°C)"); moving the pointer away hides each tooltip.

**Acceptance Scenarios**:

1. **Given** the compact current-conditions indicator is showing an icon and temperature, **When** the user hovers over that icon, **Then** a tooltip appears containing the condition label and temperature text that was previously shown directly in the panel (e.g. "Klar, 21°C").
2. **Given** the compact forecast indicator is showing an icon and temperature range, **When** the user hovers over that icon, **Then** a tooltip appears containing the day prefix, condition label, and temperature range that was previously shown directly in the panel (e.g. "Heute: Regen (15°C - 19°C)").
3. **Given** either tooltip is visible, **When** the user moves the pointer away from that icon, **Then** the tooltip disappears.
4. **Given** a user relying on a keyboard or screen reader (no mouse hover available), **When** they reach either weather icon via focus/navigation, **Then** the same descriptive text is available to them through an accessible equivalent (e.g. focus-triggered tooltip or accessible name), not only via mouse hover.

---

### Edge Cases

- What happens when current-conditions data is unavailable but forecast data is available, or vice versa? Each indicator's availability is independent; the unavailable one must still be shown clearly (not hidden behind a hover-only interaction), matching the current behavior for the unavailable case, while the available one renders normally.
- What happens on touch devices where hover doesn't exist? The full descriptive text must still be reachable, e.g. via tap-to-reveal or an always-accessible text equivalent, so touch users are not permanently blocked from the information.
- What happens if the temperature value (or range) is missing or invalid but the icon is available? The compact display should not show a broken/blank value; it should fall back to the existing unavailable-state handling.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The current-conditions weather indicator MUST show the weather icon with the temperature value positioned beneath it, replacing the current inline "icon + label, temperature" text layout.
- **FR-002**: The condition label text (e.g. "Klar", "Regen") MUST NOT be permanently visible in either compact indicator; it MUST be revealed only through the hover/detail interaction described in FR-004.
- **FR-003**: The forecast weather indicator MUST show the forecast icon with the temperature range positioned beneath it, replacing the current inline "prefix: icon + label (low°C - high°C)" text layout. Neither the condition label nor the "Heute:"/"Morgen:" day prefix is permanently visible in this compact form.
- **FR-004**: Hovering over the current-conditions icon MUST reveal the same descriptive text previously shown inline for it (condition label and temperature, in the existing wording/format, e.g. "Klar, 21°C"). Hovering over the forecast icon MUST reveal the same descriptive text previously shown inline for it, including the day prefix (e.g. "Heute: Regen (15°C - 19°C)").
- **FR-005**: Each revealed detail text MUST disappear when the pointer moves away from its icon.
- **FR-006**: The descriptive text for each indicator MUST also be available to users who cannot hover (keyboard/touch/assistive technology), via an accessible equivalent such as focus-triggered display or an accessible name/description on that icon.
- **FR-007**: The existing "unavailable" state for each indicator MUST remain visible by default (not hidden behind a hover interaction) — the compact layout for an indicator applies only when its underlying data is available; current-conditions and forecast availability are independent of each other.
- **FR-008**: A visible divider (e.g. a vertical bar or a border) MUST separate the current-conditions indicator from the forecast indicator, so the two read as distinct pieces of information rather than one continuous line.

### Key Entities

- **Current Weather Condition**: The live weather snapshot shown in the info panel, comprising a condition icon, a condition label (localized text), and a temperature value. This feature changes how it is displayed, not the underlying data.
- **Weather Forecast**: The today/tomorrow forecast shown in the info panel, comprising a day prefix, a condition icon, a condition label (localized text), and a low–high temperature range. This feature changes how it is displayed, not the underlying data or the today/tomorrow day-switch logic.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The default weather display's on-screen footprint (width) is reduced compared to the previous text-based layout, as confirmed by visual inspection of the info panel.
- **SC-002**: 100% of the descriptive text previously visible by default remains accessible to users — either via mouse hover or an accessible equivalent for non-mouse users — with zero information loss.
- **SC-003**: Users can retrieve the full weather description (condition + temperature) within a single hover or focus interaction, with no additional clicks or navigation required.

## Assumptions

- Both the current-conditions indicator and the forecast indicator are compacted the same way: icon on top, a temperature value (single value for current conditions, low–high range for forecast) beneath it, full text revealed on hover/focus.
- The temperature/range values shown beneath each icon are the values already computed today (`Math.round(weather.temperatureC)°C` for current conditions; the existing rounded low/high for forecast); no new calculation is introduced.
- The tooltip/hover text for each indicator reuses the exact same wording and localization currently produced for its inline display (including the "Heute:"/"Morgen:" prefix for the forecast), so no new translation strings are required beyond what's already used for the previous format strings.
- The divider between the two indicators is a simple visual separator (vertical bar or border) with no interactive behavior of its own; its exact styling is an implementation detail for the planning phase.
- Touch-device users get the descriptive text via tap-to-reveal or an always-present accessible label, consistent with standard tooltip accessibility patterns; the exact interaction mechanism is an implementation detail for the planning phase.
