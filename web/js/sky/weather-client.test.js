import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWeather } from './weather-client.js';

function fetchReturning(body, { ok = true } = {}) {
  return async () => ({
    ok,
    json: async () => body,
  });
}

const SAMPLE_RESPONSE = {
  current: { weather_code: 61 },
  daily: {
    sunrise: ['2026-08-09T06:00', '2026-08-10T06:02'],
    sunset: ['2026-08-09T20:30', '2026-08-10T20:28'],
  },
};

test('a successful response parses into the expected shape', async () => {
  const fetchImpl = fetchReturning(SAMPLE_RESPONSE);

  const result = await fetchWeather({ lat: 49.4, lon: 12.0 }, { fetchImpl });

  assert.equal(result.weatherCode, 61);
  assert.equal(result.category, 'rain');
  assert.equal(result.sunrise, '2026-08-09T06:00');
  assert.equal(result.sunset, '2026-08-09T20:30');
  assert.equal(result.nextSunrise, '2026-08-10T06:02');
  assert.ok(result.fetchedAt instanceof Date);
});

test('a failed (non-2xx) response returns null without throwing', async () => {
  const fetchImpl = fetchReturning({}, { ok: false });

  const result = await fetchWeather({ lat: 49.4, lon: 12.0 }, { fetchImpl });

  assert.equal(result, null);
});

test('a network failure returns null without throwing', async () => {
  const fetchImpl = async () => {
    throw new Error('offline');
  };

  const result = await fetchWeather({ lat: 49.4, lon: 12.0 }, { fetchImpl });

  assert.equal(result, null);
});

test('a malformed response returns null without throwing', async () => {
  const fetchImpl = fetchReturning({ current: {} });

  const result = await fetchWeather({ lat: 49.4, lon: 12.0 }, { fetchImpl });

  assert.equal(result, null);
});
