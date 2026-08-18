/**
 * Pure computation module for the Statistics page (022-statistics-page). Every export here takes
 * already-parsed/merged data (see aggregates.js's DailyTotal[]/MonthlyTotal[]/YearlyTotal[] and
 * plant.js's PlantMetadata) and returns plain data — no fetch, no DOM, no i18n (`label` fields
 * stay as i18n keys for the view layer to resolve via `t()`; `value` fields are pre-formatted
 * numbers via format.js, same split as yield-stats.js/aggregates.js already use elsewhere).
 *
 * See specs/022-statistics-page/contracts/statistics-module.md and data-model.md for the full
 * contract this file implements.
 */

import {
  formatKwh,
  formatCurrency,
  formatCo2,
  formatNumber,
  formatDate,
  formatMonthYear,
} from '../format.js';
import { dailySollKwh, istPercent, specificYieldKwhPerKwp, daysInYear } from './yield-stats.js';
import { co2FactorForYear } from './co2-factors.js';
import { isBackfilledDate, isUnreliableDailyYield } from './backfilled-data.js';

// Exported (not just used internally) so view layers - e.g. streaks-topic.js's day-strip tooltips
// - can show a day's actual yield without duplicating the perInverter-summing logic.
export function sumDailyKwh(perInverter) {
  return Object.values(perInverter).reduce((sum, inv) => sum + (inv?.yieldWh ?? 0), 0) / 1000;
}

function sumPeriodKwh(perInverter) {
  return Object.values(perInverter).reduce((sum, wh) => sum + (wh ?? 0), 0) / 1000;
}

function hasData(perInverter) {
  return Object.keys(perInverter ?? {}).length > 0;
}

/**
 * Drops backfilled days (see backfilled-data.js) from a daily history before it feeds a pick that
 * depends on `peakW` (scripts/backfill-min-day.js's zeroBlock() zeros every field of a
 * reconstructed day except the scaled Wh counter it writes, so `peakW` reads 0 for every
 * backfilled day regardless of the real instantaneous power that day). Each day's total yield
 * (`yieldWh`, summed via sumDailyKwh) is untouched by backfilling - it comes from days_hist.js,
 * which backfill-min-day.js reads from rather than overwrites - so kWh-based picks (best/worst
 * day, streaks, YoY, Ist %, CO2, €) must NOT be filtered through this and should use the full
 * history instead (except within config.js's UNRELIABLE_DAILY_YIELD_RANGES, where even the daily
 * kWh split isn't trustworthy - see excludeUnreliableDailyYield below for that narrower filter).
 * Not applied to monthly/yearly history either: those come from the device's own pre-aggregated
 * months.js/years.js, which carry no per-day attribution to filter by.
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @returns {{ date: string, perInverter: object }[]}
 */
export function excludeBackfilledDays(fullDailyHistory) {
  return fullDailyHistory.filter((d) => !isBackfilledDate(d.date));
}

/**
 * Drops days inside config.js's UNRELIABLE_DAILY_YIELD_RANGES from a daily history before it
 * feeds any pick that singles out *one day* by its kWh total (streaks, best/worst day, max daily
 * €/CO2/Ist %) - within those ranges the "daily" total itself is an even split of one offline
 * meter reading across the whole outage, not a real per-day measurement, so picking a single
 * winning/losing day (or a run of them) from it would be spurious. Unlike excludeBackfilledDays,
 * this is a narrow filter: most backfilled days keep a real per-day total and only need excluding
 * from peakW-based picks (see that function's own doc comment) - this one is for the strictly
 * smaller set where even the daily kWh split can't be trusted. Not applied to
 * computeYoyCumulative/computeLifetimeCumulative/monthly/yearly totals or the calendar heatmap:
 * those stay on the full history since the range's *total* is trustworthy and a cumulative curve
 * or flagged heatmap cell doesn't claim any one day within it is exact.
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @returns {{ date: string, perInverter: object }[]}
 */
export function excludeUnreliableDailyYield(fullDailyHistory) {
  return fullDailyHistory.filter((d) => !isUnreliableDailyYield(d.date));
}

