import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBackfilledTrace, detectBackfilledDates } from './detect-backfilled-days.js';

// ---------------------------------------------------------------------------
// isBackfilledTrace
// ---------------------------------------------------------------------------

test('isBackfilledTrace: true when every reading has pacW=0 across all inverters but yield is real', () => { // NOSONAR
  const trace = {
    readings: [
      { perInverter: { 1: { pacW: 0, dailyYieldWh: 0 }, 2: { pacW: 0, dailyYieldWh: 0 } } },
      { perInverter: { 1: { pacW: 0, dailyYieldWh: 19008 }, 2: { pacW: 0, dailyYieldWh: 9408 } } },
    ],
  };
  assert.equal(isBackfilledTrace(trace), true);
});

test('isBackfilledTrace: false when any inverter has a nonzero pacW reading', () => { // NOSONAR
  const trace = {
    readings: [
      { perInverter: { 1: { pacW: 0, dailyYieldWh: 0 }, 2: { pacW: 0, dailyYieldWh: 0 } } },
      { perInverter: { 1: { pacW: 3821, dailyYieldWh: 19008 }, 2: { pacW: 0, dailyYieldWh: 9408 } } },
    ],
  };
  assert.equal(isBackfilledTrace(trace), false);
});

test('isBackfilledTrace: false when the day has no real yield at all (genuinely empty, not backfilled)', () => { // NOSONAR
  const trace = {
    readings: [
      { perInverter: { 1: { pacW: 0, dailyYieldWh: 0 }, 2: { pacW: 0, dailyYieldWh: 0 } } },
    ],
  };
  assert.equal(isBackfilledTrace(trace), false);
});

test('isBackfilledTrace: false for an empty/unparseable trace (no readings)', () => { // NOSONAR
  assert.equal(isBackfilledTrace({ readings: [] }), false);
});

// ---------------------------------------------------------------------------
// detectBackfilledDates
// ---------------------------------------------------------------------------

test('detectBackfilledDates: flags backfilled min files and skips genuine ones, sorted ISO output', () => { // NOSONAR
  const backfilledContent = [
    'm[mi++]="01.07.26 23:55:00|0;0;0;19008;0;0|0;0;9408;0"',
  ].join('\n');
  const genuineContent = [
    'm[mi++]="15.06.26 12:00:00|3821;900;1500;16533;0;0|1972;500;700;8183;0"',
  ].join('\n');
  const minFilesByName = new Map([
    ['min260701.js', backfilledContent],
    ['min260615.js', genuineContent],
  ]);

  assert.deepEqual(detectBackfilledDates(minFilesByName), ['2026-07-01']);
});

test('detectBackfilledDates: ignores files that fail to parse into any reading', () => { // NOSONAR
  const minFilesByName = new Map([['min260701.js', 'garbage, not a min file']]);
  assert.deepEqual(detectBackfilledDates(minFilesByName), []);
});

test('detectBackfilledDates: --since excludes backfilled-looking days before an old, power-less era', () => { // NOSONAR
  const oldEraBackfilledLooking = 'm[mi++]="15.03.06 12:00:00|0;0;0;4733;0;0|0;0;2421;0"';
  const realGap = 'm[mi++]="01.07.26 23:55:00|0;0;0;19008;0;0|0;0;9408;0"';
  const minFilesByName = new Map([
    ['min060315.js', oldEraBackfilledLooking],
    ['min260701.js', realGap],
  ]);

  assert.deepEqual(detectBackfilledDates(minFilesByName), ['2006-03-15', '2026-07-01']);
  assert.deepEqual(detectBackfilledDates(minFilesByName, { since: '2026-01-01' }), ['2026-07-01']);
});

test('detectBackfilledDates: originalFilenames flags a file missing from the pre-backfill snapshot even before --since', () => { // NOSONAR
  // Same old-era content as above, but this time we know (via a real pre-backfill snapshot) that
  // the file simply didn't exist there - unambiguous, regardless of --since or content.
  const fabricated = 'm[mi++]="01.04.06 12:00:00|0;0;0;15722;0;0|0;0;8043;0"';
  const minFilesByName = new Map([['min060401.js', fabricated]]);

  assert.deepEqual(
    detectBackfilledDates(minFilesByName, {
      since: '2026-01-01',
      originalFilenames: new Set(), // min060401.js absent -> flagged
    }),
    ['2006-04-01'],
  );
  assert.deepEqual(
    detectBackfilledDates(minFilesByName, {
      since: '2026-01-01',
      originalFilenames: new Set(['min060401.js']), // present in the original -> not flagged
    }),
    [],
  );
});

test('detectBackfilledDates: unions the content signature and the originalFilenames signature', () => { // NOSONAR
  const contentOnly = 'm[mi++]="01.07.26 23:55:00|0;0;0;19008;0;0|0;0;9408;0"'; // present, but pacW=0
  const presenceOnly = 'm[mi++]="15.06.26 12:00:00|3821;900;1500;16533;0;0|1972;500;700;8183;0"'; // real content, absent from original
  const minFilesByName = new Map([
    ['min260701.js', contentOnly],
    ['min260615.js', presenceOnly],
  ]);

  assert.deepEqual(
    detectBackfilledDates(minFilesByName, {
      originalFilenames: new Set(['min260701.js']), // only min260615.js is "missing"
    }),
    ['2026-06-15', '2026-07-01'],
  );
});
