/**
 * fill-years.js — regenerate a year entry in years.js from minYYYY*.js files.
 *
 * Aggregates WR1 and WR2 daily totals from all min files for the given year,
 * then upserts the result into years.js.
 *
 * @module fill-years
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { parseMinFirstLine } from './utils.js';

/**
 * Filter filenames to those matching the given YYYY.
 * @param {string[]} allFilenames
 * @param {string} yyyy - four-digit year string
 * @returns {string[]}
 */
export function collectYearMinFiles(allFilenames, yyyy) {
  const yy = yyyy.slice(2);
  const prefix = `min${yy}`;
  return allFilenames.filter((f) => f.startsWith(prefix) && /^min\d{6}\.js$/.test(f));
}

/**
 * Sum WR1 and WR2 Wh across an array of min file contents.
 * @param {string[]} minContents
 * @returns {{ wr1Wh: number, wr2Wh: number }}
 */
export function aggregateYear(minContents) {
  let wr1Wh = 0, wr2Wh = 0;
  for (const c of minContents) {
    const parsed = parseMinFirstLine(c);
    if (parsed) { wr1Wh += parsed.wr1Wh; wr2Wh += parsed.wr2Wh; }
  }
  return { wr1Wh, wr2Wh };
}

/**
 * Format a years.js entry line.
 * @param {string} yyyy - four-digit year string
 * @param {{ wr1Wh: number, wr2Wh: number }} totals
 * @returns {string}
 */
export function formatYearEntry(yyyy, totals) {
  const yy = yyyy.slice(2);
  return `ye[yx++]="01.01.${yy}|${totals.wr1Wh}|${totals.wr2Wh}"`;
}

/**
 * Upsert a year line into years.js content (replace if present, else append).
 * @param {string} existingContent
 * @param {string} newLine
 * @returns {string}
 */
export function upsertInYears(existingContent, newLine) {
  const dateKey = /01\.01\.\d{2}/.exec(newLine)?.[0];
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
  const yyyy = args.find((a) => /^\d{4}$/.test(a));
  if (!yyyy) { console.error('Usage: fill-years.js YYYY [--dry-run] [--force]'); process.exit(2); }
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  const allFiles = readdirSync('.');
  const matching = collectYearMinFiles(allFiles, yyyy);
  if (matching.length === 0) {
    console.error(`No min files found for ${yyyy}`);
    process.exit(1);
  }

  const contents = matching.map((f) => readFileSync(f, 'utf8'));
  const totals = aggregateYear(contents);
  const newLine = formatYearEntry(yyyy, totals);

  console.log(`fill-years ${yyyy}`);
  console.log(`  Min files: ${matching.length}`);
  console.log(`  WR1 total: ${totals.wr1Wh} Wh`);
  console.log(`  WR2 total: ${totals.wr2Wh} Wh`);
  console.log(`  → years.js: ${newLine}`);

  if (dryRun) { console.log('  [dry-run: not written]'); process.exit(0); }

  const existingContent = readFileSync('years.js', 'utf8');
  const yy = yyyy.slice(2);
  const hasExisting = existingContent.includes(`01.01.${yy}`);

  if (hasExisting && !force) {
    const answer = await confirm('Overwrite existing year entry in years.js? [y/N] ');
    if (answer !== 'y' && answer !== 'Y') { console.log('Aborted.'); process.exit(0); }
  }

  writeFileSync('years.js', upsertInYears(existingContent, newLine));
  console.log('  Written.');
}
