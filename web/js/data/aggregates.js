import { extractAssignedStrings } from './parse-lines.js';
import { co2FactorForYear } from './co2-factors.js';

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
 * Parses months.js content (`01.MM.YY|WR1_yield_Wh|WR2_yield_Wh`). Each record's own date - not
 * just its year-month - is kept as `asOfDate`: for a completed month the device writes a final
 * entry dated that month's last day, but for the in-progress month it's dated whatever day the
 * running total was last checkpointed, which is not necessarily yesterday (see addMissingDays).
 * @param {string} fileText
 * @returns {{ month: string, asOfDate: string, perInverter: { [inverterIndex: number]: number }, dailyBreakdown: [] }[]}
 */
export function parseMonthsFile(fileText) {
  return extractAssignedStrings(fileText).map((record) => {
    const [date, ...yields] = record.split('|');
    const perInverter = {};
    yields.forEach((wh, i) => {
      perInverter[i + 1] = Number.parseInt(wh, 10);
    });
    return {
      month: yearMonthFromDdMmYy(date),
      asOfDate: isoDateFromDdMmYy(date),
      perInverter,
      dailyBreakdown: [],
    };
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
 * Derives the lifetime summary by summing all YearlyTotals. `co2SavedKg` is computed per year -
 * each year's yield multiplied by that year's own UBA emission factor (see co2-factors.js), then
 * summed - never a single flat factor applied to the combined total (FR-002/FR-008); the feed-in
 * tariff calculation is ported as-is (SC-008).
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
            asOfDate: existing.asOfDate > entry.asOfDate ? existing.asOfDate : entry.asOfDate,
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

/**
 * Adds every daily total dated after a MonthlyTotal's own checkpoint (`asOfDate`) into its
 * perInverter Wh totals - a generalisation of addTodayYield that also covers a stale months.js:
 * the device is expected to write a fresh months.js checkpoint at every day rollover, but when
 * it skips one or more rollovers (observed: stuck for 2+ days), folding in only "today" silently
 * drops the skipped day(s) entirely. Summing every dailyBreakdown entry newer than the checkpoint
 * - not just today's - recovers the missing days regardless of how far behind months.js is, as
 * long as days_hist.js/days.js still cover that date range.
 * @param {{ asOfDate?: string, perInverter: { [inverterIndex: number]: number } }} total - a
 *   MonthlyTotal (see parseMonthsFile); asOfDate absent (e.g. no months.js entry at all for this
 *   month yet) is treated as "before every day", so every entry in dailyBreakdown is added.
 * @param {ReturnType<typeof parseDailyTotalsFile>} dailyBreakdown - that month's daily totals
 *   (days_hist.js merged with days.js/today), as built by month-view.js.
 * @returns {{ perInverter: object }} a new object; `total` is not mutated.
 */
export function addMissingDays(total, dailyBreakdown) {
  const cutoff = total.asOfDate ?? '';
  const perInverter = { ...total.perInverter };
  for (const day of dailyBreakdown) {
    if (day.date <= cutoff) continue;
    for (const [idx, { yieldWh }] of Object.entries(day.perInverter)) {
      perInverter[idx] = (perInverter[idx] ?? 0) + yieldWh;
    }
  }
  return { ...total, perInverter };
}

function sumInverterWh(perInverter) {
  return Object.values(perInverter).reduce((sum, v) => sum + (v?.yieldWh ?? v ?? 0), 0);
}

/**
 * Derives today/month/year/lifetime yield (kWh) plus lifetime CO2 saved and lifetime feed-in
 * revenue from the same already-parsed/merged sources dashboard.js's widgets and total-view.js's
 * stats panel each derive independently (days.js's today entry, days_hist.js+days.js merged into
 * one daily series, months.js, years.js) - shared here so the welcome page's stats card agrees
 * with them by construction instead of drifting. Mirrors month-view.js/year-view.js's
 * addMissingDays/addTodayYield use throughout: months.js/years.js are only written at day
 * rollover, so the in-progress month/year is always missing at least today's live yield until
 * the next sync.
 * @param {{ todayEntry: ReturnType<typeof parseDailyTotalsFile>[number] | undefined,
 *   dailyHist: ReturnType<typeof parseDailyTotalsFile>, months: ReturnType<typeof parseMonthsFile>,
 *   years: ReturnType<typeof parseYearsFile>, year: number, monthKey: string,
 *   tariffRatePerKwh: number }} args - `dailyHist` is days_hist.js's totals (data.ok ? [] :
 *   already merged with days.js is done internally); `year`/`monthKey` (e.g. "2026-08")
 *   identify "today" so the right month/year get today's live yield folded in.
 * @returns {{ todayKwh: number, monthKwh: number, yearKwh: number, totalKwh: number,
 *   co2SavedKg: number, feedInTotal: number }}
 */
export function deriveYieldSummary({
  todayEntry,
  dailyHist,
  months,
  years,
  year,
  monthKey,
  tariffRatePerKwh,
}) {
  const todayKwh = todayEntry ? sumInverterWh(todayEntry.perInverter) / 1000 : 0;

  const monthDailyBreakdown = mergeDailyTotals(dailyHist, todayEntry ? [todayEntry] : []).filter(
    (d) => d.date.startsWith(monthKey),
  );
  const thisMonth = addMissingDays(
    months.find((m) => m.month === monthKey) ?? { month: monthKey, perInverter: {} },
    monthDailyBreakdown,
  );
  const monthKwh = sumInverterWh(thisMonth.perInverter) / 1000;

  const monthsInYear = months.filter((m) => m.month.startsWith(String(year)));
  const monthlyBreakdown = monthsInYear.some((m) => m.month === monthKey)
    ? monthsInYear.map((m) => (m.month === monthKey ? thisMonth : m))
    : [...monthsInYear, thisMonth];
  const yearKwh = monthlyBreakdown.reduce((sum, m) => sum + sumInverterWh(m.perInverter), 0) / 1000;

  const yearsWithToday = years.some((y) => y.year === year)
    ? years
    : [...years, { year, perInverter: {} }];
  const yearsForLifetime = yearsWithToday.map((y) =>
    y.year === year ? addTodayYield(y, todayEntry) : y,
  );
  const lifetime = deriveLifetimeSummary(yearsForLifetime, tariffRatePerKwh);

  return {
    todayKwh,
    monthKwh,
    yearKwh,
    totalKwh: lifetime.totalYieldWh / 1000,
    co2SavedKg: lifetime.co2SavedKg,
    feedInTotal: lifetime.feedInTotal,
  };
}

export function deriveLifetimeSummary(yearlyTotals, tariffRatePerKwh) {
  const totalYieldWh = yearlyTotals.reduce(
    (sum, y) => sum + Object.values(y.perInverter).reduce((s, wh) => s + wh, 0),
    0,
  );
  const totalKwh = totalYieldWh / 1000;
  const co2SavedKg = yearlyTotals.reduce((sum, y) => {
    const yearKwh = Object.values(y.perInverter).reduce((s, wh) => s + wh, 0) / 1000;
    return sum + yearKwh * co2FactorForYear(y.year);
  }, 0);
  return {
    totalYieldWh,
    co2SavedKg,
    feedInTotal: totalKwh * tariffRatePerKwh,
    byYear: yearlyTotals,
  };
}
