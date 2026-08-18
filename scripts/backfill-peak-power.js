/**
 * backfill-peak-power.js — reconstructs missing peakW values in days_hist.js from archived
 * minYYMMDD.js minute files.
 *
 * The old SolarLog device's frozen hist/days_hist.js never wrote the peak-power field at all —
 * every entry has `peakW=0` for every inverter, even though the matching minYYMMDD.js minute
 * files (PAC, field 0 of each ';'-separated block, unaffected by the SB2100/SB4200 epoch
 * differences documented in web/js/data/epoch.js) do contain real instantaneous power readings.
 * This script fills those zeroed peaks with the max PAC sampled that day, leaving already
 * non-zero entries (new device, post-2026-07-29) untouched — so reruns are idempotent and this
 * never overwrites a genuinely-measured value with a coarser minute-sampled approximation.
 *
 * Reads days_hist.js and min*.js off the filesystem (like scripts/gap-detect.js) — both need to
 * be manually unzipped/repopulated into the working directory first (see README's "Validation &
 * Aggregation Scripts" section). Writes a new file by default; pass --write to overwrite
 * days_hist.js in place once you've reviewed the diff.
 *
 * Usage:
 *   node scripts/backfill-peak-power.js [--dir .] [--out-file days_hist.backfilled.js] [--write]
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MIN_FILE_RE = /^min\d{6}\.js$/;
const DAYS_HIST_LINE_RE = /^da\[dx\+\+\]="(\d{2}\.\d{2}\.\d{2})\|(.+)"$/;
const MIN_LINE_RE = /^m\[mi\+\+\]="\d{2}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}\|([^|]+)\|([^"]+)"$/;

/**
 * Parses one days_hist.js line into its date and per-inverter { yieldWh, peakW } blocks.
 * @param {string} line
 * @returns {{ date: string, blocks: { yieldWh: number, peakW: number }[] } | null}
 */
export function parseDaysHistLine(line) {
  const match = DAYS_HIST_LINE_RE.exec(line?.trim() ?? '');
  if (!match) return null;
  const blocks = match[2].split('|').map((block) => {
    const [yieldWh, peakW] = block.split(';').map((n) => Number.parseInt(n, 10));
    return { yieldWh, peakW };
  });
  if (blocks.some((b) => Number.isNaN(b.yieldWh) || Number.isNaN(b.peakW))) return null;
  return { date: match[1], blocks };
}

/**
 * Reassembles a days_hist.js line from a date and per-inverter blocks (inverse of
 * parseDaysHistLine).
 * @param {string} date - DD.MM.YY
 * @param {{ yieldWh: number, peakW: number }[]} blocks
 * @returns {string}
 */
export function formatDaysHistLine(date, blocks) {
  const body = blocks.map((b) => `${b.yieldWh};${b.peakW}`).join('|');
  return `da[dx++]="${date}|${body}"`;
}

/**
 * Builds the minYYMMDD.js filename for a days_hist.js date.
 * @param {string} date - DD.MM.YY
 * @returns {string}
 */
export function minFilenameForDate(date) {
  const [dd, mm, yy] = date.split('.');
  return `min${yy}${mm}${dd}.js`;
}

/**
 * Scans every line of a minYYMMDD.js file's content and returns the max PAC (instantaneous
 * power, always field 0 of each block regardless of epoch) seen per block position that day.
 * @param {string} content
 * @returns {number[] | null} One peak watt value per block, in block order; null if no line parsed.
 */
export function parsePeaksFromMinFile(content) {
  let peaks = null;
  for (const line of (content ?? '').split('\n')) {
    const match = MIN_LINE_RE.exec(line.trim());
    if (!match) continue;
    const blocks = [match[1], match[2]].map((b) => b.split(';'));
    const pacs = blocks.map((b) => Number.parseInt(b[0], 10));
    if (pacs.some(Number.isNaN)) continue;
    if (!peaks) peaks = pacs.map(() => 0);
    if (peaks.length !== pacs.length) continue; // inconsistent block count within the file — skip
    peaks = peaks.map((p, i) => Math.max(p, pacs[i]));
  }
  return peaks;
}

/**
 * Backfills every zeroed-peak days_hist.js line using the matching min file's sampled peaks.
 * Pure function — I/O (reading days_hist.js/min*.js off disk) stays in the CLI entry point below
 * so this stays directly testable.
 * @param {string[]} daysHistLines - Raw lines from days_hist.js.
 * @param {Map<string, string>} minFilesByName - minYYMMDD.js filename -> file content.
 * @returns {{ lines: string[], stats: { backfilled: number, alreadyPresent: number,
 *   missingMinFile: number, mismatchedBlockCount: number, nonDataLines: number } }}
 */
export function backfillDaysHistFile(daysHistLines, minFilesByName) {
  const stats = {
    backfilled: 0,
    alreadyPresent: 0,
    missingMinFile: 0,
    mismatchedBlockCount: 0,
    nonDataLines: 0,
  };

  const lines = daysHistLines.map((line) => {
    const parsed = parseDaysHistLine(line);
    if (!parsed) {
      stats.nonDataLines += 1;
      return line;
    }
    if (parsed.blocks.some((b) => b.peakW !== 0)) {
      stats.alreadyPresent += 1;
      return line;
    }

    const minContent = minFilesByName.get(minFilenameForDate(parsed.date));
    if (!minContent) {
      stats.missingMinFile += 1;
      return line;
    }

    const peaks = parsePeaksFromMinFile(minContent);
    if (!peaks || peaks.length !== parsed.blocks.length) {
      stats.mismatchedBlockCount += 1;
      return line;
    }

    stats.backfilled += 1;
    const newBlocks = parsed.blocks.map((b, i) => ({ yieldWh: b.yieldWh, peakW: peaks[i] }));
    return formatDaysHistLine(parsed.date, newBlocks);
  });

  return { lines, stats };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const args = process.argv.slice(2);
  let dir = '.';
  let outFile = 'days_hist.backfilled.js';
  let write = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir') dir = args[++i];
    else if (args[i] === '--out-file') outFile = args[++i];
    else if (args[i] === '--write') write = true;
  }

  let daysHistLines;
  try {
    daysHistLines = readFileSync(join(dir, 'days_hist.js'), 'utf8').split('\n');
  } catch {
    console.error(`Error: cannot read ${join(dir, 'days_hist.js')}`);
    process.exit(2);
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

  const minFilesByName = new Map(
    minFilenames.map((f) => [f, readFileSync(join(dir, f), 'utf8')]),
  );

  const { lines, stats } = backfillDaysHistFile(daysHistLines, minFilesByName);
  const dest = write ? join(dir, 'days_hist.js') : join(dir, outFile);
  writeFileSync(dest, lines.join('\n'));

  console.log(`Backfilled ${stats.backfilled} day(s) into ${dest}`);
  console.log(`  already had a peak:      ${stats.alreadyPresent}`);
  console.log(`  no matching min file:    ${stats.missingMinFile}`);
  console.log(`  min file unusable:       ${stats.mismatchedBlockCount}`);
  console.log(`  non-data lines:          ${stats.nonDataLines}`);
  if (!write) {
    console.log(`\nReview the diff, then rerun with --write to overwrite days_hist.js in place.`);
  }
}
