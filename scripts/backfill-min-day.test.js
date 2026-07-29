import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFirstLine, findTemplate, scaleRecord, buildOutput } from './backfill-min-day.js';

// ---------------------------------------------------------------------------
// parseFirstLine
// ---------------------------------------------------------------------------

test('parseFirstLine: extracts wh1 and wh2 from a valid line', () => {
  const line = 'm[mi++]="08.09.09 19:55:00|16;38;12157;238|0;0;0;24129;0;0"';
  const result = parseFirstLine(line);
  assert.deepEqual(result, { wh1: 12157, wh2: 24129, total: 36286 });
});

test('parseFirstLine: returns null for a malformed line', () => {
  assert.equal(parseFirstLine('not a valid line'), null);
  assert.equal(parseFirstLine(''), null);
  assert.equal(parseFirstLine(null), null);
});

test('parseFirstLine: handles wh values of zero', () => {
  const line = 'm[mi++]="08.09.09 06:45:00|7;2375;4;324|0;0;0;0;0;0"';
  const result = parseFirstLine(line);
  assert.deepEqual(result, { wh1: 4, wh2: 0, total: 4 });
});

// ---------------------------------------------------------------------------
// findTemplate
// ---------------------------------------------------------------------------

/** Minimal candidate shape used in findTemplate tests. */
const makeCandidates = (entries) =>
  entries.map(([filename, total]) => ({ filename, total }));

test('findTemplate: returns closest candidate within tolerance', () => {
  const candidates = makeCandidates([
    ['min070908.js', 35600],  // 1.9% diff from 36286 → within 2%
    ['min080908.js', 38000],  // 4.7% diff → outside 2%
    ['min100908.js', 35000],  // 3.5% diff → outside 2%
  ]);
  const result = findTemplate(candidates, 36286, 0.02);
  assert.equal(result?.filename, 'min070908.js');
});

test('findTemplate: returns null when no candidate is within tolerance', () => {
  const candidates = makeCandidates([
    ['min070908.js', 30000],  // 17% diff
    ['min080908.js', 45000],  // 24% diff
  ]);
  const result = findTemplate(candidates, 36286, 0.02);
  assert.equal(result, null);
});

test('findTemplate: returns null for empty candidate list', () => {
  assert.equal(findTemplate([], 36286, 0.02), null);
});

test('findTemplate: exact match always selected', () => {
  const candidates = makeCandidates([
    ['min070908.js', 36286],
    ['min080908.js', 36000],
  ]);
  const result = findTemplate(candidates, 36286, 0.02);
  assert.equal(result?.filename, 'min070908.js');
});

// ---------------------------------------------------------------------------
// scaleRecord
// ---------------------------------------------------------------------------

test('scaleRecord: rewrites date, scales wh, zeros all other fields', () => {
  const line = 'm[mi++]="08.09.09 19:55:00|16;38;12157;238|0;17;13;24129;231;228"';
  const scale1 = 11764 / 12157;
  const scale2 = 23219 / 24129;
  const result = scaleRecord(line, '07.09.09', scale1, scale2);
  const expected = `m[mi++]="07.09.09 19:55:00|0;0;${Math.round(12157 * scale1)};0|0;0;0;${Math.round(24129 * scale2)};0;0"`;
  assert.equal(result, expected);
});

test('scaleRecord: handles zero wh in template without producing NaN', () => {
  const line = 'm[mi++]="08.09.09 06:45:00|7;2375;0;324|0;0;0;0;0;0"';
  const result = scaleRecord(line, '07.09.09', 1.5, 1.5);
  assert.equal(result, 'm[mi++]="07.09.09 06:45:00|0;0;0;0|0;0;0;0;0;0"');
});

test('scaleRecord: returns null for a malformed line', () => {
  assert.equal(scaleRecord('bad line', '07.09.09', 1, 1), null);
});

// ---------------------------------------------------------------------------
// buildOutput
// ---------------------------------------------------------------------------

test('buildOutput: applies scaleRecord to all lines and drops nulls', () => {
  const templateLines = [
    'm[mi++]="08.09.09 19:55:00|16;38;12157;238|0;17;13;24129;231;228"',
    'm[mi++]="08.09.09 06:45:00|7;2375;4;324|0;0;0;0;0;0"',
  ];
  const scale1 = 11764 / 12157;
  const scale2 = 23219 / 24129;
  const lines = buildOutput(templateLines, '07.09.09', scale1, scale2);
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('m[mi++]="07.09.09 19:55:00|0;0;'));
  assert.ok(lines[1].startsWith('m[mi++]="07.09.09 06:45:00|0;0;'));
});

test('buildOutput: filters out malformed template lines silently', () => {
  const templateLines = [
    'm[mi++]="08.09.09 19:55:00|16;38;12157;238|0;17;13;24129;231;228"',
    'not a valid line',
    'm[mi++]="08.09.09 06:45:00|7;2375;4;324|0;0;0;0;0;0"',
  ];
  const lines = buildOutput(templateLines, '07.09.09', 1, 1);
  assert.equal(lines.length, 2);
});
