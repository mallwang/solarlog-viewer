import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchTextCached, clearFetchCache } from './fetch-cache.js';

beforeEach(() => {
  clearFetchCache();
});

function countingFetch(result) {
  let calls = 0;
  const impl = async () => {
    calls += 1;
    return result;
  };
  return { impl, callCount: () => calls };
}

test('a second call within the TTL does not re-fetch, and returns the cached result', async () => {
  const { impl, callCount } = countingFetch({ ok: true, text: 'hello' });

  const first = await fetchTextCached('hist/months.js', 10_000, impl);
  const second = await fetchTextCached('hist/months.js', 10_000, impl);

  assert.deepEqual(first, { ok: true, text: 'hello' });
  assert.deepEqual(second, { ok: true, text: 'hello' });
  assert.equal(callCount(), 1);
});

test('a call after the TTL expires re-fetches', async () => {
  const { impl, callCount } = countingFetch({ ok: true, text: 'hello' });

  await fetchTextCached('data/months.js', -1, impl); // already expired
  await fetchTextCached('data/months.js', -1, impl);

  assert.equal(callCount(), 2);
});

test('Infinity TTL never expires', async () => {
  const { impl, callCount } = countingFetch({ ok: true, text: 'hello' });

  await fetchTextCached('hist/days_hist.js', Infinity, impl);
  await fetchTextCached('hist/days_hist.js', Infinity, impl);
  await fetchTextCached('hist/days_hist.js', Infinity, impl);

  assert.equal(callCount(), 1);
});

test('a failed result is not cached, so the next call retries', async () => {
  const { impl, callCount } = countingFetch({ ok: false, status: 404 });

  const first = await fetchTextCached('hist/months.js', 10_000, impl);
  const second = await fetchTextCached('hist/months.js', 10_000, impl);

  assert.deepEqual(first, { ok: false, status: 404 });
  assert.deepEqual(second, { ok: false, status: 404 });
  assert.equal(callCount(), 2);
});

test('independent paths are cached independently', async () => {
  const requestedPaths = [];
  const impl = async (path) => {
    requestedPaths.push(path);
    return { ok: true, text: `text for ${path}` };
  };

  const months = await fetchTextCached('hist/months.js', 10_000, impl);
  const days = await fetchTextCached('hist/days_hist.js', 10_000, impl);

  assert.deepEqual(months, { ok: true, text: 'text for hist/months.js' });
  assert.deepEqual(days, { ok: true, text: 'text for hist/days_hist.js' });
  assert.deepEqual(requestedPaths.sort(), ['hist/days_hist.js', 'hist/months.js']);
});
