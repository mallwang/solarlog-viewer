import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchTodayMinuteTrace } from './today-trace.js';

function withFetch(impl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

function ddmmyy(date) {
  const yy = String(date.getFullYear()).slice(-2);
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${yy}`;
}

// epoch 3 (current): block0 = SB4200 (6 fields), block1 = SB2100 (4 fields) — see epoch.js.
function minFileLine(date, time) {
  return `m[mi++]="${ddmmyy(date)} ${time}|500;100;100;5000;230;231|300;50;3000;229"`;
}

test('fetchTodayMinuteTrace filters readings to today only, dropping yesterday leftovers', async () => {
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const fixture = [minFileLine(yesterday, '23:55:00'), minFileLine(today, '08:00:00')].join('\n');

  await withFetch(
    async () => ({ ok: true, status: 200, text: async () => fixture }),
    async () => {
      const trace = await fetchTodayMinuteTrace();
      assert.notEqual(trace, null);
      assert.equal(trace.readings.length, 1);
      assert.ok(trace.readings[0].timestamp.endsWith('T08:00:00'));
    },
  );
});

test('fetchTodayMinuteTrace returns null when the fetch fails', async () => {
  await withFetch(
    async () => ({ ok: false, status: 404, text: async () => '' }),
    async () => {
      const trace = await fetchTodayMinuteTrace();
      assert.equal(trace, null);
    },
  );
});

test('fetchTodayMinuteTrace returns null when there are zero readings for today', async () => {
  const yesterday = new Date(Date.now() - 86400000);
  const fixture = minFileLine(yesterday, '23:55:00');

  await withFetch(
    async () => ({ ok: true, status: 200, text: async () => fixture }),
    async () => {
      const trace = await fetchTodayMinuteTrace();
      assert.equal(trace, null);
    },
  );
});
