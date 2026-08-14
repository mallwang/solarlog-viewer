# Feature Specification: Day/Night Sky Background

**Feature Branch**: `018-day-night-sky`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "I would like to enhance the background by show a different one based on the day/night. This information can be requested by the open meteo api. The idea is to show the current sky and weather during the daytime like it is. But during the night, the idea is to show a night sky, keeping the clouds and moving items as they are now. The only thing is for sunny and mixed, the sky should show stars or sometimes a falling star animation (but not for cloudy, rain, snow)."

**Design**: See [design.md](./design.md) for the approved mockup and layout notes.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Sky darkens to a night appearance after sunset (Priority: P1)

As a site visitor, when I load the dashboard after sunset (or before sunrise) at the plant's location, I see the sky background rendered as a night sky instead of the daytime appearance — while the clouds and any flying objects (birds, planes, balloons, etc.) keep rendering and animating exactly as they do during the day.

**Why this priority**: This is the core of the feature — today the sky background looks the same (aside from the sun/moon crossfade already in place) regardless of whether it's day or night at the plant's location, which looks wrong to a visitor checking the dashboard in the evening.

**Independent Test**: Load the dashboard shortly after sunset (or stub the sunrise/sunset data used by the existing sun/moon logic) and confirm the sky background shows its night appearance while clouds/flying objects are unaffected; repeat during daytime and confirm the existing daytime appearance is unchanged.

**Acceptance Scenarios**:

1. **Given** the current local time at the plant's location is between sunset and the next sunrise, **When** the dashboard loads, **Then** the sky background shows its night appearance.
2. **Given** the current local time at the plant's location is between sunrise and sunset, **When** the dashboard loads, **Then** the sky background shows today's daytime appearance, unchanged from before this feature.
3. **Given** the site is already open and sunset (or sunrise) passes while it stays open, **When** the next scheduled position update runs, **Then** the sky background transitions to the matching day/night appearance without a page reload.
4. **Given** the night appearance is showing, **When** clouds or flying objects would normally render for the current weather category, **Then** they still render and animate exactly as they do in the daytime appearance.

---

### User Story 2 - Clear/partly-cloudy nights show stars (Priority: P2)

As a site visitor, when the night sky is showing and the weather is sunny or mixed (partly cloudy), I see stars in the sky background, so the night sky feels realistic rather than an empty dark backdrop.

**Why this priority**: A plain dark backdrop at night reads as unfinished; stars are the expected visual complement to a clear/partly-cloudy night sky and build directly on User Story 1.

**Independent Test**: With the night appearance active and the weather category forced or observed as sunny or mixed, confirm stars render; with the category forced or observed as cloudy, rain, or snow, confirm no stars render.

**Acceptance Scenarios**:

1. **Given** the sky background shows its night appearance and the current weather category is sunny, **When** the dashboard is viewed, **Then** stars are visible in the sky.
2. **Given** the sky background shows its night appearance and the current weather category is mixed, **When** the dashboard is viewed, **Then** stars are visible in the sky.
3. **Given** the sky background shows its night appearance and the current weather category is cloudy, rain, or snow, **When** the dashboard is viewed, **Then** no stars are visible (the cloud cover already rendered for that category is the only sky texture shown).
4. **Given** the sky background shows its daytime appearance, **When** the dashboard is viewed under any weather category, **Then** no stars are visible (stars are a night-only, sunny/mixed-only element).

---

### User Story 3 - Occasional falling star on clear/partly-cloudy nights (Priority: P3)

As a site visitor, while stars are showing (a clear or partly-cloudy night), I occasionally see a brief falling-star animation cross the sky, as a small delightful detail — not on every visit, and not constantly.

**Why this priority**: A nice-to-have polish on top of the static starfield from User Story 2; lower priority because the dashboard remains fully correct and pleasant without it.

**Independent Test**: With stars showing (per User Story 2), observe the sky over several minutes and confirm a falling-star animation occurs occasionally rather than every load or continuously; confirm it never occurs when stars are not showing (daytime, or cloudy/rain/snow nights).

**Acceptance Scenarios**:

1. **Given** stars are showing (night, sunny or mixed), **When** enough time passes while the dashboard stays open, **Then** a falling-star animation occasionally plays and then disappears, without disrupting the clouds or flying objects already animating.
2. **Given** the night sky shows cloudy, rain, or snow (no stars), **When** the dashboard is viewed for any length of time, **Then** no falling-star animation ever plays.
3. **Given** the daytime appearance is showing, **When** the dashboard is viewed for any length of time, **Then** no falling-star animation ever plays.

---

### Edge Cases

