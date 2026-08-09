import { extractAssignedStrings } from './parse-lines.js';

const CO2_KG_PER_KWH = 0.7;

function isoDateFromDdMmYy(ddmmyy) {
  const [dd, mm, yy] = ddmmyy.split('.');
  return `20${yy}-${mm}-${dd}`;
}

function yearMonthFromDdMmYy(ddmmyy) {
  const [, mm, yy] = ddmmyy.split('.');
  return `20${yy}-${mm}`;
}

function yearFromDdMmYy(ddmmyy) {
  const [, , yy] = ddmmyy.split('.');
  return Number.parseInt(`20${yy}`, 10);
}

/**
 * Parses days.js / days_hist*.js / daysall.js content (shared wire format:
 * `DD.MM.YY|WR1_yield;WR1_peak|WR2_yield;WR2_peak`).
 * @param {string} fileText
 * @returns {{ date: string, perInverter: { [inverterIndex: number]: { yieldWh: number, peakW: number } } }[]}
 */
export function parseDailyTotalsFile(fileText) {
  return extractAssignedStrings(fileText).map((record) => {
    const [date, ...blocks] = record.split('|');
    const perInverter = {};
    blocks.forEach((block, i) => {
      const [yieldWh, peakW] = block.split(';').map((n) => Number.parseInt(n, 10));
      perInverter[i + 1] = { yieldWh, peakW };
    });
    return { date: isoDateFromDdMmYy(date), perInverter };
  });
}

/**
 * Parses months.js content (`01.MM.YY|WR1_yield_Wh|WR2_yield_Wh`).
 * @param {string} fileText
 * @returns {{ month: string, perInverter: { [inverterIndex: number]: number }, dailyBreakdown: [] }[]}
 */
export function parseMonthsFile(fileText) {
  return extractAssignedStrings(fileText).map((record) => {
    const [date, ...yields] = record.split('|');
    const perInverter = {};
    yields.forEach((wh, i) => {
      perInverter[i + 1] = Number.parseInt(wh, 10);
    });
    return { month: yearMonthFromDdMmYy(date), perInverter, dailyBreakdown: [] };
  });
}

/**
 * Parses years.js content (`01.01.YY|WR1_yield_Wh|WR2_yield_Wh`).
 * @param {string} fileText
 * @returns {{ year: number, perInverter: { [inverterIndex: number]: number } }[]}
 */
export function parseYearsFile(fileText) {
  return extractAssignedStrings(fileText).map((record) => {
    const [date, ...yields] = record.split('|');
    const perInverter = {};
    yields.forEach((wh, i) => {
      perInverter[i + 1] = Number.parseInt(wh, 10);
    });
    return { year: yearFromDdMmYy(date), perInverter };
  });
}

/**
 * Derives the lifetime summary by summing all YearlyTotals, porting the CO2 factor (0.7 kg/kWh,
 * legacy-site/visu.html's `sum*0.7`) and feed-in tariff calculation as-is (SC-008).
 * @param {{ year: number, perInverter: { [inverterIndex: number]: number } }[]} yearlyTotals
 * @param {number} tariffRatePerKwh - PlantMetadata.tariffRatePerKwh (Euro/kWh).
 * @returns {{ totalYieldWh: number, co2SavedKg: number, feedInTotal: number, byYear: object[] }}
 */
function sumPerInverter(a, b) {
  const merged = { ...a };
  for (const [idx, wh] of Object.entries(b)) {
    merged[idx] = (merged[idx] ?? 0) + wh;
  }
  return merged;
}

/**
 * Merges hist/data DailyTotal[] (see parseDailyTotalsFile) into one ascending-by-date series.
 * The hist/data split is date-exclusive by construction (HIST_DIR covers everything before
 * INSTALLATION_DATE, DATA_DIR from INSTALLATION_DATE on), so no date is expected in both; on
 * the defensive case of a collision the data-side (live device) entry wins.
 * @param {ReturnType<typeof parseDailyTotalsFile>} histEntries
 * @param {ReturnType<typeof parseDailyTotalsFile>} dataEntries
 * @returns {ReturnType<typeof parseDailyTotalsFile>}
 */
