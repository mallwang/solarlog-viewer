# Phase 0 Research: Weather Panel Icons

No open unknowns remained in the Technical Context after reviewing the existing weather
classifier, the info-panel controller, and the `018-day-night-sky` mockup precedent. This
document records the decisions made while resolving the (few, low-risk) implementation choices
the spec leaves open.

## 1. Icon glyph set per Weather Background Category

- **Decision**: Reuse plain Unicode emoji glyphs, one per existing category:
  - `sunny` → ☀️
  - `mixed` → ⛅
  - `cloudy` → ☁️
  - `rain` → 🌧️
  - `snow` → ❄️
- **Rationale**: `specs/018-day-night-sky/mockup.html` already established ☀️/☁️/🌧️/❄️ for
  `sunny`/`cloudy`/`rain`/`snow` as the project's intended visual language for this exact panel
  (line 596–600); this feature only needs to add the missing `mixed` glyph. ⛅ ("sun behind
  cloud") is the conventional "partly cloudy" glyph, matches `mixed`'s German label ("Wechselnd
  bewölkt"), and is visually distinct from both ☀️ (sunny) and ☁️ (cloudy) at small size,
  satisfying SC-002 (five distinct, distinguishable icons). No icon font or SVG sprite is
  introduced — plain characters keep the "no new dependency" default from the constitution's
  Frontend standard and require no asset loading, so they render immediately and can't 404/flash
  unstyled.
- **Alternatives considered**:
  - An SVG icon set (e.g. a small hand-picked weather-icon sprite) — rejected: adds a new
    vendored asset and build/maintenance surface for a decorative, five-value glyph that Unicode
    already covers adequately across all target browsers (Chromium/Firefox/Safari all render
    these five emoji natively).
  - Reusing `sky-controller.js`'s existing sun/moon/cloud DOM elements (CSS-animated shapes) —
    rejected: those are large, animated backdrop elements sized for full-viewport display, not a
    small static inline glyph next to nav-bar text; repurposing them would couple two unrelated
    subsystems (sky backdrop vs. info panel) for no benefit.

## 2. Icon lookup module placement

- **Decision**: New `web/js/weather/weather-icon.js`, exporting a single pure function
  `weatherCategoryToIcon(category)` (or an exported constant map, mirroring
  `WEATHER_CATEGORY_RENDER_CONFIG` in `weather-render-config.js`) plus its own `.test.js`.
- **Rationale**: `weather/` already holds one per-category lookup table
  (`weather-render-config.js`, sky-backdrop render config) alongside the shared classifier
  (`weather-category.js`); a second per-category lookup (icon glyph) for a different consumer
  (info panel) follows the same established pattern instead of inventing a new location or
  bolting the map directly into `info-panel-controller.js` (which isn't unit-tested — see that
  file's own header comment — so pure logic belongs in a separately-tested module per the
  Testing standard).
- **Alternatives considered**: Inlining the icon map as a local constant inside
  `info-panel-controller.js` — rejected: that file is explicitly _not_ unit-tested (covered only
  by Playwright per its header comment), so a five-branch lookup with a fallback case would lose
  direct unit-test coverage and duplicate a pattern (`category → per-category value`) that
  already has a tested home in `weather/`.

## 3. Accessibility marking for the icon

- **Decision**: Render each icon inside its own inline element with `aria-hidden="true"` (e.g. a
  `<span class="info-panel__weather-icon" aria-hidden="true">☀️</span>`), built via DOM
  construction (not `el.textContent = "☀️ Sonnig, 24°C"`) so the emoji is excluded from the
  accessible name and only the label/temperature text remains announced.
- **Rationale**: FR-009 requires the icon be non-semantic for assistive technology. A bare emoji
  character inside a `textContent` string is inconsistently announced across screen readers
  (some verbalize the emoji's Unicode name, e.g. "sun"), which would read as redundant or
  confusing right before the identical text label — exactly the edge case the spec calls out.
  Wrapping it in its own `aria-hidden="true"` element removes that ambiguity outright.
- **Alternatives considered**: Using the CSS `content:` property with a `::before` pseudo-element
  keyed off a `data-weather` attribute (icon lives in CSS, not DOM) — rejected: it works
  accessibility-wise (generated content is invisible to most screen readers by default) but
  means the icon glyph text lives in `app.css` rather than co-located with the other four
  category values already defined in JS (`weather-category.js`, `weather-render-config.js`,
  i18n labels), splitting one five-way mapping across two file types for no accessibility or
  maintainability gain over the `aria-hidden` span approach.

## 4. Forecast line temperature range formatting

- **Decision**: Format as `(low°C - high°C)` using a plain ASCII hyphen surrounded by spaces
  (matching the spec's own example text literally: "13°C - 19°C"), rounding each bound
  independently with `Math.round()` — the same rounding the current-conditions line and the
  existing forecast line already use for their single temperature values.
- **Rationale**: FR-006 and the spec's acceptance scenarios give this exact literal format;
  independent rounding (not rounding the range width) matches Acceptance Scenario 2's explicit
  requirement that a rounded-equal low/high still shows both bounds rather than collapsing.
- **Alternatives considered**: An en dash (–) instead of a hyphen-minus — rejected: the spec's
  own acceptance-scenario text uses a plain hyphen-minus consistently; matching it exactly avoids
  ambiguity for the Playwright text-assertion and keeps parity with existing temperature-value
  formatting elsewhere in the panel (e.g. today's forecast currently renders "22°C / 12°C" with
  plain ASCII characters).

## 5. Nighttime "sunny" → moon + "clear" override (current-conditions line only)

- **Decision**: Extend `fetchWeatherAndForecast()`'s existing single Open-Meteo request with two
  more `daily` params (`sunrise,sunset`, today's values only — no `nextSunrise` needed, see
  below), then compute a simple boolean in a new pure module,
  `web/js/weather/daytime.js`:
  `isDaytime(now, sunriseIso, sunsetIso) = now >= sunrise && now < sunset`. When the
  current-conditions category is `'sunny'` and `isDaytime` is `false`, the current-conditions
  line shows a moon glyph (🌙) and the new `infoPanel.weatherCategory.clear` label instead of the
  sunny glyph/label; every other category, and the forecast line, are unaffected (FR-011/FR-012).
- **Rationale**: The user's request is specifically about the _current_ reading looking wrong
  ("sunny" shown at 2am), which only "sunny" (WMO codes 0/1, clear/mainly clear) can trigger — the
  other four categories describe cloud/precipitation states that read the same regardless of time
  of day, so no override is needed for them. Reusing "sunny"'s existing WMO-code mapping (rather
  than adding a sixth classification category) keeps `weatherCodeToCategory()` and
  `WEATHER_CATEGORIES` (shared with the sky backdrop, FR-007) unchanged — this is a
  presentation-layer override in the info panel only, computed from the already-fetched
  `weatherCode` plus a fresh sunrise/sunset comparison.
- **Alternatives considered**:
  - Importing `sky/solar-arc.js`'s `computeSkyBodyPosition()` directly — rejected: it computes a
    full arc position (x/y percent, crossfade) for animating the sky's sun/moon sprite, and
    requires `nextSunrise` to bound the post-midnight portion of the night. This feature only
    needs a boolean day/night check for the current instant, which only needs _today's_
    sunrise/sunset — pulling in the extra field and the unused arc-position math would be
    needless coupling to the `sky/` feature directory for a two-line boolean. A small parallel
    `isDaytime()` in `weather/` (this feature's own directory) is simpler and independently
    testable at zero shared-state risk.
  - Fetching `nextSunrise` too (matching `sky/weather-client.js`'s `forecast_days=2` shape) to
    make the boundary logic byte-for-byte identical to the sky feature — rejected: unnecessary
    for a same-day boolean check; "is now before today's sunrise, or at/after today's sunset"
    fully answers "is it nighttime right now" without needing tomorrow's sunrise at all. The one
    edge case this simplification doesn't handle for free — very early morning, before today's
    sunrise, is still nighttime — is exactly why the check is `now < sunrise || now >= sunset`,
    not just `now >= sunset`; both branches are covered by today's single sunrise/sunset pair.
  - Reusing the sky feature's already-resolved location/weather poll directly instead of adding
    fields to the info panel's own request — rejected: `weather-forecast-client.js`'s header
    comment already explains why this feature keeps its own independently-polled request separate
    from `sky/weather-client.js` (different response shape, different poll cadence); adding two
    more fields to the existing request preserves that separation instead of re-coupling the two
    features.
- **Fallback when sunrise/sunset can't be resolved** (FR-013): if the extended Open-Meteo
  response is missing `sunrise`/`sunset` even though the current weather code/temperature parsed
  fine, `fetchWeatherAndForecast()` still resolves `available: true` (temperature/condition data
  is still valid) but with `sunrise`/`sunset` absent; `info-panel-controller.js` treats a missing
  sunrise/sunset pair as "assume daytime" (skip the override), matching FR-013's explicit
  safer-default requirement — never assume nighttime without proof.

## 6. Heute→Morgen forecast-day switch at a fixed cutoff hour

- **Decision**: Add `FORECAST_DAY_SWITCH_HOUR = 18` to `web/js/config.js` (mirroring the file's
  existing plain-constant style, e.g. `DATA_REFRESH_INTERVAL_MS`, `SKY_LOCATION_OVERRIDE`).
  Extend `fetchWeatherAndForecast()`'s Open-Meteo request from `forecast_days=1` to
  `forecast_days=2`, so `data.daily.*[1]` (tomorrow) is available alongside `data.daily.*[0]`
  (today) in the same response. In `renderWeather()`, pick `dayIndex = new Date().getHours() >=
FORECAST_DAY_SWITCH_HOUR ? 1 : 0` and read that day's `weatherCode`/`minC`/`maxC`, with the
  prefix text following the same branch (`t('infoPanel.todayLabel')` for index 0,
  `t('infoPanel.tomorrowLabel')` for index 1).
- **Rationale**: This is explicitly a developer-set constant per the user's clarification ("as
  hardcoded value in the config.js"), not a user-facing preference — so it needs no
  `localStorage`-backed getter/setter pair (unlike `settings.js`'s toggles, which back actual UI
  controls) and no settings UI. `config.js` already holds exactly this kind of fixed,
  product-decision constant (poll intervals, the sky's fixed location override, chart axis
  defaults), so a new constant there matches existing precedent instead of inventing a new
  configuration surface. `new Date().getHours()` matches the spec's clarified "local time" =
  browser wall-clock hour, the same time source `todayParams()` already uses elsewhere in
  `info-panel-controller.js` for "today" boundaries.
- **Alternatives considered**:
  - A `localStorage`-backed setting via `settings.js`, with a UI control (the option offered
    first) — rejected per explicit user direction; would also require inventing a UI-affordance
    location for a single hour value with no existing pattern to reuse (unlike the app's existing
    binary toggles).
  - Comparing against the installation's resolved timezone (matching `weather-client.js`/
    `weather-forecast-client.js`'s own `timezone=auto` Open-Meteo parameter) instead of the
    browser's local hour — rejected: the existing panel already treats "today" using the
    browser's own `Date` (`todayParams()`), and introducing a second, more "correct" time source
    just for this one comparison would create an inconsistency between how "today" is defined for
    the yield figures versus the forecast line, for no benefit most visitors would ever notice
    (installation and visitor are typically in the same timezone in practice for this project).
  - Fetching tomorrow's forecast in a second, separate request only once the cutoff is reached —
    rejected: `forecast_days=2` costs nothing extra (Open-Meteo returns both days in the one
    request already being made) and keeps the fetch/render split simple — one poll, one response
    shape, decide which day to display at render time.
- **Failure handling** (FR-015): if `data.daily.weather_code[1]`/`temperature_2m_max[1]`/
  `temperature_2m_min[1]` don't parse as finite numbers while the current-conditions fields and
  today's (`[0]`) fields do, `fetchWeatherAndForecast()` still resolves `available: true` (the
  current-conditions line is unaffected) but the forecast fields for the selected day come back
  missing; `info-panel-controller.js` treats that as forecast-unavailable (empty line) whenever
  the cutoff has passed, exactly mirroring the existing FR-008 fallback shape rather than adding a
  new state.

## 7. Data source for the range bounds

- **Decision**: Reuse `fetchWeatherAndForecast()`'s existing `todayMinC`/`todayMaxC` fields
  unchanged — no client change needed here, this is a formatting-only rework of already-fetched
  values.
- **Rationale**: The current forecast line already renders `todayMaxC`/`todayMinC` (just in the
  wrong order, "max / min", per `info-panel-controller.js:245`); FR-006 only requires reordering
  to low-first and wrapping in parentheses with a hyphen, not a new fetch or field.
- **Alternatives considered**: None — the data already exists in the exact shape needed.