- What happens right at the sunrise/sunset boundary? The transition between day and night appearance (and the accompanying appearance/disappearance of stars) MUST be gradual, matching the existing sun/moon crossfade transition already in place at sunrise/sunset — not an abrupt flip.
- What happens when the background-weather setting (see the existing "off"/fixed configuration) is `"off"`? No sky visuals render at all, day or night — this feature adds no exception to that existing full-disable behavior.
- What happens when the background-weather setting is fixed to a specific category (e.g. always "rain")? The day/night appearance still follows the plant's real local sunrise/sunset time; only the weather category itself stays pinned to the fixed value, consistent with how the fixed setting already leaves the nav bar's live weather reporting unaffected.
- What happens when sunrise/sunset or weather data is temporarily unavailable? The sky MUST keep showing the last successfully determined day/night state and weather category rather than resetting to a default, matching the existing last-known-good behavior.
- What happens with reduced-motion preferences? The falling-star animation MUST be suppressed the same way the existing flying-object animations already are; a static starfield (no motion) is unaffected and may still show.
- What happens during the brief sunrise/sunset crossfade window, when both day and night visuals are partially blended? Stars MUST fade in/out smoothly alongside that existing crossfade rather than popping in or out abruptly.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST render a night appearance for the sky background whenever the current local time at the resolved installation location is between sunset and the next sunrise, using the same sunrise/sunset data already used for today's sun/moon positioning.
- **FR-002**: System MUST render the existing daytime appearance whenever the current local time is between sunrise and sunset, unchanged from current behavior.
- **FR-003**: Clouds and flying objects (birds, planes, balloons, and every other existing flying-object kind) MUST continue to render and animate identically regardless of whether the day or night appearance is showing.
- **FR-004**: While the night appearance is showing and the effective weather category is sunny or mixed, system MUST display a starfield in the sky background.
- **FR-005**: While the night appearance is showing and the effective weather category is cloudy, rain, or snow, system MUST NOT display any stars.
- **FR-006**: The daytime appearance MUST NOT display stars under any weather category.
- **FR-007**: While a starfield is showing (per FR-004), system MUST occasionally play a brief falling-star animation that crosses the sky and then disappears, at a randomized, infrequent interval — not on a fixed schedule, not continuously, and not on every page load.
- **FR-008**: The falling-star animation MUST NOT play while the daytime appearance is showing, nor while the night appearance is showing with a cloudy, rain, or snow weather category.
- **FR-009**: The transition between the day and night appearance (including the starfield's appearance/disappearance) MUST be gradual across the existing sunrise/sunset crossfade window, not an instantaneous switch.
- **FR-010**: This feature MUST respect the existing background-weather setting: when it is `"off"`, no sky visuals (day, night, clouds, stars, or falling star) render; when it is fixed to a specific weather category, the day/night appearance still follows real local sunrise/sunset time while the weather category itself stays pinned to the fixed value.
- **FR-011**: The falling-star animation MUST respect the reduced-motion preference the same way existing flying-object animations already do; the static starfield itself is not required to be suppressed since it involves no motion.
- **FR-012**: If sunrise/sunset or weather data is temporarily unavailable, the sky MUST retain the last successfully determined day/night state and weather category rather than reverting to a default appearance.

### Key Entities

- **Day/Night State**: Derived from the current local time versus the resolved installation location's sunrise/sunset (the same data already driving sun/moon positioning); determines whether the daytime or night sky appearance is shown.
- **Starfield**: A night-only visual layer shown exclusively when the Day/Night State is night and the effective weather category is sunny or mixed; hidden in every other combination.
- **Falling Star Event**: An occasional, randomized, transient animation instance that plays only while the Starfield is visible.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Visitors loading the dashboard at night see a visibly distinct night sky appearance instead of the daytime appearance, with no configuration change required, in 100% of night-time page loads.
- **SC-002**: Clouds and flying objects continue to appear and animate at night exactly as they do during the day, with no loss of any existing visual behavior.
- **SC-003**: On clear or partly-cloudy nights, stars are visible in the sky background; on overcast, rainy, or snowy nights, no stars are ever shown.
- **SC-004**: A falling-star animation is observed occasionally (not on every load, not continuously) during clear or partly-cloudy nights, and never observed during the day or during cloudy/rain/snow nights.
- **SC-005**: The visual switch between day and night (and the starfield's appearance/disappearance) reads as a smooth transition rather than a sudden jump, matching the existing sunrise/sunset transition feel.

## Assumptions

- Day/night is determined using the same sunrise/sunset timestamps already fetched and used for the existing sun/moon crossfade positioning — no new data source is required.
- "Effective weather category" means the same category (sunny/mixed/cloudy/rain/snow) already governing today's cloud rendering and the fixed/auto/off background-weather setting — this feature adds a day/night dimension on top of it without changing how the category itself is determined.
- The falling-star animation's exact frequency and appearance are a visual design detail left to implementation, as long as it remains occasional (not constant, not absent) per FR-007 and SC-004.
- Stars and the falling-star animation are purely visual additions layered onto the existing night appearance; they carry no interactive behavior and no configuration of their own beyond following the existing background-weather setting (auto/off/fixed) and day/night state.
- No new site configuration is introduced by this feature — the existing `BACKGROUND_WEATHER` setting (`auto`/`off`/fixed category) remains the only control surface, per FR-010.
