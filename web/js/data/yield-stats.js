/**
 * Sums the most recent reading's per-inverter cumulative daily yield counter (Wh). Readings are
 * chronologically ascending (see parseMinFile), so the last entry holds the running total for
 * the day; null counters (e.g. live snapshots, backfilled power-less days) are treated as 0.
 * @param {{ readings: { perInverter: { [key: string]: { dailyYieldWh: number | null } } }[] }} trace
 * @returns {number} Wh
 */
export function dailyYieldWh(trace) {
  const last = trace.readings.at(-1);
  if (!last) return 0;
  return Object.values(last.perInverter).reduce((sum, inv) => sum + (inv.dailyYieldWh ?? 0), 0);
}

/**
 * The highest instantaneous total plant power (W, summed across inverters) seen across a day's
 * readings — "Maximalwert" for the day view: the peak power output reached that day, alongside
 * when it happened (so the caller can render it in parentheses, e.g. "5175 W (14:35)").
 * @param {{ readings: { timestamp: string, perInverter: { [key: string]: { pacW: number | null } } }[] }} trace
 * @returns {{ w: number, timestamp: string | null }} timestamp is an ISO string
 *   ("YYYY-MM-DDTHH:MM:SS"), or null when there are no readings.
 */
export function maxDailyPowerW(trace) {
  let best = { w: 0, timestamp: null };
  for (const reading of trace.readings) {
    const totalW = Object.values(reading.perInverter).reduce((sum, inv) => sum + (inv?.pacW ?? 0), 0);
    if (totalW > best.w) best = { w: totalW, timestamp: reading.timestamp };
  }
  return best;
}

/**
 * The highest single day's total plant energy (kWh, summed across inverters) seen across a set
 * of DailyTotal entries (see aggregates.js's parseDailyTotalsFile) — "Maximalwert" for the
 * month/year views: the best single day of production within the period, alongside which date
 * it was (so the caller can render it in parentheses, e.g. "36,4 kWh (15.)").
 * @param {{ date: string, perInverter: { [key: string]: { yieldWh: number | null } } }[]} dailyTotals
 * @returns {{ kwh: number, date: string | null }} date is an ISO date ("YYYY-MM-DD"), or null
 *   when the list is empty.
 */
export function maxDailyYieldKwh(dailyTotals) {
  let best = { kwh: 0, date: null };
  for (const day of dailyTotals) {
    const totalKwh =
      Object.values(day.perInverter).reduce((sum, inv) => sum + (inv?.yieldWh ?? 0), 0) / 1000;
    if (totalKwh > best.kwh) best = { kwh: totalKwh, date: day.date };
  }
  return best;
}

/**
 * The highest single month's total plant energy (kWh, summed across inverters) seen across a
 * set of MonthlyTotal entries (see aggregates.js's parseMonthsFile) — "Maximalwert" for the
 * year view: the best single month of production within the year, alongside which month it was
 * (so the caller can render it in parentheses, e.g. "669,6 kWh (Aug)").
 * @param {{ month: string, perInverter: { [key: string]: number } }[]} monthlyTotals
 * @returns {{ kwh: number, month: string | null }} month is "YYYY-MM", or null when the list is
 *   empty.
 */
export function maxMonthlyYieldKwh(monthlyTotals) {
  let best = { kwh: 0, month: null };
  for (const month of monthlyTotals) {
    const totalKwh = Object.values(month.perInverter).reduce((sum, wh) => sum + (wh ?? 0), 0) / 1000;
    if (totalKwh > best.kwh) best = { kwh: totalKwh, month: month.month };
  }
  return best;
}

/**
 * Specific yield: produced energy per installed kWp (e.g. "5.9 kWh/kWp").
 * @param {number} yieldKwh
 * @param {number} capacityKwp - PlantMetadata.capacityKwp, in Wp (e.g. 6200 for 6.2 kWp).
 * @returns {number} kWh/kWp, or 0 if the plant capacity is unknown.
 */
export function specificYieldKwhPerKwp(yieldKwh, capacityKwp) {
  if (!capacityKwp) return 0;
  return yieldKwh / (capacityKwp / 1000);
}

/**
 * The theoretical target yield (kWh) for a whole month, weighted by that month's share of the
 * plant's yearly specific-yield target (base_vars.js's sollMonth[], a percentage summing to 100
 * across the year) — e.g. August: 900 * 6200 * 12 / 100000 = 669.6 kWh.
 * @param {{ sollYearKwp: number, capacityKwp: number, sollMonth: number[] }} plant
 * @param {number} month - 1-indexed (1 = January).
 * @returns {number} kWh, or 0 if Soll data is unavailable.
 */
