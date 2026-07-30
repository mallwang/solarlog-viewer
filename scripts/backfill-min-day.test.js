import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findTemplate, scaleRecord, buildOutput } from './backfill-min-day.js';
import { parseMinFirstLine, epochFromDate } from './utils.js';

// Epoch descriptors used across tests.
const EP1 = epochFromDate('03.11.06'); // Epoch 1: 4|4, b0=SB2100
const EP2 = epochFromDate('13.04.09'); // Epoch 2: 4|6, b0=SB2100
const EP3 = epochFromDate('01.07.25'); // Epoch 3: 6|4, b0=SB4200

// ---------------------------------------------------------------------------
// parseMinFirstLine (shared util — tested here for backfill-specific fixtures)
// ---------------------------------------------------------------------------

test('parseMinFirstLine: extracts sb4200Wh and sb2100Wh from an Epoch 2 line (4|6)', () => { // NOSONAR
  // block0=SB2100(4f): Wh at index 2 = 12157; block1=SB4200(6f): Wh at index 3 = 24129
  const line = 'm[mi++]="08.09.09 19:55:00|16;38;12157;238|0;0;0;24129;0;0"';
  const result = parseMinFirstLine(line);
  assert.deepEqual(result, { sb4200Wh: 24129, sb2100Wh: 12157, totalWh: 36286, wr1Wh: 12157, wr2Wh: 24129 });
});

test('parseMinFirstLine: returns null for a malformed line', () => { // NOSONAR
  assert.equal(parseMinFirstLine('not a valid line'), null);
  assert.equal(parseMinFirstLine(''), null);
  assert.equal(parseMinFirstLine(null), null);
});

test('parseMinFirstLine: handles wh values of zero', () => { // NOSONAR
  // block0=SB2100(4f): Wh=4; block1=SB4200(6f): Wh=0
  const line = 'm[mi++]="08.09.09 06:45:00|7;2375;4;324|0;0;0;0;0;0"';
  const result = parseMinFirstLine(line);
  assert.deepEqual(result, { sb4200Wh: 0, sb2100Wh: 4, totalWh: 4, wr1Wh: 4, wr2Wh: 0 });
});

// ---------------------------------------------------------------------------
// findTemplate
// ---------------------------------------------------------------------------

/** Minimal candidate shape used in findTemplate tests. */
const makeCandidates = (entries) =>
  entries.map(([filename, total]) => ({ filename, total }));

test('findTemplate: returns closest candidate within tolerance', () => { // NOSONAR
  const candidates = makeCandidates([
    ['min070908.js', 35600],  // 1.9% diff from 36286 → within 2%
    ['min080908.js', 38000],  // 4.7% diff → outside 2%
    ['min100908.js', 35000],  // 3.5% diff → outside 2%
  ]);
  const result = findTemplate(candidates, 36286, 0.02);
  assert.equal(result?.filename, 'min070908.js');
});

test('findTemplate: returns null when no candidate is within tolerance', () => { // NOSONAR
  const candidates = makeCandidates([
    ['min070908.js', 30000],  // 17% diff
    ['min080908.js', 45000],  // 24% diff
  ]);
  const result = findTemplate(candidates, 36286, 0.02);
  assert.equal(result, null);
});

test('findTemplate: returns null for empty candidate list', () => { // NOSONAR
  assert.equal(findTemplate([], 36286, 0.02), null);
});

test('findTemplate: exact match always selected', () => { // NOSONAR
  const candidates = makeCandidates([
    ['min070908.js', 36286],
    ['min080908.js', 36000],
  ]);
  const result = findTemplate(candidates, 36286, 0.02);
  assert.equal(result?.filename, 'min070908.js');
});

// ---------------------------------------------------------------------------
// scaleRecord — same-epoch (Epoch 2 template → Epoch 2 output)
// ---------------------------------------------------------------------------

test('scaleRecord: Epoch 2 → Epoch 2: rewrites date, scales wh, zeros all other fields', () => { // NOSONAR
  // block0=SB2100(4f) Wh=12157, block1=SB4200(6f) Wh=24129
  const line = 'm[mi++]="08.09.09 19:55:00|16;38;12157;238|0;17;13;24129;231;228"';
  const sb4200Scale = 23219 / 24129;
  const sb2100Scale = 11764 / 12157;
  const result = scaleRecord(line, '07.09.09', EP2, sb4200Scale, sb2100Scale);
  // output: block0=SB2100(4f) 0;0;sb2100Wh;0 | block1=SB4200(6f) 0;0;0;sb4200Wh;0;0
  const outSB2100 = Math.round(12157 * sb2100Scale);
  const outSB4200 = Math.round(24129 * sb4200Scale);
  assert.equal(result, `m[mi++]="07.09.09 19:55:00|0;0;${outSB2100};0|0;0;0;${outSB4200};0;0"`);
});

