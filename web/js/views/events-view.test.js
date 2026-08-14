import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterEvents,
  buildFilterOptions,
  buildFacetedFilterOptions,
  sortEvents,
} from './events-view.js';

/** @param {Partial<import('../data/events.js').Event>} overrides @returns {import('../data/events.js').Event} */
function makeEvent(overrides) {
  return {
    start: new Date(2026, 7, 13, 6, 0, 0),
    end: new Date(2026, 7, 13, 6, 10, 0),
    isOngoing: false,
    durationMs: 10 * 60 * 1000,
    inverterIdx: 0,
    statusCode: 7,
    statusLabel: 'Mpp',
    errorCode: 0,
    errorLabel: null,
    errorRawCode: null,
    dedupeKey: 'x',
    ...overrides,
  };
}

const EVENTS = [
  makeEvent({
    start: new Date(2026, 7, 13, 6, 0, 0),
    end: new Date(2026, 7, 13, 6, 10, 0),
    inverterIdx: 0,
    statusLabel: 'Mpp',
    errorLabel: null,
    durationMs: 10 * 60 * 1000,
  }),
  makeEvent({
    start: new Date(2026, 7, 13, 7, 0, 0),
    end: new Date(2026, 7, 13, 7, 20, 0),
    inverterIdx: 1,
    statusLabel: 'Stoer.',
    errorLabel: 'NUW-UAC',
    durationMs: 20 * 60 * 1000,
  }),
  makeEvent({
    start: new Date(2026, 7, 14, 6, 0, 0),
    end: null,
    isOngoing: true,
    inverterIdx: 0,
    statusLabel: 'Fehler',
    errorLabel: null,
    durationMs: null,
  }),
];

test('filterEvents: inverter dimension in isolation', () => {
  const result = filterEvents(EVENTS, { inverter: 1, day: 'all', status: 'all', error: 'all' });
  assert.equal(result.length, 1);
  assert.equal(result[0].inverterIdx, 1);
});

test('filterEvents: day dimension matches start or end date (13.08.26)', () => {
  const result = filterEvents(EVENTS, {
    inverter: 'all',
    day: '13.08.26',
    status: 'all',
    error: 'all',
  });
  assert.equal(result.length, 2);
});

test('filterEvents: status dimension in isolation', () => {
  const result = filterEvents(EVENTS, { inverter: 'all', day: 'all', status: 'Mpp', error: 'all' });
  assert.equal(result.length, 1);
  assert.equal(result[0].statusLabel, 'Mpp');
});

test('filterEvents: error dimension in isolation', () => {
  const result = filterEvents(EVENTS, {
    inverter: 'all',
    day: 'all',
    status: 'all',
    error: 'NUW-UAC',
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].errorLabel, 'NUW-UAC');
});

test('filterEvents: combined filters narrow further than either alone', () => {
  const result = filterEvents(EVENTS, {
    inverter: 0,
    day: '14.08.26',
    status: 'all',
    error: 'all',
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].isOngoing, true);
});

test('filterEvents: "all" on every dimension returns every event unchanged', () => {
  const result = filterEvents(EVENTS, { inverter: 'all', day: 'all', status: 'all', error: 'all' });
  assert.equal(result.length, EVENTS.length);
});

test('buildFilterOptions: narrows to what is present in the given set', () => {
  const filtered = filterEvents(EVENTS, { inverter: 1, day: 'all', status: 'all', error: 'all' });
  const options = buildFilterOptions(filtered);
  assert.deepEqual(options.inverters, [1]);
  assert.deepEqual(options.statuses, ['Stoer.']);
  assert.deepEqual(options.errors, ['NUW-UAC']);
});

test('buildFilterOptions: de-duplicates and sorts inverters ascending', () => {
  const options = buildFilterOptions(EVENTS);
  assert.deepEqual(options.inverters, [0, 1]);
});

test('buildFilterOptions: days are de-duplicated and sorted most-recent-first', () => {
  const options = buildFilterOptions(EVENTS);
  assert.deepEqual(options.days, ['14.08.26', '13.08.26']);
});

test('buildFilterOptions: errors excludes null (no-error) entries', () => {
  const options = buildFilterOptions(EVENTS);
  assert.ok(!options.errors.includes(null));
});

test("buildFacetedFilterOptions: a dimension's own options ignore its own active filter", () => {
  const options = buildFacetedFilterOptions(EVENTS, {
    inverter: 1,
    day: 'all',
    status: 'all',
    error: 'all',
  });
  // Selecting inverter=1 must not hide inverter=0 from that same dropdown.
  assert.deepEqual(options.inverters, [0, 1]);
});

test('buildFacetedFilterOptions: other dimensions narrow to what remains under the active filter', () => {
  const options = buildFacetedFilterOptions(EVENTS, {
    inverter: 1,
    day: 'all',
    status: 'all',
    error: 'all',
  });
  assert.deepEqual(options.statuses, ['Stoer.']);
  assert.deepEqual(options.errors, ['NUW-UAC']);
});

test('buildFacetedFilterOptions: with no active filters, every dimension shows its full set', () => {
  const options = buildFacetedFilterOptions(EVENTS, {
    inverter: 'all',
    day: 'all',
    status: 'all',
    error: 'all',
  });
  assert.deepEqual(options, buildFilterOptions(EVENTS));
});

test('sortEvents: start ascending/descending', () => {
  const asc = sortEvents(EVENTS, { column: 'start', direction: 'asc' });
  assert.deepEqual(
    asc.map((e) => e.start.getTime()),
    [...EVENTS].map((e) => e.start.getTime()).sort((a, b) => a - b),
  );
  const desc = sortEvents(EVENTS, { column: 'start', direction: 'desc' });
  assert.equal(desc[0], asc[asc.length - 1]);
});

test('sortEvents: inverter ascending/descending', () => {
  const asc = sortEvents(EVENTS, { column: 'inverter', direction: 'asc' });
  assert.ok(asc[0].inverterIdx <= asc[asc.length - 1].inverterIdx);
  const desc = sortEvents(EVENTS, { column: 'inverter', direction: 'desc' });
  assert.ok(desc[0].inverterIdx >= desc[desc.length - 1].inverterIdx);
});

test('sortEvents: stable — equal keys keep their original relative order', () => {
  const tied = [
    makeEvent({ inverterIdx: 0, dedupeKey: 'a' }),
    makeEvent({ inverterIdx: 0, dedupeKey: 'b' }),
    makeEvent({ inverterIdx: 0, dedupeKey: 'c' }),
  ];
  const sorted = sortEvents(tied, { column: 'inverter', direction: 'asc' });
  assert.deepEqual(
    sorted.map((e) => e.dedupeKey),
    ['a', 'b', 'c'],
  );
});

test('sortEvents: never mutates the input array', () => {
  const copy = [...EVENTS];
  sortEvents(EVENTS, { column: 'start', direction: 'asc' });
  assert.deepEqual(EVENTS, copy);
});

test('sortEvents: duration — ongoing (null) events sort as the longest', () => {
  const asc = sortEvents(EVENTS, { column: 'duration', direction: 'asc' });
  assert.equal(asc[asc.length - 1].isOngoing, true);
  const desc = sortEvents(EVENTS, { column: 'duration', direction: 'desc' });
  assert.equal(desc[0].isOngoing, true);
});
