# Feature Specification: Dynamic Weather-Driven Sky Background

**Feature Branch**: `007-dynamic-sky-weather`

**Created**: 2026-08-09

**Status**: Done

**Input**: User description: "I would like to make the clouds and the sky more dynamic and not just using static CSS that reloads regularly. E.g. the background sky should be dynamically bound to the real weather in the given location of the installation (see web/data/base_vars.js). E.g. when there is full sun, the clouds should be very rare and maybe the sun could mimik its current stand of the horizon (e.g. at 12:00 in the center and at 18:00 at the right side or at 23:00 the moon cound shine). Additionally, there could be some animals like birds that fly through the background, and maybe randomly and rarely also some airplanes, rockets (to the moon as easter eggs) or baloons.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Sky reflects real current weather at the plant's location (Priority: P1)

A visitor opens the dashboard for a solar installation and sees a sky backdrop whose cloud cover visibly matches the real, current weather conditions at that installation's location — clear and mostly cloud-free on a sunny day, heavily overcast with dense, slow-moving clouds during overcast/rainy conditions, and something in between on partly-cloudy days.

**Why this priority**: This is the core of the request — replacing a static, weather-blind background with one that communicates real conditions at a glance. Without this, the rest of the feature (sun/moon position, animals, easter eggs) has no foundation to attach to.

**Independent Test**: Load the dashboard for an installation location under a known current weather condition (e.g. clear sky) and verify the rendered backdrop shows sparse or no clouds; repeat for an overcast condition and verify dense cloud cover. Can be demonstrated by comparing two installations (or two times of day) with different real weather.

**Acceptance Scenarios**:

1. **Given** the current real-world weather at the installation's location is clear/sunny, **When** the dashboard loads, **Then** the sky backdrop shows few or no clouds.
2. **Given** the current real-world weather at the installation's location is overcast, **When** the dashboard loads, **Then** the sky backdrop shows dense cloud cover.
3. **Given** the current real-world weather at the installation's location is partly cloudy, **When** the dashboard loads, **Then** the sky backdrop shows a moderate, proportionate amount of cloud cover.
4. **Given** the dashboard has been open for a while and real weather conditions change, **When** enough time has passed for the next weather refresh, **Then** the backdrop's cloud density updates to reflect the new conditions without requiring a full page reload.
5. **Given** weather data for the installation's location cannot be retrieved (e.g. network failure), **When** the dashboard loads, **Then** the backdrop falls back to a reasonable default appearance rather than showing an error or blank sky.

---

### User Story 2 - Sun and moon track the real time of day (Priority: P2)

A visitor sees the sun or moon positioned in the sky consistent with the actual current local time and daylight state at the installation's location — the sun low near the horizon in early morning or evening, high in the sky around midday, and the moon visible instead once night has fallen.

**Why this priority**: This adds a second, independent layer of realism (time-of-day) on top of the weather layer, reinforcing that the background is "alive" and tied to reality. It's valuable but secondary to weather itself.

**Independent Test**: Load the dashboard at different times of day (or simulate different times) and verify the sun's horizontal/vertical position shifts accordingly, and that it is replaced by a moon after sunset and before sunrise.

**Acceptance Scenarios**:

1. **Given** it is solar midday at the installation's location, **When** the dashboard is viewed, **Then** the sun appears near the top-center of the sky.
2. **Given** it is late afternoon/evening before sunset, **When** the dashboard is viewed, **Then** the sun appears lower and toward the side of the sky corresponding to its real direction.
3. **Given** it is nighttime (after sunset, before sunrise) at the installation's location, **When** the dashboard is viewed, **Then** a moon is shown in place of the sun.
4. **Given** heavy cloud cover is present, **When** the dashboard is viewed, **Then** the sun/moon remains at least partially visible or tastefully dimmed/obscured behind the clouds rather than disappearing abruptly.

---

### User Story 3 - Occasional flying objects animate through the sky (Priority: P3)

A visitor who watches the background for a while occasionally notices a bird (or small flock) drifting across the sky, and much more rarely a passing airplane, hot air balloon, or an easter-egg rocket flying up toward the moon.

**Why this priority**: This is a delight/polish feature that adds personality without being essential to the weather-communication goal. It's the lowest priority because the dashboard remains fully functional and meets the core intent without it.

**Independent Test**: Observe the dashboard for an extended period and confirm birds appear at a noticeably regular light cadence, while planes/balloons/rockets appear only rarely and unobtrusively, never blocking key content.

**Acceptance Scenarios**:

1. **Given** the dashboard is open and idle, **When** enough time passes, **Then** a bird or small group of birds occasionally flies across the sky and disappears off-screen.
2. **Given** the dashboard is open for an extended session, **When** a rare random trigger occurs, **Then** an airplane, hot air balloon, or (rarely) a rocket flying toward the moon animates across the sky.
3. **Given** it is daytime with the sun visible, **When** flying objects animate, **Then** birds/planes/balloons appear (rocket easter egg only relevant at night when the moon is visible).
4. **Given** a flying object animation is in progress, **When** it finishes crossing the sky, **Then** it is removed cleanly with no leftover visual artifacts and does not obstruct dashboard content (charts, numbers, navigation).

---

### Edge Cases

