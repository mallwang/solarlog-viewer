import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  createSchema,
  parseRecordLine,
  hashContent,
  listSourceFiles,
  syncDay,
  runSync,
  recomputeSummaries,
  queryDaily,
  queryMonthly,
  queryYearly,
  queryTotal,
} from './sync-sqlite.js';

const EPOCH1_LINE = '03.11.06 15:00:00|1314;1399;6653;406|2529;1346;1339;13059';
const EPOCH2_LINE = '13.04.09 13:00:00|1692;1829;4828;358|3295;1732;1731;9868;352;351';
const EPOCH3_LINE = '05.01.13 12:00:00|3295;1732;1731;9868;352;351|1692;1829;4828;358';

// Real min*.js files wrap each record as m[mi++]="..."; syncDay/runSync fixtures
// mirror that so the m[mi++]= sniff that filters out non-record file noise applies.
const record = (line) => `m[mi++]="${line}"`;

function tableNames(db) {
  return db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .all()
    .map((r) => r.name)
    .sort();
}

test('createSchema creates all tables and indexes', () => {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  assert.deepEqual(tableNames(db), [
    'daily_yield_summary',
    'monthly_yield_summary',
    'readings',
    'sync_state',
    'yearly_yield_summary',
  ]);
  const indexes = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'index'`)
    .all()
    .map((r) => r.name);
  assert.ok(indexes.includes('idx_readings_date'));
  assert.ok(indexes.includes('idx_readings_ts_inverter'));
});

test('parseRecordLine decodes an epoch-1 line into sb2100 and sb4200 readings', () => {
  const [sb2100, sb4200] = parseRecordLine(EPOCH1_LINE, '2006-11-03');
  assert.equal(sb2100.inverter, 'sb2100');
  assert.equal(sb2100.pac_w, 1314);
  assert.equal(sb2100.pdc_str1_w, 1399);
  assert.equal(sb2100.daily_yield_wh, 6653);
  assert.equal(sb2100.udc_str1_v, 406);
  assert.equal(sb2100.pdc_str2_w, null);
  assert.equal(sb2100.udc_str2_v, null);
  assert.equal(sb2100.epoch, 1);

  assert.equal(sb4200.inverter, 'sb4200');
  assert.equal(sb4200.pac_w, 2529);
  assert.equal(sb4200.pdc_str1_w, 1346);
  assert.equal(sb4200.pdc_str2_w, 1339);
  assert.equal(sb4200.daily_yield_wh, 13059);
  assert.equal(sb4200.udc_str1_v, null);
  assert.equal(sb4200.udc_str2_v, null);
  assert.equal(sb4200.timestamp, '2006-11-03T15:00:00');
});

test('parseRecordLine decodes an epoch-3 line with swapped block identity', () => {
  const [first, second] = parseRecordLine(EPOCH3_LINE, '2013-01-05');
  assert.equal(first.inverter, 'sb4200');
  assert.equal(first.pac_w, 3295);
  assert.equal(second.inverter, 'sb2100');
  assert.equal(second.pac_w, 1692);
});

test('parseRecordLine returns null for a malformed line', () => {
  assert.equal(parseRecordLine('not a valid line', '2006-11-03'), null);
  assert.equal(parseRecordLine('03.11.06 15:00:00|1;2;3|1;2;3', '2006-11-03'), null);
  assert.equal(parseRecordLine('', '2006-11-03'), null);
});

test('hashContent returns the sha256 hex digest of the given bytes', () => {
  const expected = createHash('sha256').update('hello world').digest('hex');
  assert.equal(hashContent('hello world'), expected);
});

test('listSourceFiles returns only dated min*.js files, sorted, excluding min_cur.js', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sync-sqlite-'));
  try {
    writeFileSync(join(dir, 'min070328.js'), record(EPOCH2_LINE));
    writeFileSync(join(dir, 'min061103.js'), record(EPOCH1_LINE));
    writeFileSync(join(dir, 'min_cur.js'), 'var Datum="29.07.26"');
    writeFileSync(join(dir, 'days.js'), 'unrelated');

    const files = listSourceFiles(dir);
    assert.deepEqual(
      files.map((f) => f.filename),
      ['min061103.js', 'min070328.js'],
    );
    assert.equal(files[0].date, '2006-11-03');
    assert.equal(files[0].status, 'complete');
    assert.equal(files[1].date, '2007-03-28');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('syncDay inserts readings and a sync_state row', () => {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const content = [record(EPOCH1_LINE), record(EPOCH2_LINE)].join('\n');
  const result = syncDay(db, { date: '2006-11-03', sourceFile: 'min061103.js', content, status: 'complete' });
  assert.equal(result.recordCount, 4);
  assert.equal(result.malformed, 0);

  const readings = db.prepare('SELECT * FROM readings WHERE date = ?').all('2006-11-03');
  assert.equal(readings.length, 4);

  const state = db.prepare('SELECT * FROM sync_state WHERE date = ?').get('2006-11-03');
  assert.equal(state.source_file, 'min061103.js');
  assert.equal(state.status, 'complete');
  assert.equal(state.record_count, 4);
  assert.equal(state.content_hash, hashContent(content));
});

test('syncDay skips and counts malformed lines without aborting the day', () => {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const content = [record(EPOCH1_LINE), 'm[mi++]="garbage line"', record(EPOCH2_LINE)].join('\n');
  const result = syncDay(db, { date: '2006-11-03', sourceFile: 'min061103.js', content, status: 'complete' });
  assert.equal(result.recordCount, 4);
  assert.equal(result.malformed, 1);
});

test('syncDay replaces existing readings for the date (delete-then-reinsert)', () => {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  syncDay(db, { date: '2006-11-03', sourceFile: 'min061103.js', content: record(EPOCH1_LINE), status: 'complete' });
  syncDay(db, { date: '2006-11-03', sourceFile: 'min061103.js', content: record(EPOCH1_LINE), status: 'complete' });
  const readings = db.prepare('SELECT * FROM readings WHERE date = ?').all('2006-11-03');
  assert.equal(readings.length, 2);
});

test('runSync performs a full sync across epoch-1/2/3 fixture files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sync-sqlite-'));
  try {
    writeFileSync(join(dir, 'min061103.js'), record(EPOCH1_LINE));
    writeFileSync(join(dir, 'min090413.js'), record(EPOCH2_LINE));
    writeFileSync(join(dir, 'min130105.js'), record(EPOCH3_LINE));

    const summary = runSync({ dataDir: dir, dbPath: ':memory:' });
    assert.equal(summary.inserted, 3);
    assert.equal(summary.updated, 0);
    assert.equal(summary.unchanged, 0);
    assert.equal(summary.malformed, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runSync is idempotent: second run with no changes reports 0 inserted/updated', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sync-sqlite-'));
  try {
    writeFileSync(join(dir, 'min061103.js'), record(EPOCH1_LINE));
    const dbPath = join(dir, 'test.sqlite3');

    const first = runSync({ dataDir: dir, dbPath });
    assert.equal(first.inserted, 1);

    const second = runSync({ dataDir: dir, dbPath });
    assert.equal(second.inserted, 0);
    assert.equal(second.updated, 0);
    assert.equal(second.unchanged, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runSync detects a changed file and refreshes that day only (updated, not unchanged)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sync-sqlite-'));
  try {
    writeFileSync(join(dir, 'min061103.js'), record(EPOCH1_LINE));
    const dbPath = join(dir, 'test.sqlite3');
    runSync({ dataDir: dir, dbPath });

    const secondRecord = EPOCH1_LINE.replace('15:00:00', '15:05:00');
    writeFileSync(join(dir, 'min061103.js'), record(EPOCH1_LINE) + '\n' + record(secondRecord));
    const second = runSync({ dataDir: dir, dbPath });
    assert.equal(second.updated, 1);
    assert.equal(second.unchanged, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runSync delta sync only inserts the new day, leaving prior days untouched', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sync-sqlite-'));
  try {
    writeFileSync(join(dir, 'min061103.js'), record(EPOCH1_LINE));
    const dbPath = join(dir, 'test.sqlite3');
    runSync({ dataDir: dir, dbPath });

    const db = new DatabaseSync(dbPath);
    const before = db.prepare('SELECT synced_at FROM sync_state WHERE date = ?').get('2006-11-03');

    writeFileSync(join(dir, 'min061104.js'), record(EPOCH1_LINE.replace('03.11.06', '04.11.06')));
    const second = runSync({ dataDir: dir, dbPath });
    assert.equal(second.inserted, 1);
    assert.equal(second.unchanged, 1);

    const after = db.prepare('SELECT synced_at FROM sync_state WHERE date = ?').get('2006-11-03');
    assert.equal(before.synced_at, after.synced_at);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('recomputeSummaries derives daily/monthly/yearly totals from readings', () => {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  const insert = db.prepare(`
    INSERT INTO readings
      (date, timestamp, inverter, pac_w, pdc_str1_w, pdc_str2_w, daily_yield_wh, udc_str1_v, udc_str2_v, epoch)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run('2006-11-03', '2006-11-03T15:00:00', 'sb2100', 1314, 1399, null, 6653, 406, null, 1);
  insert.run('2006-11-03', '2006-11-03T15:00:00', 'sb4200', 2529, 1346, 1339, 13059, null, null, 1);

  recomputeSummaries(db, '2006-11-03');

  const daily = db.prepare('SELECT * FROM daily_yield_summary WHERE date = ?').get('2006-11-03');
  assert.equal(daily.sb2100_yield_wh, 6653);
  assert.equal(daily.sb4200_yield_wh, 13059);
  assert.equal(daily.total_yield_wh, 6653 + 13059);

  const monthly = db.prepare('SELECT * FROM monthly_yield_summary WHERE month = ?').get('2006-11');
  assert.equal(monthly.total_yield_wh, 6653 + 13059);

  const yearly = db.prepare('SELECT * FROM yearly_yield_summary WHERE year = ?').get('2006');
  assert.equal(yearly.total_yield_wh, 6653 + 13059);
});

test('query helpers match the documented contracts', () => {
  const db = new DatabaseSync(':memory:');
  createSchema(db);
  syncDay(db, { date: '2006-11-03', sourceFile: 'min061103.js', content: record(EPOCH1_LINE), status: 'complete' });

  const daily = queryDaily(db, '2006-11-03');
  assert.equal(daily.length, 1);
  assert.equal(daily[0].sb2100_pac_w, 1314);
  assert.equal(daily[0].sb4200_pac_w, 2529);
  assert.equal(daily[0].total_pac_w, 1314 + 2529);

  const monthly = queryMonthly(db, '2006-11');
  assert.equal(monthly.length, 1);
  assert.equal(monthly[0].date, '2006-11-03');

  const yearly = queryYearly(db, '2006');
  assert.equal(yearly.length, 1);
  assert.equal(yearly[0].month, '2006-11');

  const total = queryTotal(db);
  assert.equal(total.length, 1);
  assert.equal(total[0].year, '2006');
});
