/**
 * detect-backfilled-days.js — finds calendar days whose minYYMMDD.js was reconstructed by
 * scripts/backfill-min-day.js rather than genuinely measured, and (re)generates
 * web/js/data/backfilled-data.js from the result.
 *
 * backfill-min-day.js's zeroBlock() (see that file) zeros every field except the scaled Wh
 * counter when it writes a reconstructed day, so a day is "backfilled" when every reading has
 * pacW=0 across every inverter despite a real recorded yield — the same signature day-view.js
 * already uses (`hasPowerData`) to show a yield-only fallback chart instead of a flat 0 W line.
 * days_hist.js's own `peakW` field isn't used for this: it's 0 for large parts of the 20-year
 * archive independent of backfilling (see backfill-peak-power.js's header), so it can't tell
 * "reconstructed" apart from "never had a peak recorded".
 *
 * Caveat confirmed against the real archive: the pacW=0 signature isn't unique to backfilled
 * days. The old device's early years (2006-2023, scattered) genuinely never logged instantaneous
 * power at all - their days_hist.js total still varies normally day to day, it's just power-less,
 * not reconstructed. `--since` scopes the *content* signature to a date range known to have
 * reliable power logging, so a genuine gap there is unambiguously a reconstruction rather than an
 * old-era limitation - pass the first date after which every non-backfilled day has a real,
 * varying peakW in days_hist.js.
 *
 * A second, independent signal catches what `--since` can't: a min file that was fabricated by
 * backfill-min-day.js *before* --since's cutoff (e.g. filling a gap deep in the old archive)
 * still has no counterpart in a true pre-backfill snapshot of the same directory - it simply
 * didn't exist there. Pass that snapshot's path as `--original-dir` to flag every date present in
 * `--dir` but absent from `--original-dir`, regardless of content. The two signals are unioned.
 *
 * Reads min*.js off the filesystem (like scripts/backfill-peak-power.js) — hist/ and data/ need
 * to be manually repopulated first (see README's "Validation & Aggregation Scripts" section).
 *
 * Usage:
 *   node scripts/detect-backfilled-days.js [--dir .] [--since YYYY-MM-DD]
 *     [--original-dir <pre-backfill snapshot>] [--write]
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMinFile } from '../web/js/data/min-file.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_FILE = join(ROOT, 'web/js/data/backfilled-data.js');

const MIN_FILE_RE = /^min(\d{2})(\d{2})(\d{2})\.js$/;

/**
 * Whether a parsed DailyTrace looks like a backfill-min-day.js reconstruction: every reading has
 * pacW=0 across every inverter, but at least one reading shows a real (nonzero) daily yield. A
 * trace with no readings, or one with real yield nowhere, is left alone — the former has nothing
 * to judge, the latter is genuinely empty rather than reconstructed.
 * @param {{ readings: { perInverter: Record<string, { pacW: number, dailyYieldWh: number }> }[] }} trace
 * @returns {boolean}
 */
export function isBackfilledTrace(trace) {
  const readings = trace?.readings ?? [];
  if (readings.length === 0) return false;

  let hasRealYield = false;
  for (const reading of readings) {
    for (const inv of Object.values(reading.perInverter ?? {})) {
      if ((inv?.pacW ?? 0) !== 0) return false;
      if ((inv?.dailyYieldWh ?? 0) > 0) hasRealYield = true;
    }
  }
  return hasRealYield;
}

/**
 * Builds the 'DD.MM.YY' date parseMinFile expects from a minYYMMDD.js filename.
 * @param {string} filename
 * @returns {string | null}
 */
function ddMmYyFromFilename(filename) {
  const match = MIN_FILE_RE.exec(filename);
  if (!match) return null;
  const [, yy, mm, dd] = match;
  return `${dd}.${mm}.${yy}`;
}

/**
 * Scans every min*.js file's content and returns the sorted ISO ('YYYY-MM-DD') dates flagged by
 * either signal: the content signature (isBackfilledTrace, scoped by `since`) or plain filename
 * absence from `originalFilenames` when supplied (see module header - a file backfill-min-day.js
 * fabricated has no counterpart in a true pre-backfill snapshot, regardless of its content or
 * date). Pure function — filesystem I/O stays in the CLI entry point below so this stays directly
 * testable.
 * @param {Map<string, string>} minFilesByName - minYYMMDD.js filename -> file content.
 * @param {{ since?: string, originalFilenames?: Set<string> }} [options]
 * @returns {string[]}
 */
