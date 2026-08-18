import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDaysHistLine,
  formatDaysHistLine,
  minFilenameForDate,
  parsePeaksFromMinFile,
  backfillDaysHistFile,
} from './backfill-peak-power.js';

// ---------------------------------------------------------------------------
// parseDaysHistLine / formatDaysHistLine
// ---------------------------------------------------------------------------

test('parseDaysHistLine: extracts date and per-block yieldWh/peakW', () => { // NOSONAR
  const line = 'da[dx++]="11.04.18|22494;0|11772;0"';
  assert.deepEqual(parseDaysHistLine(line), {
    date: '11.04.18',
    blocks: [
      { yieldWh: 22494, peakW: 0 },
      { yieldWh: 11772, peakW: 0 },
    ],
  });
});

test('parseDaysHistLine: returns null for non-matching lines (header/footer/blank)', () => { // NOSONAR
  assert.equal(parseDaysHistLine('var dx=0;'), null);
  assert.equal(parseDaysHistLine(''), null);
  assert.equal(parseDaysHistLine('   '), null);
});

test('formatDaysHistLine: round-trips parseDaysHistLine output back to the wire format', () => { // NOSONAR
  const line = 'da[dx++]="11.04.18|22494;3821|11772;1972"';
  const parsed = parseDaysHistLine(line);
  assert.equal(formatDaysHistLine(parsed.date, parsed.blocks), line);
});

// ---------------------------------------------------------------------------
// minFilenameForDate
// ---------------------------------------------------------------------------

test('minFilenameForDate: builds minYYMMDD.js from a DD.MM.YY days_hist date', () => { // NOSONAR
  assert.equal(minFilenameForDate('11.04.18'), 'min180411.js');
});

// ---------------------------------------------------------------------------
// parsePeaksFromMinFile
// ---------------------------------------------------------------------------

test('parsePeaksFromMinFile: returns the max PAC (field 0) per block across all lines', () => { // NOSONAR
  const content = [
    'm[mi++]="11.04.18 06:15:00|10;20;5;230|5;3;2;3;0;0"',
    'm[mi++]="11.04.18 12:00:00|3821;900;1500;230|1972;500;700;3;0;0"',
    'm[mi++]="11.04.18 12:15:00|3600;880;1480;230|1900;480;680;3;0;0"',
    'm[mi++]="11.04.18 20:45:00|0;0;5;230|0;0;0;3;0;0"',
  ].join('\n');
  assert.deepEqual(parsePeaksFromMinFile(content), [3821, 1972]);
});

test('parsePeaksFromMinFile: ignores malformed lines and blank lines', () => { // NOSONAR
  const content = [
    'not a valid line',
    '',
    'm[mi++]="11.04.18 12:00:00|100;1;2;3|200;1;2;3"',
  ].join('\n');
  assert.deepEqual(parsePeaksFromMinFile(content), [100, 200]);
});

test('parsePeaksFromMinFile: returns null when no valid lines are present', () => { // NOSONAR
  assert.equal(parsePeaksFromMinFile('not a valid line\n'), null);
  assert.equal(parsePeaksFromMinFile(''), null);
});

// ---------------------------------------------------------------------------
// backfillDaysHistFile
// ---------------------------------------------------------------------------

const minFile = (peaks) =>
  `m[mi++]="11.04.18 12:00:00|${peaks[0]};1;2;3|${peaks[1]};1;2;3"`;

test('backfillDaysHistFile: fills zeroed peaks from the matching min file', () => { // NOSONAR
  const lines = ['da[dx++]="11.04.18|22494;0|11772;0"'];
  const minFilesByName = new Map([['min180411.js', minFile([3821, 1972])]]);
  const result = backfillDaysHistFile(lines, minFilesByName);
  assert.deepEqual(result.lines, ['da[dx++]="11.04.18|22494;3821|11772;1972"']);
  assert.equal(result.stats.backfilled, 1);
  assert.equal(result.stats.alreadyPresent, 0);
  assert.equal(result.stats.missingMinFile, 0);
});

test('backfillDaysHistFile: leaves a line untouched when a peak is already non-zero', () => { // NOSONAR
  const lines = ['da[dx++]="06.08.26|17964;3772|9528;1951"'];
  const minFilesByName = new Map([['min260806.js', minFile([9999, 9999])]]);
  const result = backfillDaysHistFile(lines, minFilesByName);
  assert.deepEqual(result.lines, lines);
  assert.equal(result.stats.alreadyPresent, 1);
  assert.equal(result.stats.backfilled, 0);
});

test('backfillDaysHistFile: leaves a zeroed line untouched when no matching min file exists', () => { // NOSONAR
  const lines = ['da[dx++]="11.04.18|22494;0|11772;0"'];
  const result = backfillDaysHistFile(lines, new Map());
  assert.deepEqual(result.lines, lines);
  assert.equal(result.stats.missingMinFile, 1);
  assert.equal(result.stats.backfilled, 0);
});

test('backfillDaysHistFile: leaves a zeroed line untouched when the min file has no valid peaks', () => { // NOSONAR
  const lines = ['da[dx++]="11.04.18|22494;0|11772;0"'];
  const minFilesByName = new Map([['min180411.js', 'not a valid line']]);
  const result = backfillDaysHistFile(lines, minFilesByName);
  assert.deepEqual(result.lines, lines);
  assert.equal(result.stats.mismatchedBlockCount, 1);
  assert.equal(result.stats.backfilled, 0);
});

test('backfillDaysHistFile: leaves the block count mismatched between days_hist and min file untouched', () => { // NOSONAR
  const lines = ['da[dx++]="11.04.18|22494;0|11772;0"'];
  const singleBlockMin = 'm[mi++]="11.04.18 12:00:00|100;1;2;3"';
  const minFilesByName = new Map([['min180411.js', singleBlockMin]]);
  const result = backfillDaysHistFile(lines, minFilesByName);
  assert.deepEqual(result.lines, lines);
  assert.equal(result.stats.mismatchedBlockCount, 1);
});

test('backfillDaysHistFile: passes non-data lines (headers/blank) through unchanged', () => { // NOSONAR
  const lines = ['var dx=0;', 'da[dx++]="11.04.18|22494;0|11772;0"', ''];
  const minFilesByName = new Map([['min180411.js', minFile([3821, 1972])]]);
  const result = backfillDaysHistFile(lines, minFilesByName);
  assert.deepEqual(result.lines, [
    'var dx=0;',
    'da[dx++]="11.04.18|22494;3821|11772;1972"',
    '',
  ]);
  assert.equal(result.stats.nonDataLines, 2);
});
