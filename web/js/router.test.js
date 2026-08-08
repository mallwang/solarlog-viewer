import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, formatRoute } from './router.js';

test('parses the dashboard route from an empty hash', () => {
  assert.deepEqual(parseRoute(''), { view: 'dashboard', params: {} });
  assert.deepEqual(parseRoute('#/'), { view: 'dashboard', params: {} });
  assert.deepEqual(parseRoute('#'), { view: 'dashboard', params: {} });
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

test('falls back to dashboard for a malformed hash', () => {
  assert.deepEqual(parseRoute('#/day/not-a-date'), { view: 'dashboard', params: {} });
  assert.deepEqual(parseRoute('#/nonsense'), { view: 'dashboard', params: {} });
  assert.deepEqual(parseRoute('#/year/abcd'), { view: 'dashboard', params: {} });
});

test('falls back to dashboard for an out-of-range hash', () => {
  assert.deepEqual(parseRoute('#/month/2019/13'), { view: 'dashboard', params: {} });
  assert.deepEqual(parseRoute('#/day/2019/02/30'), { view: 'dashboard', params: {} });
});

test('formatRoute round-trips each view', () => {
  assert.equal(formatRoute({ view: 'dashboard', params: {} }), '#/');
  assert.equal(
    formatRoute({ view: 'day', params: { year: 2019, month: 7, day: 15 } }),
    '#/day/2019/07/15',
  );
  assert.equal(formatRoute({ view: 'month', params: { year: 2019, month: 7 } }), '#/month/2019/07');
  assert.equal(formatRoute({ view: 'year', params: { year: 2019 } }), '#/year/2019');
  assert.equal(formatRoute({ view: 'total', params: {} }), '#/total');
});