export function mergeDailyTotals(histEntries, dataEntries) {
  const byDate = new Map(histEntries.map((entry) => [entry.date, entry]));
  for (const entry of dataEntries) byDate.set(entry.date, entry);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Merges hist/data MonthlyTotals[] (see parseMonthsFile) into one ascending-by-month series.
 * The installation month (e.g. 2026-07) is written by both the frozen hist snapshot and the
 * new device's running total, so overlapping months are summed per-inverter rather than one
 * side overwriting the other (device installed mid-month; both halves are real production).
 * @param {ReturnType<typeof parseMonthsFile>} histEntries
 * @param {ReturnType<typeof parseMonthsFile>} dataEntries
 * @returns {ReturnType<typeof parseMonthsFile>}
 */
export function mergeMonthlyTotals(histEntries, dataEntries) {
  const byMonth = new Map(histEntries.map((entry) => [entry.month, entry]));
  for (const entry of dataEntries) {
    const existing = byMonth.get(entry.month);
    byMonth.set(
      entry.month,
      existing
        ? {
            month: entry.month,
            perInverter: sumPerInverter(existing.perInverter, entry.perInverter),
            dailyBreakdown: [],
          }
        : entry,
    );
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * Merges hist/data YearlyTotals[] (see parseYearsFile) into one ascending-by-year series.
 * The installation year (e.g. 2026) is written by both the frozen hist snapshot (total up to
 * the swap date) and the new device's running total (from the swap date on), so an overlapping
 * year is summed per-inverter rather than one side overwriting the other.
 * @param {ReturnType<typeof parseYearsFile>} histEntries
 * @param {ReturnType<typeof parseYearsFile>} dataEntries
 * @returns {ReturnType<typeof parseYearsFile>}
 */
export function mergeYearlyTotals(histEntries, dataEntries) {
  const byYear = new Map(histEntries.map((entry) => [entry.year, entry]));
  for (const entry of dataEntries) {
    const existing = byYear.get(entry.year);
    byYear.set(
      entry.year,
      existing
        ? { year: entry.year, perInverter: sumPerInverter(existing.perInverter, entry.perInverter) }
        : entry,
    );
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

/**
 * Adds today's live yield (from days.js, which the SolarLog updates continuously) into a
 * MonthlyTotal's/YearlyTotal's perInverter Wh totals. months.js/years.js are only written at
 * day rollover, so the current month's/year's running total is always missing today's
 * production until the next day's sync (mirroring min_day.js's role for the day view - see
 * day-view.js).
 * @param {{ perInverter: { [inverterIndex: number]: number } }} total - a MonthlyTotal or
 *   YearlyTotal (see parseMonthsFile/parseYearsFile).
 * @param {ReturnType<typeof parseDailyTotalsFile>[number] | undefined} todayEntry - today's
 *   DailyTotal (see parseDailyTotalsFile), or undefined if unavailable.
 * @returns {{ perInverter: object }} a new object; `total` is not mutated.
 */
export function addTodayYield(total, todayEntry) {
  if (!todayEntry) return total;
  const perInverter = { ...total.perInverter };
  for (const [idx, { yieldWh }] of Object.entries(todayEntry.perInverter)) {
    perInverter[idx] = (perInverter[idx] ?? 0) + yieldWh;
  }
  return { ...total, perInverter };
}

export function deriveLifetimeSummary(yearlyTotals, tariffRatePerKwh) {
  const totalYieldWh = yearlyTotals.reduce(
    (sum, y) => sum + Object.values(y.perInverter).reduce((s, wh) => s + wh, 0),
    0,
  );
  const totalKwh = totalYieldWh / 1000;
  return {
    totalYieldWh,
    co2SavedKg: totalKwh * CO2_KG_PER_KWH,
    feedInTotal: totalKwh * tariffRatePerKwh,
    byYear: yearlyTotals,
  };
}
