---
description: 'Task list for Weather Panel Icons implementation'
---

# Tasks: Weather Panel Icons

**Input**: Design documents from `/specs/023-weather-panel-icons/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (no `contracts/` —
this feature has no external interface, see plan.md's Structure Decision)

**Tests**: Included — plan.md's Testing section and the constitution's Testing standard both
require `node --test` coverage for the new pure modules and Playwright coverage for the visible
UI change.

**Organization**: Tasks are grouped by user story (spec.md's US1/US2) to enable independent
implementation and testing of each.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

## Path Conventions

Single static web app — all paths are under `web/` and `tests/e2e/` at repository root, per
plan.md's Project Structure.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No project scaffolding needed — this feature extends an existing app with no new
tooling, dependencies, or directories. Nothing to do here.

_(No tasks — proceed directly to Phase 2.)_

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Building blocks both US1 (current-conditions line) and US2 (forecast line) depend
on: the icon lookup module, the `sunrise`/`sunset`/`forecast_days=2` data extension, and the new
i18n keys. Both stories read from the same `renderWeather()` function and the same extended
`fetchWeatherAndForecast()` response, so these must land first.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T001 [P] Create `web/js/weather/weather-icon.js` exporting
      `weatherCategoryToIcon(category)` — a total function over the five
      `WEATHER_CATEGORIES` (`weather-category.js`) returning one emoji glyph per category
      (sunny→☀️, mixed→⛅, cloudy→☁️, rain→🌧️, snow→❄️, per research.md §1/data-model.md), plus a
      separate exported `MOON_ICON = '🌙'` constant for the nighttime override (not part of the
      category map, per data-model.md's "Weather Category Icon" source note).
- [x] T002 [P] Create `web/js/weather/weather-icon.test.js` (`node:test`) covering all five
      categories map to their documented glyph and `MOON_ICON` is exported and distinct from all
      five.
- [x] T003 [P] Create `web/js/weather/daytime.js` exporting
      `isDaytime(now, sunriseIso, sunsetIso)` — pure boolean check
      `now >= sunrise && now < sunset` per research.md §5; returns `true` (safer default, FR-013)
      when `sunriseIso`/`sunsetIso` are missing/unparseable.
- [x] T004 [P] Create `web/js/weather/daytime.test.js` (`node:test`) covering: before sunrise
      (false), daytime between sunrise/sunset (true), after sunset (false), and missing/undefined
      sunrise or sunset input (true — the safer default per FR-013).
- [x] T005 Add `FORECAST_DAY_SWITCH_HOUR = 18` constant to `web/js/config.js`, with a JSDoc
      comment matching the file's existing constant style (see `DATA_REFRESH_INTERVAL_MS`),
      documenting it as a fixed, developer-set local-hour cutoff (FR-014), not a per-visitor
      setting.
- [x] T006 Extend `fetchWeatherAndForecast()` in
      `web/js/info-panel/weather-forecast-client.js`: change the Open-Meteo request's `&daily=`
      param to include `sunrise,sunset` alongside the existing three fields, and change
      `&forecast_days=1` to `&forecast_days=2`. Parse `data.daily.sunrise?.[0]` /
      `data.daily.sunset?.[0]` into new optional `sunrise`/`sunset` response fields (absent, not
      failing, when missing — per FR-013/research.md §5's fallback). Parse tomorrow's
      `data.daily.weather_code?.[1]` / `temperature_2m_max?.[1]` / `temperature_2m_min?.[1]` into
      new `tomorrowWeatherCode`/`tomorrowMaxC`/`tomorrowMinC` fields, independently optional (a
      missing/malformed tomorrow value must NOT flip the whole response to
      `available: false` — today's/current fields staying valid is what matters, per FR-015/
      research.md §6's failure handling). Update the function's JSDoc return-type comment
      accordingly.
- [x] T007 Update `web/js/info-panel/weather-forecast-client.test.js` to cover: (a) a response
      including `sunrise`/`sunset` parses them into the result, (b) a response missing
      `sunrise`/`sunset` still resolves `available: true` without them, (c) a response with valid
      today (`[0]`) but malformed/missing tomorrow (`[1]`) fields still resolves
      `available: true` with `tomorrowWeatherCode`/`tomorrowMaxC`/`tomorrowMinC` left undefined
      rather than the whole call failing.
- [x] T008 [P] Add new i18n keys to `web/i18n/en.json` under `infoPanel`: `tomorrowLabel: "Tomorrow"`
      and `weatherCategory.clear: "Clear"` (leave `currentLabel` in place even though it becomes
      unused by the new render path — see T011).
- [x] T009 [P] Add the matching new i18n keys to `web/i18n/de.json` under `infoPanel`:
      `tomorrowLabel: "Morgen"` and `weatherCategory.clear: "Klar"`.

**Checkpoint**: Icon lookup, day/night check, extended fetch, config constant, and i18n keys are
all in place — `renderWeather()` can now be reworked for both user stories.

---

## Phase 3: User Story 1 - Scan current conditions at a glance (Priority: P1) 🎯 MVP

**Goal**: The current-conditions line drops "Aktuell:" and instead shows `<icon> <label>,
<temp>°C`, with a nighttime-only override for the "sunny" category (moon icon + "Klar"/"Clear"
label).

**Independent Test**: Load any page with the info panel visible while weather data is available;
confirm the current-conditions line shows an icon (`aria-hidden="true"`), then the label, a
comma, then the temperature, with no "Aktuell:" text. With the system clock set to nighttime and
a "sunny" `weatherCode`, confirm it shows the moon icon and "Klar"/"Clear" instead.

### Implementation for User Story 1

- [x] T010 [US1] In `web/js/info-panel/info-panel-controller.js`'s `renderWeather()`, rebuild the
      current-conditions line's rendering: replace the `currentText` string-template branch with
      DOM-fragment construction — a `<span class="info-panel__weather-icon"
