/**
 * validate-min-consistency.js — internal-consistency checks for minYYMMDD.js files.
 *
 * For every min file, verifies:
 *   1. every line starts with `m[mi++]="`
 *   2. every line's date field matches the filename's date
 *   3. every line matches the Epoch 3 block layout (6 fields | 4 fields)
 *   4. consecutive lines are exactly 5 minutes apart
 *   5. the last (earliest, "lowest") line has near-zero Wh (start of the inverters)
 *   6. cumulative Wh never decreases further down the file (further back in time)
 *   7. the first line's per-inverter Wh totals match days_hist.js
 *
 * @module validate-min-consistency
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseDaysHist } from './validate-plausibility.js';

const MIN_FILE_RE = /^min(\d{2})(\d{2})(\d{2})\.js$/;
const LINE_RE = /^m\[mi\+\+\]="(\d{2}\.\d{2}\.\d{2}) (\d{2}:\d{2}:\d{2})\|([^|]+)\|([^"]+)"$/;
const DEFAULT_NEAR_ZERO_THRESHOLD_WH = 50;

// Maps --check-* CLI flags (and the `checks` validateContent option) to issue keys.
export const CHECK_NAMES = ['line', 'date', 'epoch3', 'interval', 'startZero', 'monotonic', 'hist'];

// CLI flag name (--check-line, --check-start-zero, ...) for each CHECK_NAMES entry.
const CHECK_FLAGS = {
  line: 'check-line',
  date: 'check-date',
  epoch3: 'check-epoch3',
  interval: 'check-interval',
  startZero: 'check-start-zero',
  monotonic: 'check-monotonic',
  hist: 'check-hist',
};

/**
 * Derives the `DD.MM.YY` date a min filename encodes.
 *
 * @param {string} filename - e.g. `min260730.js`.
 * @returns {string | null} `DD.MM.YY`, or null if the filename doesn't match the pattern.
 */
export function dateFromFilename(filename) {
  const m = MIN_FILE_RE.exec(filename);
  if (!m) return null;
  const [, yy, mm, dd] = m;
  return `${dd}.${mm}.${yy}`;
}

/**
 * Parses one record line into date, time, raw blocks and per-inverter Wh totals.
 * Wh is read at the Epoch 3 field positions (SB4200 block index 3, SB2100 block
 * index 2) regardless of exact field count, so malformed/short blocks still yield
 * a best-effort Wh reading for the monotonicity and days_hist checks.
 *
 * @param {string} line - Raw line, e.g. `m[mi++]="DD.MM.YY HH:MM:SS|block0|block1"`.
 * @returns {{ date: string, time: string, b0: string[], b1: string[], sb4200Wh: number, sb2100Wh: number, totalWh: number } | null}
 */
export function parseRecordLine(line) {
  const trimmed = line?.trim();
  if (!trimmed) return null;
  const match = LINE_RE.exec(trimmed);
  if (!match) return null;
  const b0 = match[3].split(';');
  const b1 = match[4].split(';');
  const sb4200Wh = Number.parseInt(b0[3], 10);
  const sb2100Wh = Number.parseInt(b1[2], 10);
  return {
    date: match[1],
    time: match[2],
    b0,
    b1,
    sb4200Wh,
    sb2100Wh,
    totalWh: sb4200Wh + sb2100Wh,
  };
}

/**
 * Flags raw lines that do not start with the expected `m[mi++]="` prefix.
 *
 * @param {string[]} lines - Raw (trimmed) file lines.
 * @returns {{ index: number, line: string }[]}
 */
export function checkLineFormat(lines) {
  const issues = [];
  lines.forEach((line, index) => {
    if (!line.startsWith('m[mi++]=')) issues.push({ index, line });
  });
  return issues;
}

/**
 * Flags records whose date field doesn't match the filename's date.
 *
 * @param {({ date: string } | null)[]} records - Parsed records (null entries are skipped).
 * @param {string} expectedDate - `DD.MM.YY` derived from the filename.
 * @returns {{ index: number, expected: string, actual: string }[]}
 */
export function checkDateConsistency(records, expectedDate) {
  const issues = [];
  records.forEach((rec, index) => {
    if (!rec) return;
    if (rec.date !== expectedDate) issues.push({ index, expected: expectedDate, actual: rec.date });
  });
  return issues;
}

/**
 * Flags records that don't match the Epoch 3 block layout (6 fields | 4 fields).
 *
 * @param {({ b0: string[], b1: string[] } | null)[]} records
 * @returns {{ index: number, b0Fields: number, b1Fields: number }[]}
 */
