import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  addMonths,
  isFutureDay,
  isFutureMonth,
  parentOfDay,
  parentOfMonth,
  parentOfYear,
  periodNavMarkup,
} from './period-nav.js';

test('addDays steps forward within a month', () => {
  assert.deepEqual(addDays({ year: 2026, month: 8, day: 6 }, 1), {
    year: 2026,
    month: 8,
    day: 7,
  });
});

test('addDays steps backward across a month boundary', () => {
  assert.deepEqual(addDays({ year: 2026, month: 8, day: 1 }, -1), {
    year: 2026,
    month: 7,
    day: 31,
  });
});

test('addDays steps forward across a year boundary', () => {
  assert.deepEqual(addDays({ year: 2026, month: 12, day: 31 }, 1), {
    year: 2027,
    month: 1,
    day: 1,
  });
});

test('addMonths steps forward across a year boundary', () => {
  assert.deepEqual(addMonths({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
});

test('addMonths steps backward across a year boundary', () => {
  assert.deepEqual(addMonths({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
});

test('isFutureDay is false for today and past days, true for tomorrow', () => {
  const now = new Date();
  const today = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  assert.equal(isFutureDay(today), false);
  assert.equal(isFutureDay(addDays(today, -1)), false);
  assert.equal(isFutureDay(addDays(today, 1)), true);
});

test('isFutureMonth is false for the current month, true for next month', () => {
  const now = new Date();
  const thisMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
  assert.equal(isFutureMonth(thisMonth), false);
  assert.equal(isFutureMonth(addMonths(thisMonth, 1)), true);
});

test('periodNavMarkup renders both links when nextHref is set', () => {
  const html = periodNavMarkup({
    prevHref: '#/day/2026/08/05',
    prevLabel: 'Previous day',
    nextHref: '#/day/2026/08/07',
    nextLabel: 'Next day',
  });
  assert.match(html, /href="#\/day\/2026\/08\/05"/);
  assert.match(html, /href="#\/day\/2026\/08\/07"/);
  assert.doesNotMatch(html, /aria-disabled/);
});

test('periodNavMarkup disables next when nextHref is null', () => {
  const html = periodNavMarkup({
    prevHref: '#/day/2026/08/06',
    prevLabel: 'Previous day',
    nextHref: null,
    nextLabel: 'Next day',
  });
  assert.match(html, /aria-disabled="true"/);
  assert.doesNotMatch(html, /<a[^>]*>Next day/);
});

test('periodNavMarkup renders a today link when todayHref is set', () => {
  const html = periodNavMarkup({
    prevHref: '#/day/2026/08/06',
    prevLabel: 'Previous day',
    nextHref: '#/day/2026/08/08',
    nextLabel: 'Next day',
    todayHref: '#/day/2026/08/08',
    todayLabel: 'Today',
  });
  assert.match(html, /period-nav__link--today/);
  assert.match(html, /href="#\/day\/2026\/08\/08">Today/);
});

test('periodNavMarkup omits the today link when todayLabel is not set', () => {
  const html = periodNavMarkup({
    prevHref: '#/day/2026/08/06',
    prevLabel: 'Previous day',
    nextHref: '#/day/2026/08/08',
    nextLabel: 'Next day',
  });
  assert.doesNotMatch(html, /period-nav__link--today/);
});

test('periodNavMarkup disables the today link when todayHref is null', () => {
  const html = periodNavMarkup({
    prevHref: '#/day/2026/08/06',
    prevLabel: 'Previous day',
    nextHref: '#/day/2026/08/08',
    nextLabel: 'Next day',
    todayHref: null,
    todayLabel: 'Today',
  });
  assert.match(html, /period-nav__link--today period-nav__link--disabled[^>]*aria-disabled="true"[^<]*Today/);
  assert.doesNotMatch(html, /<a[^>]*period-nav__link--today/);
});

test('parentOfDay drops the day, keeping year/month', () => {
  assert.deepEqual(parentOfDay({ year: 2026, month: 3, day: 15 }), { year: 2026, month: 3 });
});

test('parentOfMonth drops the month, keeping year', () => {
  assert.deepEqual(parentOfMonth({ year: 2026, month: 3 }), { year: 2026 });
});

test('parentOfYear returns empty params', () => {
  assert.deepEqual(parentOfYear({ year: 2026 }), {});
});

test('periodNavMarkup renders an enabled parent link when parentLabel is set', () => {
  const html = periodNavMarkup({
    prevHref: '#/day/2026/08/06',
    prevLabel: 'Previous day',
    nextHref: '#/day/2026/08/08',
    nextLabel: 'Next day',
    parentHref: '#/month/2026/8',
    parentLabel: 'Month',
  });
  assert.match(html, /period-nav__link--parent/);
  assert.match(html, /<a[^>]*href="#\/month\/2026\/8"[^>]*>Month<\/a>/);
  assert.doesNotMatch(html, /aria-disabled/);
});

test('periodNavMarkup omits the parent link when parentLabel is not set', () => {
  const html = periodNavMarkup({
    prevHref: '#/day/2026/08/06',
    prevLabel: 'Previous day',
    nextHref: '#/day/2026/08/08',
    nextLabel: 'Next day',
  });
  assert.doesNotMatch(html, /period-nav__link--parent/);
});
