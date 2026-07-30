/**
 * Reconstructs a missing SolarLog daily minute file (minYYMMDD.js) by
 * scaling a donor day's intraday Wh curve to a known daily total.
 *
 * The donor day is selected automatically from files in the same calendar
 * month across all available years, preferring the closest Wh total within
 * a configurable tolerance (default 2%).
 *
 * The output format matches the epoch of the target date (not the template),
 * so cross-epoch backfilling is supported.
 *
 * Usage:
 *   node scripts/backfill-min-day.js \
 *     --target   DD.MM.YY \
 *     --sb4200-wh N \
 *     --sb2100-wh N \
 *     [--tolerance 0.02]
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseMinFirstLine, epochFromDate, epochFromFieldCounts } from './utils.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Wh field position per inverter type (independent of epoch field count):
//   SB2100 (1-string): PAC;PDC;Wh;UDC             → Wh at index 2
//   SB4200 (2-string): PAC;PDC1;PDC2;Wh[;UDC1;UDC2] → Wh at index 3
// Epoch 1's SB4200 block is 4 fields wide (no UDC) but Wh is still at index 3.

/**
 * Emits a zeroed block with `wh` at the correct position for the given inverter.
 * @param {number} wh
 * @param {boolean} isSB4200
 * @param {number} fieldCount
 * @returns {string | null}
 */
function zeroBlock(wh, isSB4200, fieldCount) {
  if (isSB4200 && fieldCount === 4) return `0;0;0;${wh}`;       // Epoch 1 SB4200: no UDC
  if (isSB4200 && fieldCount === 6) return `0;0;0;${wh};0;0`;   // Epoch 2/3 SB4200: with UDC
  if (!isSB4200 && fieldCount === 4) return `0;0;${wh};0`;       // SB2100 (all epochs)
  return null;
}

/**
 * Parses a raw min-file line into its components, or returns null if malformed.
 *
 * @param {string} line
 * @returns {{ prefix: string, time: string, b0: string[], b1: string[] } | null}
 */
function parseLine(line) {
  const trimmed = line?.trim();
  if (!trimmed) return null;
  // Match: m[mi++]="DD.MM.YY HH:MM:SS|...|..."
  const match = /^m\[mi\+\+\]="(\d{2}\.\d{2}\.\d{2}) (\d{2}:\d{2}:\d{2})\|([^|]+)\|([^"]+)"$/.exec(trimmed);
  if (!match) return null;
  return {
    prefix: match[1],
    time: match[2],
    b0: match[3].split(';'),
    b1: match[4].split(';'),
  };
}

/**
 * Rewrites a single min-file line into `targetEpoch` format, scaling Wh values
 * by `sb4200Scale` and `sb2100Scale`. Zeroes all non-Wh fields.
 *
 * @param {string} line - Source line from the template file.
 * @param {string} targetDate - Target date in DD.MM.YY format.
 * @param {{ b0Fields: number, b1Fields: number, b0IsSB4200: boolean }} targetEpoch
 * @param {number} sb4200Scale - Scale factor for SB4200 TL Wh.
 * @param {number} sb2100Scale - Scale factor for SB2100 TL Wh.
 * @returns {string | null} Rewritten line, or null if `line` is malformed.
 */
export function scaleRecord(line, targetDate, targetEpoch, sb4200Scale, sb2100Scale) {
  const parsed = parseLine(line);
  if (!parsed) return null;
  const srcEpoch = epochFromFieldCounts(parsed.b0.length, parsed.b1.length);
  if (!srcEpoch) return null;

  // Wh index depends on inverter type, not field count (mirrors utils.js logic).
  const b0WhIdx = srcEpoch.b0IsSB4200 ? 3 : 2;
  const b1WhIdx = srcEpoch.b0IsSB4200 ? 2 : 3;

  const b0Wh = Number.parseInt(parsed.b0[b0WhIdx], 10);
  const b1Wh = Number.parseInt(parsed.b1[b1WhIdx], 10);
  if (Number.isNaN(b0Wh) || Number.isNaN(b1Wh)) return null;

  // Map block Wh to inverter identity, then apply the matching scale.
  const srcSB4200Wh = srcEpoch.b0IsSB4200 ? b0Wh : b1Wh;
  const srcSB2100Wh = srcEpoch.b0IsSB4200 ? b1Wh : b0Wh;
  const outSB4200Wh = Math.round(srcSB4200Wh * sb4200Scale);
  const outSB2100Wh = Math.round(srcSB2100Wh * sb2100Scale);

  // Assign to blocks according to target epoch layout.
  const outB0Wh = targetEpoch.b0IsSB4200 ? outSB4200Wh : outSB2100Wh;
  const outB1Wh = targetEpoch.b0IsSB4200 ? outSB2100Wh : outSB4200Wh;

  const b0Str = zeroBlock(outB0Wh, targetEpoch.b0IsSB4200, targetEpoch.b0Fields);
  const b1Str = zeroBlock(outB1Wh, !targetEpoch.b0IsSB4200, targetEpoch.b1Fields);
  if (!b0Str || !b1Str) return null;

  return `m[mi++]="${targetDate} ${parsed.time}|${b0Str}|${b1Str}"`;
}