export function monthlySollKwh(plant, month) {
  const weight = plant?.sollMonth?.[month - 1] ?? 0;
  return ((plant?.sollYearKwp ?? 0) * (plant?.capacityKwp ?? 0) * weight) / 100000;
}

/**
 * The "Soll (auflaufend)" figure shown next to a single day: the month's target yield spread
 * evenly across its days (e.g. August: 669.6 kWh / 31 days = 21.6 kWh).
 * @param {{ sollYearKwp: number, capacityKwp: number, sollMonth: number[] }} plant
 * @param {number} year
 * @param {number} month - 1-indexed (1 = January).
 * @returns {number} kWh, or 0 if Soll data is unavailable.
 */
export function dailySollKwh(plant, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return monthlySollKwh(plant, month) / daysInMonth;
}

/**
 * How many days of a given month count towards a running ("auflaufend") Soll: today's
 * day-of-month if it's the current month (the month is still in progress), the full month
 * length if the month has already ended, or 0 if it's still in the future (only reachable via a
 * direct deep link — nav never routes here).
 * @param {number} year
 * @param {number} month - 1-indexed (1 = January).
 * @param {Date} [today] - Injectable for testing; defaults to the real current date.
 * @returns {number} Days.
 */
export function elapsedDaysInMonth(year, month, today = new Date()) {
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  if (isCurrentMonth) return today.getDate();

  const isPastMonth =
    year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth() + 1);
  return isPastMonth ? new Date(year, month, 0).getDate() : 0;
}

/**
 * The "Soll (auflaufend)" figure shown for the month view: the month's daily Soll (see
 * dailySollKwh) times the days elapsed so far (e.g. August 8th: 21.6 kWh * 8 = 172.8 kWh). For a
 * month that has already fully elapsed this equals the whole month's Soll (see monthlySollKwh).
 * @param {{ sollYearKwp: number, capacityKwp: number, sollMonth: number[] }} plant
 * @param {number} year
 * @param {number} month - 1-indexed (1 = January).
 * @param {Date} [today] - Injectable for testing; defaults to the real current date.
 * @returns {number} kWh, or 0 if Soll data is unavailable.
 */
export function monthSollAuflaufendKwh(plant, year, month, today = new Date()) {
  return dailySollKwh(plant, year, month) * elapsedDaysInMonth(year, month, today);
}

/**
 * The theoretical target yield (kWh) for a whole year: SollYearKWP is already an annual
 * specific-yield target (kWh/kWp/year), so this is just that times the installed capacity
 * (e.g. 900 kWh/kWp * 6.2 kWp = 5580 kWh).
 * @param {{ sollYearKwp: number, capacityKwp: number }} plant
 * @returns {number} kWh, or 0 if Soll data is unavailable.
 */
export function yearlySollKwh(plant) {
  return ((plant?.sollYearKwp ?? 0) * (plant?.capacityKwp ?? 0)) / 1000;
}

/**
 * @param {number} year
 * @returns {number} 365, or 366 for a leap year.
 */
export function daysInYear(year) {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 366 : 365;
}

/**
 * The highest single calendar year of total plant energy (kWh, summed across inverters) seen
 * across a set of YearlyTotal entries (see aggregates.js's parseYearsFile) — "Maximalwert" for
 * the total view: the best year of production across the plant's lifetime, alongside which year
 * it was (so the caller can render it in parentheses, e.g. "6234 kWh (2019)").
 * @param {{ year: number, perInverter: { [key: string]: number } }[]} yearlyTotals
 * @returns {{ kwh: number, year: number | null }} year is null when the list is empty.
 */
export function maxYearlyYield(yearlyTotals) {
  let best = { kwh: 0, year: null };
  for (const y of yearlyTotals) {
    const kwh = Object.values(y.perInverter).reduce((sum, wh) => sum + (wh ?? 0), 0) / 1000;
    if (kwh > best.kwh) best = { kwh, year: y.year };
  }
  return best;
}

