/**
 * @file Open-Meteo current-weather-code + today's-forecast fetch for the global info panel
 * (research.md §1). Deliberately separate from `web/js/sky/weather-client.js` — that module
 * is scoped around the sky backdrop's own poll cadence + sunrise/sunset; this feature needs
 * today's min/max temperature too, a different response shape. Its weather-code label,
 * however, now delegates to the shared `weatherCodeToCategory()` classifier
 * (`weather/weather-category.js`) so the nav bar's text and the sky backdrop always agree on
 * the same five-way condition whenever both are reading live data (FR-002). See data-model.md's
 * "Current Weather Condition" / "Today's Forecast Summary".
 */

import { weatherCodeToCategory } from '../weather/weather-category.js';

const FORECAST_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Maps an Open-Meteo/WMO `weather_code` to its i18n key under `infoPanel.weatherCategory.*`, via
 * the shared five-category classifier (`weatherCodeToCategory()`) — never returns anything
 * outside the five categories (FR-004).
 * @param {number} weatherCode
 * @returns {string} i18n key, e.g. 'infoPanel.weatherCategory.sunny'.
 */
export function weatherCodeToLabelKey(weatherCode) {
  return `infoPanel.weatherCategory.${weatherCodeToCategory(weatherCode)}`;
}

/**
 * Fetches the current weather code/temperature, today's forecast (weather code, min/max
 * temperature), today's sunrise/sunset, and tomorrow's forecast for a resolved installation
 * location, in one request. Never throws — any network error, non-2xx status, or malformed
 * *current/today* response resolves to `{ available: false }` so the caller can render an
 * independent "unavailable" state for the weather/forecast side of the panel (FR-008) without
 * affecting the production side. `sunrise`/`sunset` (research.md §5/FR-013) and the
 * `tomorrowWeatherCode`/`tomorrowMaxC`/`tomorrowMinC` fields (research.md §6/FR-015) are each
 * independently optional — a missing/malformed value among them does NOT flip the whole response
 * to `available: false` as long as the current-conditions/today's fields parsed fine.
 * @param {{ lat: number, lon: number }} coords - Resolved installation coordinates.
 * @param {{ fetchImpl?: typeof fetch }} [deps] - Injectable `fetch` implementation for tests.
 * @returns {Promise<{ weatherCode: number, temperatureC: number, todayWeatherCode: number,
 *   todayMaxC: number, todayMinC: number, sunrise?: string, sunset?: string,
 *   tomorrowWeatherCode?: number, tomorrowMaxC?: number, tomorrowMinC?: number,
 *   available: true } | { available: false }>}
 */
export async function fetchWeatherAndForecast({ lat, lon }, { fetchImpl = fetch } = {}) {
  try {
    const url =
      `${FORECAST_BASE_URL}?latitude=${lat}&longitude=${lon}` +
      `&current=weather_code,temperature_2m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset` +
      `&forecast_days=2&timezone=auto`;
    const response = await fetchImpl(url);
    if (!response.ok) return { available: false };
    const data = await response.json();

    const weatherCode = data?.current?.weather_code;
    const temperatureC = data?.current?.temperature_2m;
    const todayWeatherCode = data?.daily?.weather_code?.[0];
    const todayMaxC = data?.daily?.temperature_2m_max?.[0];
    const todayMinC = data?.daily?.temperature_2m_min?.[0];

    if (
      !Number.isFinite(weatherCode) ||
      !Number.isFinite(temperatureC) ||
      !Number.isFinite(todayWeatherCode) ||
      !Number.isFinite(todayMaxC) ||
      !Number.isFinite(todayMinC)
    ) {
      return { available: false };
    }

    const sunrise = data?.daily?.sunrise?.[0];
    const sunset = data?.daily?.sunset?.[0];
    const tomorrowWeatherCode = data?.daily?.weather_code?.[1];
    const tomorrowMaxC = data?.daily?.temperature_2m_max?.[1];
    const tomorrowMinC = data?.daily?.temperature_2m_min?.[1];

    return {
      weatherCode,
      temperatureC,
      todayWeatherCode,
      todayMaxC,
      todayMinC,
      ...(sunrise === undefined ? {} : { sunrise }),
      ...(sunset === undefined ? {} : { sunset }),
      ...(Number.isFinite(tomorrowWeatherCode) ? { tomorrowWeatherCode } : {}),
      ...(Number.isFinite(tomorrowMaxC) ? { tomorrowMaxC } : {}),
      ...(Number.isFinite(tomorrowMinC) ? { tomorrowMinC } : {}),
      available: true,
    };
  } catch {
    return { available: false };
  }
}
