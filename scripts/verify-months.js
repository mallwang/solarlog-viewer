/**
 * verify-months.js — verify a months.js entry against the sum of its min*.js daily files.
 *
 * Usage: node scripts/verify-months.js YYYY-MM
 *
 * @module verify-months
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectMonthMinFiles, aggregateMonth } from './fill-months.js';

/**
 * Parse the months.js entry for a given YYYY-MM.
 * @param {string} content - full content of months.js
 * @param {string} yyyymm - 'YYYY-MM'
 * @returns {{ wr1Wh: number, wr2Wh: number } | null}
 */
export function parseMonthsEntry(content, yyyymm) {
  const [yyyy, mm] = yyyymm.split('-');
  const yy = yyyy.slice(2);
  const dateKey = `01.${mm}.${yy}`;
  const line = content.split('\n').find((l) => l.includes(dateKey));
  if (!line) return null;
  const m = /\|(\d+)\|(\d+)"/.exec(line);
  if (!m) return null;
  return { wr1Wh: Number.parseInt(m[1], 10), wr2Wh: Number.parseInt(m[2], 10) };
}

/**
 * Format a human-readable comparison report.
 * @param {string} yyyymm
 * @param {{ wr1Wh: number, wr2Wh: number }} recorded - value from months.js
 * @param {{ wr1Wh: number, wr2Wh: number }} computed - sum from min files
 * @param {number} fileCount
 * @returns {string}
 */
export function formatReport(yyyymm, recorded, computed, fileCount) {
  const match = recorded.wr1Wh === computed.wr1Wh && recorded.wr2Wh === computed.wr2Wh;
  const status = match ? 'MATCH' : 'MISMATCH';
  const totalRec = recorded.wr1Wh + recorded.wr2Wh;
  const totalCom = computed.wr1Wh + computed.wr2Wh;
  const diff1 = recorded.wr1Wh - computed.wr1Wh;
  const diff2 = recorded.wr2Wh - computed.wr2Wh;
  const diffT = totalRec - totalCom;
  const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);

  const lines = [
    `verify-months ${yyyymm}  [${status}]`,
    `  Min files : ${fileCount} files`,
    ``,
    `             months.js   min files     diff`,
    `  WR1 Wh :  ${String(recorded.wr1Wh).padStart(9)}   ${String(computed.wr1Wh).padStart(9)}   ${sign(diff1)}`,
    `  WR2 Wh :  ${String(recorded.wr2Wh).padStart(9)}   ${String(computed.wr2Wh).padStart(9)}   ${sign(diff2)}`,
    `  Total   :  ${String(totalRec).padStart(9)}   ${String(totalCom).padStart(9)}   ${sign(diffT)}`,
    `  Total kWh: ${(totalRec / 1000).toFixed(1).padStart(9)}   ${(totalCom / 1000).toFixed(1).padStart(9)}`,
  ];
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
  const yyyymm = process.argv[2];
  if (!yyyymm || !/^\d{4}-\d{2}$/.test(yyyymm)) {
    console.error('Usage: node scripts/verify-months.js YYYY-MM');
    process.exit(2);
  }

  const allFiles = readdirSync('.');
  const matching = collectMonthMinFiles(allFiles, yyyymm);
  if (matching.length === 0) {
    console.error(`No min files found for ${yyyymm}`);
    process.exit(1);
  }

  const contents = matching.map((f) => readFileSync(f, 'utf8'));
  const computed = aggregateMonth(contents);

  const monthsContent = readFileSync('months.js', 'utf8');
  const recorded = parseMonthsEntry(monthsContent, yyyymm);
  if (!recorded) {
    console.error(`No months.js entry found for ${yyyymm}`);
    process.exit(1);
  }

  console.log(formatReport(yyyymm, recorded, computed, matching.length));
}
