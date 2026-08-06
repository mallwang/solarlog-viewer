import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchText } from './fetch-text.js';

function withFetch(impl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

test('returns ok:true with text on a 200 response', async () => {
  await withFetch(
    async () => ({ ok: true, status: 200, text: async () => 'hello' }),
    async () => {
      const result = await fetchText('base_vars.js');
      assert.deepEqual(result, { ok: true, text: 'hello' });
    },
  );
});

test('returns ok:false with status on a non-200 response', async () => {
  await withFetch(
    async () => ({ ok: false, status: 404, text: async () => '' }),
    async () => {
      const result = await fetchText('min260732.js');
      assert.deepEqual(result, { ok: false, status: 404 });
    },
  );
});

test('returns ok:false with null status on a network failure, never throws', async () => {
  await withFetch(
    async () => {
      throw new TypeError('Failed to fetch');
    },
    async () => {
      const result = await fetchText('base_vars.js');
      assert.deepEqual(result, { ok: false, status: null });
    },
  );
});
