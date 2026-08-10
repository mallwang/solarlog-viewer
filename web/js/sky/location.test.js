import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveInstallationLocation } from './location.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

test('override takes precedence over cache/geocode', async () => {
  const storage = fakeStorage({
    'sky-geocode:92266 Ensdorf-Wolfsbach': JSON.stringify({ lat: 1, lon: 1 }),
  });
  let geocodeCalled = false;
  const geocode = async () => {
    geocodeCalled = true;
    return { lat: 2, lon: 2 };
  };

  const result = await resolveInstallationLocation(
    { location: '92266 Ensdorf-Wolfsbach' },
    { lat: 49.4, lon: 12.0 },
    { storage, geocode },
  );

  assert.deepEqual(result, { lat: 49.4, lon: 12.0, source: 'override' });
  assert.equal(geocodeCalled, false);
});

test('a localStorage cache hit short-circuits geocoding', async () => {
  const storage = fakeStorage({
    'sky-geocode:92266 Ensdorf-Wolfsbach': JSON.stringify({ lat: 49.4, lon: 12.0 }),
  });
  let geocodeCalled = false;
  const geocode = async () => {
    geocodeCalled = true;
    return { lat: 2, lon: 2 };
  };

  const result = await resolveInstallationLocation({ location: '92266 Ensdorf-Wolfsbach' }, null, {
    storage,
    geocode,
  });

  assert.deepEqual(result, { lat: 49.4, lon: 12.0, source: 'cache' });
  assert.equal(geocodeCalled, false);
});

test('a cache miss triggers a geocode call and returns its result', async () => {
  const storage = fakeStorage();
  const geocode = async (address) => {
    assert.equal(address, '92266 Ensdorf-Wolfsbach');
    return { lat: 49.4, lon: 12.0 };
  };

  const result = await resolveInstallationLocation({ location: '92266 Ensdorf-Wolfsbach' }, null, {
    storage,
    geocode,
  });

  assert.deepEqual(result, { lat: 49.4, lon: 12.0, source: 'geocoded' });
});

test('out-of-range override coordinates are rejected as invalid', async () => {
  const storage = fakeStorage();
  const result = await resolveInstallationLocation(
    { location: 'Somewhere' },
    { lat: 200, lon: 12.0 },
    { storage, geocode: async () => null },
  );

  assert.equal(result, null);
});

test('out-of-range cached coordinates are rejected as invalid', async () => {
  const storage = fakeStorage({
    'sky-geocode:Somewhere': JSON.stringify({ lat: 12.0, lon: 999 }),
  });

  const result = await resolveInstallationLocation({ location: 'Somewhere' }, null, {
    storage,
    geocode: async () => null,
  });

  assert.equal(result, null);
});

test('all-paths-fail returns null', async () => {
  const storage = fakeStorage();
  const result = await resolveInstallationLocation({ location: 'Nowhereville' }, null, {
    storage,
    geocode: async () => null,
  });

  assert.equal(result, null);
});

test('returns null when the plant has no location and no override is set', async () => {
  const storage = fakeStorage();
  const result = await resolveInstallationLocation({ location: '' }, null, {
    storage,
    geocode: async () => null,
  });

  assert.equal(result, null);
});