function dateParts(dateIso) {
  const [year, month, day] = dateIso.split('-').map((n) => Number.parseInt(n, 10));
  return { year, month, day };
}

// `T00:00:00` pins the parse to local midnight (as streaks-topic.js/heatmaps-topic.js already do)
// so formatDate never rolls the date back a day in timezones behind UTC.
function formatDateIso(dateIso) {
  return formatDate(new Date(`${dateIso}T00:00:00`));
}

// Shared with computeLifetimeCumulative's own commissionedYear derivation below - `null` (rather
// than that function's -Infinity sentinel) since bestWorstYear only needs "is this year the
// install year", not a lower bound to filter a range against.
function commissionedYearOf(plant) {
  return plant?.commissionedDate ? Number.parseInt(plant.commissionedDate.slice(0, 4), 10) : null;
}

/**
 * Picks the entry with the highest (or lowest) `score(entry)` from `entries`, skipping entries
 * `hasData` rejects. Shared by every "best/worst X" function below.
 * @template T
 * @param {T[]} entries
 * @param {(entry: T) => boolean} hasData
 * @param {(entry: T) => number} score
 * @param {'max' | 'min'} direction
 * @returns {T | null}
 */
function pickExtremum(entries, hasDataFn, score, direction) {
  let picked = null;
  let pickedScore = null;
  for (const entry of entries) {
    if (!hasDataFn(entry)) continue;
    const s = score(entry);
    if (pickedScore === null || (direction === 'max' ? s > pickedScore : s < pickedScore)) {
      picked = entry;
      pickedScore = s;
    }
  }
  return picked;
}

/**
 * Best/worst month by summed kWh (data-model.md "Stat tile"). Months with no recorded data
 * (empty `perInverter`) are ignored — never picked as a spurious "worst" 0 kWh month.
 * @param {{ month: string, perInverter: object }[]} fullMonthlyHistory
 * @returns {{ best: object | null, worst: object | null }}
 */
export function bestWorstMonth(fullMonthlyHistory) {
  const score = (m) => sumPeriodKwh(m.perInverter);
  const bestMonth = pickExtremum(fullMonthlyHistory, (m) => hasData(m.perInverter), score, 'max');
  const worstMonth = pickExtremum(fullMonthlyHistory, (m) => hasData(m.perInverter), score, 'min');
  const toTile = (m, labelKey) => {
    if (!m) return null;
    const [year, month] = m.month.split('-').map((n) => Number.parseInt(n, 10));
    return {
      label: labelKey,
      value: formatKwh(score(m), { decimals: 2 }),
      period: formatMonthYear(year, month),
      route: { view: 'month', params: { year, month } },
      caveat: null,
    };
  };
  return {
    best: toTile(bestMonth, 'statistics.common.bestMonth'),
    worst: toTile(worstMonth, 'statistics.common.worstMonth'),
  };
}

/**
 * Best/worst year by summed kWh (data-model.md "Stat tile"). Years with no recorded data
 * (empty `perInverter`) are ignored. Two years are excluded from the "worst" pick specifically:
 * the current (still-running) year and the plant's first (commissioning) year - both are
 * naturally low-yield because they only cover part of a calendar year, and would otherwise
 * near-permanently win "worst year" for no meaningful reason. The worst tile carries a caveat
 * explaining the exclusion. The "best" pick keeps both years eligible, since a strong partial
 * year is still a genuine record.
 * @param {{ year: number, perInverter: object }[]} fullYearlyHistory
 * @param {number} [currentYear] - Defaults to the real current year; overridable for tests.
 * @param {{ commissionedDate?: string }} [plant] - Its commissioning year is excluded too.
 * @returns {{ best: object | null, worst: object | null }}
 */
