# Phase 1 Data Model: Weather Panel Icons

No new data entities are introduced — this feature reformats fields already produced by
`fetchWeatherAndForecast()` (`web/js/info-panel/weather-forecast-client.js`, unchanged) using the
existing `Weather Background Category` classification (`web/js/weather/weather-category.js`,
unchanged). The entities below extend the existing model documented in
`specs/018-day-night-sky/data-model.md` with one new lookup table and two updated render shapes.

## Weather Category Icon (NEW)

A static, decorative Unicode glyph associated with one of the five existing Weather Background
Category values. Pure lookup table — no state, no validation beyond "every category has exactly
one glyph."

| Field      | Type                                                 | Description                                    |
| ---------- | ---------------------------------------------------- | ---------------------------------------------- |
| `category` | `'sunny' \| 'mixed' \| 'cloudy' \| 'rain' \| 'snow'` | Key — one of `WEATHER_CATEGORIES` (unchanged). |
| `glyph`    | `string` (single emoji character)                    | Decorative icon shown next to the label.       |

**Values** (see research.md §1):

| category | glyph |
| -------- | ----- |
| sunny    | ☀️    |
| mixed    | ⛅    |
| cloudy   | ☁️    |
| rain     | 🌧️    |
| snow     | ❄️    |

**Invariants**:

- Total function over `WEATHER_CATEGORIES` — every category has exactly one glyph, no `null`/
  `undefined` case (mirrors `weatherCodeToCategory()`'s own total-function guarantee, which
  already always falls back to `'cloudy'` rather than an unknown sixth state).
- Glyph is never shown standalone without its adjacent text label (FR-002/FR-005 place the icon
  immediately before the label it corresponds to; FR-009 requires it be `aria-hidden`, i.e. the
  label text remains the sole accessible name for the condition).

**Source**: `web/js/weather/weather-icon.js` (new). Also exports (or co-locates) the standalone
moon glyph (🌙) used only by the Nighttime Clear Display override below — not part of the
5-category map itself, since it isn't keyed by `WEATHER_CATEGORIES`.

## Nighttime Clear Display (NEW, current-conditions line only)

A presentation-layer override, not a sixth Weather Background Category. Applies only when both:

| Condition                                                   | Source                                        |
| ----------------------------------------------------------- | --------------------------------------------- |
| `weatherCodeToCategory(weather.weatherCode) === 'sunny'`    | unchanged classifier (`weather-category.js`)  |
| `isDaytime(now, weather.sunrise, weather.sunset) === false` | NEW `daytime.js`, today's sunrise/sunset only |

| Field      | Type     | Description                                                              |
| ---------- | -------- | ------------------------------------------------------------------------ |
| `glyph`    | `string` | 🌙 (moon), replaces the sunny glyph on the current-conditions line only. |
| `labelKey` | `string` | `infoPanel.weatherCategory.clear` (NEW i18n key: "Klar" / "Clear").      |

**Invariants**:

- Only ever overrides the current-conditions line; the forecast line always uses the regular
  5-category icon/label regardless of time of day (FR-012).
- Only ever triggers for the `'sunny'` category; the other four categories are never affected by
  time of day (FR-011, spec Acceptance Scenario 5).
- If `weather.sunrise`/`weather.sunset` are absent (fetch succeeded but the daily fields didn't
  parse), the override does not apply — falls back to the regular daytime "sunny" display
  (FR-013).
- Does not change `weatherCodeToCategory()`'s return value or `WEATHER_CATEGORIES` — the sky
  backdrop and any other consumer of the classifier are unaffected.

**Source**: `web/js/weather/daytime.js` (new, `isDaytime()`) +
`web/js/info-panel/info-panel-controller.js` (new branch in `renderWeather()`).

## Current-Conditions Line (UPDATED render shape)

