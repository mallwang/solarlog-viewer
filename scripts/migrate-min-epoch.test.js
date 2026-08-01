import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLine, blockToReading, formatEpoch3Blocks, migrateLine, migrateContent } from './migrate-min-epoch.js';

// Fixture lines taken verbatim from docs/data-format-daily.md concrete examples,
// plus the Epoch 1 example from min060315.js.

// ---------------------------------------------------------------------------
// parseLine
// ---------------------------------------------------------------------------

test('parseLine: parses date, time and both blocks', () => { // NOSONAR
  const line = 'm[mi++]="15.03.06 19:45:00|0;0;2421;0|0;0;0;4733"';
  assert.deepEqual(parseLine(line), {
    date: '15.03.06',
    time: '19:45:00',
    b0: ['0', '0', '2421', '0'],
    b1: ['0', '0', '0', '4733'],
  });
});

test('parseLine: returns null for a malformed line', () => { // NOSONAR
  assert.equal(parseLine('not a min line'), null);
});

test('parseLine: returns null for empty input', () => { // NOSONAR
  assert.equal(parseLine(''), null);
});

// ---------------------------------------------------------------------------
// blockToReading
// ---------------------------------------------------------------------------

test('blockToReading: SB2100 block (4 fields, all epochs)', () => { // NOSONAR
  assert.deepEqual(blockToReading(['0', '0', '2421', '0'], false), {
    pac: 0, pdc1: 0, pdc2: null, wh: 2421, udc1: 0, udc2: null,
  });
});

test('blockToReading: SB4200 block, 4 fields (Epoch 1, no UDC)', () => { // NOSONAR
  assert.deepEqual(blockToReading(['0', '0', '0', '4733'], true), {
    pac: 0, pdc1: 0, pdc2: 0, wh: 4733, udc1: null, udc2: null,
  });
});

test('blockToReading: SB4200 block, 6 fields (Epoch 2/3, with UDC)', () => { // NOSONAR
  assert.deepEqual(blockToReading(['3295', '1732', '1731', '9868', '352', '351'], true), {
    pac: 3295, pdc1: 1732, pdc2: 1731, wh: 9868, udc1: 352, udc2: 351,
  });
});

// ---------------------------------------------------------------------------
// formatEpoch3Blocks
// ---------------------------------------------------------------------------

test('formatEpoch3Blocks: fills missing UDC with 0 for Epoch 1 SB4200 reading', () => { // NOSONAR
  const sb4200 = { pac: 0, pdc1: 0, pdc2: 0, wh: 4733, udc1: null, udc2: null };
  const sb2100 = { pac: 0, pdc1: 0, pdc2: null, wh: 2421, udc1: 0, udc2: null };
  assert.deepEqual(formatEpoch3Blocks(sb4200, sb2100), ['0;0;0;4733;0;0', '0;0;2421;0']);
});

test('formatEpoch3Blocks: passes through already-populated UDC fields unchanged', () => { // NOSONAR
  const sb4200 = { pac: 3295, pdc1: 1732, pdc2: 1731, wh: 9868, udc1: 352, udc2: 351 };
  const sb2100 = { pac: 1692, pdc1: 1829, pdc2: null, wh: 4828, udc1: 358, udc2: null };
  assert.deepEqual(formatEpoch3Blocks(sb4200, sb2100), ['3295;1732;1731;9868;352;351', '1692;1829;4828;358']);
});

// ---------------------------------------------------------------------------
// migrateLine
// ---------------------------------------------------------------------------

test('migrateLine: Epoch 1 line (block0=SB2100, block1=SB4200) → Epoch 3 layout', () => { // NOSONAR
  const line = 'm[mi++]="15.03.06 19:45:00|0;0;2421;0|0;0;0;4733"';
  const result = migrateLine(line);
  assert.equal(result.error, null);
  assert.equal(result.line, 'm[mi++]="15.03.06 19:45:00|0;0;0;4733;0;0|0;0;2421;0"');
  assert.equal(result.sb4200Wh, 4733);
  assert.equal(result.sb2100Wh, 2421);
});

test('migrateLine: Epoch 2 line (block0=SB2100, block1=SB4200+UDC) → Epoch 3 layout', () => { // NOSONAR
  const line = 'm[mi++]="13.04.09 13:00:00|1692;1829;4828;358|3295;1732;1731;9868;352;351"';
  const result = migrateLine(line);
  assert.equal(result.error, null);
  assert.equal(result.line, 'm[mi++]="13.04.09 13:00:00|3295;1732;1731;9868;352;351|1692;1829;4828;358"');
});

test('migrateLine: Epoch 3 line is already in target layout → passes through unchanged', () => { // NOSONAR
  const line = 'm[mi++]="01.07.25 13:00:00|3053;1592;1593;9293;347;338|1572;1693;4866;348"';
  const result = migrateLine(line);
  assert.equal(result.error, null);
  assert.equal(result.line, line);
});

test('migrateLine: returns an error for a malformed line', () => { // NOSONAR
  const result = migrateLine('not a min line');
  assert.match(result.error, /malformed/i);
  assert.equal(result.line, null);
});

test('migrateLine: returns an error for an unrecognized field-count combination', () => { // NOSONAR
  const line = 'm[mi++]="01.01.06 12:00:00|1;2;3|4;5;6"';
  const result = migrateLine(line);
  assert.match(result.error, /epoch/i);
  assert.equal(result.line, null);
});

// ---------------------------------------------------------------------------
// migrateContent
// ---------------------------------------------------------------------------

test('migrateContent: migrates every line and reports the source epoch', () => { // NOSONAR
  const content = [
    'm[mi++]="15.03.06 19:45:00|0;0;2421;0|0;0;0;4733"',
    'm[mi++]="15.03.06 19:40:00|0;0;2421;0|0;0;0;4733"',
  ].join('\n');
  const result = migrateContent(content);
  assert.equal(result.epoch, 1);
  assert.equal(result.lines.length, 2);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.lines[0], 'm[mi++]="15.03.06 19:45:00|0;0;0;4733;0;0|0;0;2421;0"');
});

test('migrateContent: skips blank lines', () => { // NOSONAR
  const content = 'm[mi++]="15.03.06 19:45:00|0;0;2421;0|0;0;0;4733"\n\n';
  const result = migrateContent(content);
  assert.equal(result.lines.length, 1);
});

test('migrateContent: warns when SB2100 Wh exceeds SB4200 Wh on the identifying line', () => { // NOSONAR
  // block0 identified as SB2100 (Epoch 1) but reports a higher Wh than block1 (SB4200) — suspicious.
  const content = 'm[mi++]="15.03.06 19:45:00|0;0;9999;0|0;0;0;100"';
  const result = migrateContent(content);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /SB2100.*SB4200|greater/i);
});

test('migrateContent: collects per-line errors without throwing', () => { // NOSONAR
  const content = [
    'm[mi++]="15.03.06 19:45:00|0;0;2421;0|0;0;0;4733"',
    'not a min line',
  ].join('\n');
  const result = migrateContent(content);
  assert.equal(result.lines.length, 1);
  assert.equal(result.errors.length, 1);
});

test('migrateContent: returns a top-level error when the epoch cannot be determined', () => { // NOSONAR
  const result = migrateContent('m[mi++]="01.01.06 12:00:00|1;2;3|4;5;6"');
  assert.match(result.fatalError, /epoch/i);
});
