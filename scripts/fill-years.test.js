/**
 * Tests for fill-years.js — inline fixtures, no filesystem I/O.
 * @module fill-years.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectYearMinFiles,
  aggregateYear,
  formatYearEntry,
  upsertInYears,
} from './fill-years.js';

// Fixtures: two min files for 2026
const MIN_2026_01 = `m[mi++]="01.01.26 23:55:00|0;0;0;18000;0;0|0;0;9000;0"
m[mi++]="01.01.26 23:50:00|0;0;0;17000;0;0|0;0;8000;0"`;

const MIN_2026_02 = `m[mi++]="02.01.26 23:55:00|0;0;0;19008;0;0|0;0;9408;0"
m[mi++]="02.01.26 23:50:00|0;0;0;18000;0;0|0;0;8000;0"`;

const YEARS_CONTENT = `ye[yx++]="01.01.26|2910255|1493488"
ye[yx++]="01.01.25|4340494|2304982"
ye[yx++]="01.01.24|3909707|2076400"`;

// --- collectYearMinFiles ---

describe('collectYearMinFiles', () => {
  it('returns only filenames for the given YYYY', () => {
    const all = ['min260101.js', 'min260102.js', 'min250101.js', 'min_cur.js'];
    const result = collectYearMinFiles(all, '2026');
    assert.deepEqual(result, ['min260101.js', 'min260102.js']);
  });

  it('returns empty array when no files match', () => {
    const result = collectYearMinFiles(['min260101.js'], '2025');
    assert.deepEqual(result, []);
  });
});

// --- aggregateYear ---

describe('aggregateYear', () => {
  it('sums WR1 and WR2 Wh across multiple min file contents', () => {
    const result = aggregateYear([MIN_2026_01, MIN_2026_02]);
    assert.equal(result.wr1Wh, 18000 + 19008);
    assert.equal(result.wr2Wh, 9000 + 9408);
  });

  it('returns zero totals for empty array', () => {
    const result = aggregateYear([]);
    assert.equal(result.wr1Wh, 0);
    assert.equal(result.wr2Wh, 0);
  });
});

// --- formatYearEntry ---

describe('formatYearEntry', () => {
  it('produces correct ye[yx++]= line format', () => {
    const line = formatYearEntry('2026', { wr1Wh: 2910255, wr2Wh: 1493488 });
    assert.equal(line, 'ye[yx++]="01.01.26|2910255|1493488"');
  });
});

// --- upsertInYears ---

describe('upsertInYears', () => {
  it('replaces an existing year entry', () => {
    const newLine = 'ye[yx++]="01.01.26|3000000|1500000"';
    const result = upsertInYears(YEARS_CONTENT, newLine);
    assert.ok(result.includes(newLine));
    assert.ok(!result.includes('01.01.26|2910255|1493488'));
  });

  it('appends a new entry when year is not present', () => {
    const newLine = 'ye[yx++]="01.01.23|3500000|1800000"';
    const result = upsertInYears(YEARS_CONTENT, newLine);
    assert.ok(result.includes(newLine));
  });

  it('does not duplicate the entry', () => {
    const newLine = 'ye[yx++]="01.01.26|3000000|1500000"';
    const result = upsertInYears(YEARS_CONTENT, newLine);
    const count = result.split('01.01.26').length - 1;
    assert.equal(count, 1);
  });
});
