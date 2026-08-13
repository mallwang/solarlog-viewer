const WR_INFO_LINE = /^WRInfo\[(\d+)]\s*=\s*new Array\((.*)\)\s*$/;

function extractQuotedVar(fileText, name) {
  const match = new RegExp(`var ${name}\\s*=\\s*"([^"]*)"`).exec(fileText);
  return match ? match[1] : '';
}

function extractNumericVar(fileText, name) {
  const match = new RegExp(`var ${name}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`).exec(fileText);
  return match ? Number.parseFloat(match[1]) : 0;
}

function parseArrayArg(rawArg) {
  const trimmed = rawArg.trim();
  const quoted = /^"([^"]*)"$/.exec(trimmed);
  if (quoted) return quoted[1];
  if (trimmed === 'null') return null;
  return Number.parseFloat(trimmed);
}

function commissionedDateToIso(ddMmYyyy) {
  const [dd, mm, yyyy] = ddMmYyyy.split('.');
  if (!dd || !mm || !yyyy) return '';
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Patches specific known encoding corruption in this device's base_vars.js export: some earlier
 * re-save of the file already collapsed non-ASCII bytes into U+FFFD (the "replacement
 * character") before we ever see it, so the original byte is gone from this text - there's no
 * decoding fix that recovers it, and re-syncing from the SolarLog reproduces the same corrupted
 * export. Patches the exact substrings observed (the degree sign in HPAusricht, "März" in
 * BannerZeile3, the Euro sign in Currency) rather than a blanket "any U+FFFD -> X" substitution,
 * which could as easily mangle some other field that happens to contain U+FFFD for an unrelated
 * reason.
 * @param {string} fileText
 * @returns {string}
 */
function fixKnownMojibake(fileText) {
  return fileText
    .replaceAll(/(\d) ?�/g, '$1°')
    .replaceAll('M�rz', 'März')
    .replaceAll('Currency ="�"', 'Currency ="€"');
}

/**
 * Parses `var sollMonth = new Array(2,6,9,...)` — 12 numbers, index 0 = January, giving each
 * month's percentage share of SollYearKWP's yearly specific-yield target (sums to 100).
 * @param {string} fileText
 * @returns {number[]} 12 entries, or 12 zeros if the variable isn't present.
 */
function parseSollMonth(fileText) {
  const match = /var sollMonth\s*=\s*new Array\(([^)]*)\)/.exec(fileText);
  if (!match) return new Array(12).fill(0);
  return match[1].split(',').map((n) => Number.parseFloat(n.trim()));
}

/**
 * Parses base_vars.js into PlantMetadata, deriving inverters dynamically from WRInfo[]
 * rather than trusting AnzahlWR (FR-006: never hard-code inverter/string structure).
 * @param {string} rawFileText - Raw base_vars.js content.
 * @returns {{ title: string, location: string, operator: string, capacityKwp: number,
 *   commissionedDate: string, tariffRatePerKwh: number, sollYearKwp: number, sollMonth: number[],
 *   moduleType: string, orientation: string, deviceName: string, firmware: string,
 *   firmwareDate: string,
 *   inverters: { index: number, type: string, model: string, stringCount: number }[] }}
 *   PlantMetadata
 */
export function parseBaseVars(rawFileText) {
  const fileText = fixKnownMojibake(rawFileText);
  const inverters = [];
  for (const line of fileText.split('\n')) {
    const match = WR_INFO_LINE.exec(line.trim());
    if (!match) continue;
    const args = match[2].split(',').map(parseArrayArg);
    inverters.push({
      index: Number.parseInt(match[1], 10) + 1,
      type: args[0],
      model: args[4],
      stringCount: args[5],
    });
  }
  inverters.sort((a, b) => a.index - b.index);

  const slType = extractQuotedVar(fileText, 'SLTyp');

  return {
    title: extractQuotedVar(fileText, 'HPTitel'),
    location: extractQuotedVar(fileText, 'HPStandort'),
    operator: extractQuotedVar(fileText, 'HPBetreiber'),
    capacityKwp: extractNumericVar(fileText, 'AnlagenKWP'),
    commissionedDate: commissionedDateToIso(extractQuotedVar(fileText, 'HPInbetrieb')),
    tariffRatePerKwh: extractNumericVar(fileText, 'Verguetung') / 10000,
    sollYearKwp: extractNumericVar(fileText, 'SollYearKWP'),
    sollMonth: parseSollMonth(fileText),
    moduleType: extractQuotedVar(fileText, 'HPModul'),
    orientation: extractQuotedVar(fileText, 'HPAusricht'),
    deviceName: slType ? `SolarLog ${slType}` : '',
    firmware: extractQuotedVar(fileText, 'Firmware'),
    firmwareDate: extractQuotedVar(fileText, 'FirmwareDate'),
    inverters,
  };
}