export function bestWorstYear(
  fullYearlyHistory,
  currentYear = new Date().getFullYear(),
  plant = null,
) {
  const firstYear = commissionedYearOf(plant);
  const score = (y) => sumPeriodKwh(y.perInverter);
  const bestYear = pickExtremum(fullYearlyHistory, (y) => hasData(y.perInverter), score, 'max');
  const worstYear = pickExtremum(
    fullYearlyHistory.filter((y) => y.year !== currentYear && y.year !== firstYear),
    (y) => hasData(y.perInverter),
    score,
    'min',
  );
  const toTile = (y, labelKey, caveat = null) => {
    if (!y) return null;
    return {
      label: labelKey,
      value: formatKwh(score(y), { decimals: 2 }),
      period: String(y.year),
      route: { view: 'year', params: { year: y.year } },
      caveat,
    };
  };
  return {
    best: toTile(bestYear, 'statistics.common.bestYear'),
    worst: toTile(
      worstYear,
      'statistics.common.worstYear',
      'statistics.commonTiles.worstYearCaveat',
    ),
  };
}

/**
 * The single day with the highest recorded peak power (`peakW`, summed across inverters) —
 * already present in days.js/days_hist.js, so this is a genuine per-day max without any
 * minute-file read (FR-010/FR-011). Carries a `caveat` since the source data has no time-of-day.
 * Callers must pass a history with backfilled days already dropped (excludeBackfilledDays) -
 * unlike this file's other daily "max" picks, `peakW` reads 0 for every backfilled day (see
 * excludeBackfilledDays's own doc comment) and would otherwise never win here, silently hiding
 * the real peak among the remaining days behind a false "no peak that day" reading.
 * @param {{ date: string, perInverter: { [i: string]: { peakW: number } } }[]} fullDailyHistory
 * @returns {object | null}
 */
export function maxDailyPower(fullDailyHistory) {
  const score = (d) =>
    Object.values(d.perInverter).reduce((sum, inv) => sum + (inv?.peakW ?? 0), 0);
  const day = pickExtremum(fullDailyHistory, (d) => hasData(d.perInverter), score, 'max');
  if (!day) return null;
  const { year, month, day: dayNum } = dateParts(day.date);
  return {
    label: 'statistics.common.maxDailyPower',
    value: `${formatNumber(score(day), { decimals: 0 })} W`,
    period: formatDateIso(day.date),
    route: { view: 'day', params: { year, month, day: dayNum } },
    caveat: 'statistics.commonTiles.maxDailyPowerCaveat',
  };
}

/**
 * The single day with the highest "Ist %" (that day's yield ÷ that day's Soll auflaufend share,
 * see yield-stats.js's dailySollKwh/istPercent, reused unchanged). Days without a Soll target
 * (dailySollKwh returns 0) are skipped, since istPercent is meaningless without one.
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @param {{ sollYearKwp: number, capacityKwp: number, sollMonth: number[] }} plant
 * @returns {object | null}
 */
export function maxIstPercent(fullDailyHistory, plant) {
  const scored = fullDailyHistory
    .filter((d) => hasData(d.perInverter))
    .map((d) => {
      const { year, month, day: dayNum } = dateParts(d.date);
      const soll = dailySollKwh(plant ?? {}, year, month);
      const ist = istPercent(sumDailyKwh(d.perInverter), soll);
      return { day: d, soll, ist, year, month, dayNum };
    })
    .filter((entry) => entry.soll > 0);

  if (scored.length === 0) return null;
  const best = scored.reduce((a, b) => (b.ist > a.ist ? b : a));
  return {
    label: 'statistics.common.maxIstPercent',
    value: `${best.ist}%`,
    period: formatDateIso(best.day.date),
    route: { view: 'day', params: { year: best.year, month: best.month, day: best.dayNum } },
    caveat: null,
  };
}

/**
 * The single day with the highest CO2 avoided (that day's kWh × that day's year's emission
 * factor, see co2-factors.js).
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @returns {object | null}
 */
export function maxDailyCo2(fullDailyHistory) {
  const score = (d) => sumDailyKwh(d.perInverter) * co2FactorForYear(dateParts(d.date).year);
  const day = pickExtremum(fullDailyHistory, (d) => hasData(d.perInverter), score, 'max');
  if (!day) return null;
  const { year, month, day: dayNum } = dateParts(day.date);
  return {
    label: 'statistics.common.maxDailyCo2',
    value: formatCo2(score(day)),
    period: formatDateIso(day.date),
    route: { view: 'day', params: { year, month, day: dayNum } },
    caveat: null,
  };
}

/**
 * The single day with the highest feed-in revenue (that day's kWh × plant.tariffRatePerKwh).
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @param {{ tariffRatePerKwh: number }} plant
 * @returns {object | null}
 */
