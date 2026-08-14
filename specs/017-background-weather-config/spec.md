# Feature Specification: Configurable Weather Backgrounds

**Feature Branch**: `017-background-weather-config`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "I would like to enhance the background weather animation with a fixed set of backgrounds: sunny, mixed, cloudy, rain, snow. Currently there are already some of them which should be extended and triggered at certain criteria based on the already requested weather api and the navigation bar text should match to the selected background (this requires to at first check which values are returned from the api). Furthermore, I would like to allow the user to configure the background weather settings in the config file (enable/disable like "off"/"auto", and to overwrite it with a fixed weather like "sunny", "rain")."

**Design**: See [design.md](./design.md) for the approved mockup and layout notes.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Background matches real weather, consistently with the nav bar (Priority: P1)

As a site visitor, when I load the dashboard I see an animated sky background that visually matches the real current weather at the plant's location (one of: sunny, mixed, cloudy, rain, snow). While the background-weather setting is on automatic, this matches what the navigation bar's own weather text already reports, because both read the same live conditions — the nav bar itself always shows the real, current weather and forecast regardless of the background setting (see User Story 2/3), since that information matters to visitors on its own.

**Why this priority**: This is the core value of the feature — today the background only distinguishes three cloud-cover tiers (clear/partly/overcast) with no rain or snow treatment, and it is derived independently from the nav bar's own weather text, which uses a different, more detailed classification of the same API response. Visitors currently can see a "rain" label in the nav bar while the background still shows plain clouds. Deriving both from one shared classification (so they naturally agree whenever the background is live) is the improvement being asked for.

**Independent Test**: Can be fully tested by loading the site while the plant's location is experiencing each of the five conditions (or by stubbing the weather API response) and confirming the background style and the nav bar text both name the same condition.

**Acceptance Scenarios**:

1. **Given** the background-weather setting is "auto" and the weather API reports clear sky, **When** the dashboard loads, **Then** the "sunny" background is shown and the nav bar's weather text reads the matching "clear"/"sunny" label.
2. **Given** the background-weather setting is "auto" and the weather API reports light/partial cloud cover, **When** the dashboard loads, **Then** the "mixed" background is shown and the nav bar's weather text reads the matching label.
3. **Given** the background-weather setting is "auto" and the weather API reports overcast/heavy cloud cover, **When** the dashboard loads, **Then** the "cloudy" background is shown and the nav bar's weather text reads the matching label.
4. **Given** the background-weather setting is "auto" and the weather API reports any form of rain or drizzle, **When** the dashboard loads, **Then** the "rain" background is shown and the nav bar's weather text reads the matching label.
5. **Given** the background-weather setting is "auto" and the weather API reports any form of snow, **When** the dashboard loads, **Then** the "snow" background is shown and the nav bar's weather text reads the matching label.
6. **Given** the background-weather setting is "auto" and the site is already open, **When** the next scheduled weather poll returns a different condition, **Then** the background updates to the new condition, and the nav bar text (already independently polling and reporting live conditions) reads the same condition.
7. **Given** each of the five backgrounds, **When** it is displayed, **Then** it renders as its own animated treatment (not a static image) consistent with how the sky background already animates today.

---

### User Story 2 - Operator disables the weather-driven background (Priority: P2)

As the site operator, I can set a single configuration value to turn the weather-driven background off, so the dashboard always shows its plain default appearance regardless of the API response, without touching any code.

**Why this priority**: Gives the operator a simple escape hatch (e.g. to reduce visual noise, rule out the feature while debugging something else, or match a future design change) without needing to revert code.

**Independent Test**: Set the configuration value to "off", reload the site, and confirm the background stays on its plain default appearance no matter what the weather API reports, while the rest of the sky background (sun/moon position) is unaffected.

**Acceptance Scenarios**:

