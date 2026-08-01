import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRegeneratedMap,
  sortDateKeysDescending,
  formatDaysHistFile,
  compareDaysHist,
  classifyCompleteness,
  applyOriginalFallbackForMismatches,
  minFilenameForDateKey,
} from './regenerate-days-hist.js';
import { parseRecordLine } from './validate-min-consistency.js';

const MIN_260730 = 'm[mi++]="30.07.26 21:10:00|0;0;0;21270;0;0|13;35;11171;145"\n';
const MIN_260729 = 'm[mi++]="29.07.26 23:55:00|0;0;0;10377;0;0|13;35;5521;145"\n';

function readFileMap(files) {
  return (filename) => files[filename];
}

test('buildRegeneratedMap extracts per-inverter Wh from each min file first line', () => {
  const files = { 'min260730.js': MIN_260730, 'min260729.js': MIN_260729 };
  const map = buildRegeneratedMap(Object.keys(files), readFileMap(files));
  assert.deepEqual(map.get('30.07.26'), { wr1Wh: 21270, wr1Feed: 0, wr2Wh: 11171, wr2Feed: 0 });
  assert.deepEqual(map.get('29.07.26'), { wr1Wh: 10377, wr1Feed: 0, wr2Wh: 5521, wr2Feed: 0 });
  assert.equal(map.size, 2);
});

test('buildRegeneratedMap skips filenames that are not min files and unparsable content', () => {
  const files = { 'min260730.js': MIN_260730, 'days_hist.js': 'irrelevant', 'min260601.js': 'garbage' };
  const map = buildRegeneratedMap(Object.keys(files), readFileMap(files));
  assert.equal(map.size, 1);
  assert.ok(map.has('30.07.26'));
});

test('sortDateKeysDescending orders DD.MM.YY keys newest first', () => {
  assert.deepEqual(sortDateKeysDescending(['01.01.09', '30.07.26', '15.03.06']), [
    '30.07.26',
    '01.01.09',
    '15.03.06',
  ]);
});

test('formatDaysHistFile renders entries newest-first as da[dx++] lines', () => {
  const map = new Map([
    ['29.07.26', { wr1Wh: 10377, wr1Feed: 0, wr2Wh: 5521, wr2Feed: 0 }],
    ['30.07.26', { wr1Wh: 21270, wr1Feed: 0, wr2Wh: 11171, wr2Feed: 0 }],
  ]);
  const content = formatDaysHistFile(map);
  assert.equal(
    content,
    'da[dx++]="30.07.26|21270;0|11171;0"\nda[dx++]="29.07.26|10377;0|5521;0"\n',
  );
});

test('compareDaysHist flags combined-total mismatches beyond tolerance', () => {
  const regenMap = new Map([
    ['30.07.26', { wr1Wh: 21270, wr1Feed: 0, wr2Wh: 11171, wr2Feed: 0 }],
    ['29.07.26', { wr1Wh: 10377, wr1Feed: 0, wr2Wh: 5521, wr2Feed: 0 }],
  ]);
  const originalMap = new Map([
    ['30.07.26', { wr1Wh: 21270, wr2Wh: 11171 }], // exact match
    ['29.07.26', { wr1Wh: 10300, wr2Wh: 5521 }], // 77 Wh off
  ]);
  const result = compareDaysHist(regenMap, originalMap, 0);
  assert.deepEqual(result.mismatches, [
    { date: '29.07.26', regenTotalWh: 15898, originalTotalWh: 15821, delta: 77 },
  ]);
  assert.deepEqual(result.onlyInRegen, []);
  assert.deepEqual(result.onlyInOriginal, []);
});

test('compareDaysHist respects tolerance and reports dates present on only one side', () => {
  const regenMap = new Map([
    ['30.07.26', { wr1Wh: 100, wr1Feed: 0, wr2Wh: 100, wr2Feed: 0 }],
    ['28.07.26', { wr1Wh: 50, wr1Feed: 0, wr2Wh: 50, wr2Feed: 0 }],
  ]);
  const originalMap = new Map([
    ['30.07.26', { wr1Wh: 105, wr2Wh: 100 }], // 5 Wh off, within tolerance
    ['27.07.26', { wr1Wh: 10, wr2Wh: 10 }],
  ]);
  const result = compareDaysHist(regenMap, originalMap, 10);
  assert.deepEqual(result.mismatches, []);
  assert.deepEqual(result.onlyInRegen, ['28.07.26']);
  assert.deepEqual(result.onlyInOriginal, ['27.07.26']);
});

const COMPLETE_LINES = [
  'm[mi++]="30.07.26 06:15:00|0;13;10;500;166;165|13;36;300;150"',
  'm[mi++]="30.07.26 06:10:00|0;12;9;450;160;160|12;35;280;148"',
  'm[mi++]="30.07.26 06:05:00|0;10;8;200;150;150|10;30;100;140"',
  'm[mi++]="30.07.26 06:00:00|0;0;0;0;0;0|3;8;10;0"',
];

test('classifyCompleteness reports complete for gap-free, near-zero-start records with enough data', () => {
  const records = COMPLETE_LINES.map(parseRecordLine);
  const result = classifyCompleteness(records, { minRecords: 4 });
  assert.deepEqual(result, { complete: true, reasons: [] });
});

