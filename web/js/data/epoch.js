/**
 * epoch.js — SolarLog min-file layout epoch detection.
 *
 * Canonical source for the browser (web/js/data/min-file.js). Also reused by the Node
 * tooling in scripts/utils.js, which re-exports from here — scripts/ is dev-only tooling
 * never shipped to the browser, but this epoch table must not be duplicated.
 * @module epoch
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
