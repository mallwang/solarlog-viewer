import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, formatRoute } from './router.js';

const welcomeRoute = { view: 'welcome', params: {} };

test('parses an empty hash as the welcome page (015-welcome-page-dashboard)', () => {
  assert.deepEqual(parseRoute(''), welcomeRoute);
  assert.deepEqual(parseRoute('#/'), welcomeRoute);
  assert.deepEqual(parseRoute('#'), welcomeRoute);
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

test('parses the events route', () => {
  assert.deepEqual(parseRoute('#/events'), { view: 'events', params: {} });
});

test('falls back to the welcome page for a malformed hash', () => {
  assert.deepEqual(parseRoute('#/day/not-a-date'), welcomeRoute);
  assert.deepEqual(parseRoute('#/nonsense'), welcomeRoute);
  assert.deepEqual(parseRoute('#/year/abcd'), welcomeRoute);
});

test('falls back to the welcome page for an out-of-range hash', () => {
  assert.deepEqual(parseRoute('#/month/2019/13'), welcomeRoute);
  assert.deepEqual(parseRoute('#/day/2019/02/30'), welcomeRoute);
});

test('parses the statistics route with a valid topic', () => {
  assert.deepEqual(parseRoute('#/statistics/heatmaps'), {
    view: 'statistics',
    params: { topic: 'heatmaps' },
  });
});

test('parses the statistics route with a missing topic segment as "common"', () => {
  assert.deepEqual(parseRoute('#/statistics'), { view: 'statistics', params: { topic: 'common' } });
});

test('parses the statistics route with an invalid topic segment as "common"', () => {
  assert.deepEqual(parseRoute('#/statistics/bogus'), {
    view: 'statistics',
    params: { topic: 'common' },
  });
});

test('formatRoute round-trips the statistics route', () => {
  assert.equal(
    formatRoute({ view: 'statistics', params: { topic: 'trends' } }),
    '#/statistics/trends',
  );
});

test('formatRoute round-trips each view', () => {
  assert.equal(
    formatRoute({ view: 'day', params: { year: 2019, month: 7, day: 15 } }),
    '#/day/2019/07/15',
  );
  assert.equal(formatRoute({ view: 'month', params: { year: 2019, month: 7 } }), '#/month/2019/07');
  assert.equal(formatRoute({ view: 'year', params: { year: 2019 } }), '#/year/2019');
  assert.equal(formatRoute({ view: 'total', params: {} }), '#/total');
  assert.equal(formatRoute({ view: 'events', params: {} }), '#/events');
});

test('formatRoute serializes the welcome view to "#/"', () => {
  assert.equal(formatRoute({ view: 'welcome', params: {} }), '#/');
});

test('formatRoute falls back to "#/" for an unknown view (e.g. the disabled dashboard)', () => {
  assert.equal(formatRoute({ view: 'dashboard', params: {} }), '#/');
});
