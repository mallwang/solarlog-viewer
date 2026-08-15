import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { sourceDirForDate, fetchFromBothSources } from './data-source.js';
import { clearFetchCache } from './fetch-cache.js';

function withFetch(impl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

beforeEach(() => {
  clearFetchCache();
});

test('sourceDirForDate resolves dates before installation to hist', () => {
  assert.equal(sourceDirForDate('2026-07-28'), 'hist');
  assert.equal(sourceDirForDate('2006-03-15'), 'hist');
});

test('sourceDirForDate resolves the installation date and later to data', () => {
  assert.equal(sourceDirForDate('2026-07-29'), 'data');
  assert.equal(sourceDirForDate('2026-08-04'), 'data');
});

test('fetchFromBothSources fetches hist/<filename> and data/<filename> in parallel', async () => {
  const requestedPaths = [];
  await withFetch(
    async (path) => {
      requestedPaths.push(path);
      return { ok: true, status: 200, text: async () => `text for ${path}` };
    },
    async () => {
      const result = await fetchFromBothSources('months.js');
      assert.deepEqual(requestedPaths.sort(), ['data/months.js', 'hist/months.js']);
      assert.deepEqual(result.hist, { ok: true, text: 'text for hist/months.js' });
      assert.deepEqual(result.data, { ok: true, text: 'text for data/months.js' });
    },
  );
});

test('fetchFromBothSources surfaces a 404 on one side without failing the other', async () => {
  await withFetch(
    async (path) => {
      if (path.startsWith('hist/')) return { ok: false, status: 404, text: async () => '' };
      return { ok: true, status: 200, text: async () => 'ok' };
    },
    async () => {
      const result = await fetchFromBothSources('years.js');
      assert.deepEqual(result.hist, { ok: false, status: 404 });
      assert.deepEqual(result.data, { ok: true, text: 'ok' });
    },
  );
});
