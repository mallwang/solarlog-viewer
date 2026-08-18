import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKFILLED_DATES, isBackfilledDate } from './backfilled-data.js';

test('BACKFILLED_DATES is a Set of ISO date strings', () => {
  // NOSONAR
  assert.ok(BACKFILLED_DATES instanceof Set);
});

test('isBackfilledDate reads through to BACKFILLED_DATES', () => {
  // NOSONAR
  assert.equal(isBackfilledDate('2026-07-01'), BACKFILLED_DATES.has('2026-07-01'));
  assert.equal(isBackfilledDate('1999-01-01'), false);
});
