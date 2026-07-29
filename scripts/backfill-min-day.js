/**
 * Reconstructs a missing SolarLog daily minute file (minYYMMDD.js) by
 * scaling a donor day's intraday Wh curve to a known daily total.
 *
 * The donor day is selected automatically from files in the same calendar
 * month across all available years, preferring the closest Wh total within
 * a configurable tolerance (default 2%).
 *
 * Usage:
 *   node scripts/backfill-min-day.js \
 *     --target   DD.MM.YY \
 *     --inv1-wh  N \
 *     --inv2-wh  N \
 *     [--tolerance 0.02]
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// m[mi++]="DD.MM.YY HH:MM:SS|pdc1;pac1;wh1;v1|pdc2;dc2;pac2;wh2;v2a;v2b"
const LINE_RE =
  /^m\[mi\+\+\]="(\d{2}\.\d{2}\.\d{2}) (\d{2}:\d{2}:\d{2})\|(\d+);(\d+);(\d+);(\d+)\|(\d+);(\d+);(\d+);(\d+);(\d+);(\d+)"$/;

/**
 * Parses the first (newest) line of a min file to extract daily Wh totals.
 *
 * @param {string | null | undefined} line - Raw line from a min file.
 * @returns {{ wh1: number, wh2: number, total: number } | null}
 */
export function parseFirstLine(line) {
  if (!line) return null;
  const m = LINE_RE.exec(line.trim());
  if (!m) return null;
  const wh1 = Number.parseInt(m[5], 10);
  const wh2 = Number.parseInt(m[10], 10);
  return { wh1, wh2, total: wh1 + wh2 };
}

/**
 * Selects the best donor candidate whose daily total is within `tolerance`
 * of `targetTotal`, preferring the one with the smallest absolute difference.
 *
 * @param {{ filename: string, total: number }[]} candidates
 * @param {number} targetTotal - Combined inv1+inv2 Wh for the target day.
 * @param {number} tolerance - Maximum fractional deviation (e.g. 0.02 = 2%).
 * @returns {{ filename: string, total: number } | null}
 */
export function findTemplate(candidates, targetTotal, tolerance) {
  const within = candidates.filter(
    (c) => Math.abs(c.total - targetTotal) / targetTotal <= tolerance,
  );
  if (!within.length) return null;
  within.sort((a, b) => Math.abs(a.total - targetTotal) - Math.abs(b.total - targetTotal));
  return within[0];
}

/**
 * Rewrites a single min-file line: replaces the date, scales wh1/wh2,
 * and zeros all PDC/PAC/Volt fields.
 *
 * @param {string} line - Source line from the template file.
 * @param {string} targetDate - Target date in DD.MM.YY format.
 * @param {number} scale1 - Scale factor for inv1 Wh (targetWh / templateWh).
 * @param {number} scale2 - Scale factor for inv2 Wh.
 * @returns {string | null} Rewritten line, or null if `line` is malformed.
 */
export function scaleRecord(line, targetDate, scale1, scale2) {
  const m = LINE_RE.exec(line?.trim());
  if (!m) return null;
  const time = m[2];
  const wh1 = Math.round(Number.parseInt(m[5], 10) * scale1);
  const wh2 = Math.round(Number.parseInt(m[10], 10) * scale2);
  return `m[mi++]="${targetDate} ${time}|0;0;${wh1};0|0;0;0;${wh2};0;0"`;
}

/**
 * Applies `scaleRecord` to every line of the template, discarding malformed ones.
 *
 * @param {string[]} templateLines - All lines from the template min file.
 * @param {string} targetDate - Target date in DD.MM.YY format.
 * @param {number} scale1 - Scale factor for inv1 Wh.
 * @param {number} scale2 - Scale factor for inv2 Wh.
 * @returns {string[]} Output lines for the new min file.
 */
export function buildOutput(templateLines, targetDate, scale1, scale2) {
  return templateLines
    .map((l) => scaleRecord(l, targetDate, scale1, scale2))
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      target:    { type: 'string' },
      'inv1-wh': { type: 'string' },
      'inv2-wh': { type: 'string' },
      tolerance: { type: 'string', default: '0.02' },
    },
  });

  const target    = values['target'];
  const inv1Wh    = Number.parseInt(values['inv1-wh'], 10);
  const inv2Wh    = Number.parseInt(values['inv2-wh'], 10);
  const tolerance = Number.parseFloat(values['tolerance']);

  if (!target || Number.isNaN(inv1Wh) || Number.isNaN(inv2Wh)) {
    console.error('Usage: node backfill-min-day.js --target DD.MM.YY --inv1-wh N --inv2-wh N [--tolerance 0.02]');
    process.exit(1);
  }

  const [dd, mm, yy] = target.split('.');
  const targetFile = `min${yy}${mm}${dd}.js`;
  const targetTotal = inv1Wh + inv2Wh;

  // Collect candidates: same calendar month, any year, not the target file itself
  const allMin = readdirSync(ROOT).filter((f) => /^min\d{6}\.js$/.test(f));
  const candidates = allMin
    .filter((f) => f.slice(5, 7) === mm && f !== targetFile)
    .map((filename) => {
      const firstLine = readFileSync(join(ROOT, filename), 'utf8').split('\n')[0];
      const parsed = parseFirstLine(firstLine);
      return parsed ? { filename, total: parsed.total } : null;
    })
    .filter(Boolean);

  const template = findTemplate(candidates, targetTotal, tolerance);

  if (!template) {
    const closest = candidates
      .sort((a, b) => Math.abs(a.total - targetTotal) - Math.abs(b.total - targetTotal))
      .at(0);
    const diff = closest
      ? ` Closest: ${closest.filename} (${closest.total} Wh, ${((Math.abs(closest.total - targetTotal) / targetTotal) * 100).toFixed(1)}% off)`
      : ' No candidates found at all.';
    console.error(`No template found within ${(tolerance * 100).toFixed(0)}% of ${targetTotal} Wh.${diff}`);
    process.exit(1);
  }

  const templateLines = readFileSync(join(ROOT, template.filename), 'utf8')
    .split('\n')
    .filter((l) => l.trim());

  const { wh1: tplWh1, wh2: tplWh2 } = parseFirstLine(templateLines[0]);
  const scale1 = inv1Wh / tplWh1;
  const scale2 = inv2Wh / tplWh2;

  const output = buildOutput(templateLines, target, scale1, scale2);
  writeFileSync(join(ROOT, targetFile), output.join('\n') + '\n');

  console.log(`Written ${output.length} records to ${targetFile}`);
  console.log(`  template: ${template.filename} (${template.total} Wh)`);
  console.log(`  inv1: ${tplWh1} → ${inv1Wh} Wh (scale=${scale1.toFixed(4)})`);
  console.log(`  inv2: ${tplWh2} → ${inv2Wh} Wh (scale=${scale2.toFixed(4)})`);
  console.log(`  first: ${output[0]}`);
  console.log(`  last:  ${output.at(-1)}`);
}
