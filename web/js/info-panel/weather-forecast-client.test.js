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

test('weatherCodeToLabelKey delegates to the shared five-category classifier', () => {
  assert.equal(weatherCodeToLabelKey(0), 'infoPanel.weatherCategory.sunny');
  assert.equal(weatherCodeToLabelKey(2), 'infoPanel.weatherCategory.mixed');
  assert.equal(weatherCodeToLabelKey(45), 'infoPanel.weatherCategory.cloudy');
  assert.equal(weatherCodeToLabelKey(61), 'infoPanel.weatherCategory.rain');
  assert.equal(weatherCodeToLabelKey(75), 'infoPanel.weatherCategory.snow');
  assert.equal(weatherCodeToLabelKey(95), 'infoPanel.weatherCategory.rain');
});

test('weatherCodeToLabelKey falls back to cloudy for unrecognized codes', () => {
  assert.equal(weatherCodeToLabelKey(999), 'infoPanel.weatherCategory.cloudy');
});

test('a response including sunrise/sunset and tomorrow fields parses them into the result', async () => {
  const fetchImpl = fetchReturning({
    current: { weather_code: 3, temperature_2m: 21.4 },
    daily: {
      weather_code: [61, 71],
      temperature_2m_max: [24.1, 10.5],
      temperature_2m_min: [14.2, 2.1],
      sunrise: ['2026-08-10T06:00'],
      sunset: ['2026-08-10T20:30'],
    },
  });

  const result = await fetchWeatherAndForecast({ lat: 49.4, lon: 12.0 }, { fetchImpl });

  assert.deepEqual(result, {
    weatherCode: 3,
    temperatureC: 21.4,
    todayWeatherCode: 61,
    todayMaxC: 24.1,
    todayMinC: 14.2,
    sunrise: '2026-08-10T06:00',
    sunset: '2026-08-10T20:30',
    tomorrowWeatherCode: 71,
    tomorrowMaxC: 10.5,
    tomorrowMinC: 2.1,
    available: true,
  });
});

test('a response missing sunrise/sunset still resolves available: true without them', async () => {
  const fetchImpl = fetchReturning(SAMPLE_RESPONSE);

  const result = await fetchWeatherAndForecast({ lat: 49.4, lon: 12.0 }, { fetchImpl });

  assert.equal(result.available, true);
  assert.equal('sunrise' in result, false);
  assert.equal('sunset' in result, false);
});

test(
  'a valid today with malformed/missing tomorrow fields still resolves available: true, ' +
    'leaving the tomorrow fields undefined',
  async () => {
    const fetchImpl = fetchReturning({
      current: { weather_code: 3, temperature_2m: 21.4 },
      daily: {
        weather_code: [61, null],
        temperature_2m_max: [24.1],
        temperature_2m_min: [14.2],
      },
    });

    const result = await fetchWeatherAndForecast({ lat: 49.4, lon: 12.0 }, { fetchImpl });

    assert.equal(result.available, true);
    assert.equal(result.todayWeatherCode, 61);
    assert.equal('tomorrowWeatherCode' in result, false);
    assert.equal('tomorrowMaxC' in result, false);
    assert.equal('tomorrowMinC' in result, false);
  },
);
