/**
 * Migrates a single SolarLog minYYMMDD.js file from its historical block
 * layout (Epoch 1 or 2 — see docs/data-format-daily.md) to the current
 * Epoch 3 layout (block 0 = SB 4200 TL, block 1 = SB 2100 TL).
 *
 * The legacy diagram code in visu.html/functions.js assumes Epoch 3 layout
 * for every min file it loads, regardless of the file's actual date. Files
 * from before 2013-01-04 use a different block order (and, for Epoch 1,
 * fewer fields), so their values land in the wrong columns and the day
 * chart renders empty. Migrating the archived files to a single consistent
 * layout fixes this without touching the legacy viewer code.
 *
 * Usage:
 *   node scripts/migrate-min-epoch.js --date DD.MM.YY [--data-dir .] \
 *     [--archive-dir archive/min-original] [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { epochFromFieldCounts } from './utils.js';

const LINE_RE = /^m\[mi\+\+\]="(\d{2}\.\d{2}\.\d{2}) (\d{2}:\d{2}:\d{2})\|([^|]+)\|([^"]+)"$/;

/**
 * Parses a raw min-file record line into its date, time and two raw blocks.
 *
 * @param {string} line - Raw line, e.g. `m[mi++]="DD.MM.YY HH:MM:SS|block0|block1"`.
 * @returns {{ date: string, time: string, b0: string[], b1: string[] } | null}
 */
export function parseLine(line) {
  const trimmed = line?.trim();
  if (!trimmed) return null;
  const match = LINE_RE.exec(trimmed);
  if (!match) return null;
  return {
    date: match[1],
    time: match[2],
    b0: match[3].split(';'),
    b1: match[4].split(';'),
  };
}

/**
 * Converts a raw block's field strings into a normalized reading, keyed by
 * field meaning rather than position. Fields absent from the source layout
 * (e.g. UDC on an Epoch 1 SB4200 block) are `null`.
 *
 * @param {string[]} fields - Semicolon-split raw field strings for one block.
 * @param {boolean} isSB4200 - True if this block belongs to the 2-string SB 4200 TL.
 * @returns {{ pac: number, pdc1: number, pdc2: number | null, wh: number, udc1: number | null, udc2: number | null }}
 */
export function blockToReading(fields, isSB4200) {
  const nums = fields.map((f) => Number.parseInt(f, 10));
  if (isSB4200) {
    const [pac, pdc1, pdc2, wh, udc1, udc2] = nums;
    return { pac, pdc1, pdc2, wh, udc1: udc1 ?? null, udc2: udc2 ?? null };
  }
  const [pac, pdc1, wh, udc1] = nums;
  return { pac, pdc1, pdc2: null, wh, udc1, udc2: null };
}

/**
 * Formats normalized readings back into Epoch 3 block strings. Missing UDC
 * fields (Epoch 1 SB4200 blocks never recorded them) are zero-filled, matching
 * the convention already used elsewhere in this archive for absent columns.
 *
 * @param {{ pac: number, pdc1: number, pdc2: number | null, wh: number, udc1: number | null, udc2: number | null }} sb4200
 * @param {{ pac: number, pdc1: number, wh: number, udc1: number | null }} sb2100
 * @returns {[string, string]} `[block0 (SB4200), block1 (SB2100)]`.
 */
export function formatEpoch3Blocks(sb4200, sb2100) {
  const b0 = [sb4200.pac, sb4200.pdc1, sb4200.pdc2, sb4200.wh, sb4200.udc1 ?? 0, sb4200.udc2 ?? 0].join(';');
  const b1 = [sb2100.pac, sb2100.pdc1, sb2100.wh, sb2100.udc1 ?? 0].join(';');
  return [b0, b1];
}

/**
 * Migrates a single record line to Epoch 3 layout. Determines the source
 * epoch (and therefore block identity) from the line's own field counts, so
 * it works on a line-by-line basis without external date context.
 *
 * @param {string} line - Raw source line.
 * @returns {{ line: string, error: null, sb4200Wh: number, sb2100Wh: number } | { line: null, error: string, sb4200Wh: null, sb2100Wh: null }}
 */
