import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKFILLED_DATES, isBackfilledDate, isUnreliableDailyYield } from './backfilled-data.js';
import { UNRELIABLE_DAILY_YIELD_RANGES } from '../config.js';

test('BACKFILLED_DATES is a Set of ISO date strings', () => {
  // NOSONAR
  assert.ok(BACKFILLED_DATES instanceof Set);
});

test('isBackfilledDate reads through to BACKFILLED_DATES', () => {
  // NOSONAR
  assert.equal(isBackfilledDate('2026-07-01'), BACKFILLED_DATES.has('2026-07-01'));
  assert.equal(isBackfilledDate('1999-01-01'), false);
});

test("isUnreliableDailyYield is true for every date inside config.js's ranges, inclusive", () => {
  for (const [from, to] of UNRELIABLE_DAILY_YIELD_RANGES) {
    assert.equal(isUnreliableDailyYield(from), true);
    assert.equal(isUnreliableDailyYield(to), true);
  }
});

test('isUnreliableDailyYield is false just outside a configured range', () => {
  const [from] = UNRELIABLE_DAILY_YIELD_RANGES[0];
  const dayBefore = new Date(`${from}T00:00:00`);
  dayBefore.setDate(dayBefore.getDate() - 1);
  assert.equal(isUnreliableDailyYield(dayBefore.toISOString().slice(0, 10)), false);
  assert.equal(isUnreliableDailyYield('1999-01-01'), false);
});