export function maxDailyEuro(fullDailyHistory, plant) {
  const rate = plant?.tariffRatePerKwh ?? 0;
  const score = (d) => sumDailyKwh(d.perInverter) * rate;
  const day = pickExtremum(fullDailyHistory, (d) => hasData(d.perInverter), score, 'max');
  if (!day) return null;
  const { year, month, day: dayNum } = dateParts(day.date);
  return {
    label: 'statistics.common.maxDailyEuro',
    value: formatCurrency(score(day)),
    period: formatDateIso(day.date),
    route: { view: 'day', params: { year, month, day: dayNum } },
    caveat: null,
  };
}

function metricValueKwh(perInverter, metric, year, plant) {
  const kwh = sumDailyKwh(perInverter);
  if (metric === 'energyKwh') return kwh;
  if (metric === 'moneyEuro') return kwh * (plant?.tariffRatePerKwh ?? 0);
  return kwh * co2FactorForYear(year); // 'co2Kg'
}

/**
 * Builds one calendar year's heatmap cell data for a single metric (data-model.md "Calendar
 * heatmap"). Days absent from `fullDailyHistory` get `value: null` (distinguishable from a real
 * recorded 0, FR-005); `relativeIntensity` is scaled to that year's own min/max among non-null
 * values (FR-015), `0` when every present value is equal (e.g. a single data point). Backfilled
 * days (backfilled-data.js) keep their real reconstructed `value` - unlike the "best of" picks
 * elsewhere in this file, the heatmap shows them, just flagged via `backfilled` so the view layer
 * can style them distinctly rather than treating them as missing.
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @param {number} year
 * @param {'energyKwh' | 'moneyEuro' | 'co2Kg'} metric
 * @param {object} plant - PlantMetadata.
 * @returns {{ metric: string, year: number, cells: { date: string, value: number | null, relativeIntensity: number | null, backfilled: boolean }[] }}
 */
export function buildCalendarHeatmap(fullDailyHistory, year, metric, plant) {
  const byDate = new Map(fullDailyHistory.map((d) => [d.date, d]));
  const values = Array.from({ length: daysInYear(year) }, (_, i) => {
    const date = new Date(Date.UTC(year, 0, i + 1));
    const iso = date.toISOString().slice(0, 10);
    const entry = byDate.get(iso);
    const value =
      entry && hasData(entry.perInverter)
        ? metricValueKwh(entry.perInverter, metric, year, plant)
        : null;
    return { date: iso, value };
  });

  const present = values.map((v) => v.value).filter((v) => v !== null);
  const yearMin = present.length ? Math.min(...present) : null;
  const yearMax = present.length ? Math.max(...present) : null;

  const cells = values.map(({ date, value }) => {
    const backfilled = isBackfilledDate(date);
    if (value === null) return { date, value: null, relativeIntensity: null, backfilled };
    const relativeIntensity =
      yearMax === yearMin ? 0 : Math.min(1, Math.max(0, (value - yearMin) / (yearMax - yearMin)));
    return { date, value, relativeIntensity, backfilled };
  });

  return { metric, year, cells };
}

// Two round-number thresholds (superseding the single derived research.md R5 constant) that frame
// the streaks topic as a pair: a "high-yield" streak of strong sunny days and a "low-yield" streak
// of consecutive underperforming days (overcast/winter runs), per user request.
export const STREAK_HIGH_THRESHOLD_KWH = 20;
export const STREAK_LOW_THRESHOLD_KWH = 5;