export function checkEpoch3Format(records) {
  const issues = [];
  records.forEach((rec, index) => {
    if (!rec) return;
    if (rec.b0.length !== 6 || rec.b1.length !== 4) {
      issues.push({ index, b0Fields: rec.b0.length, b1Fields: rec.b1.length });
    }
  });
  return issues;
}

/**
 * Flags consecutive record pairs whose timestamps aren't exactly 5 minutes apart.
 * Records are expected in file order (newest first); the delta is measured as
 * `time[index-1] - time[index]`.
 *
 * @param {({ date: string, time: string } | null)[]} records
 * @returns {{ index: number, fromTime: string, toTime: string, deltaMinutes: number }[]}
 */
export function checkFiveMinuteIntervals(records) {
  const issues = [];
  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1];
    const cur = records[i];
    if (!prev || !cur) continue;
    const prevMs = Date.parse(`${toIsoDate(prev.date)}T${prev.time}Z`);
    const curMs = Date.parse(`${toIsoDate(cur.date)}T${cur.time}Z`);
    const deltaMinutes = (prevMs - curMs) / 60000;
    if (deltaMinutes !== 5) {
      issues.push({ index: i, fromTime: prev.time, toTime: cur.time, deltaMinutes });
    }
  }
  return issues;
}

/**
 * Converts a `DD.MM.YY` date into an ISO `YYYY-MM-DD` date for `Date.parse`.
 *
 * @param {string} ddmmyy - Date in `DD.MM.YY` format.
 * @returns {string}
 */
function toIsoDate(ddmmyy) {
  const [dd, mm, yy] = ddmmyy.split('.');
  const yyyy = Number.parseInt(yy, 10) >= 70 ? `19${yy}` : `20${yy}`;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Flags a non-near-zero total Wh on the last (earliest, "lowest") line of the file.
 *
 * @param {({ totalWh: number } | null)[]} records
 * @param {number} [threshold] - Max total Wh considered "near zero".
 * @returns {{ index: number, totalWh: number, threshold: number }[]}
 */
export function checkStartNearZero(records, threshold = DEFAULT_NEAR_ZERO_THRESHOLD_WH) {
  const lastIndex = records.length - 1;
  const last = records[lastIndex];
  if (!last) return [];
  if (last.totalWh > threshold) {
    return [{ index: lastIndex, totalWh: last.totalWh, threshold }];
  }
  return [];
}

/**
 * Flags records whose cumulative Wh drops further down the file (further back
 * in time), i.e. `totalWh` must be non-increasing from the first (newest) line
 * to the last (earliest) line.
 *
 * @param {({ totalWh: number } | null)[]} records
 * @returns {{ index: number, prevTotalWh: number, totalWh: number }[]}
 */
export function checkMonotonicWh(records) {
  const issues = [];
  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1];
    const cur = records[i];
    if (!prev || !cur) continue;
    if (cur.totalWh > prev.totalWh) {
      issues.push({ index: i, prevTotalWh: prev.totalWh, totalWh: cur.totalWh });
    }
  }
  return issues;
}

/**
 * Compares the first line's combined total Wh against the days_hist.js entry's
 * combined total. Compared as a combined total (not per-inverter) because block
 * identity (SB4200 vs SB2100) was swapped to a consistent order by the Epoch 3
 * migration for min files, while days_hist.js retains each day's original
 * (pre-migration) block order — a per-inverter comparison would flag every
 * pre-2013 day as a false mismatch even though the totals agree.
 *
 * @param {({ totalWh: number } | null)[]} records
 * @param {{ wr1Wh: number, wr2Wh: number } | undefined} histEntry
 * @param {number} [tolerance] - Max abs delta (Wh) before flagging.
 * @returns {{ minTotalWh: number, histTotalWh: number } | null}
 */
export function checkDaysHistMatch(records, histEntry, tolerance = 0) {
  if (!histEntry) return null;
  const first = records[0];
  if (!first) return null;
  const histTotalWh = histEntry.wr1Wh + histEntry.wr2Wh;
  if (Math.abs(first.totalWh - histTotalWh) <= tolerance) return null;
  return { minTotalWh: first.totalWh, histTotalWh };
}

// Record-level checks, keyed by the CLI/`checks` option name in CHECK_NAMES.
// `run` receives (records, { expectedDate, histEntry, options }) and returns
// either an issues array (flagged when non-empty) or a single issue-or-null.
const RECORD_CHECKS = [
  { name: 'date', issueKey: 'date', run: (records, ctx) => checkDateConsistency(records, ctx.expectedDate) },
  { name: 'epoch3', issueKey: 'epoch3Format', run: (records) => checkEpoch3Format(records) },
  { name: 'interval', issueKey: 'fiveMinuteIntervals', run: (records) => checkFiveMinuteIntervals(records) },
  { name: 'startZero', issueKey: 'startNearZero', run: (records, ctx) => checkStartNearZero(records, ctx.options.nearZeroThreshold) },
  { name: 'monotonic', issueKey: 'monotonicWh', run: (records) => checkMonotonicWh(records) },
  { name: 'hist', issueKey: 'daysHistMatch', run: (records, ctx) => checkDaysHistMatch(records, ctx.histEntry, ctx.options.histTolerance) },
];

