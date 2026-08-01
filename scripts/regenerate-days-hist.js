/**
 * regenerate-days-hist.js — rebuild days_hist.js purely from minYYMMDD.js files
 * and compare the result against the previously archived days_hist.js.
 *
 * min files carry no separate grid-feed counter (only the SB4200/SB2100 Wh
 * totals), so regenerated entries always report a feed of 0 — this loses the
 * feed-in figures the original days_hist.js carried. Totals are compared as
 * a combined wr1+wr2 sum, not per-inverter, because the Epoch 3 migration
 * reordered min files' blocks to a consistent order while days_hist.js keeps
 * each day's original (pre-2013) block order (see docs/validate-min-consistency.md).
 *
 * @module regenerate-days-hist
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { parseMinFirstLine } from './utils.js';
import { dateFromFilename, parseRecordLine, checkFiveMinuteIntervals, checkStartNearZero } from './validate-min-consistency.js';
import { formatDaysHistEntry, parseDaysHistFiles } from './fill-days-hist.js';
import { parseDaysHist } from './validate-plausibility.js';

const MIN_FILE_RE = /^min(\d{2})(\d{2})(\d{2})\.js$/;
const DEFAULT_NEAR_ZERO_THRESHOLD_WH = 100;
const DEFAULT_MIN_RECORDS = 20;

/**
 * Builds a `DD.MM.YY -> { wr1Wh, wr1Feed, wr2Wh, wr2Feed }` map from a set of
 * min filenames, reading each file's first line only. Non-min filenames and
 * files whose first line can't be parsed are skipped. Feed is always 0 — min
 * files carry no grid-feed counter.
 *
 * @param {string[]} filenames - Candidate filenames (only `minYYMMDD.js` ones are used).
 * @param {(filename: string) => string} readFile - Reads a filename's content.
 * @returns {Map<string, { wr1Wh: number, wr1Feed: number, wr2Wh: number, wr2Feed: number }>}
 */
export function buildRegeneratedMap(filenames, readFile) {
  const map = new Map();
  for (const filename of filenames) {
    if (!MIN_FILE_RE.test(filename)) continue;
    const dateKey = dateFromFilename(filename);
    if (!dateKey) continue;
    const parsed = parseMinFirstLine(readFile(filename));
    if (!parsed) continue;
    map.set(dateKey, { wr1Wh: parsed.wr1Wh, wr1Feed: 0, wr2Wh: parsed.wr2Wh, wr2Feed: 0 });
  }
  return map;
}

/**
 * Judges whether a min file's records are complete enough to trust its
 * derived daily total: no missing 5-minute intervals, the day genuinely
 * starts near zero (not truncated before dawn), and a plausible number of
 * records are present.
 *
 * @param {object[]} records - Parsed records from `parseRecordLine` (validate-min-consistency.js), in file order.
 * @param {{ nearZeroThreshold?: number, minRecords?: number }} [options]
 * @returns {{ complete: boolean, reasons: string[] }}
 */
export function classifyCompleteness(records, options = {}) {
  const { nearZeroThreshold = DEFAULT_NEAR_ZERO_THRESHOLD_WH, minRecords = DEFAULT_MIN_RECORDS } = options;
  const reasons = [];

  const gapIssues = checkFiveMinuteIntervals(records);
  if (gapIssues.length > 0) {
    const largest = Math.max(...gapIssues.map((g) => g.deltaMinutes));
    reasons.push(`${gapIssues.length} interval gap(s), largest ${largest}min`);
  }

  const startIssues = checkStartNearZero(records, nearZeroThreshold);
  if (startIssues.length > 0) {
    reasons.push(`day-start not near zero (${startIssues[0].totalWh}Wh)`);
  }

  if (records.length < minRecords) {
    reasons.push(`only ${records.length} record(s)`);
  }

  return { complete: reasons.length === 0, reasons };
}

/**
 * Derives the `minYYMMDD.js` filename for a `DD.MM.YY` date key — the inverse
 * of {@link dateFromFilename}.
 *
 * @param {string} dateKey - `DD.MM.YY`.
 * @returns {string}
 */
export function minFilenameForDateKey(dateKey) {
  const [dd, mm, yy] = dateKey.split('.');
  return `min${yy}${mm}${dd}.js`;
}

