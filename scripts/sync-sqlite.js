/**
 * sync-sqlite.js — sync SolarLog min*.js archive files into a local SQLite cache.
 *
 * Reads every dated minYYMMDD.js file (min_cur.js is a single real-time
 * snapshot in a different format — see docs/data-format.md — and is not
 * part of this sync), decodes each 5-minute record per its epoch's block
 * layout (see scripts/utils.js), and stores one row per inverter per
 * timestamp in `readings`, tracking per-day sync state via a content hash
 * so re-runs are idempotent and only changed/new days are re-processed.
 *
 * Reads `web/data/`/`web/hist/` off the filesystem — both were deleted from this repo's working
 * tree and `scripts/ftp-sync.js`/`sync-ftp` no longer fetch them (see README's "Validation &
 * Aggregation Scripts" section), so this script needs those directories manually repopulated
 * before it will find anything to sync.
 *
 * Usage:
 *   node scripts/sync-sqlite.js [--data-dir <path>] [--db <path>] [--dry-run]
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { epochFromDate } from './utils.js';

const MIN_FILE_RE = /^min(\d{2})(\d{2})(\d{2})\.js$/;
const RECORD_LINE_RE = /^(?:m\[mi\+\+\]=")?(\d{2})\.(\d{2})\.(\d{2}) (\d{2}:\d{2}:\d{2})\|([^|]+)\|([^"]+?)"?$/;

/**
 * Creates all tables and indexes for the sync cache, if they don't already exist.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {void}
 */