- What happens when the installation's location cannot be determined (e.g. incomplete/missing configuration)? → Backdrop falls back to a static, weather-independent default appearance (current behavior) rather than failing to render.
- What happens when the weather data source is unavailable or rate-limited for an extended period? → The last successfully retrieved condition continues to be shown; if none was ever retrieved, the default fallback appearance is used.
- What happens on very slow connections or low-power devices? → Sky animation must degrade gracefully (e.g. fewer simultaneous animated elements) rather than freezing or slowing down the rest of the dashboard.
- What happens if a user has enabled "reduce motion" accessibility preferences? → Animations (drifting clouds, flying objects) should be minimized or disabled while still reflecting weather/time-of-day through static cues (e.g. cloud density, sun/moon position).
- What happens at the exact moment of sunrise/sunset transition? → The sun/moon swap should occur smoothly rather than as a jarring instant flip mid-view.
- What happens when multiple installations with different locations are viewed (e.g. navigating between dashboards)? → Each dashboard's sky reflects the weather and time of day for its own installation's location, not a shared/global state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST determine each installation's geographic location from its existing configuration data (installation address/site info) for the purpose of looking up local weather and solar time.
- **FR-002**: System MUST retrieve current real-world weather conditions (at minimum: a cloud-cover / sky-condition indicator) for the installation's location from an external weather data source.
- **FR-003**: System MUST render the sky backdrop's cloud density/coverage proportionally to the retrieved real weather condition (clear → sparse/no clouds; overcast → dense clouds; partly cloudy → intermediate).
- **FR-004**: System MUST periodically refresh the weather condition while the dashboard remains open, and MUST update the backdrop accordingly without requiring a manual page reload.
- **FR-005**: System MUST fall back to a sensible default backdrop appearance when weather data cannot be retrieved (network failure, missing location, source unavailable), without showing errors to the visitor.
- **FR-006**: System MUST compute the sun's apparent position in the sky from the current local time and the installation's location, and render it accordingly (e.g. low near horizon at sunrise/sunset, high at solar noon).
- **FR-007**: System MUST replace the sun with a moon during nighttime hours (between sunset and sunrise) at the installation's location.
- **FR-008**: System MUST transition between sun and moon smoothly around sunrise/sunset rather than instantly.
- **FR-009**: System MUST occasionally animate birds flying across the sky at a light, regular cadence, independent of weather/time state (birds may appear day or night).
- **FR-010**: System MUST rarely and randomly animate additional flying objects (airplane, hot air balloon) across the sky, at a noticeably lower frequency than birds.
- **FR-011**: System MUST rarely animate a rocket easter egg flying toward the moon, only during nighttime when the moon is visible.
- **FR-012**: System MUST ensure all animated sky elements (clouds, sun/moon, birds, planes, balloons, rockets) never visually obstruct or interfere with the readability of dashboard content (charts, statistics, navigation).
- **FR-013**: System MUST respect the visitor's "reduce motion" accessibility preference by minimizing or disabling drifting/flying animations while still conveying weather and time-of-day through static visual cues.
- **FR-014**: System MUST scope weather and time-of-day sky state per installation, so that different installations (different locations) show independently correct backdrops.
- **FR-015**: System MUST continue to function (with the default fallback backdrop) for installations whose location data is incomplete or unavailable.

### Key Entities

- **Installation Location**: The geographic site of a solar installation (derived from existing installation configuration/address data), used as the lookup key for weather and solar time calculations.
- **Weather Condition**: The current real-world sky/cloud state for a location (e.g. clear, partly cloudy, overcast), refreshed periodically, driving cloud density in the backdrop.
- **Solar Time State**: The current local time expressed relative to that location's sunrise/solar-noon/sunset, used to position the sun or determine that the moon should be shown instead.
- **Sky Flying Object**: A transient animated element (bird, airplane, balloon, rocket) that crosses the backdrop and then disappears, each with its own appearance frequency/rarity tier.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: When viewed under clear-sky real weather, at least 90% of test observations show a visibly sparse/clear backdrop rather than the heavy default cloud cover used today.
- **SC-002**: When viewed under overcast real weather, at least 90% of test observations show a visibly dense cloud backdrop, distinctly different from the clear-sky appearance.
- **SC-003**: The sun/moon's on-screen position at any given time of day matches its expected solar position (horizon vs. midday vs. night) in at least 95% of spot checks across a full day.
- **SC-004**: The backdrop reflects a weather change within one refresh cycle (no more than 30 minutes) of the real condition changing, without any manual page reload.
- **SC-005**: On a network or weather-source failure, the dashboard remains fully usable and visually coherent (no errors, no blank areas) in 100% of tested failure scenarios.
- **SC-006**: Over an extended viewing session (30+ minutes), birds are observed crossing the sky multiple times, while planes/balloons/rockets are observed no more than a handful of times, confirming the intended rarity tiering.
- **SC-007**: None of the animated sky elements measurably reduce readability of or interaction with core dashboard content, as verified by a usability pass with animations active.

## Assumptions

- The installation's location can be derived from existing configuration (e.g. `HPStandort` in `web/data/base_vars.js`, which currently holds a postal address string) and geocoded or otherwise resolved to coordinates suitable for weather and solar-time lookups.
- A free or already-available external weather data source can be used to obtain current cloud-cover conditions per location; exact provider selection is an implementation detail deferred to planning.
- "Real weather" refers to current/near-real-time conditions, not a forecast; historical or forecast weather is out of scope for this feature.
- Sun/moon position is a simplified visual representation of solar altitude/azimuth (e.g. horizontal position + height) rather than an astronomically precise rendering.
- Rocket/balloon/airplane easter eggs are cosmetic and carry no functional meaning beyond visual delight; their exact trigger probabilities are tunable implementation details.
- The existing sky/cloud backdrop (`.sky-clouds` in `web/css/app.css` and its markup in `web/index.html`) is the visual layer being enhanced/replaced, not an entirely new page region.
- Reduced-motion support follows standard OS/browser accessibility signals already used elsewhere on the web (e.g. `prefers-reduced-motion`).
