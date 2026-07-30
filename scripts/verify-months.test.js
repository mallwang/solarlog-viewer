/**
 * Tests for verify-months.js — inline fixtures, no filesystem I/O.
 * @module verify-months.test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMonthsEntry, formatReport } from './verify-months.js';

const MONTHS_CONTENT = `mo[mx++]="01.07.26|532224|263424"
mo[mx++]="01.06.26|570240|282240"
mo[mx++]="01.01.09|183132|97538"
mo[mx++]="01.05.26|525197|269568"`;

// --- parseMonthsEntry ---

describe('parseMonthsEntry', () => {
  it('extracts WR1 and WR2 Wh for a matching month', () => {
    const result = parseMonthsEntry(MONTHS_CONTENT, '2026-06');
    assert.deepEqual(result, { wr1Wh: 570240, wr2Wh: 282240 });
  });

  it('parses early year (2009-01) correctly', () => {
    const result = parseMonthsEntry(MONTHS_CONTENT, '2009-01');
    assert.deepEqual(result, { wr1Wh: 183132, wr2Wh: 97538 });
  });

  it('returns null when month is not found', () => {
    const result = parseMonthsEntry(MONTHS_CONTENT, '2026-03');
    assert.equal(result, null);
  });
});

// --- formatReport ---

describe('formatReport', () => {
  it('shows MATCH when totals are equal', () => {
    const out = formatReport('2026-06', { wr1Wh: 570240, wr2Wh: 282240 }, { wr1Wh: 570240, wr2Wh: 282240 }, 30);
    assert.ok(out.includes('MATCH'));
    assert.ok(out.includes('570240'));
    assert.ok(out.includes('282240'));
    assert.ok(out.includes('30 files'));
  });

  it('shows MISMATCH when totals differ', () => {
    const out = formatReport('2009-01', { wr1Wh: 183132, wr2Wh: 97538 }, { wr1Wh: 180000, wr2Wh: 96000 }, 31);
    assert.ok(out.includes('MISMATCH'));
    assert.ok(out.includes('183132'));
    assert.ok(out.includes('180000'));
  });

  it('shows signed diff values', () => {
    const out = formatReport('2026-06', { wr1Wh: 570240, wr2Wh: 282240 }, { wr1Wh: 570000, wr2Wh: 282000 }, 30);
    assert.ok(out.includes('+240'));
    assert.ok(out.includes('+240'));
  });
});