/**
 * For a list of mismatched days (typically from {@link compareDaysHist}, e.g.
 * filtered to deltas beyond some threshold), checks each day's min file with
 * {@link classifyCompleteness} and, where it's judged incomplete, overrides
 * `regenMap`'s entry with the corresponding entry from `originalMap` instead
 * of trusting the min-derived total. Days not passed in `mismatches` are left
 * untouched — this only reconsiders days already known to disagree, so a
 * file with a harmless interval gap that doesn't affect the total is never
 * penalized.
 *
 * @param {Map<string, { wr1Wh: number, wr1Feed: number, wr2Wh: number, wr2Feed: number }>} regenMap
 * @param {{ date: string, regenTotalWh: number, originalTotalWh: number }[]} mismatches
 * @param {Map<string, { wr1Wh: number, wr1Feed: number, wr2Wh: number, wr2Feed: number }>} originalMap - Feed-aware original days_hist entries, keyed by `DD.MM.YY`.
 * @param {(filename: string) => string | undefined} readFile - Reads a filename's content, or undefined if it doesn't exist.
 * @param {{ nearZeroThreshold?: number, minRecords?: number }} [options]
 * @returns {{ map: Map<string, { wr1Wh: number, wr1Feed: number, wr2Wh: number, wr2Feed: number }>, fallbacks: { date: string, filename: string, reasons: string[], regenTotalWh: number, originalTotalWh: number }[] }}
 */
export function applyOriginalFallbackForMismatches(regenMap, mismatches, originalMap, readFile, options = {}) {
  const map = new Map(regenMap);
  const fallbacks = [];

  for (const m of mismatches) {
    const filename = minFilenameForDateKey(m.date);
    const content = readFile(filename);
    if (!content) continue;

    const records = content.split('\n').map((l) => l.trim()).filter(Boolean).map(parseRecordLine).filter(Boolean);
    const { complete, reasons } = classifyCompleteness(records, options);
    if (complete) continue;

    const original = originalMap.get(m.date);
    if (!original) continue;

    map.set(m.date, original);
    fallbacks.push({ date: m.date, filename, reasons, regenTotalWh: m.regenTotalWh, originalTotalWh: m.originalTotalWh });
  }

  return { map, fallbacks };
}

/**
 * Converts a `DD.MM.YY` date key into an ISO `YYYY-MM-DD` string for sorting.
 *
 * @param {string} ddmmyy
 * @returns {string}
 */
