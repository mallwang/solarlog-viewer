import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMinFirstLine, epochFromDate, epochFromFieldCounts } from './utils.js';

// Fixture lines taken verbatim from docs/data-format-daily.md concrete examples.

// ---------------------------------------------------------------------------
// parseMinFirstLine
// ---------------------------------------------------------------------------

test('parseMinFirstLine: Epoch 1 (4|4) SB2100 block0, SB4200 block1', () => { // NOSONAR
  const line = 'm[mi++]="03.11.06 15:00:00|1314;1399;6653;406|2529;1346;1339;13059"';
  // block0=SB2100 → sb2100Wh=6653; block1=SB4200(4f) → sb4200Wh=13059
  assert.deepEqual(parseMinFirstLine(line), { sb4200Wh: 13059, sb2100Wh: 6653, totalWh: 19712, wr1Wh: 6653, wr2Wh: 13059 });
});

test('parseMinFirstLine: Epoch 2 (4|6) SB2100 block0, SB4200+UDC block1', () => { // NOSONAR
  const line = 'm[mi++]="13.04.09 13:00:00|1692;1829;4828;358|3295;1732;1731;9868;352;351"';
  // block0=SB2100 → sb2100Wh=4828; block1=SB4200(6f) → sb4200Wh=9868
  assert.deepEqual(parseMinFirstLine(line), { sb4200Wh: 9868, sb2100Wh: 4828, totalWh: 14696, wr1Wh: 4828, wr2Wh: 9868 });
});

test('parseMinFirstLine: Epoch 3 (6|4) SB4200 block0, SB2100 block1', () => { // NOSONAR
  const line = 'm[mi++]="01.07.25 13:00:00|3053;1592;1593;9293;347;338|1572;1693;4866;348"';
  // block0=SB4200(6f) → sb4200Wh=9293; block1=SB2100 → sb2100Wh=4866
  assert.deepEqual(parseMinFirstLine(line), { sb4200Wh: 9293, sb2100Wh: 4866, totalWh: 14159, wr1Wh: 9293, wr2Wh: 4866 });
});

test('parseMinFirstLine: returns null for a malformed line', () => { // NOSONAR
  assert.equal(parseMinFirstLine('not a min line'), null);
});

test('parseMinFirstLine: returns null for empty input', () => { // NOSONAR
  assert.equal(parseMinFirstLine(''), null);
});

test('parseMinFirstLine: accepts full file content and reads the first line', () => { // NOSONAR
  const content =
    'm[mi++]="01.07.25 13:00:00|3053;1592;1593;9293;347;338|1572;1693;4866;348"\n' +
    'm[mi++]="01.07.25 12:55:00|2900;1500;1500;9000;340;330|1400;1600;4500;340"\n';
  assert.deepEqual(parseMinFirstLine(content), { sb4200Wh: 9293, sb2100Wh: 4866, totalWh: 14159, wr1Wh: 9293, wr2Wh: 4866 });
});

// ---------------------------------------------------------------------------
// epochFromDate
// ---------------------------------------------------------------------------

test('epochFromDate: 2006-11-03 → Epoch 1 (first file date)', () => { // NOSONAR
  assert.equal(epochFromDate('03.11.06')?.epoch, 1);
});

test('epochFromDate: 2007-03-27 → Epoch 1 (last Epoch 1 date)', () => { // NOSONAR
  assert.equal(epochFromDate('27.03.07')?.epoch, 1);
});

test('epochFromDate: 2007-03-28 → Epoch 2 (first Epoch 2 date)', () => { // NOSONAR
  assert.equal(epochFromDate('28.03.07')?.epoch, 2);
});

test('epochFromDate: 2012-12-04 → Epoch 2 (last Epoch 2 date)', () => { // NOSONAR
  assert.equal(epochFromDate('04.12.12')?.epoch, 2);
});

test('epochFromDate: 2013-01-04 → Epoch 3 (first Epoch 3 date)', () => { // NOSONAR
  assert.equal(epochFromDate('04.01.13')?.epoch, 3);
});

test('epochFromDate: 2025-07-01 → Epoch 3 (recent date)', () => { // NOSONAR
  assert.equal(epochFromDate('01.07.25')?.epoch, 3);
});

test('epochFromDate: returns null for malformed date', () => { // NOSONAR
  assert.equal(epochFromDate('bad'), null);
});

// ---------------------------------------------------------------------------
// epochFromFieldCounts
// ---------------------------------------------------------------------------

test('epochFromFieldCounts: 4,4 → Epoch 1', () => { // NOSONAR
  assert.equal(epochFromFieldCounts(4, 4)?.epoch, 1);
});

test('epochFromFieldCounts: 4,6 → Epoch 2', () => { // NOSONAR
  assert.equal(epochFromFieldCounts(4, 6)?.epoch, 2);
});

test('epochFromFieldCounts: 6,4 → Epoch 3', () => { // NOSONAR
  assert.equal(epochFromFieldCounts(6, 4)?.epoch, 3);
});

test('epochFromFieldCounts: unknown combination → null', () => { // NOSONAR
  assert.equal(epochFromFieldCounts(3, 3), null);
});
