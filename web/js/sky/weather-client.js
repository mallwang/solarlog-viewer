/**
 * @file Open-Meteo forecast wrapper. Fetches the current WMO weather code plus today's and
 * tomorrow's sunrise/sunset for a resolved installation location in one request, and parses the
 * response into the shape `sky-controller.js` needs for both the weather-driven background
 * (User Story 1) and sun/moon positioning (User Story 2). See research.md §1 and data-model.md
 * §Sky Weather Reading.
 */

import { weatherCodeToCategory } from '../weather/weather-category.js';

const FORECAST_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetches the current weather code and today's/tomorrow's sunrise/sunset for a location. Never
 * throws — any network error, non-2xx status, or malformed response resolves to `null` so the
 * caller can retain its last-known-good state (FR-009).
 * @param {{ lat: number, lon: number }} coords - Resolved installation coordinates.
 * @param {{ fetchImpl?: typeof fetch }} [deps] - Injectable `fetch` implementation for tests.
 * @returns {Promise<{ weatherCode: number, category: 'sunny' | 'mixed' | 'cloudy' | 'rain' |
 *   'snow', sunrise: string, sunset: string, nextSunrise: string, fetchedAt: Date } | null>}
 */
export async function fetchWeather({ lat, lon }, { fetchImpl = fetch } = {}) {
  try {
    const url =
      `${FORECAST_BASE_URL}?latitude=${lat}&longitude=${lon}` +
      `&current=weather_code&daily=sunrise,sunset&forecast_days=2&timezone=auto`;
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    const data = await response.json();

    const weatherCode = data?.current?.weather_code;
    const [sunrise, nextSunrise] = data?.daily?.sunrise ?? [];
    const [sunset] = data?.daily?.sunset ?? [];
    if (!Number.isFinite(weatherCode) || !sunrise || !sunset || !nextSunrise) return null;

    return {
      weatherCode,
      category: weatherCodeToCategory(weatherCode),
      sunrise,
      sunset,
      nextSunrise,
      fetchedAt: new Date(),
    };
  } catch {
    return null;
  }
}
