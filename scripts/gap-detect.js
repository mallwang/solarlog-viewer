/**
 * gap-detect.js — detect missing daily SolarLog min files.
 *
 * Scans minYYMMDD.js filenames, reports missing date ranges between
 * earliest and latest known file. Supports --since filter and JSON output.
 *
 * @module gap-detect
 */

import { readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIN_FILE_RE = /^min(\d{2})(\d{2})(\d{2})\.js$/;

/**
 * Parse minYYMMDD.js filenames into sorted ISO date strings.
 * @param {string[]} filenames - bare filenames (not paths)
 * @returns {string[]} sorted ISO dates ('YYYY-MM-DD')
 */
export function parseArchiveFilenames(filenames) {
  const dates = [];
  for (const f of filenames) {
    const m = MIN_FILE_RE.exec(f);
    if (!m) continue;
    const yy = Number.parseInt(m[1], 10);
    const mm = m[2];
    const dd = m[3];
    const yyyy = yy >= 6 ? 2000 + yy : 2100 + yy; // ponytail: 2-digit year; 2106 is the ceiling
    const iso = `${yyyy}-${mm}-${dd}`;
    if (Number.isNaN(new Date(iso).getTime())) continue; // skip files with invalid dates (e.g. min080132.js)
    dates.push(iso);
  }
  return dates.sort((a, b) => a.localeCompare(b));
}

/**
 * Detect gaps in a sorted list of ISO date strings.
 * @param {string[]} dates - sorted ISO dates
 * @param {string} [since] - ISO date; only report gaps on or after this date
 * @returns {{ start: string, end: string, count: number }[]}
 */
export function detectGaps(dates, since) {
  if (dates.length < 2) return [];
  const sinceMs = since ? new Date(since).getTime() : 0;
  const gaps = [];
  for (let i = 0; i < dates.length - 1; i++) {
    const cur = new Date(dates[i]);
    const next = new Date(dates[i + 1]);
    const diffDays = (next - cur) / 86_400_000;
    if (diffDays <= 1) continue;
    // gap: from cur+1 to next-1
    const gapStart = new Date(cur.getTime() + 86_400_000);
    const gapEnd = new Date(next.getTime() - 86_400_000);
    if (gapStart.getTime() < sinceMs) continue;
    const count = Math.round((gapEnd - gapStart) / 86_400_000) + 1;
    gaps.push({
      start: gapStart.toISOString().slice(0, 10),
      end: gapEnd.toISOString().slice(0, 10),
      count,
    });
  }
  return gaps;
}

/**
 * Format gap ranges as human-readable strings.
 * @param {{ start: string, end: string, count: number }[]} gaps
 * @returns {string[]}
 */
export function formatRanges(gaps) {
  return gaps.map(({ start, end, count }) => {
    const label = count === 1 ? '1 day missing' : `${count} days missing`;
    return start === end ? `  ${start}: ${label}` : `  ${start} – ${end}: ${label}`;
  });
}

/**
 * Build a JSON report object.
 * @param {{ firstFile: string, lastFile: string, fileCount: number }} meta
 * @param {{ start: string, end: string, count: number }[]} gaps
 * @returns {object}
 */
export function buildJsonReport(meta, gaps) {
  return {
    meta,
    gapCount: gaps.length,
    totalMissingDays: gaps.reduce((s, g) => s + g.count, 0),
    gaps,
  };
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const args = process.argv.slice(2);
  let since, outputJson, outFile;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--since') since = args[++i];
    else if (args[i] === '--output' && args[i + 1] === 'json') { outputJson = true; i++; }
    else if (args[i] === '--out-file') outFile = args[++i];
  }

  let filenames;
  try {
    filenames = readdirSync('.');
  } catch {
    console.error('Error: cannot read archive directory');
    process.exit(2);
  }

  const dates = parseArchiveFilenames(filenames);
  if (dates.length === 0) {
    console.error('Error: no min*.js files found in current directory');
    process.exit(2);
  }

  const gaps = detectGaps(dates, since);
  const meta = { firstFile: dates[0], lastFile: dates.at(-1), fileCount: dates.length };

  console.log(`Gap Report: ${meta.firstFile} – ${meta.lastFile} (${meta.fileCount} files found)\n`);
  if (gaps.length === 0) {
    console.log('No gaps detected. ✓');
  } else {
    console.log('Gaps:');
    for (const line of formatRanges(gaps)) console.log(line);
    const totalDays = gaps.reduce((s, g) => s + g.count, 0);
    console.log(`\nSummary: ${gaps.length} gap range${gaps.length === 1 ? '' : 's'}, ${totalDays} day${totalDays === 1 ? '' : 's'} total`);
  }

  if (outputJson) {
    const report = buildJsonReport(meta, gaps);
    const dest = outFile ?? 'gap-report.json';
    writeFileSync(dest, JSON.stringify(report, null, 2));
    console.log(`\nJSON report written to ${dest}`);
  }

  process.exit(gaps.length > 0 ? 1 : 0);
}
