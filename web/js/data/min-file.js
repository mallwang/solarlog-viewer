import { epochFromDate, epochFromFieldCounts } from './epoch.js';

const LINE_RE = /^m\[mi\+\+]="(\d{2})\.(\d{2})\.(\d{2}) (\d{2}:\d{2}:\d{2})\|([^|]+)\|([^"]+)"$/;

function isoDateFromDdMmYy(dd, mm, yy) {
  return `20${yy}-${mm}-${dd}`;
}

function parseSb4200Block(fields) {
  return {
    pacW: Number.parseInt(fields[0], 10),
    pdcW: [Number.parseInt(fields[1], 10), Number.parseInt(fields[2], 10)],
    dailyYieldWh: Number.parseInt(fields[3], 10),
    udcV:
      fields.length >= 6 ? [Number.parseInt(fields[4], 10), Number.parseInt(fields[5], 10)] : null,
  };
}

function parseSb2100Block(fields) {
  return {
    pacW: Number.parseInt(fields[0], 10),
    pdcW: [Number.parseInt(fields[1], 10)],
    dailyYieldWh: Number.parseInt(fields[2], 10),
    udcV: [Number.parseInt(fields[3], 10)],
  };
}

const CUR_DATUM_RE = /var Datum="(\d{2})\.(\d{2})\.(\d{2})"/;
const CUR_UHRZEIT_RE = /var Uhrzeit="(\d{2}:\d{2}:\d{2})"/;
const CUR_PAC_ARR_RE = /PacArr\s*=\s*(\[[\s\S]*?\]\s*\]);/;
const CUR_PDC_ARR_RE = /PdcArr\s*=\s*(\[[\s\S]*?\]\s*\]);/;

/**
 * Parses min_cur.js's live-reading snapshot (a distinct var-based format, unlike the
 * `m[mi++]=` line format used by historical min{YYMMDD}.js files) into a single-reading
 * DailyTrace. `0 W` is a real reading (plant idle at night), never treated as missing data.
 * @param {string} fileText
 * @returns {{ date: string, epoch: null, readings: object[] } | null}
 */
function parseLiveReading(fileText) {
  const datumMatch = CUR_DATUM_RE.exec(fileText);
  const uhrzeitMatch = CUR_UHRZEIT_RE.exec(fileText);
  const pacArrMatch = CUR_PAC_ARR_RE.exec(fileText);
  if (!datumMatch || !uhrzeitMatch || !pacArrMatch) return null;

  const [, dd, mm, yy] = datumMatch;
  const pacArr = JSON.parse(pacArrMatch[1]);
  const pdcArrMatch = CUR_PDC_ARR_RE.exec(fileText);
  const pdcArr = pdcArrMatch ? JSON.parse(pdcArrMatch[1]) : pacArr.map(() => []);

  const perInverter = {};
  pacArr.forEach((pac, i) => {
    perInverter[i + 1] = {
      pacW: pac[0],
      pdcW: pdcArr[i] ?? [],
      dailyYieldWh: null,
      udcV: null,
    };
  });

  return {
    date: isoDateFromDdMmYy(dd, mm, yy),
    epoch: null,
    readings: [{ timestamp: `${isoDateFromDdMmYy(dd, mm, yy)}T${uhrzeitMatch[1]}`, perInverter }],
  };
}

/**
 * Parses a min{YYMMDD}.js (historical, `m[mi++]=` lines) or min_cur.js (live snapshot, var
 * assignments) file into a DailyTrace. Block layout for historical files is resolved per-line
 * via `epochFromFieldCounts` (scripts/utils.js) since archived files have been normalised to
 * the current block order regardless of their original date; `dateDdMmYy` is only a fallback
 * for lines that somehow fail field-count detection.
 * @param {string} fileText
 * @param {string} dateDdMmYy - 'DD.MM.YY', used for the DailyTrace date and as an epoch fallback.
 * @returns {{ date: string, epoch: number | null, readings: object[] }} DailyTrace
 */
export function parseMinFile(fileText, dateDdMmYy) {
  const liveReading = parseLiveReading(fileText);
  if (liveReading) return liveReading;

  const [ddReq, mmReq, yyReq] = dateDdMmYy.split('.');
  const fallbackEpoch = epochFromDate(dateDdMmYy)?.epoch ?? null;
  let epoch = fallbackEpoch;
  const readings = [];

  for (const line of fileText.split('\n')) {
    const match = LINE_RE.exec(line.trim());
    if (!match) continue;
    const [, dd, mm, yy, time, b0raw, b1raw] = match;
    const b0 = b0raw.split(';');
    const b1 = b1raw.split(';');
    const descriptor = epochFromFieldCounts(b0.length, b1.length);
    if (!descriptor) continue;
    epoch = descriptor.epoch;

    const sb4200Fields = descriptor.b0IsSB4200 ? b0 : b1;
    const sb2100Fields = descriptor.b0IsSB4200 ? b1 : b0;

    readings.push({
      timestamp: `${isoDateFromDdMmYy(dd, mm, yy)}T${time}`,
      perInverter: {
        1: parseSb4200Block(sb4200Fields),
        2: parseSb2100Block(sb2100Fields),
      },
    });
  }

  readings.reverse();

  return { date: isoDateFromDdMmYy(ddReq, mmReq, yyReq), epoch, readings };
}
