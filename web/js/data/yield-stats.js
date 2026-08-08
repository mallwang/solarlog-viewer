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
 * The highest single day's total plant energy (kWh, summed across inverters) seen across a set
 * of DailyTotal entries (see aggregates.js's parseDailyTotalsFile) — "Maximalwert" for the
 * month/year views: the best single day of production within the period.
 * @param {{ perInverter: { [key: string]: { yieldWh: number | null } } }[]} dailyTotals
 * @returns {number} kWh
 */
export function maxDailyYieldKwh(dailyTotals) {
  let max = 0;
  for (const day of dailyTotals) {
    const totalKwh =
      Object.values(day.perInverter).reduce((sum, inv) => sum + (inv?.yieldWh ?? 0), 0) / 1000;
    if (totalKwh > max) max = totalKwh;
  }
  return max;
}

/**
 * The highest single month's total plant energy (kWh, summed across inverters) seen across a
 * set of MonthlyTotal entries (see aggregates.js's parseMonthsFile) — "Maximalwert" for the
 * year view: the best single month of production within the year.
 * @param {{ perInverter: { [key: string]: number } }[]} monthlyTotals
 * @returns {number} kWh
 */
export function maxMonthlyYieldKwh(monthlyTotals) {
  let max = 0;
  for (const month of monthlyTotals) {
    const totalKwh = Object.values(month.perInverter).reduce((sum, wh) => sum + (wh ?? 0), 0) / 1000;
    if (totalKwh > max) max = totalKwh;
  }
  return max;
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

function daysInYear(year) {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 366 : 365;
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
 * The "Soll (auflaufend)" figure shown for the year view: the year's Soll (see yearlySollKwh)
 * spread evenly across its days, times the days elapsed so far (e.g. day 220 of 365: 5580 kWh /
 * 365 * 220 = 3363.3 kWh). For a year that has already fully elapsed this equals the whole
 * year's Soll.
 * @param {{ sollYearKwp: number, capacityKwp: number }} plant
 * @param {number} year
 * @param {Date} [today] - Injectable for testing; defaults to the real current date.
 * @returns {number} kWh, or 0 if Soll data is unavailable.
 */
export function yearSollAuflaufendKwh(plant, year, today = new Date()) {
  return (yearlySollKwh(plant) / daysInYear(year)) * elapsedDaysInYear(year, today);
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