/**
 * Splits raw file content into trimmed, non-blank lines and parses each into
 * a record. Lines that look like records (start with `m[mi++]=`) but fail to
 * parse are returned separately as `malformed`.
 *
 * @param {string} content - Full raw file content.
 * @returns {{ lines: string[], records: object[], malformed: { index: number, line: string }[] }}
 */
function parseLines(content) {
  const lines = (content ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const records = [];
  const malformed = [];
  lines.forEach((line, index) => {
    const rec = parseRecordLine(line);
    if (rec) {
      records.push(rec);
    } else if (line.startsWith('m[mi++]=')) {
      malformed.push({ index, line });
    }
  });
  return { lines, records, malformed };
}

/**
 * Runs all consistency checks against one min file's content.
 *
 * @param {string} filename - e.g. `min260730.js`.
 * @param {string} content - Full raw file content.
 * @param {{ wr1Wh: number, wr2Wh: number } | undefined} histEntry - Matching days_hist.js entry, if any.
 * @param {{ nearZeroThreshold?: number, histTolerance?: number, checks?: string[] }} [options]
 *   `checks` restricts which of {@link CHECK_NAMES} run; omit/undefined runs all of them.
 * @returns {{ filename: string, ok: boolean, issues: Record<string, unknown> }}
 */
export function validateContent(filename, content, histEntry, options = {}) {
  const active = new Set(options.checks && options.checks.length > 0 ? options.checks : CHECK_NAMES);
  const expectedDate = dateFromFilename(filename);
  const { lines, records, malformed } = parseLines(content);

  const issues = {};
  if (active.has('line')) {
    const lineFormatIssues = checkLineFormat(lines);
    if (lineFormatIssues.length > 0) issues.lineFormat = lineFormatIssues;
  }
  if (malformed.length > 0) issues.malformed = malformed;

  const ctx = { expectedDate, histEntry, options };
  for (const check of RECORD_CHECKS) {
    if (records.length === 0 || !active.has(check.name)) continue;
    const result = check.run(records, ctx);
    const flagged = Array.isArray(result) ? result.length > 0 : Boolean(result);
    if (flagged) issues[check.issueKey] = result;
  }

  return { filename, ok: Object.keys(issues).length === 0, issues };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const { values } = parseArgs({
    options: {
      'data-dir':            { type: 'string', default: '.' },
      'near-zero-threshold': { type: 'string', default: String(DEFAULT_NEAR_ZERO_THRESHOLD_WH) },
      'hist-tolerance':      { type: 'string', default: '0' },
      ...Object.fromEntries(Object.values(CHECK_FLAGS).map((flag) => [flag, { type: 'boolean', default: false }])),
    },
  });

  const dataDir = values['data-dir'];
  const nearZeroThreshold = Number.parseInt(values['near-zero-threshold'], 10);
  const histTolerance = Number.parseInt(values['hist-tolerance'], 10);
  // Selecting any --check-* flag restricts the run to just those checks; none selected runs all.
  const checks = CHECK_NAMES.filter((name) => values[CHECK_FLAGS[name]]);

  const daysHistContent = readFileSync(resolve(dataDir, 'days_hist.js'), 'utf8');
  const histMap = parseDaysHist(daysHistContent);

  const files = readdirSync(dataDir).filter((f) => MIN_FILE_RE.test(f)).sort();
  const results = files.map((f) => {
    const content = readFileSync(resolve(dataDir, f), 'utf8');
    const dateKey = dateFromFilename(f);
    return validateContent(f, content, histMap.get(dateKey), { nearZeroThreshold, histTolerance, checks });
  });

  const failed = results.filter((r) => !r.ok);

  for (const r of failed) {
    console.log(`${r.filename}:`);
    for (const [check, detail] of Object.entries(r.issues)) {
      const count = Array.isArray(detail) ? detail.length : 1;
      console.log(`  ${check}: ${count} issue${count === 1 ? '' : 's'}`);
      const sample = Array.isArray(detail) ? detail.slice(0, 3) : [detail];
      sample.forEach((d) => console.log(`    ${JSON.stringify(d)}`));
    }
  }

  console.log(`\n${results.length} file(s) checked, ${failed.length} with issues.`);
  process.exit(failed.length > 0 ? 1 : 0);
}