function isoNextDay(dateIso) {
  const [y, m, d] = dateIso.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

/**
 * Longest run of consecutive recorded days each satisfying `qualifies(dailyKwh)` (data-model.md
 * "Streak"). A missing date breaks the run (consecutive *recorded* days, not calendar days with
 * gaps tolerated). Ties are broken by most-recent run, so an ongoing run tying the historical
 * record is still reported as ongoing (spec.md Edge Cases).
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @param {(dailyKwh: number) => boolean} qualifies
 * @returns {{ lengthDays: number, startDate: string, endDate: string, isOngoing: boolean } | null}
 */
function computeLongestRun(fullDailyHistory, qualifies) {
  const qualifying = [...fullDailyHistory]
    .filter((d) => hasData(d.perInverter) && qualifies(sumDailyKwh(d.perInverter)))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (qualifying.length === 0) return null;

  let bestRun = null;
  let runStart = qualifying[0].date;
  let runEnd = qualifying[0].date;

  const flush = () => {
    const length = daysBetween(runStart, runEnd) + 1;
    if (!bestRun || length >= bestRun.length) {
      bestRun = { start: runStart, end: runEnd, length };
    }
  };

  for (let i = 1; i < qualifying.length; i += 1) {
    const date = qualifying[i].date;
    if (date === isoNextDay(runEnd)) {
      runEnd = date;
    } else {
      flush();
      runStart = date;
      runEnd = date;
    }
  }
  flush();

  const mostRecentDate = fullDailyHistory.reduce(
    (max, d) => (d.date > max ? d.date : max),
    fullDailyHistory[0]?.date ?? '',
  );

  return {
    lengthDays: bestRun.length,
    startDate: bestRun.start,
    endDate: bestRun.end,
    isOngoing: bestRun.end === mostRecentDate,
  };
}

/**
 * Longest run of consecutive recorded days each yielding ≥ STREAK_HIGH_THRESHOLD_KWH.
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @returns {{ lengthDays: number, startDate: string, endDate: string, isOngoing: boolean } | null}
 */
export function computeLongestHighStreak(fullDailyHistory) {
  return computeLongestRun(fullDailyHistory, (kwh) => kwh >= STREAK_HIGH_THRESHOLD_KWH);
}

/**
 * Longest run of consecutive recorded days each yielding < STREAK_LOW_THRESHOLD_KWH.
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @returns {{ lengthDays: number, startDate: string, endDate: string, isOngoing: boolean } | null}
 */
export function computeLongestLowStreak(fullDailyHistory) {
  return computeLongestRun(fullDailyHistory, (kwh) => kwh < STREAK_LOW_THRESHOLD_KWH);
}

function daysBetween(fromIso, toIso) {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

// Cumulative days before each month in a leap-year scheme (Feb = 29 days) — used so the same
// calendar date always maps to the same dayOfYear slot across leap and non-leap years (Feb 29
// occupies slot 60 only in leap years; Mar 1 is always slot 61), rather than every date after
// February shifting by one day depending on the year (mirrors the corrected YearComparisonSeries
// precedent in specs/001-website-modernization/data-model.md).
const LEAP_CUMULATIVE_DAYS_BEFORE_MONTH = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

function dayOfYear(dateIso) {
  const { month, day } = dateParts(dateIso);
  return LEAP_CUMULATIVE_DAYS_BEFORE_MONTH[month - 1] + day;
}

/**
 * One cumulative-yield series per calendar year present in `fullDailyHistory`, aligned by
 * `dayOfYear` (1-366; Feb 29 included without shifting later day-of-year values in non-leap
 * years — see dayOfYear above), running sum reset at each year boundary.
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @returns {{ year: number, points: { dayOfYear: number, cumulativeKwh: number }[] }[]}
 */
export function computeYoyCumulative(fullDailyHistory) {
  const byYear = new Map();
  for (const day of [...fullDailyHistory].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!hasData(day.perInverter)) continue;
    const { year } = dateParts(day.date);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(day);
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, days]) => {
      let cumulative = 0;
      const points = days.map((day) => {
        cumulative += sumDailyKwh(day.perInverter);
        return { dayOfYear: dayOfYear(day.date), cumulativeKwh: cumulative };
      });
      return { year, points };
    });
}

/**
 * Running lifetime totals (€ feed-in revenue, kg CO2 avoided) since `plant.commissionedDate`'s
 * year, one point per year (data-model.md "Trend series").
 * @param {{ year: number, perInverter: object }[]} fullYearlyHistory
 * @param {{ commissionedDate: string, tariffRatePerKwh: number }} plant
 * @returns {{ year: number, cumulativeEuro: number, cumulativeCo2Kg: number }[]}
 */
