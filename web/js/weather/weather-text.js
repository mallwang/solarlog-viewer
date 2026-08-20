/**
 * @file Pure string/glyph builders for the compact weather indicators (current conditions +
 * forecast) in the global info panel (025-weather-icon-compact, data-model.md's "Compact Weather
 * Indicator" shape). Each builder returns the exact same `{ icon, compactValue, fullText,
 * available }` shape from one function call, so the short value shown by default and the full
 * text used for both `aria-label` and the hover/focus tooltip can never drift apart (FR-004).
 *
 * Deliberately takes already-resolved/translated fragments (label, prefix text, unavailable
 * text) rather than i18n keys or category codes — the nighttime "sunny"→"clear" override and the
 * `t()` lookups stay in `info-panel-controller.js` (research.md §6); this module is pure string
 * assembly with no DOM and no i18n dependency of its own, so it's directly unit-testable
 * (weather-text.test.js).
 */

/** Decorative dash glyph shown in place of the real icon when an indicator is unavailable
 *  (data-model.md's "Unavailable" column, research.md §5) — dimmed via CSS, not here. */
export const UNAVAILABLE_ICON = '–';

/**
 * @typedef {{ icon: string, compactValue: string, fullText: string, available: boolean }} WeatherIndicatorText
 */

/**
 * Builds the compact/full text pair for the current-conditions indicator.
 * @param {{ available: boolean, icon?: string, label?: string, temperatureC?: number,
 *   unavailableText?: string }} params - `icon`/`label`/`temperatureC` are required when
 *   `available` is true; `unavailableText` (e.g. `t('infoPanel.unavailable')`) is required when
 *   `available` is false.
 * @returns {WeatherIndicatorText}
 */
export function buildCurrentWeatherText({ available, icon, label, temperatureC, unavailableText }) {
  if (!available) {
    return {
      icon: UNAVAILABLE_ICON,
      compactValue: '',
      fullText: unavailableText,
      available: false,
    };
  }

  const temp = `${Math.round(temperatureC)}°C`;
  return {
    icon,
    compactValue: temp,
    fullText: `${label}, ${temp}`,
    available: true,
  };
}

/**
 * Builds the compact/full text pair for the forecast indicator, for whichever day
 * (today/tomorrow) has already been selected by the caller.
 * @param {{ available: boolean, icon?: string, label?: string, prefixText?: string,
 *   minC?: number, maxC?: number, unavailableText?: string }} params - `icon`/`label`/
 *   `prefixText`/`minC`/`maxC` are required when `available` is true (`prefixText` is the
 *   already-translated `t('infoPanel.todayLabel')`/`t('infoPanel.tomorrowLabel')`);
 *   `unavailableText` is required when `available` is false.
 * @returns {WeatherIndicatorText}
 */
export function buildForecastWeatherText({
  available,
  icon,
  label,
  prefixText,
  minC,
  maxC,
  unavailableText,
}) {
  if (!available) {
    return {
      icon: UNAVAILABLE_ICON,
      compactValue: '',
      fullText: unavailableText,
      available: false,
    };
  }

  const min = Math.round(minC);
  const max = Math.round(maxC);
  return {
    icon,
    compactValue: `${min}° - ${max}°`,
    fullText: `${prefixText}: ${label} (${min}°C - ${max}°C)`,
    available: true,
  };
}