test('classifyCompleteness flags interval gaps, a non-zero day start, and too few records', () => {
  const gappy = [
    parseRecordLine('m[mi++]="30.07.26 06:20:00|0;0;0;600;0;0|0;0;350;0"'),
    parseRecordLine('m[mi++]="30.07.26 06:05:00|0;0;0;200;0;0|0;0;100;0"'), // 15-min gap, and doesn't start near zero
  ];
  const result = classifyCompleteness(gappy, { minRecords: 4 });
  assert.equal(result.complete, false);
  assert.equal(result.reasons.length, 3);
  assert.match(result.reasons[0], /interval gap/);
  assert.match(result.reasons[1], /day-start not near zero/);
  assert.match(result.reasons[2], /only 2 record/);
});

test('minFilenameForDateKey derives the min filename from a DD.MM.YY date key', () => {
  assert.equal(minFilenameForDateKey('30.07.26'), 'min260730.js');
  assert.equal(minFilenameForDateKey('04.01.13'), 'min130104.js');
});

test('applyOriginalFallbackForMismatches leaves days not in the mismatch list untouched, even if incomplete', () => {
  const regenMap = new Map([['30.07.26', { wr1Wh: 500, wr1Feed: 0, wr2Wh: 300, wr2Feed: 0 }]]);
  const files = { 'min260730.js': 'm[mi++]="30.07.26 06:05:00|0;0;0;2;0;0|0;0;1;0"\n' }; // incomplete, but no mismatch passed in
  const originalMap = new Map([['30.07.26', { wr1Wh: 999, wr1Feed: 0, wr2Wh: 999, wr2Feed: 0 }]]);
  const { map, fallbacks } = applyOriginalFallbackForMismatches(regenMap, [], originalMap, readFileMap(files), { minRecords: 20 });
  assert.deepEqual(map.get('30.07.26'), { wr1Wh: 500, wr1Feed: 0, wr2Wh: 300, wr2Feed: 0 });
  assert.deepEqual(fallbacks, []);
});

test('applyOriginalFallbackForMismatches keeps the min-derived total for a mismatched but complete day', () => {
  const regenMap = new Map([['30.07.26', { wr1Wh: 500, wr1Feed: 0, wr2Wh: 300, wr2Feed: 0 }]]);
  const files = { 'min260730.js': COMPLETE_LINES.join('\n') + '\n' };
  const originalMap = new Map([['30.07.26', { wr1Wh: 1, wr1Feed: 1, wr2Wh: 1, wr2Feed: 1 }]]);
  const mismatches = [{ date: '30.07.26', regenTotalWh: 800, originalTotalWh: 2, delta: 798 }];
  const { map, fallbacks } = applyOriginalFallbackForMismatches(regenMap, mismatches, originalMap, readFileMap(files), { minRecords: 4 });
  assert.deepEqual(map.get('30.07.26'), { wr1Wh: 500, wr1Feed: 0, wr2Wh: 300, wr2Feed: 0 });
  assert.deepEqual(fallbacks, []);
});

test('applyOriginalFallbackForMismatches falls back to the original entry for a mismatched, incomplete day', () => {
  const regenMap = new Map([['30.07.26', { wr1Wh: 6, wr1Feed: 0, wr2Wh: 4, wr2Feed: 0 }]]);
  const files = {
    'min260730.js': 'm[mi++]="30.07.26 06:10:00|0;0;0;6;0;0|0;0;4;0"\n' +
                     'm[mi++]="30.07.26 06:05:00|0;0;0;2;0;0|0;0;1;0"\n',
  };
  const originalMap = new Map([['30.07.26', { wr1Wh: 26544, wr1Feed: 0, wr2Wh: 9047, wr2Feed: 0 }]]);
  const mismatches = [{ date: '30.07.26', regenTotalWh: 10, originalTotalWh: 35591, delta: -35581 }];
  const { map, fallbacks } = applyOriginalFallbackForMismatches(regenMap, mismatches, originalMap, readFileMap(files), { minRecords: 20 });
  assert.deepEqual(map.get('30.07.26'), { wr1Wh: 26544, wr1Feed: 0, wr2Wh: 9047, wr2Feed: 0 });
  assert.equal(fallbacks.length, 1);
  assert.deepEqual(fallbacks[0], {
    date: '30.07.26',
    filename: 'min260730.js',
    reasons: ['only 2 record(s)'],
    regenTotalWh: 10,
    originalTotalWh: 35591,
  });
});

test('applyOriginalFallbackForMismatches keeps the min-derived total when incomplete but no original entry exists', () => {
  const regenMap = new Map([['30.07.26', { wr1Wh: 2, wr1Feed: 0, wr2Wh: 1, wr2Feed: 0 }]]);
  const files = { 'min260730.js': 'm[mi++]="30.07.26 06:05:00|0;0;0;2;0;0|0;0;1;0"\n' };
  const mismatches = [{ date: '30.07.26', regenTotalWh: 3, originalTotalWh: 0, delta: 3 }];
  const { map, fallbacks } = applyOriginalFallbackForMismatches(regenMap, mismatches, new Map(), readFileMap(files), { minRecords: 20 });
  assert.deepEqual(map.get('30.07.26'), { wr1Wh: 2, wr1Feed: 0, wr2Wh: 1, wr2Feed: 0 });
  assert.deepEqual(fallbacks, []);
});