export function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_state (
      date TEXT PRIMARY KEY,
      source_file TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      record_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      inverter TEXT NOT NULL,
      pac_w INTEGER NOT NULL,
      pdc_str1_w INTEGER NOT NULL,
      pdc_str2_w INTEGER,
      daily_yield_wh INTEGER NOT NULL,
      udc_str1_v INTEGER,
      udc_str2_v INTEGER,
      epoch INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_readings_date ON readings(date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_readings_ts_inverter ON readings(timestamp, inverter);

    CREATE TABLE IF NOT EXISTS daily_yield_summary (
      date TEXT PRIMARY KEY,
      sb4200_yield_wh INTEGER NOT NULL,
      sb2100_yield_wh INTEGER NOT NULL,
      total_yield_wh INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monthly_yield_summary (
      month TEXT PRIMARY KEY,
      total_yield_wh INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS yearly_yield_summary (
      year TEXT PRIMARY KEY,
      total_yield_wh INTEGER NOT NULL
    );
  `);
}

/**
 * Decodes one inverter block's fields into a reading object, or null if any
 * numeric field fails to parse.
 *
 * @param {string[]} fields - Semicolon-split raw field strings.
 * @param {boolean} isSB4200 - True for the 2-string SB4200 TL block.
 * @param {string} date - ISO date (YYYY-MM-DD) for this record's file.
 * @param {string} timestamp - ISO 8601 timestamp for this record.
 * @param {number} epochNum - Epoch number (1, 2, or 3).
 * @returns {object | null}
 */
function decodeBlock(fields, isSB4200, date, timestamp, epochNum) {
  const nums = fields.map((f) => Number.parseInt(f, 10));
  if (nums.some((n) => Number.isNaN(n))) return null;
  if (isSB4200) {
    const [pac_w, pdc_str1_w, pdc_str2_w, daily_yield_wh, udc_str1_v, udc_str2_v] = nums;
    return {
      date,
      timestamp,
      inverter: 'sb4200',
      pac_w,
      pdc_str1_w,
      pdc_str2_w,
      daily_yield_wh,
      udc_str1_v: udc_str1_v ?? null,
      udc_str2_v: udc_str2_v ?? null,
      epoch: epochNum,
    };
  }
  const [pac_w, pdc_str1_w, daily_yield_wh, udc_str1_v] = nums;
  return {
    date,
    timestamp,
    inverter: 'sb2100',
    pac_w,
    pdc_str1_w,
    pdc_str2_w: null,
    daily_yield_wh,
    udc_str1_v: udc_str1_v ?? null,
    udc_str2_v: null,
    epoch: epochNum,
  };
}

/**
 * Parses one raw min-file record line into its two per-inverter reading rows.
 *
 * @param {string} line - Raw line, e.g. `m[mi++]="DD.MM.YY HH:MM:SS|block1|block2"`.
 * @param {string} date - ISO date (YYYY-MM-DD) of the source file this line came from.
 * @returns {object[] | null} Two reading objects (block order), or null if malformed.
 */
export function parseRecordLine(line, date) {
  const trimmed = line?.trim();
  if (!trimmed) return null;
  const match = RECORD_LINE_RE.exec(trimmed);
  if (!match) return null;
  const [, dd, mm, yy, time, b0raw, b1raw] = match;
  const epoch = epochFromDate(`${dd}.${mm}.${yy}`);
  if (!epoch) return null;
  const b0 = b0raw.split(';');
  const b1 = b1raw.split(';');
  if (b0.length !== epoch.b0Fields || b1.length !== epoch.b1Fields) return null;
  const timestamp = `${date}T${time}`;
  const rec0 = decodeBlock(b0, epoch.b0IsSB4200, date, timestamp, epoch.epoch);
  const rec1 = decodeBlock(b1, !epoch.b0IsSB4200, date, timestamp, epoch.epoch);
  if (!rec0 || !rec1) return null;
  return [rec0, rec1];
}

/**
 * Computes the sha256 hex digest of raw file content.
 *
 * @param {string | Buffer} content
 * @returns {string} hex-encoded sha256 digest.
 */
export function hashContent(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Lists dated minYYMMDD.js source files in a directory, sorted oldest-first.
 *
 * min_cur.js is intentionally excluded: it is a single real-time snapshot in
 * a different format (see docs/data-format.md), not a per-record archive file.
 *
 * @param {string} dataDir - Directory to scan.
 * @returns {{ filename: string, date: string, status: 'complete' }[]}
 */
export function listSourceFiles(dataDir) {
  return readdirSync(dataDir)
    .map((f) => MIN_FILE_RE.exec(f))
    .filter(Boolean)
    .map((m) => {
      const [, yy, mm, dd] = m;
      const yearNum = Number.parseInt(yy, 10);
      const yyyy = yearNum >= 6 ? 2000 + yearNum : 2100 + yearNum; // ponytail: 2106 ceiling
      return { filename: m[0], date: `${yyyy}-${mm}-${dd}`, status: /** @type {const} */ ('complete') };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Recomputes daily/monthly/yearly yield summaries for the given date from
 * `readings`, using INSERT OR REPLACE so the summaries stay consistent.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} date - ISO date (YYYY-MM-DD).
 * @returns {void}
 */
export function recomputeSummaries(db, date) {
  const month = date.slice(0, 7);
  const year = date.slice(0, 4);

  const lastFor = (inverter) =>
    db
      .prepare(
        `SELECT daily_yield_wh FROM readings WHERE date = ? AND inverter = ? ORDER BY timestamp DESC LIMIT 1`,
      )
      .get(date, inverter)?.daily_yield_wh ?? 0;

  const sb4200Wh = lastFor('sb4200');
  const sb2100Wh = lastFor('sb2100');
  const totalWh = sb4200Wh + sb2100Wh;

  db.prepare(
    `INSERT OR REPLACE INTO daily_yield_summary (date, sb4200_yield_wh, sb2100_yield_wh, total_yield_wh)
     VALUES (?, ?, ?, ?)`,
  ).run(date, sb4200Wh, sb2100Wh, totalWh);

  const monthTotal =
    db
      .prepare(`SELECT SUM(total_yield_wh) AS total FROM daily_yield_summary WHERE substr(date, 1, 7) = ?`)
      .get(month)?.total ?? 0;
  db.prepare(`INSERT OR REPLACE INTO monthly_yield_summary (month, total_yield_wh) VALUES (?, ?)`).run(
    month,
    monthTotal,
  );

  const yearTotal =
    db
      .prepare(`SELECT SUM(total_yield_wh) AS total FROM daily_yield_summary WHERE substr(date, 1, 4) = ?`)
      .get(year)?.total ?? 0;
  db.prepare(`INSERT OR REPLACE INTO yearly_yield_summary (year, total_yield_wh) VALUES (?, ?)`).run(
    year,
    yearTotal,
  );
}

/**
 * Syncs one day's file content into the database: replaces that date's
 * `readings` rows, refreshes `sync_state`, and recomputes yield summaries,
 * all inside a single transaction (rolled back on error).
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ date: string, sourceFile: string, content: string, status: 'complete' | 'current' }} params
 * @returns {{ recordCount: number, malformed: number }}
 */
export function syncDay(db, { date, sourceFile, content, status }) {
  const readings = [];
  let malformed = 0;

  content.split('\n').forEach((rawLine, i) => {
    const line = rawLine.trim();
    // Files sometimes contain non-record noise (config vars, blank lines, stray
    // HTTP response headers from archival scraping) interleaved with records —
    // only lines shaped like a record are candidates for the malformed count.
    if (!line.startsWith('m[mi++]=')) return;
    const parsed = parseRecordLine(line, date);
    if (!parsed) {
      malformed += 1;
      console.error(`WARN ${sourceFile}:${i + 1}: unable to decode record, skipping`);
      return;
    }
    readings.push(...parsed);
  });

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM readings WHERE date = ?').run(date);
    const insert = db.prepare(`
      INSERT INTO readings
        (date, timestamp, inverter, pac_w, pdc_str1_w, pdc_str2_w, daily_yield_wh, udc_str1_v, udc_str2_v, epoch)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of readings) {
      insert.run(
        r.date,
        r.timestamp,
        r.inverter,
        r.pac_w,
        r.pdc_str1_w,
        r.pdc_str2_w,
        r.daily_yield_wh,
        r.udc_str1_v,
        r.udc_str2_v,
        r.epoch,
      );
    }
    recomputeSummaries(db, date);
    db.prepare(`
      INSERT OR REPLACE INTO sync_state (date, source_file, content_hash, status, synced_at, record_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(date, sourceFile, hashContent(content), status, new Date().toISOString(), readings.length);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return { recordCount: readings.length, malformed };
}

/**
 * Runs a full sync pass: discovers source files, skips days whose content is
 * unchanged and already fully synced, and (re)syncs the rest.
 *
 * @param {{ dataDir: string, dbPath: string, dryRun?: boolean }} params
 * @returns {{ inserted: number, updated: number, unchanged: number, malformed: number }}
 */
export function runSync({ dataDir, dbPath, dryRun = false }) {
  if (!existsSync(dataDir)) {
    throw new Error(`--data-dir does not exist: ${dataDir}`);
  }
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  createSchema(db);

  const summary = { inserted: 0, updated: 0, unchanged: 0, malformed: 0 };

  for (const file of listSourceFiles(dataDir)) {
    const content = readFileSync(join(dataDir, file.filename), 'utf8');
    const hash = hashContent(content);
    const existing = db.prepare('SELECT * FROM sync_state WHERE date = ?').get(file.date);

    if (existing?.status === 'complete' && existing.content_hash === hash) {
      summary.unchanged += 1;
      continue;
    }

    if (dryRun) {
      if (existing) summary.updated += 1;
      else summary.inserted += 1;
      continue;
    }

    const result = syncDay(db, { date: file.date, sourceFile: file.filename, content, status: file.status });
    summary.malformed += result.malformed;
    if (existing) summary.updated += 1;
    else summary.inserted += 1;
  }

  return summary;
}

/**
 * Queries all 5-minute AC-power readings for one day (Mode 0 — daily view).
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} date - ISO date (YYYY-MM-DD).
 * @returns {object[]}
 */
export function queryDaily(db, date) {
  return db
    .prepare(
      `SELECT
         timestamp,
         MAX(CASE WHEN inverter = 'sb4200' THEN pac_w END) AS sb4200_pac_w,
         MAX(CASE WHEN inverter = 'sb2100' THEN pac_w END) AS sb2100_pac_w,
         SUM(pac_w) AS total_pac_w
       FROM readings
       WHERE date = ?
       GROUP BY timestamp
       ORDER BY timestamp`,
    )
    .all(date);
}

/**
 * Queries per-day yield summaries for one month (Mode 1 — monthly view).
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} month - ISO month (YYYY-MM).
 * @returns {object[]}
 */
export function queryMonthly(db, month) {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return db
    .prepare(
      `SELECT date, sb4200_yield_wh, sb2100_yield_wh, total_yield_wh
       FROM daily_yield_summary
       WHERE date >= ? AND date < ?
       ORDER BY date`,
    )
    .all(`${month}-01`, `${next}-01`);
}

/**
 * Queries per-month combined yield totals for one year (Mode 2 — yearly view).
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {string} year - Four-digit year (YYYY).
 * @returns {object[]}
 */
export function queryYearly(db, year) {
  return db
    .prepare(
      `SELECT month, total_yield_wh
       FROM monthly_yield_summary
       WHERE substr(month, 1, 4) = ?
       ORDER BY month`,
    )
    .all(year);
}

/**
 * Queries per-year combined yield totals for the whole archive (Mode 3 — total view).
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {object[]}
 */
export function queryTotal(db) {
  return db.prepare(`SELECT year, total_yield_wh FROM yearly_yield_summary ORDER BY year`).all();
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      'data-dir': { type: 'string', default: '.' },
      db: { type: 'string', default: 'data/solarlog.sqlite3' },
      'dry-run': { type: 'boolean', default: false },
    },
  });

  try {
    const summary = runSync({ dataDir: values['data-dir'], dbPath: values.db, dryRun: values['dry-run'] });
    const days = summary.inserted + summary.updated;
    console.log(
      `Synced ${days} day(s): ${summary.inserted} inserted, ${summary.updated} updated, ` +
        `${summary.unchanged} unchanged (skipped), ${summary.malformed} malformed records`,
    );
    process.exit(0);
  } catch (err) {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
  }
}
