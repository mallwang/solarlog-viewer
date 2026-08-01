/**
 * utils.js — shared parsing utilities for SolarLog min files.
 * @module utils
 */

// Epoch boundaries (inclusive start dates in YYMMDD numeric form).
// Epoch 1: 4|4 fields — SB2100 TL | SB4200 TL (no UDC)          2006-03-15 (plant install; assumed unchanged through the archive's first file, 2006-11-03)
// Epoch 2: 4|6 fields — SB2100 TL | SB4200 TL (+UDC)            2007-03-28
// Epoch 3: 6|4 fields — SB4200 TL | SB2100 TL (blocks swapped)  2013-01-04
const EPOCH_STARTS = [
  { epoch: 1, from: 60315, b0Fields: 4, b1Fields: 4, b0IsSB4200: false },
  { epoch: 2, from: 70328, b0Fields: 4, b1Fields: 6, b0IsSB4200: false },
  { epoch: 3, from: 130104, b0Fields: 6, b1Fields: 4, b0IsSB4200: true },
];

// Wh field index by inverter type (not field count):
//   SB2100 (1-string): PAC;PDC;Wh;UDC             → index 2
//   SB4200 (2-string): PAC;PDC1;PDC2;Wh[;UDC1;UDC2] → index 3
// Epoch 1's SB4200 block has 4 fields (no UDC) but Wh is still at index 3.

/**
 * Returns the epoch descriptor for a given date string (DD.MM.YY).
 *
 * @param {string} ddmmyy - Date in DD.MM.YY format.
 * @returns {{ epoch: number, b0Fields: number, b1Fields: number, b0IsSB4200: boolean } | null}
 */
export function epochFromDate(ddmmyy) {
  const [dd, mm, yy] = ddmmyy.split('.');
  if (!dd || !mm || !yy) return null;
  const numeric = Number.parseInt(`${yy}${mm}${dd}`, 10);
  if (Number.isNaN(numeric)) return null;
  // Walk backwards through thresholds — last one whose `from` ≤ numeric wins.
  for (let i = EPOCH_STARTS.length - 1; i >= 0; i--) {
    if (numeric >= EPOCH_STARTS[i].from) return EPOCH_STARTS[i];
  }
  return null;
}

/**
 * Returns the epoch descriptor inferred from a parsed line's block field counts.
 *
 * @param {number} b0Len - Field count of block 0.
 * @param {number} b1Len - Field count of block 1.
 * @returns {{ epoch: number, b0Fields: number, b1Fields: number, b0IsSB4200: boolean } | null}
 */
export function epochFromFieldCounts(b0Len, b1Len) {
  return EPOCH_STARTS.find((e) => e.b0Fields === b0Len && e.b1Fields === b1Len) ?? null;
}

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