function toIsoDate(ddmmyy) {
  const [dd, mm, yy] = ddmmyy.split('.');
  const yyyy = Number.parseInt(yy, 10) >= 70 ? `19${yy}` : `20${yy}`;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Sorts `DD.MM.YY` date keys newest-first, matching days_hist.js's record order.
 *
 * @param {string[]} dateKeys
 * @returns {string[]}
 */
export function sortDateKeysDescending(dateKeys) {
  return [...dateKeys].sort((a, b) => toIsoDate(b).localeCompare(toIsoDate(a)));
}

/**
 * Renders a regenerated map into days_hist.js file content, newest-first.
 *
 * @param {Map<string, { wr1Wh: number, wr1Feed: number, wr2Wh: number, wr2Feed: number }>} regenMap
 * @returns {string}
 */
export function formatDaysHistFile(regenMap) {
  const lines = sortDateKeysDescending([...regenMap.keys()])
    .map((dateKey) => formatDaysHistEntry(dateKey, regenMap.get(dateKey)));
  return lines.join('\n') + '\n';
}

/**
 * Compares the regenerated map's combined totals against the original
 * days_hist.js entries' combined totals.
 *
 * @param {Map<string, { wr1Wh: number, wr2Wh: number }>} regenMap
 * @param {Map<string, { wr1Wh: number, wr2Wh: number }>} originalMap
 * @param {number} [tolerance] - Max abs delta (Wh) before flagging.
 * @returns {{ mismatches: { date: string, regenTotalWh: number, originalTotalWh: number, delta: number }[], onlyInRegen: string[], onlyInOriginal: string[] }}
 */
export function compareDaysHist(regenMap, originalMap, tolerance = 0) {
  const mismatches = [];
  const onlyInRegen = [];
  const onlyInOriginal = [];

  for (const date of sortDateKeysDescending([...regenMap.keys()])) {
    const original = originalMap.get(date);
    if (!original) {
      onlyInRegen.push(date);
      continue;
    }
    const regen = regenMap.get(date);
    const regenTotalWh = regen.wr1Wh + regen.wr2Wh;
    const originalTotalWh = original.wr1Wh + original.wr2Wh;
    const delta = regenTotalWh - originalTotalWh;
    if (Math.abs(delta) > tolerance) {
      mismatches.push({ date, regenTotalWh, originalTotalWh, delta });
    }
  }

  for (const date of sortDateKeysDescending([...originalMap.keys()])) {
    if (!regenMap.has(date)) onlyInOriginal.push(date);
  }

  return { mismatches, onlyInRegen, onlyInOriginal };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const { values } = parseArgs({
    options: {
      'data-dir':              { type: 'string', default: '.' },
      'archive-dir':           { type: 'string', default: 'archive/days_hist-merged' },
      tolerance:               { type: 'string', default: '0' },
      'dry-run':               { type: 'boolean', default: false },
      'out-file':              { type: 'string' },
      'trust-original-on-gaps': { type: 'boolean', default: false },
      'fallback-threshold':    { type: 'string', default: '100' },
      'original-file':         { type: 'string' },
      'near-zero-threshold':   { type: 'string', default: String(DEFAULT_NEAR_ZERO_THRESHOLD_WH) },
      'min-records':           { type: 'string', default: String(DEFAULT_MIN_RECORDS) },
    },
  });

  const dataDir = values['data-dir'];
  const archiveDir = values['archive-dir'];
  const tolerance = Number.parseInt(values.tolerance, 10);
  const dryRun = values['dry-run'];
  const trustOriginalOnGaps = values['trust-original-on-gaps'];
  const fallbackThreshold = Number.parseInt(values['fallback-threshold'], 10);
  const nearZeroThreshold = Number.parseInt(values['near-zero-threshold'], 10);
  const minRecords = Number.parseInt(values['min-records'], 10);

  const daysHistPath = resolve(dataDir, 'days_hist.js');
  const archivePath = resolve(dataDir, archiveDir, 'days_hist.js');
  const archiveExists = existsSync(archivePath);

  // If a previous run already archived the true original, compare/fall back
  // against that instead of the current (possibly already-regenerated) days_hist.js.
  let originalFilePath = daysHistPath;
  if (values['original-file']) {
    originalFilePath = resolve(values['original-file']);
  } else if (archiveExists) {
    originalFilePath = archivePath;
  }
  const originalContent = readFileSync(originalFilePath, 'utf8');
  const originalMap = parseDaysHist(originalContent);

  const files = readdirSync(dataDir);
  const readFile = (f) => readFileSync(resolve(dataDir, f), 'utf8');

  const regenMap = buildRegeneratedMap(files, readFile);
  const comparison = compareDaysHist(regenMap, originalMap, tolerance);

  console.log(`Regenerated ${regenMap.size} day(s) from min files; original had ${originalMap.size} day(s).`);
  console.log(`  Mismatched totals: ${comparison.mismatches.length}`);
  console.log(`  Only in regenerated (no days_hist.js entry): ${comparison.onlyInRegen.length}`);
  console.log(`  Only in original (no min file): ${comparison.onlyInOriginal.length}`);

  if (comparison.mismatches.length > 0) {
    console.log('\nMismatches (date, regenerated total, original total, delta):');
    for (const m of comparison.mismatches) {
      console.log(`  ${m.date}: ${m.regenTotalWh} vs ${m.originalTotalWh} (Δ ${m.delta > 0 ? '+' : ''}${m.delta})`);
    }
  }

  let finalMap = regenMap;
  let fallbacks = [];
  if (trustOriginalOnGaps) {
    // Only reconsider days whose totals actually disagree beyond fallback-threshold —
    // a min file with a harmless interval gap that doesn't move the total is left alone.
    const candidates = comparison.mismatches.filter((m) => Math.abs(m.delta) > fallbackThreshold);
    const originalMapWithFeed = parseDaysHistFiles([originalContent]);
    const readFileIfExists = (f) => (existsSync(resolve(dataDir, f)) ? readFile(f) : undefined);
    ({ map: finalMap, fallbacks } = applyOriginalFallbackForMismatches(
      regenMap, candidates, originalMapWithFeed, readFileIfExists, { nearZeroThreshold, minRecords },
    ));

    if (fallbacks.length > 0) {
      console.log(`\nKept the original days_hist.js value for ${fallbacks.length} day(s) whose min file looks incomplete (needs reconstruction):`);
      for (const fb of fallbacks) {
        console.log(`  ${fb.date} (${fb.filename}): ${fb.reasons.join('; ')} — min-derived ${fb.regenTotalWh}Wh vs kept ${fb.originalTotalWh}Wh`);
      }
    }
  }

  if (values['out-file']) {
    writeFileSync(values['out-file'], JSON.stringify({ ...comparison, fallbacks }, null, 2));
    console.log(`\nComparison report written to ${values['out-file']}`);
  }

  if (dryRun) {
    console.log('\n--dry-run: days_hist.js not archived or overwritten.');
    process.exit(0);
  }

  if (archiveExists) {
    console.log(`\nArchive already exists at ${join(archiveDir, 'days_hist.js')} — not overwriting it.`);
  } else {
    mkdirSync(resolve(dataDir, archiveDir), { recursive: true });
    copyFileSync(daysHistPath, archivePath);
    console.log(`\nArchived original to ${join(archiveDir, 'days_hist.js')}.`);
  }
  writeFileSync(daysHistPath, formatDaysHistFile(finalMap));

  console.log(`Rewrote ${daysHistPath} from min files.`);
}
