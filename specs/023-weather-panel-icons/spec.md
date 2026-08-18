# Feature Specification: Weather Panel Icons

**Feature Branch**: `023-weather-panel-icons`

**Created**: 2026-08-18

**Status**: Draft

**Design**: See [design.md](./design.md) for the approved mockup and layout (icon/label
combinations, the nighttime "clear" override, and the Heute→Morgen forecast cutoff).

**Input**: User description: "I would like to rework the weather panel we have in the navigation bar:

- instead of the "Aktuell:" prefix, I would like to show a small icon, similar like in the suggested @specs/018-day-night-sky/mockup.html and then the label and temperature (divided by a comma), e.g. <icon> Sonnig, 24°C
- below the "Heute:" prefix can stay but a small icon would also be nice here, then the temperature label and temperature value (should be shown in brackets using a human readable range, e.g. "Heute: <icon> Regen (13°C - 19°C)"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Scan current conditions at a glance (Priority: P1)

A visitor looking at the navigation bar's weather panel wants to know the current outdoor
conditions without reading a full sentence. Instead of the text prefix "Aktuell:", a small
weather icon representing the current condition appears first, immediately followed by the
condition label and the current temperature, separated by a comma (e.g. "☀️ Sonnig, 24°C"
during the day). At night, a "sunny" reading instead shows a moon icon and the "clear" label
(e.g. "🌙 Klar, 11°C"), since calling a nighttime sky "sunny" reads as wrong even though the
underlying weather condition (clear sky) is the same one the "sunny" category already covers.

**Why this priority**: This is the current-conditions line, the first thing users check, and the
one explicitly called out first in the request. It delivers the core visual improvement
(icon-first scanning) on its own.

**Independent Test**: Load any page with the info panel visible while weather data is available;
confirm the current-conditions line shows an icon, then the label, a comma, then the
temperature — with no "Aktuell:" text remaining.

**Acceptance Scenarios**:

1. **Given** current weather data is available and classified as "sunny" during daytime, **When**
   the info panel renders, **Then** the current-conditions line shows the sunny (sun) icon
   followed by "Sonnig, 24°C" (label, comma, rounded temperature with unit) and no "Aktuell:"
   prefix.
2. **Given** current weather data is available and classified as "rain", **When** the info panel
   renders, **Then** the line shows the rain icon followed by "Regen, 11°C".
3. **Given** weather data is unavailable, **When** the info panel renders, **Then** the
   current-conditions line falls back to the existing unavailable-state text with no icon shown.
4. **Given** current weather data is available, classified as "sunny", and the current time is
   after sunset and before the next sunrise (nighttime), **When** the info panel renders, **Then**
   the current-conditions line shows a moon icon (not the sun icon) followed by "Klar, 11°C" (the
   "clear" label, not "Sonnig") and the current temperature — the underlying "sunny" weather
   classification is unchanged, only the current-conditions display swaps to its nighttime
   variant.
5. **Given** current weather data is available, classified as "rain" (or "mixed", "cloudy",
   "snow"), and it is nighttime, **When** the info panel renders, **Then** the line still shows
   that category's regular icon and label unchanged — the day/night display swap applies only to
   the "sunny" category on the current-conditions line.

---

### User Story 2 - See the relevant day's forecast range with an icon (Priority: P2)

Below the current-conditions line, a visitor wants to see the forecast for whichever day is
still practically relevant, at a glance: an icon, the forecast condition label, and the
temperature range shown in parentheses as a human-readable low–high range (e.g.
"Heute: 🌧️ Regen (13°C - 19°C)"). Since a "today" forecast becomes stale-feeling in the evening
— by 9pm, "today: high of 24°C" is no longer useful, tomorrow's outlook is — the line switches
from today's forecast to tomorrow's forecast at a fixed local hour of the day, swapping its own
prefix from "Heute:" to "Morgen:" at the same moment so the label always names the day the
figures actually describe. This cutoff hour is a fixed, developer-set value in the codebase
(`config.js`), not a setting exposed to end users; it defaults to 18:00 (6pm) local time.

**Why this priority**: This is the secondary, supporting line (day-ahead outlook) — valuable but
dependent on the same icon/label building blocks introduced in User Story 1, so it's ordered
second.

**Independent Test**: Load any page with the info panel visible while weather data is available,
before the configured cutoff hour; confirm the forecast line reads "Heute:", then an icon, then
the label, then today's min–max range in parentheses. Reload after the configured cutoff hour;
confirm the same line now reads "Morgen:" followed by tomorrow's icon/label/range instead.

**Acceptance Scenarios**:

1. **Given** the current local time is before the configured cutoff hour (default 18:00) and
   today's forecast is available, classified as "rain", with a low of 13°C and a high of 19°C,
   **When** the info panel renders, **Then** the forecast line reads
   "Heute: 🌧️ Regen (13°C - 19°C)".
2. **Given** the current local time is at or after the configured cutoff hour (default 18:00) and
   tomorrow's forecast is available, classified as "sunny", with a low of 9°C and a high of 21°C,
   **When** the info panel renders, **Then** the forecast line reads
   "Morgen: ☀️ Sonnig (9°C - 21°C)" — the prefix, icon, label, and range all describe tomorrow,
   not today.
3. **Given** the forecast low and high (whichever day is currently shown) round to the same
   whole-degree value, **When** the info panel renders, **Then** the range still shows both
   bounds (e.g. "(14°C - 14°C)") rather than collapsing to a single value.
4. **Given** weather data is unavailable, **When** the info panel renders, **Then** the forecast
   line remains empty, matching current behavior, regardless of which side of the cutoff hour the
   current time falls on.
5. **Given** the current local time crosses the configured cutoff hour while the page stays open
   (the panel's own poll/refresh cycle runs again after the cutoff), **When** the info panel
   next re-renders, **Then** the forecast line switches from "Heute:" + today's data to "Morgen:"
   - tomorrow's data without requiring a page reload.

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
- What happens right at the sunrise/sunset boundary, where the current reading and the local
  sunrise/sunset timestamps are only seconds apart? The current-conditions line uses a simple
  before/after comparison against today's sunrise and sunset (the same source data the sky
  background feature already uses); there is no separate twilight/dusk state — the display is
  either the daytime "sunny" variant or the nighttime "clear" variant.
- What happens if sunrise/sunset data cannot be resolved even though the current weather reading
  itself is available? The current-conditions line falls back to the daytime "sunny" display
  (sun icon, "Sonnig" label) rather than guessing at nighttime — the existing "sunny" behavior is
  the safer default when day/night cannot be determined.
- What happens exactly at the configured cutoff hour (e.g. local time reads precisely 18:00:00)?
  The cutoff is inclusive of its own hour — "at or after" the cutoff hour switches to "Morgen:"
  (FR-004), so 18:00:00 itself already shows tomorrow's forecast, not today's.
- What happens if tomorrow's forecast data fails to load while today's forecast and the current
  reading are still available, and it's already past the cutoff hour? The forecast line falls
  back to its existing empty "unavailable" state (FR-015) rather than showing an incorrect
  day's data under the wrong label.
- What happens if the panel is open across the cutoff hour without a page reload (e.g. left open
  overnight)? The next scheduled weather poll re-renders the forecast line with the new
  Heute/Morgen state — there is no separate "just crossed the cutoff" transition state or
  animation, it simply reflects the current time on its next refresh (FR-014's Acceptance
  Scenario 5).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The current-conditions line MUST NOT display the "Aktuell:" text prefix.
- **FR-002**: The current-conditions line MUST display a small icon representing the current
  weather condition's category, positioned before the condition label.
- **FR-003**: The current-conditions line MUST display the condition label and the rounded
  current temperature (with unit) separated by a comma and a single space, in that order (icon,
  label, comma, temperature).
- **FR-004**: The forecast line MUST display "Heute:" when the current local time is before the
  configured cutoff hour (FR-014), and "Morgen:" when it is at or after the cutoff hour — the
  prefix always names the same day whose icon/label/range are shown alongside it. Before the
  cutoff hour, this preserves the existing "Heute:"-prefixed behavior.
- **FR-005**: The forecast line MUST display a small icon representing the shown day's (today's
  or tomorrow's, per FR-004) forecast weather condition's category, positioned after the
  "Heute:"/"Morgen:" prefix and before the condition label.
- **FR-006**: The forecast line MUST display the condition label followed by the shown day's
  temperature range in parentheses, formatted as "(low°C - high°C)" with both values rounded to
  the nearest whole degree, low value first.
- **FR-007**: The icon shown on each line MUST correspond to the same five weather categories
  ("sunny", "mixed", "cloudy", "rain", "snow") already used to classify weather elsewhere in the
  app, so the icon and the label always agree — except for the nighttime "sunny" display variant
  described in FR-011, which overrides only the icon/label shown, not the underlying
  classification.
- **FR-008**: When weather data is unavailable, both lines MUST fall back to their current
  existing behavior (unavailable-state text for the current-conditions line, empty forecast
  line) with no icon shown.
- **FR-009**: Icons MUST be marked as decorative/non-semantic for assistive technology, since the
  adjacent text label already conveys the same information.
- **FR-010**: The reworked layout MUST remain legible and non-overlapping on both desktop and
  mobile navigation-bar widths.
- **FR-011**: When the current-conditions weather is classified as "sunny" AND the current time
  is nighttime (at or after today's sunset and before the next sunrise), the current-conditions
  line MUST display a moon icon (instead of the sunny/sun icon) and the "clear" condition label
  (instead of "Sonnig"/"Sunny") in place of the daytime sunny display; the current temperature and
  overall line structure (icon, label, comma, temperature) are otherwise unchanged. This applies
  only to the current-conditions line, only to the "sunny" category, and does not change the
  underlying weather classification used elsewhere.
- **FR-012**: The forecast line's icon/label MUST NOT get the current-conditions line's nighttime
  "sunny"→"clear" override (FR-011) — whichever day it summarizes (today or tomorrow, per
  FR-004), it always shows that day's daytime-style category icon/label (e.g. the sunny icon for
  a "sunny" classified day), since a whole-day forecast has no single instant to test for
  nighttime. This is independent of, and unaffected by, the Heute→Morgen day switch: switching
  which day is summarized does not introduce a day/night variant of its own.
- **FR-013**: If the day/night determination for the current-conditions line cannot be made
  (e.g. sunrise/sunset data is unavailable even though the current weather reading is available),
  the current-conditions line MUST fall back to the daytime "sunny" display rather than assuming
  nighttime.
- **FR-014**: The forecast line's Heute→Morgen cutoff hour MUST be a single fixed local-time hour
  (0–23), read from a developer-set constant in the codebase (not a user-facing setting, not
  persisted per-visitor), defaulting to **18** (6pm) when not otherwise overridden by whoever
  maintains the codebase.
- **FR-015**: If tomorrow's forecast data is unavailable (fetch/parse failure) while today's
  forecast and the current-conditions reading remain available, and the current time is at or
  after the cutoff hour, the forecast line MUST fall back to its existing "unavailable" empty
  state (FR-008) rather than silently showing stale today data under a "Morgen:" label, or
  today's data under a "Heute:" label past the cutoff.

### Key Entities

- **Weather Category Icon**: A small decorative visual glyph associated with one of the five
  existing Weather Background Categories (sunny, mixed, cloudy, rain, snow). Used identically on
  both the current-conditions line and the forecast line, chosen from the same category
  classification already computed for each reading — except the current-conditions line's own
  nighttime override (see Nighttime Clear Display below).
- **Current-Conditions Line**: The navigation bar's info-panel text showing the icon, condition
  label, and current temperature, replacing the previous "Aktuell:" prefixed text.
- **Forecast Line**: The navigation bar's info-panel text showing "Heute:" or "Morgen:" (per the
  configured cutoff hour, FR-014), the icon, the condition label, and the shown day's low–high
  temperature range in parentheses.
