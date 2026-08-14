import { extractAssignedStrings } from './parse-lines.js';

const OFFLINE_STATUS_LABEL = 'Offline';

/**
 * Splits one `events.js`/`events_day.js` line (already extracted via
 * `parse-lines.js#extractAssignedStrings`) into its 5 raw fields.
 * @param {string} line - e.g. "13.08.26 06:37:30;13.08.26 06:37:44;0;6;0"
 * @returns {{ startRaw: string, endRaw: string, inverterIdx: number, statusCode: number,
 *   errorCode: number, dedupeKey: string } | null} `null` for a malformed line (FR-009) — caller
 *   filters these out, this function never throws.
 */
export function parseEventLine(line) {
  const fields = line.split(';');
  if (fields.length !== 5) return null;
  const [startRaw, endRaw, inverterIdxRaw, statusCodeRaw, errorCodeRaw] = fields;
  const inverterIdx = Number.parseInt(inverterIdxRaw, 10);
  const statusCode = Number.parseInt(statusCodeRaw, 10);
  const errorCode = Number.parseInt(errorCodeRaw, 10);
  if (
    !Number.isInteger(inverterIdx) ||
    !Number.isInteger(statusCode) ||
    !Number.isInteger(errorCode)
  ) {
    return null;
  }
  return { startRaw, endRaw, inverterIdx, statusCode, errorCode, dedupeKey: line };
}

/**
 * Parses a full `events.js`/`events_day.js` file's text into RawEventLine-shaped records
 * (`parseEventLine` applied to every `extractAssignedStrings()` result), skipping malformed
 * lines (FR-009).
 * @param {string} fileText
 * @returns {ReturnType<typeof parseEventLine>[]} Never `null` entries — malformed lines are
 *   already filtered out.
 */
export function parseEventsFile(fileText) {
  return extractAssignedStrings(fileText)
    .map(parseEventLine)
    .filter((record) => record !== null);
}

/**
 * Combines the historical (`events.js`) and today's (`events_day.js`) raw records into one
 * deduplicated list (FR-008, research.md R5 amended). Identity is `(startRaw, inverterIdx)`, not
 * the exact raw line: the device can snapshot an event into `events.js` while it's still open
 * (empty `endRaw`) and only fill in the real end time once it closes, in `events_day.js` — so the
 * same event's two copies are *not* always byte-identical (R5's original assumption). When
 * identities collide, whichever copy is closed (non-empty `endRaw`) wins over one still open,
 * regardless of which file it came from; if both are closed (or both still open), the
 * first-encountered copy wins (history file first, then today's).
 * @param {ReturnType<typeof parseEventsFile>} historyRecords
 * @param {ReturnType<typeof parseEventsFile>} todayRecords
 * @returns {ReturnType<typeof parseEventsFile>}
 */
export function mergeAndDedupeEvents(historyRecords, todayRecords) {
  const byIdentity = new Map();
  const order = [];
  for (const record of [...historyRecords, ...todayRecords]) {
    const identityKey = `${record.startRaw}|${record.inverterIdx}`;
    const existing = byIdentity.get(identityKey);
    if (!existing) {
      byIdentity.set(identityKey, record);
      order.push(identityKey);
      continue;
    }
    if (record.endRaw !== '' && existing.endRaw === '') {
      byIdentity.set(identityKey, record);
    }
  }
  return order.map((identityKey) => byIdentity.get(identityKey));
}

/**
 * Parses `"DD.MM.YY HH:mm:ss"` into a local-time `Date` (research.md R4) — all observed data
 * (2006–2026) is unambiguously 20xx, so a plain `2000 + yy` offset is used rather than
 * replicating the legacy renderer's own coercion-based year reconstruction.
 * @param {string} raw
 * @returns {Date | null} `null` for an empty string — this is exactly how "ongoing, no end time
 *   yet" is encoded (FR-003).
 */
function parseEventTimestamp(raw) {
  if (!raw) return null;
  const [datePart, timePart] = raw.split(' ');
  const [dd, mm, yy] = datePart.split('.').map((n) => Number.parseInt(n, 10));
  const [HH, MM, SS] = timePart.split(':').map((n) => Number.parseInt(n, 10));
  return new Date(2000 + yy, mm - 1, dd, HH, MM, SS);
}

/**
 * Resolves an inverter's status code into its human-readable label, falling back to the fixed
 * `"Offline"` catch-all for any out-of-range code or unknown inverter (research.md R3, FR-010) —
 * matches the legacy `events.html` parser's own padding behavior byte-for-byte.
 * @param {string[][]} statusCodes
 * @param {number} inverterIdx
 * @param {number} code
 * @returns {string} Never empty.
 */
function resolveStatusLabel(statusCodes, inverterIdx, code) {
  const labels = statusCodes[inverterIdx] ?? [];
  return code < labels.length ? labels[code] : OFFLINE_STATUS_LABEL;
}

/**
 * Resolves an inverter's error code into its human-readable label (research.md R3, FR-010):
 * `code === 0` -> `{ errorLabel: null, errorRawCode: null }` (no error, renders as a dash);
 * a known code -> `{ errorLabel: <label>, errorRawCode: null }`; an out-of-range code or unknown
 * inverter -> `{ errorLabel: null, errorRawCode: code }` (UI renders "Code {code} (unbekannt)").
 * @param {string[][]} errorCodes
 * @param {number} inverterIdx
 * @param {number} code
 * @returns {{ errorLabel: string | null, errorRawCode: number | null }}
 */
function resolveErrorLabel(errorCodes, inverterIdx, code) {
  if (code === 0) return { errorLabel: null, errorRawCode: null };
  const labels = errorCodes[inverterIdx] ?? [];
  if (code < labels.length) return { errorLabel: labels[code], errorRawCode: null };
  return { errorLabel: null, errorRawCode: code };
}

/**
 * Enriches one raw record into the UI-facing Event shape (see data-model.md) — timestamp
 * parsing, ongoing/duration derivation, per-inverter status/error label resolution with
 * fallbacks (research.md R3/R4).
 * @param {ReturnType<typeof parseEventLine>} rawRecord
 * @param {{ statusCodes: string[][], errorCodes: string[][] }} codes - `plant.statusCodes`/
 *   `plant.errorCodes` (see `plant.js`).
 * @returns {{ start: Date, end: Date | null, isOngoing: boolean, durationMs: number | null,
 *   inverterIdx: number, statusCode: number, statusLabel: string, errorCode: number,
 *   errorLabel: string | null, errorRawCode: number | null, dedupeKey: string }} Event
 */
export function enrichEvent(rawRecord, { statusCodes, errorCodes }) {
  const { startRaw, endRaw, inverterIdx, statusCode, errorCode, dedupeKey } = rawRecord;
  const start = parseEventTimestamp(startRaw);
  const end = parseEventTimestamp(endRaw);
  const { errorLabel, errorRawCode } = resolveErrorLabel(errorCodes, inverterIdx, errorCode);

  return {
    start,
    end,
    isOngoing: end === null,
    durationMs: end === null ? null : end.getTime() - start.getTime(),
    inverterIdx,
    statusCode,
    statusLabel: resolveStatusLabel(statusCodes, inverterIdx, statusCode),
    errorCode,
    errorLabel,
    errorRawCode,
    dedupeKey,
  };
}