test('scaleRecord: Epoch 2 → Epoch 2: handles zero wh in template without producing NaN', () => { // NOSONAR
  const line = 'm[mi++]="08.09.09 06:45:00|7;2375;0;324|0;0;0;0;0;0"';
  const result = scaleRecord(line, '07.09.09', EP2, 1.5, 1.5);
  assert.equal(result, 'm[mi++]="07.09.09 06:45:00|0;0;0;0|0;0;0;0;0;0"');
});

test('scaleRecord: returns null for a malformed line', () => { // NOSONAR
  assert.equal(scaleRecord('bad line', '07.09.09', EP2, 1, 1), null);
});

// ---------------------------------------------------------------------------
// scaleRecord — cross-epoch (Epoch 2 template → Epoch 3 output)
// ---------------------------------------------------------------------------

test('scaleRecord: Epoch 2 → Epoch 3: block order swaps, field counts change', () => { // NOSONAR
  // Epoch 2 source: block0=SB2100(4f) Wh=12157, block1=SB4200(6f) Wh=24129
  const line = 'm[mi++]="08.09.09 19:55:00|16;38;12157;238|0;17;13;24129;231;228"';
  const sb4200Scale = 2;
  const sb2100Scale = 3;
  const result = scaleRecord(line, '01.01.13', EP3, sb4200Scale, sb2100Scale);
  // Epoch 3 output: block0=SB4200(6f) 0;0;0;sb4200Wh;0;0 | block1=SB2100(4f) 0;0;sb2100Wh;0
  const outSB4200 = Math.round(24129 * sb4200Scale);
  const outSB2100 = Math.round(12157 * sb2100Scale);
  assert.equal(result, `m[mi++]="01.01.13 19:55:00|0;0;0;${outSB4200};0;0|0;0;${outSB2100};0"`);
});

test('scaleRecord: Epoch 3 → Epoch 1: block order swaps, SB4200 loses UDC columns', () => { // NOSONAR
  // Epoch 3 source: block0=SB4200(6f) Wh=9293, block1=SB2100(4f) Wh=4866
  const line = 'm[mi++]="01.07.25 13:00:00|3053;1592;1593;9293;347;338|1572;1693;4866;348"';
  const sb4200Scale = 0.5;
  const sb2100Scale = 0.5;
  const result = scaleRecord(line, '15.11.06', EP1, sb4200Scale, sb2100Scale);
  // Epoch 1 output: block0=SB2100(4f) 0;0;sb2100Wh;0 | block1=SB4200(4f) 0;0;0;sb4200Wh
  const outSB2100 = Math.round(4866 * sb2100Scale);
  const outSB4200 = Math.round(9293 * sb4200Scale);
  assert.equal(result, `m[mi++]="15.11.06 13:00:00|0;0;${outSB2100};0|0;0;0;${outSB4200}"`);
});

// ---------------------------------------------------------------------------
// buildOutput
// ---------------------------------------------------------------------------

test('buildOutput: applies scaleRecord to all lines and drops nulls', () => { // NOSONAR
  const templateLines = [
    'm[mi++]="08.09.09 19:55:00|16;38;12157;238|0;17;13;24129;231;228"',
    'm[mi++]="08.09.09 06:45:00|7;2375;4;324|0;0;0;0;0;0"',
  ];
  const lines = buildOutput(templateLines, '07.09.09', EP2, 23219 / 24129, 11764 / 12157);
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('m[mi++]="07.09.09 19:55:00|0;0;'));
  assert.ok(lines[1].startsWith('m[mi++]="07.09.09 06:45:00|0;0;'));
});

test('buildOutput: filters out malformed template lines silently', () => { // NOSONAR
  const templateLines = [
    'm[mi++]="08.09.09 19:55:00|16;38;12157;238|0;17;13;24129;231;228"',
    'not a valid line',
    'm[mi++]="08.09.09 06:45:00|7;2375;4;324|0;0;0;0;0;0"',
  ];
  const lines = buildOutput(templateLines, '07.09.09', EP2, 1, 1);
  assert.equal(lines.length, 2);
});
