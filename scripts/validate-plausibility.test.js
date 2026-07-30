/**
 * Tests for validate-plausibility.js — inline fixtures, no filesystem I/O.
 * @module validate-plausibility.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMinFile, parseDaysHist, compareDay } from './validate-plausibility.js';

// Fixture: newer format min file (2026 style: 6 WR1 fields, 4 WR2 fields)
const MIN_NEWER = `m[mi++]="28.07.26 23:55:00|0;0;0;19008;0;0|0;0;9408;0"
m[mi++]="28.07.26 23:50:00|0;0;0;19000;0;0|0;0;9400;0"`;

// Fixture: older format min file (2006 style: 4 WR1 fields, 4 WR2 fields)
const MIN_OLDER = `m[mi++]="03.11.06 17:00:00|12;32;7793;235|0;8;6;15130"
m[mi++]="03.11.06 16:55:00|12;32;7792;273|0;24;16;15130"`;

// Fixture: days_hist content
const DAYS_HIST = `da[dx++]="29.07.26|10377;3209|5521;1645"
da[dx++]="28.07.26|19008;0|9408;0"
da[dx++]="27.07.26|19008;0|9408;0"
da[dx++]="03.11.06|7793;1615|15130;3155"`;

// --- parseMinFile ---

describe('parseMinFile', () => {
  it('extracts WR1 and WR2 Wh from newer-format first line (field index 2 in each block)', () => {
    const result = parseMinFile(MIN_NEWER);
    assert.deepEqual(result, { wr1Wh: 19008, wr2Wh: 9408 });
  });

  it('extracts WR1 and WR2 Wh from older-format first line (Epoch 1: 4|4 fields)', () => {
    const result = parseMinFile(MIN_OLDER);
    assert.deepEqual(result, { wr1Wh: 7793, wr2Wh: 15130 });
  });

  it('returns null for empty content', () => {
    assert.equal(parseMinFile(''), null);
  });
});

// --- parseDaysHist ---

describe('parseDaysHist', () => {
  it('builds a map keyed by DD.MM.YY with correct Wh values', () => {
    const map = parseDaysHist(DAYS_HIST);
    assert.ok(map.has('28.07.26'));
    assert.deepEqual(map.get('28.07.26'), { wr1Wh: 19008, wr2Wh: 9408 });
  });

  it('ignores lines that do not match da[] format', () => {
    const map = parseDaysHist('// comment\nda[dx++]="01.01.26|100;0|200;0"\n');
    assert.equal(map.size, 1);
  });

  it('returns empty map for empty content', () => {
    assert.equal(parseDaysHist('').size, 0);
  });
});

// --- compareDay ---

describe('compareDay', () => {
  it('returns null when both WR1 and WR2 deltas are within tolerance', () => {
    const min = { wr1Wh: 19008, wr2Wh: 9408 };
    const hist = { wr1Wh: 19008, wr2Wh: 9408 };
    assert.equal(compareDay(min, hist, 1), null);
  });

  it('returns null when delta equals tolerance exactly', () => {
    const min = { wr1Wh: 19009, wr2Wh: 9408 };
    const hist = { wr1Wh: 19008, wr2Wh: 9408 };
    assert.equal(compareDay(min, hist, 1), null);
  });

  it('returns mismatch record when WR1 delta exceeds tolerance', () => {
    const min = { wr1Wh: 19100, wr2Wh: 9408 };
    const hist = { wr1Wh: 19008, wr2Wh: 9408 };
    const result = compareDay(min, hist, 1);
    assert.ok(result !== null);
    assert.equal(result.wr1MinWh, 19100);
    assert.equal(result.wr1HistWh, 19008);
    assert.equal(result.wr1Delta, 92);
    assert.equal(result.wr2Delta, 0);
  });

  it('returns mismatch record when WR2 delta exceeds tolerance', () => {
    const min = { wr1Wh: 19008, wr2Wh: 9500 };
    const hist = { wr1Wh: 19008, wr2Wh: 9408 };
    const result = compareDay(min, hist, 1);
    assert.ok(result !== null);
    assert.equal(result.wr2Delta, 92);
  });
});
