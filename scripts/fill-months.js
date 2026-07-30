/**
 * fill-months.js — regenerate a month entry in months.js from minYYYYMM*.js files.
 *
 * Aggregates WR1 and WR2 daily totals from all min files for the given month,
 * then upserts the result into months.js.
 *
 * @module fill-months
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { parseMinFirstLine } from './utils.js';


/**
 * Filter filenames to those matching the given YYYY-MM (e.g. '2026-06').
 * @param {string[]} allFilenames
 * @param {string} yyyymm - 'YYYY-MM'
 * @returns {string[]}
 */
export function collectMonthMinFiles(allFilenames, yyyymm) {
  const [yyyy, mm] = yyyymm.split('-');
  const yy = yyyy.slice(2);
  const prefix = `min${yy}${mm}`;
  return allFilenames.filter((f) => f.startsWith(prefix) && /^min\d{6}\.js$/.test(f));
}

/**
 * Sum WR1 and WR2 Wh across an array of min file contents.
 * @param {string[]} minContents
 * @returns {{ wr1Wh: number, wr2Wh: number }}
 */
export function aggregateMonth(minContents) {
  let wr1Wh = 0, wr2Wh = 0;
  for (const c of minContents) {
    const parsed = parseMinFirstLine(c);
    if (parsed) { wr1Wh += parsed.wr1Wh; wr2Wh += parsed.wr2Wh; }
  }
  return { wr1Wh, wr2Wh };
}

/**
 * Format a months.js entry line.
 * @param {string} yyyymm - 'YYYY-MM'
 * @param {{ wr1Wh: number, wr2Wh: number }} totals
 * @returns {string}
 */
export function formatMonthEntry(yyyymm, totals) {
  const [yyyy, mm] = yyyymm.split('-');
  const yy = yyyy.slice(2);
  return `mo[mx++]="01.${mm}.${yy}|${totals.wr1Wh}|${totals.wr2Wh}"`;
}

/**
 * Upsert a month line into months.js content (replace if present, else append).
 * @param {string} existingContent
 * @param {string} newLine
 * @returns {string}
 */
export function upsertInMonths(existingContent, newLine) {
  const dateKey = /01\.\d{2}\.\d{2}/.exec(newLine)?.[0];
  const lines = existingContent.split('\n');
  const idx = lines.findIndex((l) => l.includes(dateKey));
  if (idx !== -1) {
    lines[idx] = newLine;
    return lines.join('\n');
  }
  return existingContent.trimEnd() + '\n' + newLine + '\n';
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a); }));
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const args = process.argv.slice(2);
  const yyyymm = args.find((a) => /^\d{4}-\d{2}$/.test(a));
  if (!yyyymm) { console.error('Usage: fill-months.js YYYY-MM [--dry-run] [--force]'); process.exit(2); }
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  const allFiles = readdirSync('.');
  const matching = collectMonthMinFiles(allFiles, yyyymm);
  if (matching.length === 0) {
    console.error(`No min files found for ${yyyymm}`);
    process.exit(1);
  }

  const contents = matching.map((f) => readFileSync(f, 'utf8'));
  const totals = aggregateMonth(contents);
  const newLine = formatMonthEntry(yyyymm, totals);

  console.log(`fill-months ${yyyymm}`);
  console.log(`  Min files: ${matching.length}`);
  console.log(`  WR1 total: ${totals.wr1Wh} Wh`);
  console.log(`  WR2 total: ${totals.wr2Wh} Wh`);
  console.log(`  → months.js: ${newLine}`);

  if (dryRun) { console.log('  [dry-run: not written]'); process.exit(0); }

  const existingContent = readFileSync('months.js', 'utf8');
  const hasExisting = existingContent.includes(/01\.\d{2}\.\d{2}/.exec(newLine)?.[0]);

  if (hasExisting && !force) {
    const answer = await confirm('Overwrite existing month entry in months.js? [y/N] ');
    if (answer !== 'y' && answer !== 'Y') { console.log('Aborted.'); process.exit(0); }
  }

  writeFileSync('months.js', upsertInMonths(existingContent, newLine));
  console.log('  Written.');
}
