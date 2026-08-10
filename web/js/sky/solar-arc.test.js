import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSkyBodyPosition } from './solar-arc.js';

const SUNRISE = '2026-08-09T06:00:00';
const SUNSET = '2026-08-09T20:00:00';
const NEXT_SUNRISE = '2026-08-10T06:00:00';

test('the sun is shown low near the horizon right at sunrise', () => {
  const result = computeSkyBodyPosition(new Date(SUNRISE), SUNRISE, SUNSET, NEXT_SUNRISE);
  assert.equal(result.body, 'sun');
  assert.ok(result.xPercent < 5);
  assert.ok(result.yPercent > 95);
});

test('the sun is shown high (near the top of the arc) at solar noon', () => {
  const solarNoon = new Date('2026-08-09T13:00:00'); // midpoint of a 06:00–20:00 day
  const result = computeSkyBodyPosition(solarNoon, SUNRISE, SUNSET, NEXT_SUNRISE);
  assert.equal(result.body, 'sun');
  assert.ok(Math.abs(result.xPercent - 50) < 2);
  assert.ok(result.yPercent < 5);
});

test('the sun is shown low near the horizon just before sunset', () => {
  const justBeforeSunset = new Date('2026-08-09T19:58:00');
  const result = computeSkyBodyPosition(justBeforeSunset, SUNRISE, SUNSET, NEXT_SUNRISE);
  assert.equal(result.body, 'sun');
  assert.ok(result.yPercent > 90);
});

test('the moon is shown at midnight', () => {
  const midnight = new Date('2026-08-10T01:00:00');
  const result = computeSkyBodyPosition(midnight, SUNRISE, SUNSET, NEXT_SUNRISE);
  assert.equal(result.body, 'moon');
});

test('crossfade is 0 well outside the sunrise/sunset transition window', () => {
  const solarNoon = new Date('2026-08-09T13:00:00');
  const result = computeSkyBodyPosition(solarNoon, SUNRISE, SUNSET, NEXT_SUNRISE);
  assert.equal(result.crossfade, 0);
});

test('crossfade is > 0 a couple of minutes before sunrise', () => {
  const justBeforeSunrise = new Date('2026-08-09T05:58:00');
  const result = computeSkyBodyPosition(justBeforeSunrise, SUNRISE, SUNSET, NEXT_SUNRISE);
  assert.ok(result.crossfade > 0);
});

test('crossfade is > 0 a couple of minutes after sunset', () => {
  const justAfterSunset = new Date('2026-08-09T20:02:00');
  const result = computeSkyBodyPosition(justAfterSunset, SUNRISE, SUNSET, NEXT_SUNRISE);
  assert.ok(result.crossfade > 0);
});