- **Forecast Cutoff Hour**: A fixed, developer-set local-time hour (default 18) at which the
  Forecast Line switches which day it summarizes — today before the cutoff, tomorrow at/after it
  — and its own prefix text switches correspondingly ("Heute:" → "Morgen:"). Not a per-visitor or
  UI-exposed setting.
- **Nighttime Clear Display**: A current-conditions-line-only override that applies when the
  classification is "sunny" and the current time falls between today's sunset and the next
  sunrise: a moon icon and a "clear" condition label replace the sunny icon/label, using the same
  sunrise/sunset day/night determination the existing sky-background feature already computes.
  Does not introduce a sixth Weather Background Category — the underlying classification stays
  "sunny"; only this one line's displayed icon/label changes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can identify the current weather condition and temperature within 2 seconds
  of glancing at the navigation bar, without reading any label text, by recognizing the icon
  alone.
- **SC-002**: 100% of the five weather categories (sunny, mixed, cloudy, rain, snow) have a
  distinct, visually distinguishable icon shown correctly on both the current-conditions and
  forecast lines, and the nighttime "sunny" override on the current-conditions line correctly
  shows a moon icon and "clear" label distinct from all five category icons/labels.
- **SC-003**: The reworked weather panel renders without visual overlap, clipping, or line
  wrapping that separates an icon from its label, across desktop and mobile navigation-bar
  widths.
