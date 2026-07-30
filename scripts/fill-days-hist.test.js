/**
 * Tests for fill-days-hist.js — inline fixtures, no filesystem I/O.
 * @module fill-days-hist.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDaysHistFiles,
  findInDaysFiles,
  aggregateFromMin,
  formatDaysHistEntry,
  insertEntryInOrder,
} from './fill-days-hist.js';

// Fixtures
const DAYS_HIST_CONTENT = `da[dx++]="29.07.26|10377;3209|5521;1645"
da[dx++]="28.07.26|19008;0|9408;0"
da[dx++]="27.07.26|15000;0|7000;0"`;

const DAYS_HIST_06 = `da[dx++]="31.12.06|5291;1615|10274;3155"
da[dx++]="15.06.26|12000;500|6000;200"`;

// min file: newer format, WR1 Wh at block[0][3], WR2 Wh at block[1][2]
const MIN_CONTENT = `m[mi++]="15.06.26 23:55:00|0;0;0;12345;0;0|0;0;6789;0"
m[mi++]="15.06.26 23:50:00|0;0;0;12000;0;0|0;0;6500;0"`;

// --- parseDaysHistFiles ---

describe('parseDaysHistFiles', () => {
  it('merges multiple days_hist file contents into a single map', () => {
    const map = parseDaysHistFiles([DAYS_HIST_CONTENT, DAYS_HIST_06]);
    assert.ok(map.has('28.07.26'));
    assert.ok(map.has('31.12.06'));
    assert.ok(map.has('15.06.26'));
  });

  it('stores wr1Wh, wr2Wh, wr1Feed, wr2Feed', () => {
    const map = parseDaysHistFiles([DAYS_HIST_CONTENT]);
    const entry = map.get('29.07.26');
    assert.equal(entry.wr1Wh, 10377);
    assert.equal(entry.wr1Feed, 3209);
    assert.equal(entry.wr2Wh, 5521);
    assert.equal(entry.wr2Feed, 1645);
  });
});

// --- findInDaysFiles ---

describe('findInDaysFiles', () => {
  it('returns a record when date is found in a days file (pass 1 hit)', () => {
    const result = findInDaysFiles('15.06.26', [DAYS_HIST_CONTENT, DAYS_HIST_06]);
    assert.ok(result !== null);
    assert.equal(result.wr1Wh, 12000);
    assert.equal(result.wr2Wh, 6000);
  });

  it('returns null when date is not in any days file', () => {
    const result = findInDaysFiles('01.01.20', [DAYS_HIST_CONTENT, DAYS_HIST_06]);
    assert.equal(result, null);
  });
});

// --- aggregateFromMin ---

describe('aggregateFromMin', () => {
  it('returns WR1 and WR2 Wh from first line of min file (pass 2)', () => {
    const result = aggregateFromMin(MIN_CONTENT);
    assert.equal(result.wr1Wh, 12345);
    assert.equal(result.wr2Wh, 6789);
  });

  it('sets feed values to 0 (no feed data in min files)', () => {
    const result = aggregateFromMin(MIN_CONTENT);
    assert.equal(result.wr1Feed, 0);
    assert.equal(result.wr2Feed, 0);
  });

  it('returns null for empty content', () => {
    assert.equal(aggregateFromMin(''), null);
  });
});

// --- formatDaysHistEntry ---

describe('formatDaysHistEntry', () => {
  it('produces byte-for-byte compatible da[dx++]= line', () => {
    const record = { wr1Wh: 19008, wr1Feed: 0, wr2Wh: 9408, wr2Feed: 0 };
    const line = formatDaysHistEntry('28.07.26', record);
    assert.equal(line, 'da[dx++]="28.07.26|19008;0|9408;0"');
  });

  it('includes non-zero feed values', () => {
    const record = { wr1Wh: 10377, wr1Feed: 3209, wr2Wh: 5521, wr2Feed: 1645 };
    const line = formatDaysHistEntry('29.07.26', record);
    assert.equal(line, 'da[dx++]="29.07.26|10377;3209|5521;1645"');
  });
});

// --- insertEntryInOrder ---

describe('insertEntryInOrder', () => {
  it('inserts a newer date before older dates (newest-first ordering)', () => {
    const existing = [
      'da[dx++]="27.07.26|15000;0|7000;0"',
      'da[dx++]="26.07.26|14000;0|6000;0"',
    ];
    const newLine = 'da[dx++]="28.07.26|19008;0|9408;0"';
    const result = insertEntryInOrder(existing, newLine);
    assert.equal(result[0], newLine);
  });

  it('inserts between two entries in the correct sort position', () => {
    const existing = [
      'da[dx++]="29.07.26|10377;3209|5521;1645"',
      'da[dx++]="27.07.26|15000;0|7000;0"',
    ];
    const newLine = 'da[dx++]="28.07.26|19008;0|9408;0"';
    const result = insertEntryInOrder(existing, newLine);
    assert.equal(result[1], newLine);
  });

  it('appends an older date at the end', () => {
    const existing = ['da[dx++]="29.07.26|10377;3209|5521;1645"'];
    const newLine = 'da[dx++]="01.01.20|5000;0|2000;0"';
    const result = insertEntryInOrder(existing, newLine);
    assert.equal(result.at(-1), newLine);
  });
});