export function detectBackfilledDates(minFilesByName, { since, originalFilenames } = {}) {
  const dates = [];
  for (const [filename, content] of minFilesByName) {
    const dateDdMmYy = ddMmYyFromFilename(filename);
    if (!dateDdMmYy) continue;
    const trace = parseMinFile(content, dateDdMmYy);

    const missingFromOriginal = originalFilenames && !originalFilenames.has(filename);
    const matchesContentSignature =
      (!since || trace.date >= since) && isBackfilledTrace(trace);

    if (missingFromOriginal || matchesContentSignature) dates.push(trace.date);
  }
  return dates.sort((a, b) => a.localeCompare(b));
}

/**
 * Renders web/js/data/backfilled-data.js's full source from a sorted ISO date list.
 * @param {string[]} isoDates
 * @returns {string}
 */
export function formatBackfilledDataModule(isoDates) {
  const entries = isoDates.map((d) => `  '${d}',`).join('\n');
  const setBody = isoDates.length === 0 ? '' : `\n${entries}\n`;
  const header = [
    '/**',
    ' * Static list of calendar dates whose SolarLog minute data was reconstructed rather than',
    ' * genuinely measured: either backfill-min-day.js fabricated the file outright (no counterpart',
    " * in a true pre-backfill snapshot), or every reading has pacW=0 across all inverters despite a",
    " * real recorded daily yield, because backfill-min-day.js's zeroBlock() zeros every field except",
    ' * the scaled Wh counter it writes. See scripts/detect-backfilled-days.js for both signals.',
    ' *',
    ' * Regenerate via: node scripts/detect-backfilled-days.js --dir <repopulated hist/+data dir>',
    ' *   --original-dir <pre-backfill snapshot> --since <first date with reliable power logging>',
    ' *   --write',
    " * (don't hand-edit the date list below — rerun the detector so this stays authoritative).",
    ' */',
  ].join('\n');
  return `${header}

/** @type {ReadonlySet<string>} ISO 'YYYY-MM-DD' dates. */
export const BACKFILLED_DATES = new Set([${setBody}]);

/**
 * Whether a given ISO date's minute data is a backfill-min-day.js reconstruction rather than a
 * genuine measurement.
 * @param {string} dateIso - 'YYYY-MM-DD'.
 * @returns {boolean}
 */
export function isBackfilledDate(dateIso) {
  return BACKFILLED_DATES.has(dateIso);
}
`;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const args = process.argv.slice(2);
  let dir = '.';
  let originalDir;
  let write = false;
  let since;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir') dir = args[++i];
    else if (args[i] === '--original-dir') originalDir = args[++i];
    else if (args[i] === '--since') since = args[++i];
    else if (args[i] === '--write') write = true;
  }

  let minFilenames;
  try {
    minFilenames = readdirSync(dir).filter((f) => MIN_FILE_RE.test(f));
  } catch {
    console.error(`Error: cannot read directory ${dir}`);
    process.exit(2);
  }
  if (minFilenames.length === 0) {
    console.error(`Error: no min*.js files found in ${dir}`);
    process.exit(2);
  }

  let originalFilenames;
  if (originalDir) {
    try {
      originalFilenames = new Set(readdirSync(originalDir).filter((f) => MIN_FILE_RE.test(f)));
    } catch {
      console.error(`Error: cannot read directory ${originalDir}`);
      process.exit(2);
    }
  }

  const minFilesByName = new Map(
    minFilenames.map((f) => [f, readFileSync(join(dir, f), 'utf8')]),
  );

  const isoDates = detectBackfilledDates(minFilesByName, { since, originalFilenames });
  console.log(`Detected ${isoDates.length} backfilled day(s) among ${minFilenames.length} min file(s).`);
  isoDates.forEach((d) => console.log(`  ${d}`));

  if (write) {
    writeFileSync(OUTPUT_FILE, formatBackfilledDataModule(isoDates));
    console.log(`\nWrote ${OUTPUT_FILE}`);
  } else {
    console.log(`\nRerun with --write to regenerate ${OUTPUT_FILE}.`);
  }
}
