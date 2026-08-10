import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWeatherAndForecast, weatherCodeToLabelKey } from './weather-forecast-client.js';

function fetchReturning(body, { ok = true } = {}) {
  return async () => ({
    ok,
    json: async () => body,
  });
}

const SAMPLE_RESPONSE = {
  current: { weather_code: 3, temperature_2m: 21.4 },
  daily: {
    weather_code: [61],
    temperature_2m_max: [24.1],
    temperature_2m_min: [14.2],
  },
};

test('a successful response parses into the expected shape', async () => {
  const fetchImpl = fetchReturning(SAMPLE_RESPONSE);

  const result = await fetchWeatherAndForecast({ lat: 49.4, lon: 12.0 }, { fetchImpl });

  assert.deepEqual(result, {
    weatherCode: 3,
    temperatureC: 21.4,
    todayWeatherCode: 61,
    todayMaxC: 24.1,
    todayMinC: 14.2,
    available: true,
  });
});

test('a failed (non-2xx) response resolves to available: false without throwing', async () => {
  const fetchImpl = fetchReturning({}, { ok: false });

  const result = await fetchWeatherAndForecast({ lat: 49.4, lon: 12.0 }, { fetchImpl });

  assert.deepEqual(result, { available: false });
});

test('a network failure resolves to available: false without throwing', async () => {
  const fetchImpl = async () => {
    throw new Error('offline');
  };

  const result = await fetchWeatherAndForecast({ lat: 49.4, lon: 12.0 }, { fetchImpl });

  assert.deepEqual(result, { available: false });
});

test('a malformed response resolves to available: false', async () => {
  const fetchImpl = fetchReturning({ current: {} });

  const result = await fetchWeatherAndForecast({ lat: 49.4, lon: 12.0 }, { fetchImpl });

  assert.deepEqual(result, { available: false });
});

test('weatherCodeToLabelKey groups known WMO codes', () => {
  assert.equal(weatherCodeToLabelKey(0), 'infoPanel.weatherCode.clear');
  assert.equal(weatherCodeToLabelKey(2), 'infoPanel.weatherCode.cloudy');
  assert.equal(weatherCodeToLabelKey(45), 'infoPanel.weatherCode.fog');
  assert.equal(weatherCodeToLabelKey(61), 'infoPanel.weatherCode.rain');
  assert.equal(weatherCodeToLabelKey(75), 'infoPanel.weatherCode.snow');
  assert.equal(weatherCodeToLabelKey(95), 'infoPanel.weatherCode.storm');
});

test('weatherCodeToLabelKey falls back to unknown for unrecognized codes', () => {
  assert.equal(weatherCodeToLabelKey(999), 'infoPanel.weatherCode.unknown');
});