Existing entity (info panel's current-weather text), reformatted. Previously: `"Aktuell: <label>
· <temp>°C"`. Now (daytime, or "sunny" case not applicable):

| Segment     | Source                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------- |
| icon        | `weatherCategoryToIcon(weatherCodeToCategory(weather.weatherCode))`, `aria-hidden="true"` |
| label       | `t(weatherCodeToLabelKey(weather.weatherCode))` (unchanged)                               |
| separator   | literal `", "` (comma + single space, per FR-003)                                         |
| temperature | `Math.round(weather.temperatureC)` + `"°C"` (unchanged rounding)                          |

When the Nighttime Clear Display override applies (category `'sunny'`, nighttime): `icon` and
`label` above are replaced by the override's `glyph` (🌙) and `t('infoPanel.weatherCategory.clear')`
respectively; `separator` and `temperature` are unchanged.

Unavailable state (FR-008, unchanged): falls back to `t('infoPanel.unavailable')`, no icon.

## Forecast Cutoff Hour (NEW)

A fixed, developer-set constant — not app state, not user data. Read once per render, no
persistence layer.

| Field                      | Type     | Description                                                                            |
| -------------------------- | -------- | -------------------------------------------------------------------------------------- |
| `FORECAST_DAY_SWITCH_HOUR` | `number` | Local hour (0–23) at/after which the forecast line switches to tomorrow. Default `18`. |

**Source**: `web/js/config.js` (new constant, alongside `DATA_REFRESH_INTERVAL_MS` /
`WEATHER_REFRESH_INTERVAL_MS`).

## Forecast Line (UPDATED render shape)

Existing entity (info panel's forecast text). Previously: `"Heute: <label> · <max>°C /
<min>°C"`, always today. Now selects one of two day-indices based on the Forecast Cutoff Hour
(FR-004/FR-014):

| dayIndex       | Condition                                           | prefix key                                          |
| -------------- | --------------------------------------------------- | --------------------------------------------------- |
| `0` (today)    | `new Date().getHours() < FORECAST_DAY_SWITCH_HOUR`  | `infoPanel.todayLabel` ("Heute")                    |
| `1` (tomorrow) | `new Date().getHours() >= FORECAST_DAY_SWITCH_HOUR` | `infoPanel.tomorrowLabel` ("Morgen") — NEW i18n key |

Rendered segments, using whichever `dayIndex` applies:

| Segment | Source                                                                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| prefix  | `t(dayIndex === 0 ? 'infoPanel.todayLabel' : 'infoPanel.tomorrowLabel')` + `":"` (FR-004)                                                              |
| icon    | `weatherCategoryToIcon(weatherCodeToCategory(weather.daily[dayIndex].weatherCode))`, `aria-hidden="true"` — never gets the nighttime override (FR-012) |
| label   | `t(weatherCodeToLabelKey(weather.daily[dayIndex].weatherCode))`                                                                                        |
| range   | `"(" + Math.round(weather.daily[dayIndex].minC) + "°C - " + Math.round(weather.daily[dayIndex].maxC) + "°C)"` (FR-006, low first)                      |

Unavailable state (FR-008/FR-015, unchanged in shape): empty string, no icon — now also covers
the case where the selected day's fields specifically failed to parse (see research.md §6).

## Relationships

```text
weather_code (Open-Meteo, current + daily[0])         sunrise, sunset (Open-Meteo, daily[0], NEW)
        │  weatherCodeToCategory()                              │
        │  [unchanged, weather-category.js]                     │  isDaytime(now, ·, ·)
        ▼                                                        ▼  [NEW, daytime.js]
Weather Background Category                              true (day) | false (night)
('sunny'|'mixed'|'cloudy'|'rain'|'snow')                            │
        │                          │                               │
        │ weatherCategoryToIcon()  │ weatherCodeToLabelKey() → t()  │
        ▼  [NEW, weather-icon.js]  ▼  [unchanged]                  │
   decorative glyph            localized label text                │
        └───────────┬───────────────┘                              │
                     ▼                                              │
        current-conditions display (glyph, label) ◄── overridden when category==='sunny'
                     │                                  AND isDaytime===false: glyph→🌙,
                     ▼                                  label→'infoPanel.weatherCategory.clear'
        Current-Conditions Line / Forecast Line
        (rendered by info-panel-controller.js renderWeather(); forecast line never overridden)
```

The same classification the sky backdrop already computes independently (per
`weather-forecast-client.js`'s own header comment) now also drives the icon, so icon and label
always agree — there is no path where the icon glyph and the text label disagree, since both are
derived from the same `category` value in the same render call (FR-007), except the deliberate,
symmetric current-conditions-only override documented above (FR-011).

The Forecast Cutoff Hour is orthogonal to all of the above: it only selects _which day's_ daily
fields (`weather.daily[0]` vs `weather.daily[1]`) feed the Forecast Line's existing
category→icon/label pipeline — it never touches the current-conditions line or the nighttime
override.
