/**
 * @file Shared five-category weather classifier — the one piece of logic both the sky
 * background (`sky/sky-controller.js`) and the global info panel (`info-panel/weather-forecast-
 * client.js`) run over their own independently-polled Open-Meteo `weather_code` reading, so the
 * same underlying condition always yields the same one of five categories on both sides
 * (FR-002). Pure function, no DOM. See research.md §3 and data-model.md §Weather Background
 * Category.
 */

/** The five valid Weather Background Category values, in no particular order (data-model.md). */
export const WEATHER_CATEGORIES = ['sunny', 'mixed', 'cloudy', 'rain', 'snow'];

/** WMO `weather_code`s that map to `'sunny'` — clear sky, mainly clear. */
const SUNNY_CODES = [0, 1];
/** WMO `weather_code`s that map to `'mixed'` — partly cloudy. */
const MIXED_CODES = [2];
/** WMO `weather_code`s that map to `'cloudy'` — overcast, fog/rime fog (closest visual match). */
const CLOUDY_CODES = [3, 45, 48];
/** WMO `weather_code`s that map to `'rain'` — drizzle/rain/rain-showers and thunderstorm. */
const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
/** WMO `weather_code`s that map to `'snow'` — snow fall/grains/showers. */
const SNOW_CODES = [71, 73, 75, 77, 85, 86];

/**
 * Classifies a raw Open-Meteo/WMO `weather_code` into one of the five Weather Background
 * Category values. Any unrecognized code (including a future WMO code this table doesn't yet
 * know about) falls back to `'cloudy'` — a neutral default, never a sixth "unknown" state
 * (FR-004).
 * @param {number} weatherCode - Raw Open-Meteo `current.weather_code` (WMO code).
 * @returns {'sunny' | 'mixed' | 'cloudy' | 'rain' | 'snow'}
 */
export function weatherCodeToCategory(weatherCode) {
  if (SUNNY_CODES.includes(weatherCode)) return 'sunny';
  if (MIXED_CODES.includes(weatherCode)) return 'mixed';
  if (RAIN_CODES.includes(weatherCode)) return 'rain';
  if (SNOW_CODES.includes(weatherCode)) return 'snow';
  if (CLOUDY_CODES.includes(weatherCode)) return 'cloudy';
  return 'cloudy';
}
