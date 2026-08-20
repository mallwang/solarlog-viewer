# Phase 1 Data Model: Compact Weather Display with Hover Detail

No new data entities are introduced — this feature reformats fields already produced by
`fetchWeatherAndForecast()` (`web/js/info-panel/weather-forecast-client.js`, unchanged) using the
existing `Weather Background Category` classification (`web/js/weather/weather-category.js`,
unchanged) and icon lookup (`web/js/weather/weather-icon.js`, unchanged). The entities below
extend the render shapes documented in `specs/023-weather-panel-icons/data-model.md` with a new
compact/full-text split and a divider.

## Compact Weather Indicator (NEW render shape, applies to both entities below)

The shared shape both the current-conditions and forecast indicators now use. Not a data entity
of its own — a presentation pattern applied to each of the two entities below.

| Field          | Type      | Description                                                                                       |
| -------------- | --------- | ------------------------------------------------------------------------------------------------- |
| `icon`         | `string`  | Decorative glyph (unchanged lookup), `aria-hidden="true"`.                                        |
| `compactValue` | `string`  | Short value shown beneath the icon by default — no label, no prefix, no unit repetition.          |
| `fullText`     | `string`  | The complete previous inline sentence — becomes the indicator's `aria-label` and tooltip content. |
| `available`    | `boolean` | Independent per indicator (FR-007) — drives which of the two render branches below applies.       |

**Invariants**:

- `compactValue` and `fullText` are always derived from the same source label/prefix/temperature
  data in the same render call (`weather-text.js`) — never built from two independent code paths
  (FR-004, research.md §6).
- `icon` is never shown standalone without either `compactValue` (available) or the unavailable
  dash glyph — an indicator is never rendered with only an icon and no value at all.
- `fullText` is set as `aria-label` unconditionally (not only while hovered/focused) — an
  assistive-technology user gets it the instant they reach the indicator (FR-006).

## Current-Conditions Indicator (UPDATED render shape)

Previously (023-weather-panel-icons): `<icon> <label>, <temp>°C` all visible inline. Now:

| Field          | Available (`true`)                                                                                                                                | Unavailable (`false`)        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `icon`         | `weatherCategoryToIcon(weatherCodeToCategory(weather.weatherCode))` (or the moon glyph under the existing nighttime override, unchanged from 023) | dimmed dash icon (`–`)       |
| `compactValue` | `Math.round(weather.temperatureC) + "°C"` (e.g. `"21°C"`)                                                                                         | _(none — dash icon only)_    |
| `fullText`     | `"<label>, <temp>°C"` (e.g. `"Klar, 21°C"`) — identical wording to the previous inline text                                                       | `t('infoPanel.unavailable')` |

The nighttime "sunny"→moon/"clear" override (023) is unchanged: when it applies, `<label>` above
is `t('infoPanel.weatherCategory.clear')` and `<icon>` is the moon glyph, same as before this
feature — only the _display shape_ (compact vs. inline) changes, not the classification logic.

## Forecast Indicator (UPDATED render shape)

Previously (023-weather-panel-icons): `<prefix>: <icon> <label> (<low>°C - <high>°C)` all visible
inline, or nothing at all when the selected day's fields were missing. Now:

| Field          | Available (`true`)                                                                                                                                         | Unavailable (`false`)        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `icon`         | `weatherCategoryToIcon(weatherCodeToCategory(weatherCode))` for the selected day (unchanged selection logic)                                               | dimmed dash icon (`–`)       |
| `compactValue` | `"<low>° - <high>°"` (e.g. `"15° - 19°"`) — degree symbol per bound, no repeated `"C"` to keep the range compact                                           | _(none — dash icon only)_    |
| `fullText`     | `"<prefix>: <label> (<low>°C - <high>°C)"` (e.g. `"Heute: Regen (15°C - 19°C)"`) — identical wording to the previous inline text, including the day prefix | `t('infoPanel.unavailable')` |

`prefix`/day selection (`infoPanel.todayLabel`/`infoPanel.tomorrowLabel` at
`FORECAST_DAY_SWITCH_HOUR`) is unchanged from 023 — only the render shape changes. The
**unavailable** shape is a change from 023: previously the forecast indicator rendered nothing at
all when the selected day's fields didn't parse; it now renders the same dimmed dash icon the
current-conditions indicator already used, for visual consistency with the new divider
(research.md §5).

## Divider (NEW, presentational only)

| Field   | Type | Description                                                                            |
| ------- | ---- | -------------------------------------------------------------------------------------- |
| `style` | CSS  | `border-left: 1px solid var(--color-border)` on the forecast indicator's leading edge. |

**Invariants**:

- Purely visual — no accessible role, no interactive behavior, present regardless of either
  indicator's availability (FR-008 applies "so the two read as distinct pieces of information,"
  which holds whether or not either side currently has data).

## Relationships

```text
weather_code, temperature_2m (Open-Meteo, current)      weather_code, min/maxC (Open-Meteo, daily[dayIndex])
        │  weatherCodeToCategory() [unchanged]                    │  weatherCodeToCategory() [unchanged]
        ▼                                                          ▼
   Weather Background Category                             Weather Background Category
        │                                                          │
        │ weatherCategoryToIcon() [unchanged]                      │ weatherCategoryToIcon() [unchanged]
        ▼                                                          ▼
    decorative glyph                                          decorative glyph
        │                                                          │
        │ weather-text.js (NEW) ── builds compactValue + fullText from the same label/temp source
        ▼                                                          ▼
 Current-Conditions Indicator                              Forecast Indicator
 (icon, compactValue, fullText, available)                  (icon, compactValue, fullText, available)
        │                                                          │
        └──────────────────────┬───────────────────────────────────┘
                                ▼
                 rendered side by side inside `.info-panel__weather`,
                 divider between them (CSS only, no data dependency)
```

`fullText` becomes each indicator's `aria-label` unconditionally, and separately drives the
decorative tooltip's text content shown on hover/focus/tap — both are populated from the exact
same `weather-text.js` output, so there is no path where the accessible name and the visual
tooltip disagree (FR-004, Constraints).
