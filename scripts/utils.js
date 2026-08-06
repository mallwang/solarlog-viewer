/**
 * utils.js — shared parsing utilities for SolarLog min files.
 * @module utils
 */

// Epoch detection lives in web/js/data/epoch.js (the browser's canonical copy, since web/ is
// the sole directory shipped to the SolarLog device's static host); re-exported here for the
// Node-side tooling in this directory.
export { epochFromDate, epochFromFieldCounts } from '../web/js/data/epoch.js';
import { epochFromFieldCounts } from '../web/js/data/epoch.js';

// Wh field index by inverter type (not field count):
//   SB2100 (1-string): PAC;PDC;Wh;UDC             → index 2
//   SB4200 (2-string): PAC;PDC1;PDC2;Wh[;UDC1;UDC2] → index 3
// Epoch 1's SB4200 block has 4 fields (no UDC) but Wh is still at index 3.

/**
 * Extracts daily Wh totals from the first (newest) line of a min file.
 * Accepts either a single line or full file content (reads the first line).
 * Handles all three epoch layouts without requiring a date lookup.
 *
 * Returns Wh keyed by inverter identity (SB4200 / SB2100), not block position,
 * so callers remain correct across cross-epoch scaling.
 *
 * @param {string | null | undefined} content - First line or full file content.
 * @returns {{ sb4200Wh: number, sb2100Wh: number, totalWh: number } | null}
 */
export function parseMinFirstLine(content) {
  if (!content) return null;
  const line = content.split('\n')[0].trim();
  const pipeIdx = line.indexOf('|');
  if (pipeIdx === -1) return null;
  const blocks = line.slice(pipeIdx + 1).replace(/"$/, '').split('|');
  if (blocks.length < 2) return null;
  const b0 = blocks[0].split(';');
  const b1 = blocks[1].split(';');
  const ep = epochFromFieldCounts(b0.length, b1.length);
  if (!ep) return null;
  // Wh index depends on inverter type (string count), not field count.
  const b0WhIdx = ep.b0IsSB4200 ? 3 : 2;
  const b1WhIdx = ep.b0IsSB4200 ? 2 : 3;
  const b0Wh = Number.parseInt(b0[b0WhIdx], 10);
  const b1Wh = Number.parseInt(b1[b1WhIdx], 10);
  if (Number.isNaN(b0Wh) || Number.isNaN(b1Wh)) return null;
  const sb4200Wh = ep.b0IsSB4200 ? b0Wh : b1Wh;
  const sb2100Wh = ep.b0IsSB4200 ? b1Wh : b0Wh;
  // wr1Wh/wr2Wh are block-positional aliases used by days_hist/months/years format.
  return { sb4200Wh, sb2100Wh, totalWh: sb4200Wh + sb2100Wh, wr1Wh: b0Wh, wr2Wh: b1Wh };
}