export function computeLifetimeCumulative(fullYearlyHistory, plant) {
  const commissionedYear = plant?.commissionedDate
    ? Number.parseInt(plant.commissionedDate.slice(0, 4), 10)
    : -Infinity;
  const rate = plant?.tariffRatePerKwh ?? 0;

  const years = [...fullYearlyHistory]
    .filter((y) => hasData(y.perInverter) && y.year >= commissionedYear)
    .sort((a, b) => a.year - b.year);

  let cumulativeEuro = 0;
  let cumulativeCo2Kg = 0;
  return years.map((y) => {
    const kwh = sumPeriodKwh(y.perInverter);
    cumulativeEuro += kwh * rate;
    cumulativeCo2Kg += kwh * co2FactorForYear(y.year);
    return { year: y.year, cumulativeEuro, cumulativeCo2Kg };
  });
}

/**
 * Ordinary-least-squares `{ slope, intercept }` of `values` against their index (0, 1, 2, …).
 * Shared by `linearRegressionFit` (the "how is this trending" line drawn across the actual
 * years) and `forecastYears` (extrapolating that same line beyond them). A single point has no
 * slope to fit, so it trends flat at its own value rather than dividing by zero.
 * @param {number[]} values
 * @returns {{ slope: number, intercept: number }}
 */
