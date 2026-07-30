/**
 * fill-days-hist.js — fill a missing day entry in days_hist.js.
 *
 * Two-pass lookup: Pass 1 searches all days*.js files verbatim; Pass 2
 * reads the corresponding minYYMMDD.js first line with feed=0.
 *
 * @module fill-days-hist
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { parseMinFirstLine } from './utils.js';

const DA_LINE_RE = /^da\[dx\+\+\]="(\d{2}\.\d{2}\.\d{2})\|(\d+);(\d+)\|(\d+);(\d+)"/;

/**
 * Parse one or more days_hist-format file contents into a merged map.
 * @param {string[]} contents
 * @returns {Map<string, { wr1Wh: number, wr1Feed: number, wr2Wh: number, wr2Feed: number }>}
 */
export function parseDaysHistFiles(contents) {
  const map = new Map();
  for (const content of contents) {
    for (const line of content.split('\n')) {
      const m = DA_LINE_RE.exec(line.trim());
      if (!m) continue;
      map.set(m[1], {
        wr1Wh: Number.parseInt(m[2], 10),
        wr1Feed: Number.parseInt(m[3], 10),
        wr2Wh: Number.parseInt(m[4], 10),
        wr2Feed: Number.parseInt(m[5], 10),
      });
    }
  }
  return map;
}

/**
 * Pass 1: search all days file contents for a date entry.
 * @param {string} dateKey - 'DD.MM.YY'
 * @param {string[]} daysContents
 * @returns {{ wr1Wh: number, wr1Feed: number, wr2Wh: number, wr2Feed: number } | null}
 */
export function findInDaysFiles(dateKey, daysContents) {
  const map = parseDaysHistFiles(daysContents);
  return map.get(dateKey) ?? null;
}

/**
 * Pass 2: extract Wh totals from the first line of a min file (feed=0).
 * @param {string} content
 * @returns {{ wr1Wh: number, wr1Feed: number, wr2Wh: number, wr2Feed: number } | null}
 */
export function aggregateFromMin(content) {
  const parsed = parseMinFirstLine(content);
  if (!parsed) return null;
  return { wr1Wh: parsed.wr1Wh, wr1Feed: 0, wr2Wh: parsed.wr2Wh, wr2Feed: 0 }; // block-positional aliases from utils
}

/**
 * Format a days_hist.js entry line.
 * @param {string} dateKey - 'DD.MM.YY'
 * @param {{ wr1Wh: number, wr1Feed: number, wr2Wh: number, wr2Feed: number }} record
 * @returns {string}
 */
export function formatDaysHistEntry(dateKey, record) {
  return `da[dx++]="${dateKey}|${record.wr1Wh};${record.wr1Feed}|${record.wr2Wh};${record.wr2Feed}"`;
}

/**
 * Insert a new da[dx++] line into an existing lines array, newest-first.
 * Date comparison is done by converting 'DD.MM.YY' to ISO (YYYY-MM-DD).
 * @param {string[]} existingLines
 * @param {string} newLine
 * @returns {string[]}
 */
export function insertEntryInOrder(existingLines, newLine) {
  const toIso = (line) => {
    const m = DA_LINE_RE.exec(line);
    if (!m) return '';
    const [dd, mm, yy] = m[1].split('.');
    return `20${yy}-${mm}-${dd}`;
  };
  const newIso = toIso(newLine);
  const idx = existingLines.findIndex((l) => toIso(l) < newIso);
  const result = [...existingLines];
  if (idx === -1) {
    result.push(newLine);
  } else {
    result.splice(idx, 0, newLine);
  }
  return result;
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(question, (a) => { rl.close(); res(a); }));
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const args = process.argv.slice(2);
  const yyyymm = args.find((a) => /^\d{4}-\d{2}$/.test(a));
  if (!yyyymm) { console.error('Usage: fill-days-hist.js YYYY-MM [--dry-run] [--force]'); process.exit(2); }

  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  const [yyyy, mm] = yyyymm.split('-');
  const yy = yyyy.slice(2);

  // Build list of days in the month
  const daysInMonth = new Date(Number(yyyy), Number(mm), 0).getDate();
  const allFiles = readdirSync('.');
  const daysFiles = allFiles.filter((f) => /^days.*\.js$/.test(f));
  const daysContents = daysFiles.map((f) => readFileSync(f, 'utf8'));

  const existingContent = readFileSync('days_hist.js', 'utf8');
  let existingLines = existingContent.split('\n').filter((l) => l.trim());

  let alreadyPresent = 0, filledPass1 = 0, filledPass2 = 0, unfillable = 0;
  const pass1Details = [], pass2Details = [];
  const newLines = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dd = String(d).padStart(2, '0');
    const dateKey = `${dd}.${mm}.${yy}`;
    const isoDate = `${yyyy}-${mm}-${dd}`;
    const minFilename = `min${yy}${mm}${dd}.js`;

    if (existingLines.some((l) => l.includes(dateKey))) {
      alreadyPresent++;
      continue;
    }

    const record = findInDaysFiles(dateKey, daysContents);
    if (record) {
      filledPass1++;
      pass1Details.push(isoDate);
      newLines.push({ dateKey, record });
      continue;
    }

    if (allFiles.includes(minFilename)) {
      const minRecord = aggregateFromMin(readFileSync(minFilename, 'utf8'));
      if (minRecord) {
        filledPass2++;
        pass2Details.push(`${isoDate} (${minFilename})`);
        newLines.push({ dateKey, record: minRecord });
        continue;
      }
    }

    unfillable++;
    console.error(`  Unfillable: ${isoDate} — no days file entry and no ${minFilename}`);
  }

  console.log(`fill-days-hist ${yyyymm}`);
  console.log(`  Checked: ${daysInMonth} days`);
  console.log(`  Already present: ${alreadyPresent}`);
  console.log(`  Filled from days*.js (pass 1): ${filledPass1}${pass1Details.length ? ' — ' + pass1Details.join(', ') : ''}`);
  console.log(`  Filled from min file (pass 2): ${filledPass2}${pass2Details.length ? ' — ' + pass2Details.join(', ') : ''}`);
  console.log(`  Unfillable: ${unfillable}`);

  if (dryRun) { console.log('  [dry-run: not written]'); process.exit(unfillable > 0 ? 1 : 0); }
  if (newLines.length === 0) { process.exit(unfillable > 0 ? 1 : 0); }

  if (!force) {
    const answer = await confirm(`Write ${newLines.length} new entries to days_hist.js? [y/N] `);
    if (answer !== 'y' && answer !== 'Y') { console.log('Aborted.'); process.exit(0); }
  }

  for (const { dateKey, record } of newLines) {
    existingLines = insertEntryInOrder(existingLines, formatDaysHistEntry(dateKey, record));
  }
  writeFileSync('days_hist.js', existingLines.join('\n') + '\n');
  console.log('  Written.');
  process.exit(unfillable > 0 ? 1 : 0);
}
