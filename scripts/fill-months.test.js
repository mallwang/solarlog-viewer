/**
 * Tests for fill-months.js — inline fixtures, no filesystem I/O.
 * @module fill-months.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectMonthMinFiles,
  aggregateMonth,
  formatMonthEntry,
  upsertInMonths,
} from './fill-months.js';

// Fixtures: two min files for June 2026
const MIN_JUNE_01 = `m[mi++]="01.06.26 23:55:00|0;0;0;18000;0;0|0;0;9000;0"
m[mi++]="01.06.26 23:50:00|0;0;0;17000;0;0|0;0;8000;0"`;

const MIN_JUNE_02 = `m[mi++]="02.06.26 23:55:00|0;0;0;19008;0;0|0;0;9408;0"
m[mi++]="02.06.26 23:50:00|0;0;0;18000;0;0|0;0;8000;0"`;

const MONTHS_CONTENT = `mo[mx++]="01.07.26|532224|263424"
mo[mx++]="01.06.26|111111|222222"
mo[mx++]="01.05.26|525197|269568"`;

// --- collectMonthMinFiles ---

describe('collectMonthMinFiles', () => {
  it('returns only filenames matching the given YYYY-MM', () => {
    const all = ['min260601.js', 'min260602.js', 'min260701.js', 'min_cur.js', 'days.js'];
    const result = collectMonthMinFiles(all, '2026-06');
    assert.deepEqual(result, ['min260601.js', 'min260602.js']);
  });

  it('returns empty array when no files match', () => {
    const result = collectMonthMinFiles(['min260701.js'], '2026-06');
    assert.deepEqual(result, []);
  });
});

// --- aggregateMonth ---

describe('aggregateMonth', () => {
  it('sums WR1 and WR2 Wh across multiple min file contents', () => {
    const result = aggregateMonth([MIN_JUNE_01, MIN_JUNE_02]);
    assert.equal(result.wr1Wh, 18000 + 19008);
    assert.equal(result.wr2Wh, 9000 + 9408);
  });

  it('returns zero totals for empty array', () => {
    const result = aggregateMonth([]);
    assert.equal(result.wr1Wh, 0);
    assert.equal(result.wr2Wh, 0);
  });
});

// --- formatMonthEntry ---

describe('formatMonthEntry', () => {
  it('produces correct mo[mx++]= line format', () => {
    const line = formatMonthEntry('2026-06', { wr1Wh: 570240, wr2Wh: 282240 });
    assert.equal(line, 'mo[mx++]="01.06.26|570240|282240"');
  });
});

// --- upsertInMonths ---

describe('upsertInMonths', () => {
  it('replaces an existing month entry', () => {
    const newLine = 'mo[mx++]="01.06.26|570240|282240"';
    const result = upsertInMonths(MONTHS_CONTENT, newLine);
    assert.ok(result.includes(newLine));
    assert.ok(!result.includes('01.06.26|111111|222222'));
  });

  it('appends a new entry when month is not present', () => {
    const newLine = 'mo[mx++]="01.04.26|400000|200000"';
    const result = upsertInMonths(MONTHS_CONTENT, newLine);
    assert.ok(result.includes(newLine));
  });

  it('does not duplicate the entry', () => {
    const newLine = 'mo[mx++]="01.06.26|570240|282240"';
    const result = upsertInMonths(MONTHS_CONTENT, newLine);
    const count = result.split('01.06.26').length - 1;
    assert.equal(count, 1);
  });
});
