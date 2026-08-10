/**
 * @file Open-Meteo current-weather-code + today's-forecast fetch for the global info panel
 * (research.md §1). Deliberately separate from `web/js/sky/weather-client.js` — that module
 * is scoped around cloud-cover-percent + sunrise/sunset for the sky backdrop; this feature
 * needs a discrete WMO weather code (for a human label like "clear"/"rain") and today's
 * min/max temperature, a different response shape. See data-model.md's "Current Weather
 * Condition" / "Today's Forecast Summary".
 */

const FORECAST_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Maps an Open-Meteo/WMO `weather_code` to a short i18n key under `infoPanel.weatherCode.*`.
 * Grouped per WMO code table: https://open-meteo.com/en/docs (see "WMO Weather interpretation
 * codes"). Unrecognized codes fall back to the generic 'unknown' key rather than throwing.
 * @param {number} weatherCode
 * @returns {string} i18n key, e.g. 'infoPanel.weatherCode.clear'.
 */
export function weatherCodeToLabelKey(weatherCode) {
  if (weatherCode === 0) return 'infoPanel.weatherCode.clear';
  if ([1, 2, 3].includes(weatherCode)) return 'infoPanel.weatherCode.cloudy';
  if ([45, 48].includes(weatherCode)) return 'infoPanel.weatherCode.fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return 'infoPanel.weatherCode.rain';
  }
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return 'infoPanel.weatherCode.snow';
  if ([95, 96, 99].includes(weatherCode)) return 'infoPanel.weatherCode.storm';
  return 'infoPanel.weatherCode.unknown';
}

/**
 * Fetches the current weather code/temperature and today's forecast (weather code, min/max
 * temperature) for a resolved installation location, in one request. Never throws — any
 * network error, non-2xx status, or malformed response resolves to `{ available: false }` so
 * the caller can render an independent "unavailable" state for the weather/forecast side of
 * the panel (FR-008) without affecting the production side.
 * @param {{ lat: number, lon: number }} coords - Resolved installation coordinates.
 * @param {{ fetchImpl?: typeof fetch }} [deps] - Injectable `fetch` implementation for tests.
 * @returns {Promise<{ weatherCode: number, temperatureC: number, todayWeatherCode: number,
 *   todayMaxC: number, todayMinC: number, available: true } | { available: false }>}
 */
export async function fetchWeatherAndForecast({ lat, lon }, { fetchImpl = fetch } = {}) {
  try {
    const url =
      `${FORECAST_BASE_URL}?latitude=${lat}&longitude=${lon}` +
      `&current=weather_code,temperature_2m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
      `&forecast_days=1&timezone=auto`;
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

    return { weatherCode, temperatureC, todayWeatherCode, todayMaxC, todayMinC, available: true };
  } catch {
    return { available: false };
  }
}
