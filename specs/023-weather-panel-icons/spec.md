# Feature Specification: Weather Panel Icons

**Feature Branch**: `023-weather-panel-icons`

**Created**: 2026-08-18

**Status**: Draft

**Input**: User description: "I would like to rework the weather panel we have in the navigation bar:

- instead of the "Aktuell:" prefix, I would like to show a small icon, similar like in the suggested @specs/018-day-night-sky/mockup.html and then the label and temperature (divided by a comma), e.g. <icon> Sonnig, 24°C
- below the "Heute:" prefix can stay but a small icon would also be nice here, then the temperature label and temperature value (should be shown in brackets using a human readable range, e.g. "Heute: <icon> Regen (13°C - 19°C)"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Scan current conditions at a glance (Priority: P1)

A visitor looking at the navigation bar's weather panel wants to know the current outdoor
conditions without reading a full sentence. Instead of the text prefix "Aktuell:", a small
weather icon representing the current condition appears first, immediately followed by the
condition label and the current temperature, separated by a comma (e.g. "☀️ Sonnig, 24°C").

**Why this priority**: This is the current-conditions line, the first thing users check, and the
one explicitly called out first in the request. It delivers the core visual improvement
(icon-first scanning) on its own.

**Independent Test**: Load any page with the info panel visible while weather data is available;
confirm the current-conditions line shows an icon, then the label, a comma, then the
temperature — with no "Aktuell:" text remaining.

**Acceptance Scenarios**:

1. **Given** current weather data is available and classified as "sunny", **When** the info
   panel renders, **Then** the current-conditions line shows the sunny icon followed by
   "Sonnig, 24°C" (label, comma, rounded temperature with unit) and no "Aktuell:" prefix.
2. **Given** current weather data is available and classified as "rain", **When** the info panel
   renders, **Then** the line shows the rain icon followed by "Regen, 11°C".
3. **Given** weather data is unavailable, **When** the info panel renders, **Then** the
   current-conditions line falls back to the existing unavailable-state text with no icon shown.

---

### User Story 2 - See today's forecast range with an icon (Priority: P2)

Below the current-conditions line, a visitor wants to see today's forecast at a glance. The
"Heute:" prefix stays, but is now followed by a small weather icon, then the forecast condition
label, then the temperature range shown in parentheses as a human-readable low–high range (e.g.
"Heute: 🌧️ Regen (13°C - 19°C)").

**Why this priority**: This is the secondary, supporting line (today's outlook) — valuable but
dependent on the same icon/label building blocks introduced in User Story 1, so it's ordered
second.

**Independent Test**: Load any page with the info panel visible while weather data is available;
confirm the forecast line reads "Heute:", then an icon, then the label, then the min–max range
in parentheses in that order.

**Acceptance Scenarios**:

1. **Given** today's forecast is available and classified as "rain" with a low of 13°C and a
   high of 19°C, **When** the info panel renders, **Then** the forecast line reads
   "Heute: 🌧️ Regen (13°C - 19°C)".
2. **Given** today's forecast low and high round to the same whole-degree value, **When** the
   info panel renders, **Then** the range still shows both bounds (e.g. "(14°C - 14°C)") rather
   than collapsing to a single value.
3. **Given** weather data is unavailable, **When** the info panel renders, **Then** the forecast
   line remains empty, matching current behavior.

---

### Edge Cases

- What happens when the weather condition maps to a category with no obvious matching icon
  (e.g. an unrecognized upstream weather code)? The classifier already has a defined fallback
  category ("cloudy"); the icon for that fallback category is shown, never a broken image or
  missing-icon placeholder.
- How does the panel behave for a screen reader user? The icon is decorative (the label text
  already conveys the same condition), so it must not introduce redundant or confusing
  announcements.
- How does the low/high range render when the forecast low is above the current temperature or
  the high is below it (unusual but possible with rounding at the edges of the day)? The range
  always shows low first, then high, regardless of how it compares to the current reading.
- What happens on narrow (mobile) viewports where horizontal space is tight? The icon must not
  cause the line to wrap in a way that separates the icon from its label, and must not be
  cropped or overlap adjacent text.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The current-conditions line MUST NOT display the "Aktuell:" text prefix.
- **FR-002**: The current-conditions line MUST display a small icon representing the current
  weather condition's category, positioned before the condition label.
- **FR-003**: The current-conditions line MUST display the condition label and the rounded
  current temperature (with unit) separated by a comma and a single space, in that order (icon,
  label, comma, temperature).
- **FR-004**: The forecast ("today") line MUST continue to display the existing "Heute:" text
  prefix.
- **FR-005**: The forecast line MUST display a small icon representing today's forecast weather
  condition's category, positioned after the "Heute:" prefix and before the condition label.
- **FR-006**: The forecast line MUST display the condition label followed by the temperature
  range in parentheses, formatted as "(low°C - high°C)" with both values rounded to the nearest
  whole degree, low value first.
- **FR-007**: The icon shown on each line MUST correspond to the same five weather categories
  ("sunny", "mixed", "cloudy", "rain", "snow") already used to classify weather elsewhere in the
  app, so the icon and the label always agree.
- **FR-008**: When weather data is unavailable, both lines MUST fall back to their current
  existing behavior (unavailable-state text for the current-conditions line, empty forecast
  line) with no icon shown.
- **FR-009**: Icons MUST be marked as decorative/non-semantic for assistive technology, since the
  adjacent text label already conveys the same information.
- **FR-010**: The reworked layout MUST remain legible and non-overlapping on both desktop and
  mobile navigation-bar widths.

### Key Entities

- **Weather Category Icon**: A small decorative visual glyph associated with one of the five
  existing Weather Background Categories (sunny, mixed, cloudy, rain, snow). Used identically on
  both the current-conditions line and the forecast line, chosen from the same category
  classification already computed for each reading.
- **Current-Conditions Line**: The navigation bar's info-panel text showing the icon, condition
  label, and current temperature, replacing the previous "Aktuell:" prefixed text.
- **Forecast Line**: The navigation bar's info-panel text showing "Heute:", the icon, the
  condition label, and the today low–high temperature range in parentheses.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can identify the current weather condition and temperature within 2 seconds
  of glancing at the navigation bar, without reading any label text, by recognizing the icon
  alone.
- **SC-002**: 100% of the five weather categories (sunny, mixed, cloudy, rain, snow) have a
  distinct, visually distinguishable icon shown correctly on both the current-conditions and
  forecast lines.
- **SC-003**: The reworked weather panel renders without visual overlap, clipping, or line
  wrapping that separates an icon from its label, across desktop and mobile navigation-bar
  widths.
- **SC-004**: No user-facing regression in the "weather data unavailable" fallback: the panel
  continues to communicate unavailability exactly as before, with no icon or broken-icon shown.

## Assumptions

- The five existing Weather Background Categories (sunny, mixed, cloudy, rain, snow) and their
  classification logic are reused unchanged as the basis for icon selection — no new weather
  categories are introduced by this feature.
- Icons are simple, small, static glyphs (comparable in scale and style to the emoji shown in the
  `018-day-night-sky` mockup) rather than animated or interactive elements.
- The existing German-language condition labels (e.g. "Sonnig", "Regen") and temperature
  rounding/formatting conventions are unchanged; only the surrounding prefix/icon/punctuation
  layout changes.
- "Heute:" stays as literal text per the user's explicit request, while "Aktuell:" is fully
  replaced by the icon — these two lines are intentionally allowed to diverge in structure.
- The forecast line's parenthesized range always shows low before high, matching how the
  low/max values are already sourced from the existing forecast data.
