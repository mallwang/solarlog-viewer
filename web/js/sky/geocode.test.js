import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geocodeAddress } from './geocode.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
    _map: map,
  };
}

function fetchReturning(body, { ok = true } = {}) {
  return async () => ({
    ok,
    json: async () => body,
  });
}

test('geocodeAddress returns { lat, lon } from the first result on success', async () => {
  const storage = fakeStorage();
  const fetchImpl = fetchReturning({
    results: [
      { latitude: 49.4, longitude: 12.0 },
      { latitude: 1, longitude: 1 },
    ],
  });

  const result = await geocodeAddress('92266 Ensdorf-Wolfsbach', { fetchImpl, storage });

  assert.deepEqual(result, { lat: 49.4, lon: 12.0 });
});

test('geocodeAddress returns null for a zero-result response', async () => {
  const storage = fakeStorage();
  const fetchImpl = fetchReturning({ results: [] });

  const result = await geocodeAddress('Nowhereville', { fetchImpl, storage });

  assert.equal(result, null);
});

test('geocodeAddress returns null without throwing on network failure', async () => {
  const storage = fakeStorage();
  const fetchImpl = async () => {
    throw new Error('network down');
  };

  const result = await geocodeAddress('92266 Ensdorf-Wolfsbach', { fetchImpl, storage });

  assert.equal(result, null);
});

test('geocodeAddress returns null without throwing on a non-2xx response', async () => {
  const storage = fakeStorage();
  const fetchImpl = fetchReturning({}, { ok: false });

  const result = await geocodeAddress('92266 Ensdorf-Wolfsbach', { fetchImpl, storage });

  assert.equal(result, null);
});

test('geocodeAddress returns null without throwing on malformed JSON', async () => {
  const storage = fakeStorage();
  const fetchImpl = async () => ({
    ok: true,
    json: async () => {
      throw new SyntaxError('bad json');
    },
  });

  const result = await geocodeAddress('92266 Ensdorf-Wolfsbach', { fetchImpl, storage });

  assert.equal(result, null);
});

test('geocodeAddress caches a successful lookup under sky-geocode:<address>', async () => {
  const storage = fakeStorage();
  const fetchImpl = fetchReturning({ results: [{ latitude: 49.4, longitude: 12.0 }] });

  await geocodeAddress('92266 Ensdorf-Wolfsbach', { fetchImpl, storage });

  assert.equal(
    storage.getItem('sky-geocode:92266 Ensdorf-Wolfsbach'),
    JSON.stringify({ lat: 49.4, lon: 12.0 }),
  );
});

test('geocodeAddress does not write to the cache on failure', async () => {
  const storage = fakeStorage();
  const fetchImpl = fetchReturning({ results: [] });

  await geocodeAddress('Nowhereville', { fetchImpl, storage });

  assert.equal(storage._map.size, 0);
});
