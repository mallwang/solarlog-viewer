import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dateFromFilename,
  parseRecordLine,
  checkLineFormat,
  checkDateConsistency,
  checkEpoch3Format,
  checkFiveMinuteIntervals,
  checkStartNearZero,
  checkMonotonicWh,
  checkDaysHistMatch,
  validateContent,
  CHECK_NAMES,
} from './validate-min-consistency.js';

const GOOD_LINES = [
  'm[mi++]="30.07.26 06:10:00|0;13;10;500;166;165|13;36;300;150"',
  'm[mi++]="30.07.26 06:05:00|0;12;9;450;160;160|12;35;280;148"',
  'm[mi++]="30.07.26 06:00:00|0;0;0;0;0;0|3;8;10;313"',
];

test('dateFromFilename parses minYYMMDD.js into DD.MM.YY', () => {
  assert.equal(dateFromFilename('min260730.js'), '30.07.26');
  assert.equal(dateFromFilename('min090101.js'), '01.01.09');
  assert.equal(dateFromFilename('not-a-min-file.js'), null);
});

test('parseRecordLine extracts date, time and epoch-3 blocks', () => {
  const rec = parseRecordLine(GOOD_LINES[0]);
  assert.equal(rec.date, '30.07.26');
  assert.equal(rec.time, '06:10:00');
  assert.deepEqual(rec.b0, ['0', '13', '10', '500', '166', '165']);
  assert.deepEqual(rec.b1, ['13', '36', '300', '150']);
  assert.equal(rec.sb4200Wh, 500);
  assert.equal(rec.sb2100Wh, 300);
  assert.equal(rec.totalWh, 800);
});

test('parseRecordLine returns null for malformed lines', () => {
  assert.equal(parseRecordLine('not a record line'), null);
  assert.equal(parseRecordLine('m[mi++]="30.07.26 06:10:00|0;13;10;500;166;165"'), null);
});

test('checkLineFormat flags lines that do not start with m[mi++]', () => {
  assert.deepEqual(checkLineFormat(['m[mi++]="x"', 'garbage line']), [
    { index: 1, line: 'garbage line' },
  ]);
  assert.deepEqual(checkLineFormat(['m[mi++]="x"']), []);
});

test('checkDateConsistency flags records whose date differs from the filename date', () => {
  const records = GOOD_LINES.map(parseRecordLine);
  assert.deepEqual(checkDateConsistency(records, '30.07.26'), []);
  assert.deepEqual(checkDateConsistency(records, '29.07.26'), [
    { index: 0, expected: '29.07.26', actual: '30.07.26' },
    { index: 1, expected: '29.07.26', actual: '30.07.26' },
    { index: 2, expected: '29.07.26', actual: '30.07.26' },
  ]);
});

test('checkEpoch3Format flags records not matching the 6|4 field layout', () => {
  const records = GOOD_LINES.map(parseRecordLine);
  assert.deepEqual(checkEpoch3Format(records), []);
  const bad = { ...records[0], b0: ['0', '13', '10', '500'] };
  assert.deepEqual(checkEpoch3Format([bad]), [{ index: 0, b0Fields: 4, b1Fields: 4 }]);
});

test('checkFiveMinuteIntervals flags gaps that are not exactly 5 minutes', () => {
  const records = GOOD_LINES.map(parseRecordLine);
  assert.deepEqual(checkFiveMinuteIntervals(records), []);

  const withGap = [
    parseRecordLine('m[mi++]="30.07.26 06:15:00|0;0;0;0;0;0|0;0;0;0"'),
    parseRecordLine('m[mi++]="30.07.26 06:05:00|0;0;0;0;0;0|0;0;0;0"'),
  ];
  assert.deepEqual(checkFiveMinuteIntervals(withGap), [
    { index: 1, fromTime: '06:15:00', toTime: '06:05:00', deltaMinutes: 10 },
  ]);
});

test('checkStartNearZero flags a non-near-zero last (earliest) line', () => {
  const records = GOOD_LINES.map(parseRecordLine);
  assert.deepEqual(checkStartNearZero(records, 50), []);

  const highStart = [
    ...records,
    parseRecordLine('m[mi++]="30.07.26 05:55:00|0;0;0;5000;0;0|0;0;3000;0"'),
  ];
  assert.deepEqual(checkStartNearZero(highStart, 50), [{ index: 3, totalWh: 8000, threshold: 50 }]);
});

test('checkMonotonicWh flags cumulative Wh decreasing further down the file (back in time)', () => {
  const records = GOOD_LINES.map(parseRecordLine);
  assert.deepEqual(checkMonotonicWh(records), []);

  const decreasing = [
    parseRecordLine('m[mi++]="30.07.26 06:10:00|0;0;0;400;0;0|0;0;200;0"'),
    parseRecordLine('m[mi++]="30.07.26 06:05:00|0;0;0;500;0;0|0;0;300;0"'),
  ];
  assert.deepEqual(checkMonotonicWh(decreasing), [
    { index: 1, prevTotalWh: 600, totalWh: 800 },
  ]);
});

test('checkDaysHistMatch flags a mismatch between the first line total and days_hist entry', () => {
  const records = GOOD_LINES.map(parseRecordLine);
  assert.equal(checkDaysHistMatch(records, { wr1Wh: 500, wr2Wh: 300 }), null);
  // Combined total matches even though wr1/wr2 are individually swapped (pre-migration block order).
  assert.equal(checkDaysHistMatch(records, { wr1Wh: 300, wr2Wh: 500 }), null);
  assert.deepEqual(checkDaysHistMatch(records, { wr1Wh: 500, wr2Wh: 250 }), {
    minTotalWh: 800,
    histTotalWh: 750,
  });
  assert.equal(checkDaysHistMatch(records, undefined), null);
});

test('validateContent aggregates all checks for a single file', () => {
  const content = GOOD_LINES.join('\n') + '\n';
  const result = validateContent('min260730.js', content, { wr1Wh: 500, wr2Wh: 300 });
  assert.equal(result.filename, 'min260730.js');
  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, {});
});

test('validateContent reports issues per check when things are wrong', () => {
  const badContent = [
    'm[mi++]="30.07.26 06:10:00|0;13;10;500;166;165|13;36;300;150"',
    'not a valid line',
  ].join('\n');
  const result = validateContent('min260730.js', badContent, undefined);
  assert.equal(result.ok, false);
  assert.ok(result.issues.lineFormat.length > 0 || result.issues.malformed.length > 0);
});

test('validateContent restricts to the given `checks` list, e.g. only the line-format check', () => {
  const content = [
    // interval and monotonic violations present, but only `line` is selected
    'm[mi++]="30.07.26 06:20:00|0;0;0;100;0;0|0;0;50;0"',
    'm[mi++]="30.07.26 06:05:00|0;0;0;200;0;0|0;0;100;0"',
  ].join('\n');
  const allChecks = validateContent('min260730.js', content, undefined);
  assert.ok(allChecks.issues.fiveMinuteIntervals);
  assert.ok(allChecks.issues.monotonicWh);

  const lineOnly = validateContent('min260730.js', content, undefined, { checks: ['line'] });
  assert.deepEqual(Object.keys(lineOnly.issues), []);
  assert.equal(lineOnly.ok, true);
});

test('CHECK_NAMES lists exactly the check names accepted by the `checks` option', () => {
  assert.deepEqual(CHECK_NAMES, ['line', 'date', 'epoch3', 'interval', 'startZero', 'monotonic', 'hist']);
});
