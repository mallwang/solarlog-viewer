import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDaytime } from './daytime.js';

const SUNRISE = '2026-08-10T06:00:00';
const SUNSET = '2026-08-10T20:30:00';

test('before sunrise is nighttime (false)', () => {
  const now = new Date('2026-08-10T05:00:00');
  assert.equal(isDaytime(now, SUNRISE, SUNSET), false);
});

test('between sunrise and sunset is daytime (true)', () => {
  const now = new Date('2026-08-10T13:00:00');
  assert.equal(isDaytime(now, SUNRISE, SUNSET), true);
});

test('after sunset is nighttime (false)', () => {
  const now = new Date('2026-08-10T21:00:00');
  assert.equal(isDaytime(now, SUNRISE, SUNSET), false);
});

test('missing sunrise falls back to true (the safer default)', () => {
  const now = new Date('2026-08-10T02:00:00');
  assert.equal(isDaytime(now, undefined, SUNSET), true);
});

test('missing sunset falls back to true (the safer default)', () => {
  const now = new Date('2026-08-10T21:00:00');
  assert.equal(isDaytime(now, SUNRISE, undefined), true);
});

test('unparseable sunrise/sunset falls back to true (the safer default)', () => {
  const now = new Date('2026-08-10T21:00:00');
  assert.equal(isDaytime(now, 'not-a-date', 'also-not-a-date'), true);
});
