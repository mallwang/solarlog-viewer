/**
 * validate-plausibility.js — cross-check min file daily totals against days_hist.js.
 *
 * For each minYYMMDD.js, reads the first-line Wh counter and compares it against
 * the corresponding entry in days_hist.js. Flags days where abs(delta) > tolerance.
 *
 * @module validate-plausibility
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIN_FILE_RE = /^min(\d{2})(\d{2})(\d{2})\.js$/;
const DA_LINE_RE = /^da\[dx\+\+\]="(\d{2}\.\d{2}\.\d{2})\|(\d+);(\d+)\|(\d+);(\d+)"/;

/**
 * Parse the first line of a min file to extract per-inverter Wh totals.
 * @param {string} content - full file content
 * @returns {{ wr1Wh: number, wr2Wh: number } | null}
 */
export function parseMinFile(content) {
  const firstLine = content.split('\n')[0]?.trim();
  if (!firstLine) return null;
  const pipeIdx = firstLine.indexOf('|');
  if (pipeIdx === -1) return null;
  const blocks = firstLine.slice(pipeIdx + 1).replace(/"$/, '').split('|');
  if (blocks.length < 2) return null;
  // ponytail: Wh index varies by block length: 4-field→index 2, 6-field→index 3
  const b0 = blocks[0].split(';');
  const wr1Wh = Number.parseInt(b0[b0.length >= 5 ? 3 : 2], 10);
  const b1 = blocks[1].split(';');
  const wr2Wh = Number.parseInt(b1[b1.length >= 5 ? 3 : 2], 10);
  if (Number.isNaN(wr1Wh) || Number.isNaN(wr2Wh)) return null;
  return { wr1Wh, wr2Wh };
}

/**
 * Parse days_hist.js content into a map keyed by 'DD.MM.YY'.
 * @param {string} content
 * @returns {Map<string, { wr1Wh: number, wr2Wh: number }>}
 */
export function parseDaysHist(content) {
  const map = new Map();
  for (const line of content.split('\n')) {
    const m = DA_LINE_RE.exec(line.trim());
    if (!m) continue;
    map.set(m[1], {
      wr1Wh: Number.parseInt(m[2], 10),
      wr2Wh: Number.parseInt(m[4], 10),
    });
  }
  return map;
}

/**
 * Compare min-derived totals against days_hist totals.
 * @param {{ wr1Wh: number, wr2Wh: number }} minTotal
 * @param {{ wr1Wh: number, wr2Wh: number }} histTotal
 * @param {number} tolerance - max abs delta (Wh) before flagging
 * @returns {{ wr1MinWh, wr1HistWh, wr1Delta, wr2MinWh, wr2HistWh, wr2Delta } | null}
 */
export function compareDay(minTotal, histTotal, tolerance) {
  const wr1Delta = Math.abs(minTotal.wr1Wh - histTotal.wr1Wh);
  const wr2Delta = Math.abs(minTotal.wr2Wh - histTotal.wr2Wh);
  if (wr1Delta <= tolerance && wr2Delta <= tolerance) return null;
  return {
    wr1MinWh: minTotal.wr1Wh,
    wr1HistWh: histTotal.wr1Wh,
    wr1Delta: minTotal.wr1Wh - histTotal.wr1Wh,
    wr2MinWh: minTotal.wr2Wh,
    wr2HistWh: histTotal.wr2Wh,
    wr2Delta: minTotal.wr2Wh - histTotal.wr2Wh,
  };
}


if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const args = process.argv.slice(2);
  let since, tolerance = 1, outputJson, outFile;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--since') since = args[++i];
    else if (args[i] === '--tolerance') tolerance = Number.parseInt(args[++i], 10);
    else if (args[i] === '--output' && args[i + 1] === 'json') { outputJson = true; i++; }
    else if (args[i] === '--out-file') outFile = args[++i];
  }

  const files = readdirSync('.');
  const daysHistContent = readFileSync('days_hist.js', 'utf8');
  const histMap = parseDaysHist(daysHistContent);

  const mismatches = [];
  const sinceMs = since ? new Date(since).getTime() : 0;

  for (const f of files) {
    const m = MIN_FILE_RE.exec(f);
    if (!m) continue;
    const yy = Number.parseInt(m[1], 10);
    const yyyy = yy >= 6 ? 2000 + yy : 2100 + yy;
    const isoDate = `${yyyy}-${m[2]}-${m[3]}`;
    if (new Date(isoDate).getTime() < sinceMs) continue;

    const dateKey = `${m[3]}.${m[2]}.${m[1]}`; // DD.MM.YY
    const histEntry = histMap.get(dateKey);
    if (!histEntry) continue; // no hist entry — not our job to flag gaps

    const content = readFileSync(f, 'utf8');
    const minTotal = parseMinFile(content);
    if (!minTotal) continue;

    const diff = compareDay(minTotal, histEntry, tolerance);
    if (diff) mismatches.push({ date: isoDate, ...diff });
  }

  mismatches.sort((a, b) => a.date.localeCompare(b.date));

  if (mismatches.length === 0) {
    console.log('All checked days within tolerance. ✓');
  } else {
    const h = (s) => s.padStart(12);
    console.log(`${'Date'.padEnd(12)}${h('WR1 min')}${h('WR1 hist')}${h('Δ WR1')}${h('WR2 min')}${h('WR2 hist')}${h('Δ WR2')}`);
    for (const r of mismatches) {
      const pct1 = r.wr1HistWh ? `${((r.wr1Delta / r.wr1HistWh) * 100).toFixed(2)}%` : '-';
      const pct2 = r.wr2HistWh ? `${((r.wr2Delta / r.wr2HistWh) * 100).toFixed(2)}%` : '-';
      console.log(
        `${r.date.padEnd(12)}${String(r.wr1MinWh).padStart(12)}${String(r.wr1HistWh).padStart(12)}` +
        `${String(r.wr1Delta).padStart(8)} ${pct1.padStart(8)}` +
        `${String(r.wr2MinWh).padStart(12)}${String(r.wr2HistWh).padStart(12)}` +
        `${String(r.wr2Delta).padStart(8)} ${pct2.padStart(8)}`
      );
    }
    console.log(`\n${mismatches.length} mismatch${mismatches.length === 1 ? '' : 'es'} found`);
  }

  if (outputJson) {
    const report = { tolerance, mismatches };
    const dest = outFile ?? 'plausibility-report.json';
    writeFileSync(dest, JSON.stringify(report, null, 2));
    console.log(`\nJSON report written to ${dest}`);
  }

  process.exit(mismatches.length > 0 ? 1 : 0);
}