/**
 * Selects the best donor candidate whose daily total is within `tolerance`
 * of `targetTotal`, preferring the one with the smallest absolute difference.
 *
 * @param {{ filename: string, total: number }[]} candidates
 * @param {number} targetTotal - Combined SB4200+SB2100 Wh for the target day.
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
 * Applies `scaleRecord` to every line of the template, discarding malformed ones.
 *
 * @param {string[]} templateLines - All lines from the template min file.
 * @param {string} targetDate - Target date in DD.MM.YY format.
 * @param {{ b0Fields: number, b1Fields: number, b0IsSB4200: boolean }} targetEpoch
 * @param {number} sb4200Scale - Scale factor for SB4200 TL Wh.
 * @param {number} sb2100Scale - Scale factor for SB2100 TL Wh.
 * @returns {string[]} Output lines for the new min file.
 */
export function buildOutput(templateLines, targetDate, targetEpoch, sb4200Scale, sb2100Scale) {
  return templateLines
    .map((l) => scaleRecord(l, targetDate, targetEpoch, sb4200Scale, sb2100Scale))
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      target:      { type: 'string' },
      'sb4200-wh': { type: 'string' },
      'sb2100-wh': { type: 'string' },
      tolerance:   { type: 'string', default: '0.02' },
    },
  });

  const target    = values['target'];
  const sb4200Wh  = Number.parseInt(values['sb4200-wh'], 10);
  const sb2100Wh  = Number.parseInt(values['sb2100-wh'], 10);
  const tolerance = Number.parseFloat(values['tolerance']);

  if (!target || Number.isNaN(sb4200Wh) || Number.isNaN(sb2100Wh)) {
    console.error('Usage: node backfill-min-day.js --target DD.MM.YY --sb4200-wh N --sb2100-wh N [--tolerance 0.02]');
    process.exit(1);
  }

  const targetEpoch = epochFromDate(target);
  if (!targetEpoch) {
    console.error(`Cannot determine epoch for target date: ${target}`);
    process.exit(1);
  }

  const [dd, mm, yy] = target.split('.');
  const targetFile  = `min${yy}${mm}${dd}.js`;
  const targetTotal = sb4200Wh + sb2100Wh;

  // Collect candidates: same calendar month, any year, not the target file itself.
  const allMin = readdirSync(ROOT).filter((f) => /^min\d{6}\.js$/.test(f));
  const candidates = allMin
    .filter((f) => f.slice(5, 7) === mm && f !== targetFile)
    .map((filename) => {
      const content = readFileSync(join(ROOT, filename), 'utf8');
      const parsed = parseMinFirstLine(content);
      return parsed ? { filename, total: parsed.totalWh } : null;
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

  const tplParsed = parseMinFirstLine(templateLines[0]);
  const sb4200Scale = tplParsed.sb4200Wh > 0 ? sb4200Wh / tplParsed.sb4200Wh : 0;
  const sb2100Scale = tplParsed.sb2100Wh > 0 ? sb2100Wh / tplParsed.sb2100Wh : 0;

  const output = buildOutput(templateLines, target, targetEpoch, sb4200Scale, sb2100Scale);
  writeFileSync(join(ROOT, targetFile), output.join('\n') + '\n');

  console.log(`Written ${output.length} records to ${targetFile} (Epoch ${targetEpoch.epoch})`);
  console.log(`  template: ${template.filename} (${template.total} Wh)`);
  console.log(`  SB4200: ${tplParsed.sb4200Wh} → ${sb4200Wh} Wh (scale=${sb4200Scale.toFixed(4)})`);
  console.log(`  SB2100: ${tplParsed.sb2100Wh} → ${sb2100Wh} Wh (scale=${sb2100Scale.toFixed(4)})`);
  console.log(`  first: ${output[0]}`);
  console.log(`  last:  ${output.at(-1)}`);
}