function daysBetweenInclusiveUtc(fromIso, toIso) {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  return Math.floor((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000) + 1;
}

/**
 * The theoretical target yield (kWh) for the plant's partial first calendar year, prorated by
 * the fraction of that year covered from the commissioning date onward (e.g. commissioned 15
 * March 2006: 292 of 365 days -> 900 * 6.2 * 292/365 = 4468.8 kWh). If the plant was commissioned
 * in the still-current year, this prorates only up to today instead (mirroring
 * yearSollAuflaufendKwh's "auflaufend" treatment of the current year), since the rest of the
 * year hasn't happened yet.
 * @param {{ sollYearKwp: number, capacityKwp: number }} plant
 * @param {string} commissionedDate - ISO date (YYYY-MM-DD), PlantMetadata.commissionedDate.
 * @param {Date} [today] - Injectable for testing; defaults to the real current date.
 * @returns {number} kWh, or 0 if Soll/commissioning data is unavailable.
 */
export function firstYearSollKwh(plant, commissionedDate, today = new Date()) {
  if (!commissionedDate) return 0;
  const year = Number.parseInt(commissionedDate.slice(0, 4), 10);
  const isCurrentYear = year === today.getFullYear();
  const toIso = isCurrentYear
    ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    : `${year}-12-31`;
  const days = daysBetweenInclusiveUtc(commissionedDate, toIso);
  return (yearlySollKwh(plant) * days) / daysInYear(year);
}

/**
 * The lifetime "Soll" target (kWh) from plant commissioning through today: the partial
 * commissioning year (see firstYearSollKwh) plus every full year since, plus the current year's
 * running "auflaufend" target (see yearSollAuflaufendKwh) — or, when the plant was commissioned
 * this same year, just that one partial year up to today.
 * @param {{ sollYearKwp: number, capacityKwp: number, sollMonth: number[] }} plant
 * @param {string} commissionedDate - ISO date (YYYY-MM-DD), PlantMetadata.commissionedDate.
 * @param {Date} [today] - Injectable for testing; defaults to the real current date.
 * @returns {number} kWh, or 0 if Soll/commissioning data is unavailable.
 */
export function lifetimeSollKwh(plant, commissionedDate, today = new Date()) {
  if (!commissionedDate) return 0;
  const firstYear = Number.parseInt(commissionedDate.slice(0, 4), 10);
  const currentYear = today.getFullYear();

  const total = firstYearSollKwh(plant, commissionedDate, today);
  if (firstYear === currentYear) return total; // still within the first (partial) year

  let fullYearsTotal = 0;
  for (let year = firstYear + 1; year < currentYear; year += 1) {
    fullYearsTotal += yearlySollKwh(plant);
  }
  return total + fullYearsTotal + yearSollAuflaufendKwh(plant, currentYear, today);
}

/**
 * How many days of a given year count towards a running ("auflaufend") Soll: today's
 * day-of-year if it's the current year (the year is still in progress), the full year length if
 * the year has already ended, or 0 if it's still in the future (only reachable via a direct deep
 * link — nav never routes here).
 * @param {number} year
 * @param {Date} [today] - Injectable for testing; defaults to the real current date.
 * @returns {number} Days.
 */
export function elapsedDaysInYear(year, today = new Date()) {
  const isCurrentYear = year === today.getFullYear();
  if (isCurrentYear) {
    // UTC-based arithmetic (rather than subtracting local Date objects directly) sidesteps a
    // DST off-by-one: a spring-forward clock change between Jan 1 and today would otherwise
    // shave an hour off the raw ms difference and undercount by a day.
    const startOfYearUtc = Date.UTC(year, 0, 1);
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.floor((todayUtc - startOfYearUtc) / 86400000) + 1;
  }
  return year < today.getFullYear() ? daysInYear(year) : 0;
}

/**
 * The "Soll (auflaufend)" figure shown for the year view: the sum of each month's Soll (see
 * monthSollAuflaufendKwh) — fully counted for months already elapsed, prorated by day-of-month
 * for the current month, and 0 for months still in the future — using the same sollMonth-weighted
 * logic as the month view rather than spreading the yearly Soll evenly across all 365 days (e.g.
 * Aug 9th: full Jan-Jul Soll + 9 days of August's daily Soll = 3877.2 kWh). For a year that has
 * already fully elapsed this equals the whole year's Soll.
 * @param {{ sollYearKwp: number, capacityKwp: number, sollMonth: number[] }} plant
 * @param {number} year
 * @param {Date} [today] - Injectable for testing; defaults to the real current date.
 * @returns {number} kWh, or 0 if Soll data is unavailable.
 */
export function yearSollAuflaufendKwh(plant, year, today = new Date()) {
  let total = 0;
  for (let month = 1; month <= 12; month += 1) {
    total += monthSollAuflaufendKwh(plant, year, month, today);
  }
  return total;
}

/**
 * "Ist": the day's actual yield as a percentage of its Soll (auflaufend) target, rounded to a
 * whole number (e.g. 36.4 kWh / 21.6 kWh = 169%).
 * @param {number} yieldKwh
 * @param {number} sollKwh
 * @returns {number} Percent, rounded; 0 if sollKwh is 0.
 */
export function istPercent(yieldKwh, sollKwh) {
  if (!sollKwh) return 0;
  return Math.round((yieldKwh / sollKwh) * 100);
}