- **SC-004**: No user-facing regression in the "weather data unavailable" fallback: the panel
  continues to communicate unavailability exactly as before, with no icon or broken-icon shown.
- **SC-005**: At every hour of the day, the forecast line's prefix ("Heute:"/"Morgen:") correctly
  names the day whose icon/label/range it displays — verified by loading the panel just before
  and just at/after the configured cutoff hour.

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
- Day/night for the current-conditions line's nighttime "clear" override is determined the same
  way the existing sky-background feature (`018-day-night-sky`) already determines it — comparing
  the current time against today's sunrise/sunset (and the next sunrise, if needed for
  correctness right after midnight) for the resolved installation location — rather than
  introducing a new, independent day/night source.
- "Clear" is a new, purely-display-level label distinct from the existing "sunny" label; it is
  not one of, and does not replace, the five Weather Background Categories used elsewhere in the
  app (sky background, forecast line).
- The Heute→Morgen cutoff hour is intentionally a single fixed, codebase-level constant (default 18) rather than a user-facing preference — nothing in the request calls for per-visitor
  configuration or a settings UI, so none is introduced by this feature.
- "Local time" for the cutoff-hour comparison means the viewer's own browser wall-clock hour (the
  same `new Date()`-based "today" boundary the info panel already uses for its yield-so-far
  figures, e.g. `todayParams()`), not a separately-resolved installation timezone — this matches
  existing precedent elsewhere in this same panel rather than introducing a new time source.