1. **Given** the configuration value is set to "off", **When** the dashboard loads under any real weather condition, **Then** the background shows the plain default appearance instead of a weather-specific one.
2. **Given** the configuration value is set to "off", **When** the weather API is polled, **Then** no weather-condition background switch happens (the poll may still run for other consumers such as the nav bar's own independent weather text).

---

### User Story 3 - Operator forces a fixed weather background (Priority: P3)

As the site operator, I can set the configuration value to one specific weather condition (e.g. "sunny" or "rain"), so the dashboard always shows that background and matching nav bar text, regardless of the live API response — useful for showcasing the site, screenshotting it, or personal preference.

**Why this priority**: A nice-to-have on top of P1/P2 — same mechanism as "off", just pinned to a specific visual instead of the plain default. Lower priority because it's a convenience/customization feature rather than something visitors notice.

**Independent Test**: Set the configuration value to a fixed condition (e.g. "rain"), reload the site under a real weather condition that differs from it (e.g. actual sunny weather), and confirm the background and nav bar text both show "rain" regardless.

**Acceptance Scenarios**:

1. **Given** the configuration value is fixed to "snow", **When** the dashboard loads under any real weather condition, **Then** the "snow" background is shown and the nav bar's weather text reads the matching label.
2. **Given** the configuration value is fixed to an invalid/unrecognized value, **When** the dashboard loads, **Then** the system falls back to automatic (API-driven) behavior rather than failing to render.

---

### Edge Cases

- What happens when the weather API is temporarily unreachable while in automatic mode? The background and nav bar text MUST keep showing the last successfully fetched condition rather than clearing to a blank or broken state (matching how the rest of the dashboard already degrades on fetch failure).
- What happens when the API reports a condition that isn't one of the five defined backgrounds (e.g. fog, thunderstorm)? It MUST resolve to the closest matching one of the five (see Assumptions) so the background and nav bar always show one of the five, never an "unknown" state.
- What happens when the classification is right on the boundary between two categories (e.g. cloud cover hovering between "mixed" and "cloudy")? The existing weather poll cadence (not sub-minute) naturally limits how often the background can flip, avoiding visible flicker.
- What happens with reduced-motion preferences? Any new animated elements introduced for the "rain"/"snow" backgrounds MUST respect `prefers-reduced-motion` the same way the existing flying-object animations already do.
- What happens when the fixed-override configuration is set to "off" and separately to a specific condition at once? These are mutually exclusive states of the same single setting, not two independent switches — see Key Entities.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST classify the current weather, on every successful poll, into exactly one of five categories: sunny, mixed, cloudy, rain, snow.
- **FR-002**: While the background-weather setting is "auto" (FR-005), the background weather category and the navigation bar's weather text MUST be derived from the same classification of the same live API response, so they agree about current conditions. The navigation bar's weather text is otherwise a fully independent widget: it always reports live weather/forecast data and is never itself switched to "off" or a fixed value by this feature (see FR-007) — only the background is.
- **FR-003**: System MUST render a visually distinct, animated background for each of the five categories — not a static image — extending the two treatments that exist today (sunny/clear, cloudy/overcast) with a "mixed" (partly cloudy) treatment already partially present, and adding new "rain" and "snow" treatments that do not exist today.
- **FR-004**: System MUST map every weather condition the API can report that is not already one of the five categories (e.g. fog, thunderstorm) onto the closest matching one of the five, so classification always resolves to one of the five — never to an unclassified/unknown state. [Default mapping: fog → cloudy, thunderstorm → rain; see Assumptions.]
- **FR-005**: The site configuration MUST expose one setting controlling the background-weather behavior, accepting: "auto" (default — live, API-driven classification per FR-001), "off" (always show the plain default background, independent of the API), or one of the five fixed category names (always show that category's background, independent of the API).
- **FR-006**: When the setting is fixed to one of the five category names, the background MUST show that fixed category regardless of what the API currently reports. The navigation bar's weather text is unaffected by this and keeps showing live conditions (per FR-002) — the two are allowed to disagree while the setting isn't "auto".
- **FR-007**: When the setting is "off", the background MUST show its plain default appearance regardless of the API response. The navigation bar's own weather text (an existing, separate widget) is unaffected and keeps showing live conditions.
- **FR-008**: When the setting holds an unrecognized value, the system MUST behave as if it were "auto" rather than failing to render or throwing an error.
- **FR-009**: While in "auto" mode, if the weather API fetch fails or returns malformed data, the system MUST retain the last successfully classified category rather than reverting to a default or blank state.
- **FR-010**: Changing the configuration setting MUST take effect the next time the site is loaded, without requiring any other code change.

### Key Entities

- **Weather Background Category**: One of exactly five values — sunny, mixed, cloudy, rain, snow — the shared classification driving both the animated background and the navigation bar's weather text.
- **Background Weather Setting**: A single site configuration value controlling how the category is determined: `"auto"` (live API-driven), `"off"` (disabled, plain default background), or a fixed category name (always that category). Mutually exclusive — the site has exactly one active mode at a time.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: For every weather condition the API can report, while the background setting is "auto", the dashboard shows exactly one of the five defined backgrounds and the nav bar names that same condition — verified across all documented API response values, with none left unclassified.
- **SC-002**: An operator can turn the weather-driven background off by changing a single configuration value and reloading, with no other code change required; the nav bar keeps reporting real weather unaffected.
- **SC-003**: An operator can pin the background to one specific condition by changing a single configuration value and reloading, with that pinned condition shown on every subsequent visit regardless of real weather, while the nav bar continues to report the real, live conditions independently.
- **SC-004**: When live weather data is temporarily unavailable, visitors keep seeing the last successfully determined background instead of a blank, broken, or inconsistent state.
- **SC-005**: An invalid configuration value never breaks page rendering — the site falls back to live, API-driven behavior.

## Assumptions

- The weather API already used for the sky background and the one already used for the navigation bar's weather text return the same kind of current-conditions data (a discrete weather condition code plus, separately, a cloud-cover percentage); this feature unifies both consumers around one shared classification derived from that data rather than introducing a new data source.
- Default mapping from the API's finer-grained conditions onto the five categories: clear-sky → sunny; light/partial cloud → mixed; overcast/heavy cloud → cloudy; any drizzle/rain/rain-shower condition → rain; any snow/snow-shower condition → snow; fog → cloudy (visually closest); thunderstorm → rain (visually closest, precipitation-bearing).
- "Off" and a fixed override both affect only the _background's_ weather category selection; neither disables the unrelated sun/moon positioning or bird/plane-style flying-object animation already present in the sky background, and neither affects the navigation bar's own independent weather text — it keeps reporting live conditions exactly as it does today, in every mode, because that information is relevant to visitors on its own and independent of what the background is showing.
- The configuration setting lives alongside the project's existing manual-override style settings (e.g. site title, sky location override) in the site's central configuration file, edited by the operator and taking effect on next page load — no in-app UI is required to change it.
- New "rain" and "snow" visual treatments are expected to reuse the existing animated-backdrop mechanism (comparable in visual weight to the current cloud animation) rather than introduce an unrelated visual style; exact visual design is left to the implementation phase.
