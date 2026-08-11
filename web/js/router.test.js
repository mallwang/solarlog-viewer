import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, formatRoute } from './router.js';

function todayRoute() {
  const now = new Date();
  return {
    view: 'day',
    params: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
  };
}

test("parses an empty hash as today's day view (dashboard is disabled)", () => {
  assert.deepEqual(parseRoute(''), todayRoute());
  assert.deepEqual(parseRoute('#/'), todayRoute());
  assert.deepEqual(parseRoute('#'), todayRoute());
});

test('parses the day route', () => {
  assert.deepEqual(parseRoute('#/day/2019/07/15'), {
    view: 'day',
    params: { year: 2019, month: 7, day: 15 },
  });
});

test('parses the month route', () => {
  assert.deepEqual(parseRoute('#/month/2019/07'), {
    view: 'month',
    params: { year: 2019, month: 7 },
  });
});

test('parses the year route', () => {
  assert.deepEqual(parseRoute('#/year/2019'), { view: 'year', params: { year: 2019 } });
});

test('parses the total route', () => {
  assert.deepEqual(parseRoute('#/total'), { view: 'total', params: {} });
});

test("falls back to today's day view for a malformed hash", () => {
  assert.deepEqual(parseRoute('#/day/not-a-date'), todayRoute());
  assert.deepEqual(parseRoute('#/nonsense'), todayRoute());
  assert.deepEqual(parseRoute('#/year/abcd'), todayRoute());
});

test("falls back to today's day view for an out-of-range hash", () => {
  assert.deepEqual(parseRoute('#/month/2019/13'), todayRoute());
  assert.deepEqual(parseRoute('#/day/2019/02/30'), todayRoute());
});

test('formatRoute round-trips each view', () => {
  assert.equal(
    formatRoute({ view: 'day', params: { year: 2019, month: 7, day: 15 } }),
    '#/day/2019/07/15',
  );
  assert.equal(formatRoute({ view: 'month', params: { year: 2019, month: 7 } }), '#/month/2019/07');
  assert.equal(formatRoute({ view: 'year', params: { year: 2019 } }), '#/year/2019');
  assert.equal(formatRoute({ view: 'total', params: {} }), '#/total');
});

test('formatRoute falls back to "#/" for an unknown view (e.g. the disabled dashboard)', () => {
  assert.equal(formatRoute({ view: 'dashboard', params: {} }), '#/');
});
