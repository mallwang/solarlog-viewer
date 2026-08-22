import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchLiveReading } from './live-reading-client.js';

function fetchReturning(body, { ok = true } = {}) {
  return async () => ({
    ok,
    json: async () => body,
  });
}

const SUCCESS_BODY = {
  watt: 600,
  timestamp: '2026-08-22T09:21:05',
  sources: { solarlog: { watt: 600, ok: true, error: null, inverters: [] } },
};

test('a successful response parses into the expected shape', async () => {
  const fetchImpl = fetchReturning(SUCCESS_BODY);

  const result = await fetchLiveReading({ fetchImpl });

  assert.deepEqual(result, { available: true, watt: 600, timestamp: '2026-08-22T09:21:05' });
});

test('a watt: 0 success response resolves available: true, not available: false (FR-011)', async () => {
  const fetchImpl = fetchReturning({ ...SUCCESS_BODY, watt: 0 });

  const result = await fetchLiveReading({ fetchImpl });

  assert.deepEqual(result, { available: true, watt: 0, timestamp: '2026-08-22T09:21:05' });
});

test('a thrown fetch/network error resolves to available: false without throwing', async () => {
  const fetchImpl = async () => {
    throw new Error('offline');
  };

  const result = await fetchLiveReading({ fetchImpl });

  assert.deepEqual(result, { available: false });
});

test('a non-2xx response (response.ok: false) resolves to available: false', async () => {
  const fetchImpl = fetchReturning(SUCCESS_BODY, { ok: false });

  const result = await fetchLiveReading({ fetchImpl });

  assert.deepEqual(result, { available: false });
});

test('an unparseable JSON body resolves to available: false', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => {
      throw new SyntaxError('Unexpected token');
    },
  });

  const result = await fetchLiveReading({ fetchImpl });

  assert.deepEqual(result, { available: false });
});

test('a missing top-level watt resolves to available: false', async () => {
  const bodyWithoutWatt = { timestamp: SUCCESS_BODY.timestamp, sources: SUCCESS_BODY.sources };
  const fetchImpl = fetchReturning(bodyWithoutWatt);

  const result = await fetchLiveReading({ fetchImpl });

  assert.deepEqual(result, { available: false });
});

test('a non-numeric top-level watt resolves to available: false', async () => {
  const fetchImpl = fetchReturning({ ...SUCCESS_BODY, watt: 'not-a-number' });

  const result = await fetchLiveReading({ fetchImpl });

  assert.deepEqual(result, { available: false });
});

test('sources.solarlog.ok: false resolves to available: false', async () => {
  const fetchImpl = fetchReturning({
    ...SUCCESS_BODY,
    sources: { solarlog: { ...SUCCESS_BODY.sources.solarlog, ok: false } },
  });

  const result = await fetchLiveReading({ fetchImpl });

  assert.deepEqual(result, { available: false });
});

test('a missing sources.solarlog.ok resolves to available: false', async () => {
  const fetchImpl = fetchReturning({ ...SUCCESS_BODY, sources: {} });

  const result = await fetchLiveReading({ fetchImpl });

  assert.deepEqual(result, { available: false });
});
