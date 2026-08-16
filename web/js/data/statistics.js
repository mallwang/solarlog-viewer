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

import { formatKwh, formatCurrency, formatCo2, formatNumber } from '../format.js';
import { dailySollKwh, istPercent, specificYieldKwhPerKwp, daysInYear } from './yield-stats.js';
import { co2FactorForYear } from './co2-factors.js';

function sumDailyKwh(perInverter) {
  return Object.values(perInverter).reduce((sum, inv) => sum + (inv?.yieldWh ?? 0), 0) / 1000;
}

function sumPeriodKwh(perInverter) {
  return Object.values(perInverter).reduce((sum, wh) => sum + (wh ?? 0), 0) / 1000;
}

function hasData(perInverter) {
  return Object.keys(perInverter ?? {}).length > 0;
}

function dateParts(dateIso) {
  const [year, month, day] = dateIso.split('-').map((n) => Number.parseInt(n, 10));
  return { year, month, day };
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
      value: formatKwh(score(m)),
      period: m.month,
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
 * (empty `perInverter`) are ignored.
 * @param {{ year: number, perInverter: object }[]} fullYearlyHistory
 * @returns {{ best: object | null, worst: object | null }}
 */
export function bestWorstYear(fullYearlyHistory) {
  const score = (y) => sumPeriodKwh(y.perInverter);
  const bestYear = pickExtremum(fullYearlyHistory, (y) => hasData(y.perInverter), score, 'max');
  const worstYear = pickExtremum(fullYearlyHistory, (y) => hasData(y.perInverter), score, 'min');
  const toTile = (y, labelKey) => {
    if (!y) return null;
    return {
      label: labelKey,
      value: formatKwh(score(y)),
      period: String(y.year),
      route: { view: 'year', params: { year: y.year } },
      caveat: null,
    };
  };
  return {
    best: toTile(bestYear, 'statistics.common.bestYear'),
    worst: toTile(worstYear, 'statistics.common.worstYear'),
  };
}

/**
 * The single day with the highest recorded peak power (`peakW`, summed across inverters) —
 * already present in days.js/days_hist.js, so this is a genuine per-day max without any
 * minute-file read (FR-010/FR-011). Carries a `caveat` since the source data has no time-of-day.
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
    period: day.date,
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
    period: best.day.date,
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
    period: day.date,
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
    period: day.date,
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
 * values (FR-015), `0` when every present value is equal (e.g. a single data point).
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @param {number} year
 * @param {'energyKwh' | 'moneyEuro' | 'co2Kg'} metric
 * @param {object} plant - PlantMetadata.
 * @returns {{ metric: string, year: number, cells: { date: string, value: number | null, relativeIntensity: number | null }[] }}
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
    if (value === null) return { date, value: null, relativeIntensity: null };
    const relativeIntensity =
      yearMax === yearMin ? 0 : Math.min(1, Math.max(0, (value - yearMin) / (yearMax - yearMin)));
    return { date, value, relativeIntensity };
  });

  return { metric, year, cells };
}

// See research.md R5: fixed constant, ~10% of the plant's average historical daily yield in the
// Mar-Sep productive season, computed once from the merged full daily history's own median at
// implementation time (2026-08-16 dataset) rather than derived at runtime — a fixed constant per
// spec.md's Assumptions, not recomputed per plant/session.
export const STREAK_THRESHOLD_KWH = 1.5;

function isoNextDay(dateIso) {
  const [y, m, d] = dateIso.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

/**
 * Longest run of consecutive recorded days each yielding ≥ STREAK_THRESHOLD_KWH (data-model.md
 * "Streak"). A missing date breaks the run (consecutive *recorded* days, not calendar days with
 * gaps tolerated). Ties are broken by most-recent run, so an ongoing run tying the historical
 * record is still reported as ongoing (spec.md Edge Cases).
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @returns {{ lengthDays: number, startDate: string, endDate: string, isOngoing: boolean } | null}
 */
export function computeLongestStreak(fullDailyHistory) {
  const qualifying = [...fullDailyHistory]
    .filter((d) => hasData(d.perInverter) && sumDailyKwh(d.perInverter) >= STREAK_THRESHOLD_KWH)
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
 * Per-year specific yield (kWh/kWp), unchanged formula from yield-stats.js's
 * specificYieldKwhPerKwp (data-model.md "Trend series" — FR-008's degradation caveat is static UI
 * copy, not a computed field here).
 * @param {{ year: number, perInverter: object }[]} fullYearlyHistory
 * @param {{ capacityKwp: number }} plant
 * @returns {{ year: number, specificYieldKwhPerKwp: number }[]}
 */
export function computeSpecificYieldTrend(fullYearlyHistory, plant) {
  return [...fullYearlyHistory]
    .filter((y) => hasData(y.perInverter))
    .sort((a, b) => a.year - b.year)
    .map((y) => ({
      year: y.year,
      specificYieldKwhPerKwp: specificYieldKwhPerKwp(
        sumPeriodKwh(y.perInverter),
        plant?.capacityKwp ?? 0,
      ),
    }));
}

/**
 * Best/worst pairs for the Best vs. Worst topic (data-model.md "Best/worst pair") — composes
 * bestWorstMonth/bestWorstYear plus a daily-yield best/worst pair, without duplicating their
 * per-metric logic (FR-016).
 * @param {{ date: string, perInverter: object }[]} fullDailyHistory
 * @param {{ month: string, perInverter: object }[]} fullMonthlyHistory
 * @param {{ year: number, perInverter: object }[]} fullYearlyHistory
 * @returns {{ label: string, best: object | null, worst: object | null }[]}
 */
export function bestWorstPairs(fullDailyHistory, fullMonthlyHistory, fullYearlyHistory) {
  const months = bestWorstMonth(fullMonthlyHistory);
  const years = bestWorstYear(fullYearlyHistory);

  const score = (d) => sumDailyKwh(d.perInverter);
  const bestDay = pickExtremum(fullDailyHistory, (d) => hasData(d.perInverter), score, 'max');
  const worstDay = pickExtremum(fullDailyHistory, (d) => hasData(d.perInverter), score, 'min');
  const toDayTile = (d, labelKey) => {
    if (!d) return null;
    const { year, month, day } = dateParts(d.date);
    return {
      label: labelKey,
      value: formatKwh(score(d)),
      period: d.date,
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