function linearRegressionParams(values) {
  const n = values.length;
  if (n <= 1) return { slope: 0, intercept: values[0] ?? 0 };
  const sumX = values.reduce((s, _, i) => s + i, 0);
  const sumY = values.reduce((s, v) => s + v, 0);
  const sumXY = values.reduce((s, v, i) => s + i * v, 0);
  const sumX2 = values.reduce((s, _, i) => s + i * i, 0);
  const denominator = n * sumX2 - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * Ordinary-least-squares fit of `values` against their index (0, 1, 2, …) — the "how is this
 * trending" line shown alongside computeSpecificYieldTrend's bars.
 * @param {number[]} values
 * @returns {number[]} One fitted value per input index, same length as `values`.
 */
function linearRegressionFit(values) {
  const { slope, intercept } = linearRegressionParams(values);
  return values.map((_, i) => slope * i + intercept);
}

// How many years beyond the last actual one `forecastYears` projects (user request: "two years
// into the future" on the lifetime-cumulative and specific-yield trend charts).
const FORECAST_YEARS_COUNT = 2;

/**
 * Extends a chronological `{ year, ...metrics }[]` series (as returned by
 * computeLifetimeCumulative/computeSpecificYieldTrend) with `count` additional future years, each
 * `metricKeys` field continuing that metric's own linear-regression trend across the actual
 * years — "if this trend continues" points for a chart to render distinctly (see chart-factory.js's
 * gray/dashed forecast series), kept out of the actual-data computers above so their own output
 * stays real-data-only. Flatlines at the last actual value when there's only one point to fit (no
 * slope to extrapolate). Empty input has no year to count forward from, so it forecasts nothing.
 * @param {Array<{ year: number } & Record<string, number>>} actual
 * @param {string[]} metricKeys - Which numeric fields on each entry to extrapolate.
 * @param {number} [count]
 * @returns {Array<{ year: number, forecast: true } & Record<string, number>>}
 */
export function forecastYears(actual, metricKeys, count = FORECAST_YEARS_COUNT) {
  if (actual.length === 0) return [];
  const lastYear = actual.at(-1).year;
  const params = Object.fromEntries(
    metricKeys.map((key) => [key, linearRegressionParams(actual.map((a) => a[key]))]),
  );
  return Array.from({ length: count }, (_, offset) => {
    const index = actual.length + offset;
    const entry = { year: lastYear + offset + 1, forecast: true };
    for (const key of metricKeys) {
      const { slope, intercept } = params[key];
      entry[key] = slope * index + intercept;
    }
    return entry;
  });
}

/**
 * Per-year specific yield (kWh/kWp), unchanged formula from yield-stats.js's
 * specificYieldKwhPerKwp (data-model.md "Trend series" — FR-008's degradation caveat is static UI
 * copy, not a computed field here). Each point also carries `trendKwhPerKwp`, its linear-regression
 * fit across all years (user request), for the chart to draw as an overlaid trend line.
 * @param {{ year: number, perInverter: object }[]} fullYearlyHistory
 * @param {{ capacityKwp: number }} plant
 * @returns {{ year: number, specificYieldKwhPerKwp: number, trendKwhPerKwp: number }[]}
 */
export function computeSpecificYieldTrend(fullYearlyHistory, plant) {
  const years = [...fullYearlyHistory]
    .filter((y) => hasData(y.perInverter))
    .sort((a, b) => a.year - b.year)
    .map((y) => ({
      year: y.year,
      specificYieldKwhPerKwp: specificYieldKwhPerKwp(
        sumPeriodKwh(y.perInverter),
        plant?.capacityKwp ?? 0,
      ),
    }));

  const trend = linearRegressionFit(years.map((y) => y.specificYieldKwhPerKwp));
  return years.map((y, i) => ({ ...y, trendKwhPerKwp: trend[i] }));
}

/**
 * Best/worst pairs for the Best vs. Worst topic (data-model.md "Best/worst pair") — composes
 * bestWorstMonth/bestWorstYear plus a daily-yield best/worst pair, without duplicating their
 * per-metric logic (FR-016).
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @param {{ month: string, perInverter: object }[]} fullMonthlyHistory
 * @param {{ year: number, perInverter: object }[]} fullYearlyHistory
 * @param {{ commissionedDate?: string }} [plant] - Passed through to bestWorstYear so its first
 *   (partial) year is excluded from "worst" here too.
 * @returns {{ label: string, best: object | null, worst: object | null }[]}
 */
export function bestWorstPairs(fullDailyHistory, fullMonthlyHistory, fullYearlyHistory, plant) {
  const months = bestWorstMonth(fullMonthlyHistory);
  const years = bestWorstYear(fullYearlyHistory, undefined, plant);

  const score = (d) => sumDailyKwh(d.perInverter);
  const bestDay = pickExtremum(fullDailyHistory, (d) => hasData(d.perInverter), score, 'max');
  const worstDay = pickExtremum(fullDailyHistory, (d) => hasData(d.perInverter), score, 'min');
  const toDayTile = (d, labelKey) => {
    if (!d) return null;
    const { year, month, day } = dateParts(d.date);
    return {
      label: labelKey,
      value: formatKwh(score(d), { decimals: 2 }),
      period: formatDateIso(d.date),
      route: { view: 'day', params: { year, month, day } },
      caveat: null,
    };
  };

  return [
    { label: 'statistics.bestWorst.month', best: months.best, worst: months.worst },
    { label: 'statistics.bestWorst.year', best: years.best, worst: years.worst },
    {
      label: 'statistics.bestWorst.dailyYield',
      best: toDayTile(bestDay, 'statistics.bestWorst.best'),
      worst: toDayTile(worstDay, 'statistics.bestWorst.worst'),
    },
  ];
}

/**
 * Shared not-enough-data gate for the three history-sensitive topics (data-model.md
 * "Not-enough-data gating", FR-012/SC-005). `common`/`best-worst` are never gated (spec.md) and
 * aren't part of this function's topic union — callers simply don't call it for those topics.
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @param {{ year: number, perInverter: object }[]} fullYearlyHistory
 * @param {'heatmaps' | 'streaks' | 'trends'} topic
 * @returns {boolean}
 */
export function hasEnoughHistory(fullDailyHistory, fullYearlyHistory, topic) {
  const hasAnyDaily = fullDailyHistory.some((d) => hasData(d.perInverter));
  if (topic === 'heatmaps' || topic === 'streaks') return hasAnyDaily;
  if (topic === 'trends') return fullYearlyHistory.some((y) => hasData(y.perInverter));
  return true;
}

/**
 * Whether the Trends topic's year-over-year chart specifically has enough data (≥2 distinct
 * years with recorded data) — gated independently from the lifetime/degradation charts, which
 * only need ≥1 full calendar year (data-model.md's gating table).
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @returns {boolean}
 */
export function hasEnoughHistoryForYoy(fullDailyHistory) {
  const years = new Set(
    fullDailyHistory.filter((d) => hasData(d.perInverter)).map((d) => dateParts(d.date).year),
  );
  return years.size >= 2;
}