aria-hidden="true">` holding the icon glyph, followed by a text node
      `"${label}, ${temp}°C"` (FR-001/FR-002/FR-003) — written into each `currentEls` element
      (clearing prior content first). Determine icon/label from
      `weatherCategoryToIcon(weatherCodeToCategory(weather.weatherCode))` and
      `t(weatherCodeToLabelKey(weather.weatherCode))` per data-model.md's "Current-Conditions
      Line" render shape.
- [x] T011 [US1] In the same function, add the nighttime "sunny"→"clear" override (FR-011/
      FR-012/FR-013, data-model.md's "Nighttime Clear Display"): when
      `weatherCodeToCategory(weather.weatherCode) === 'sunny'` and
      `isDaytime(new Date(), weather.sunrise, weather.sunset) === false`, use `MOON_ICON` and
      `t('infoPanel.weatherCategory.clear')` in place of the sunny icon/label computed in T010;
      leave every other category, and the unavailable-state fallback (FR-008, unchanged), as-is.
      Import `isDaytime` from `weather/daytime.js` and `MOON_ICON`/`weatherCategoryToIcon` from
      `weather/weather-icon.js`.
- [x] T012 [US1] Remove the now-unused `infoPanel.currentLabel` reads from
      `info-panel-controller.js` (the "Aktuell:" prefix is fully replaced, FR-001) — leave the
      `currentLabel` i18n key itself in `en.json`/`de.json` untouched (no functional requirement
      to remove unused i18n keys, avoids churn in unrelated strings).
- [x] T013 [P] [US1] Add a CSS rule for `.info-panel__weather-icon` in `web/css/app.css`
      (`inline-flex`/appropriate vertical-align, sizing/spacing using existing CSS custom
      properties) so the icon and label never wrap apart at 320px width (FR-010/SC-003).
- [x] T014 [US1] Update `tests/e2e/info-panel.spec.js`'s `mockForecast()` helper (or add a new
      variant) to optionally supply `sunrise`/`sunset` in the mocked Open-Meteo response, and
      update/add assertions for: icon element present with `aria-hidden="true"` inside
      `[data-role="weather-current"]`, no "Aktuell:" text remaining, and the existing
      label/temperature text still matches (e.g. "Regen, 18°C" instead of the old
      "Aktuell: Regen · 18°C" shape).
- [x] T015 [US1] Add a new Playwright test in `tests/e2e/info-panel.spec.js` using
      `page.clock.install()` (per `tests/e2e/sky.spec.js`'s pattern) set to a nighttime timestamp
      plus a mocked "sunny" `weatherCode` (0) with `sunrise`/`sunset` both in the past relative to
      the clock time: assert the current-conditions line shows the moon icon and "Klar"
      (`de.json`'s label) instead of "Sonnig". Add a companion daytime "sunny" test confirming the
      regular sun icon/"Sonnig" still shows when `isDaytime` is true, and a test for a
      non-"sunny" category (e.g. "rain") at night confirming it is unaffected (spec Acceptance
      Scenario 5).

**Checkpoint**: User Story 1 is fully functional and independently testable — the
current-conditions line matches spec.md's Acceptance Scenarios 1–5.

---

## Phase 4: User Story 2 - See the relevant day's forecast range with an icon (Priority: P2)

**Goal**: The forecast line shows an icon, keeps its "Heute:"/"Morgen:" prefix (switching at
`FORECAST_DAY_SWITCH_HOUR`), and displays the shown day's temperature range as
`(low°C - high°C)`.

**Independent Test**: Load the panel before the configured cutoff hour; confirm "Heute:" + icon +
label + today's `(low°C - high°C)`. Reload with the clock set at/after the cutoff hour; confirm
"Morgen:" + icon + label + tomorrow's range instead.

### Implementation for User Story 2

- [x] T016 [US2] In `renderWeather()`, compute
      `dayIndex = new Date().getHours() >= FORECAST_DAY_SWITCH_HOUR ? 1 : 0` (import
      `FORECAST_DAY_SWITCH_HOUR` from `config.js`), and select that day's weather code/min/max
      from the extended `weather` object (`weather.weatherCode`/`todayMaxC`/`todayMinC` for index
      0; `weather.tomorrowWeatherCode`/`tomorrowMaxC`/`tomorrowMinC` for index 1) per
      data-model.md's "Forecast Line" render shape.
- [x] T017 [US2] Rebuild the forecast line's rendering as DOM-fragment construction: prefix text
      node `t(dayIndex === 0 ? 'infoPanel.todayLabel' : 'infoPanel.tomorrowLabel') + ": "`,
      followed by an `<span class="info-panel__weather-icon" aria-hidden="true">` with the
      selected day's icon (`weatherCategoryToIcon`, never the nighttime override — FR-012),
      followed by `"${label} (${low}°C - ${high}°C)"` (FR-004/FR-005/FR-006), written into each
      `forecastEls` element.
- [x] T018 [US2] Apply FR-015's fallback: if `dayIndex === 1` and any of
      `tomorrowWeatherCode`/`tomorrowMaxC`/`tomorrowMinC` is missing/non-finite even though
      `weather.available` is `true`, render the forecast line as the existing empty
      "unavailable" state (same as FR-008) instead of the icon/label/range markup.
- [x] T019 [P] [US2] Update `tests/e2e/info-panel.spec.js`'s existing "shows current weather and
      today's forecast summary" test (and any other test asserting the old
      "22°C / 12°C" order) for the new "(low°C - high°C)" format, retained "Heute:" prefix, and
      icon presence with `aria-hidden="true"` inside `[data-role="weather-forecast"]`.
- [x] T020 [US2] Add new Playwright tests in `tests/e2e/info-panel.spec.js` using
      `page.clock.install()`: (a) clock set before `FORECAST_DAY_SWITCH_HOUR` (default 18:00) —
      forecast line reads "Heute:" + today's icon/label/range; (b) clock set at/after 18:00 with a
      mocked response supplying distinct tomorrow values — forecast line reads "Morgen:" +
      tomorrow's icon/label/range, distinct from today's mocked values; (c) clock at/after 18:00
      with tomorrow's fields omitted from the mock — forecast line falls back to empty
      (FR-015); (d) a "sunny" mocked response at nighttime — forecast line still shows the regular
      sun icon/"Sonnig" (not the moon/"Klar" override), confirming FR-012's independence from
      US1's nighttime override.
- [x] T021 [P] [US2] Add a boundary-value round-trip check within the same spec file (or a
      `node:test` if easier — the formatting itself is inline in `info-panel-controller.js`,
      which per its header comment isn't unit-tested, so this stays a Playwright assertion): a
      mocked response whose low and high round to the same whole degree still renders both
      bounds, e.g. "(14°C - 14°C)" (spec Acceptance Scenario 2.3).

**Checkpoint**: User Stories 1 AND 2 both work independently and together — full spec.md coverage
for both P1 and P2.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and final validation across both stories.

- [x] T022 [P] Search `README.md`/`README.de.md` and `docs/user-guide.md`/
      `docs/user-guide.de.md` for any mention of the old "Aktuell:"/"Heute: <label> · <max>°C /
      <min>°C" panel text format and update to describe the new icon-led format (plan.md's
      Documentation Standards note).
- [x] T023 Run `npm run test:scripts` (or the specific `node --test
web/js/weather/weather-icon.test.js web/js/weather/daytime.test.js
web/js/info-panel/weather-forecast-client.test.js` invocations) and confirm all pass.
- [x] T024 Run `npx playwright test tests/e2e/info-panel.spec.js --reporter=line` and confirm all
      pass, including the new icon/nighttime/cutoff-hour assertions.
- [x] T025 Run `specs/023-weather-panel-icons/quickstart.md`'s validation scenarios manually (or
      via the Playwright suite above if it already covers them) and confirm each passes.
- [x] T026 Update `**Status**` in `specs/023-weather-panel-icons/spec.md` from `Draft` to
      `Implemented` (only once every task above is checked off).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — empty, nothing to do.
- **Foundational (Phase 2)**: No dependencies — BLOCKS both user stories (T001–T009 must all
  land before Phase 3/4 begin, since both stories' `renderWeather()` changes read the extended
  `weather` object and the new icon/daytime modules).
- **User Story 1 (Phase 3)**: Depends on Phase 2. Independent of US2 (different lines of the same
  function, but no shared new state beyond what Phase 2 already provides).
- **User Story 2 (Phase 4)**: Depends on Phase 2. Independent of US1 — can be implemented before,
  after, or in parallel with Phase 3, though both land in the same `renderWeather()` function so
  sequential implementation (not truly parallel file edits) is more practical in practice.
- **Polish (Phase 5)**: Depends on Phases 3 and 4 both being complete.

### Within Each Phase

- T001–T004 (icon lookup + daytime check, and their tests) are fully parallel — four different
  files.
- T005 (config constant) is independent of T001–T004.
- T006 (extend fetch) should follow T003 conceptually (uses the same sunrise/sunset shape) but
  has no file overlap with T001–T004; T007 (its test) follows T006.
- T008/T009 (i18n) are parallel with everything else in Phase 2 — different files.
- Within US1: T010 → T011 (T011 extends T010's DOM structure) → T012; T013 (CSS) is parallel;
  T014/T015 (Playwright) follow T010–T012 being implemented.
- Within US2: T016 → T017 → T018 (each builds on the prior); T019/T020/T021 (Playwright) follow
  T016–T018.

### Parallel Opportunities

- Phase 2: T001+T002+T003+T004+T005+T008+T009 can all run in parallel (7 independent file sets);
  T006/T007 form their own small sequential pair.
- T013 (CSS) can run in parallel with T010–T012 (different file).
- T022 (docs) can run in parallel with T023–T025 (verification) in Phase 5.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch all independent foundational file-creation tasks together:
Task: "Create web/js/weather/weather-icon.js"
Task: "Create web/js/weather/weather-icon.test.js"
Task: "Create web/js/weather/daytime.js"
Task: "Create web/js/weather/daytime.test.js"
Task: "Add FORECAST_DAY_SWITCH_HOUR to web/js/config.js"
Task: "Add tomorrowLabel/weatherCategory.clear to web/i18n/en.json"
Task: "Add tomorrowLabel/weatherCategory.clear to web/i18n/de.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (icon lookup, daytime check, extended fetch, config constant,
   i18n keys).
2. Complete Phase 3: User Story 1 (current-conditions line rework + nighttime override).
3. **STOP and VALIDATE**: Run `tests/e2e/info-panel.spec.js`'s US1-related tests independently;
   confirm spec.md's User Story 1 Acceptance Scenarios all pass.
4. Deploy/demo if ready — the forecast line (US2) still renders in its old format until Phase 4
   lands, which is a safe intermediate state (no broken markup, just the pre-feature text shape).

### Incremental Delivery

1. Foundational → Foundation ready (icon/daytime modules, extended fetch, config, i18n).
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!).
3. Add User Story 2 → Test independently → Deploy/Demo.
4. Polish (docs, full test suite, spec status).

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- `info-panel-controller.js` is explicitly not unit-tested (per its own header comment) —
  Playwright is the only coverage for its `renderWeather()` changes; the new pure modules
  (`weather-icon.js`, `daytime.js`) get `node --test` coverage instead.
- Commit after each task or logical group.
- Stop at either checkpoint (end of Phase 3, end of Phase 4) to validate that story
  independently before continuing.
