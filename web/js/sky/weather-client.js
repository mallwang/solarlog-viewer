/**
 * @file Open-Meteo forecast wrapper. Fetches current cloud cover plus today's and tomorrow's
 * sunrise/sunset for a resolved installation location in one request, and parses the
 * response into the shape `sky-controller.js` needs for both cloud density (User Story 1)
 * and sun/moon positioning (User Story 2). See research.md §1 and data-model.md §Weather
 * Condition.
 */

import { cloudCoverToTier } from './cloud-density.js';

const FORECAST_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetches the current cloud cover and today's/tomorrow's sunrise/sunset for a location.
 * Never throws — any network error, non-2xx status, or malformed response resolves to `null`
 * so the caller can retain its last-known-good state (FR-005).
 * @param {{ lat: number, lon: number }} coords - Resolved installation coordinates.
 * @param {{ fetchImpl?: typeof fetch }} [deps] - Injectable `fetch` implementation for tests.
 * @returns {Promise<{ cloudCoverPercent: number, tier: 'clear' | 'partly' | 'overcast',
 *   sunrise: string, sunset: string, nextSunrise: string, fetchedAt: Date } | null>}
 */
export async function fetchWeather({ lat, lon }, { fetchImpl = fetch } = {}) {
  try {
    const url =
      `${FORECAST_BASE_URL}?latitude=${lat}&longitude=${lon}` +
      `&current=cloud_cover&daily=sunrise,sunset&forecast_days=2&timezone=auto`;
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    const data = await response.json();

    const cloudCoverPercent = data?.current?.cloud_cover;
    const [sunrise, nextSunrise] = data?.daily?.sunrise ?? [];
    const [sunset] = data?.daily?.sunset ?? [];
    if (!Number.isFinite(cloudCoverPercent) || !sunrise || !sunset || !nextSunrise) return null;

    return {
      cloudCoverPercent,
      tier: cloudCoverToTier(cloudCoverPercent),
      sunrise,
      sunset,
      nextSunrise,
      fetchedAt: new Date(),
    };
  } catch {
    return null;
  }
}