export function migrateLine(line) {
  const parsed = parseLine(line);
  if (!parsed) {
    return { line: null, error: `malformed line: ${line}`, sb4200Wh: null, sb2100Wh: null };
  }
  const epoch = epochFromFieldCounts(parsed.b0.length, parsed.b1.length);
  if (!epoch) {
    return {
      line: null,
      error: `unrecognized epoch for field counts ${parsed.b0.length}|${parsed.b1.length}: ${line}`,
      sb4200Wh: null,
      sb2100Wh: null,
    };
  }

  const b0Reading = blockToReading(parsed.b0, epoch.b0IsSB4200);
  const b1Reading = blockToReading(parsed.b1, !epoch.b0IsSB4200);
  const sb4200Reading = epoch.b0IsSB4200 ? b0Reading : b1Reading;
  const sb2100Reading = epoch.b0IsSB4200 ? b1Reading : b0Reading;

  const [sb4200Block, sb2100Block] = formatEpoch3Blocks(sb4200Reading, sb2100Reading);
  return {
    line: `m[mi++]="${parsed.date} ${parsed.time}|${sb4200Block}|${sb2100Block}"`,
    error: null,
    sb4200Wh: sb4200Reading.wh,
    sb2100Wh: sb2100Reading.wh,
  };
}

/**
 * Migrates every record line in a min-file's content to Epoch 3 layout.
 * The source epoch is read from the first parseable line and reported back;
 * malformed lines are collected as errors rather than aborting the run, and
 * a warning is raised if the SB4200/SB2100 Wh magnitudes on the identifying
 * line look reversed (SB 4200 TL, the larger inverter, should out-yield
 * SB 2100 TL under normal conditions).
 *
 * @param {string} content - Full raw file content.
 * @returns {{ epoch: number | null, lines: string[], warnings: string[], errors: string[], fatalError: string | null }}
 */
export function migrateContent(content) {
  const rawLines = (content ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (rawLines.length === 0) {
    return { epoch: null, lines: [], warnings: [], errors: [], fatalError: 'No records found in content.' };
  }

  const first = parseLine(rawLines[0]);
  const firstEpoch = first ? epochFromFieldCounts(first.b0.length, first.b1.length) : null;
  if (!firstEpoch) {
    return { epoch: null, lines: [], warnings: [], errors: [], fatalError: `Cannot determine epoch from first line: ${rawLines[0]}` };
  }

  const lines = [];
  const errors = [];
  const warnings = [];

  rawLines.forEach((rawLine, idx) => {
    const result = migrateLine(rawLine);
    if (result.error) {
      errors.push(`line ${idx + 1}: ${result.error}`);
      return;
    }
    lines.push(result.line);
    if (idx === 0 && result.sb2100Wh > result.sb4200Wh) {
      warnings.push(
        `First line reports SB2100 TL Wh (${result.sb2100Wh}) greater than SB4200 TL Wh (${result.sb4200Wh}) — verify block identity for this file.`,
      );
    }
  });

  return { epoch: firstEpoch.epoch, lines, warnings, errors, fatalError: null };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      date:          { type: 'string' },
      'data-dir':    { type: 'string', default: '.' },
      'archive-dir': { type: 'string', default: 'archive/min-original' },
      'dry-run':     { type: 'boolean', default: false },
    },
  });

  const date = values.date;
  if (!date) {
    console.error('Usage: node migrate-min-epoch.js --date DD.MM.YY [--data-dir .] [--archive-dir archive/min-original] [--dry-run]');
    process.exit(1);
  }

  const [dd, mm, yy] = date.split('.');
  if (!dd || !mm || !yy) {
    console.error(`Invalid --date: ${date} (expected DD.MM.YY)`);
    process.exit(1);
  }

  const filename = `min${yy}${mm}${dd}.js`;
  const filePath = join(values['data-dir'], filename);

  if (!existsSync(filePath)) {
    console.error(`No such file: ${filePath}`);
    process.exit(1);
  }

  const content = readFileSync(filePath, 'utf8');
  const result = migrateContent(content);

  if (result.fatalError) {
    console.error(`${filename}: ${result.fatalError}`);
    process.exit(1);
  }

  console.log(
    `${filename}: Epoch ${result.epoch} -> Epoch 3, ${result.lines.length} record(s), ${result.errors.length} error(s), ${result.warnings.length} warning(s)`,
  );
  result.warnings.forEach((w) => console.warn(`  warning: ${w}`));
  result.errors.forEach((e) => console.warn(`  error: ${e}`));
  if (result.lines.length > 0) {
    console.log(`  first: ${result.lines[0]}`);
    console.log(`  last:  ${result.lines.at(-1)}`);
  }

  if (values['dry-run']) {
    console.log('\n--dry-run: no files written. Full migrated content:\n');
    console.log(result.lines.join('\n'));
    process.exit(0);
  }

  const archiveDir = values['archive-dir'];
  mkdirSync(archiveDir, { recursive: true });
  copyFileSync(filePath, join(archiveDir, filename));
  writeFileSync(filePath, result.lines.join('\n') + '\n');

  console.log(`\nArchived original to ${join(archiveDir, filename)}`);
  console.log(`Rewrote ${filePath} in Epoch 3 format.`);
}
