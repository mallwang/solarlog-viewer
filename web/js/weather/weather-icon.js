/**
 * @file Decorative icon lookup for the global info panel's weather text (research.md §1,
 * data-model.md §Weather Category Icon). Pure map, no DOM — mirrors `weather-render-config.js`'s
 * existing per-category lookup table pattern, but for a different consumer (info panel icon
 * glyph vs. sky-backdrop render config).
 */

/** One decorative emoji glyph per `WEATHER_CATEGORIES` value (`weather-category.js`). */
const CATEGORY_ICONS = {
  sunny: '☀️',
  mixed: '⛅',
  cloudy: '☁️',
  rain: '🌧️',
  snow: '❄️',
};

/**
 * Standalone moon glyph for the current-conditions line's nighttime "sunny"→"clear" override
 * (data-model.md §Nighttime Clear Display) — not part of the 5-category map itself, since it
 * isn't keyed by `WEATHER_CATEGORIES`.
 * @type {string}
 */
export const MOON_ICON = '🌙';

/**
 * Total function over the five `WEATHER_CATEGORIES` values — every category has exactly one
 * glyph (data-model.md's "Weather Category Icon" invariant).
 * @param {'sunny' | 'mixed' | 'cloudy' | 'rain' | 'snow'} category
 * @returns {string} A single decorative emoji glyph.
 */
export function weatherCategoryToIcon(category) {
  return CATEGORY_ICONS[category];
}
