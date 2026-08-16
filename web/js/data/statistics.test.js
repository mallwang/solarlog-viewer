import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestWorstMonth,
  bestWorstYear,
  maxDailyPower,
  maxIstPercent,
  maxDailyCo2,
  maxDailyEuro,
  buildCalendarHeatmap,
  computeLongestStreak,
  computeYoyCumulative,
  computeLifetimeCumulative,
  computeSpecificYieldTrend,
  bestWorstPairs,
  hasEnoughHistory,
  hasEnoughHistoryForYoy,
  STREAK_THRESHOLD_KWH,
} from './statistics.js';

const PLANT = {
  capacityKwp: 6200,
  commissionedDate: '2020-03-15',
  tariffRatePerKwh: 0.12,
  sollYearKwp: 900,
  sollMonth: [2, 6, 9, 11, 12, 13, 13, 12, 10, 7, 3, 2],
};

function day(date, yieldWh, peakW = 1000) {
  return { date, perInverter: { 1: { yieldWh, peakW } } };
}

function month(m, wh) {
  return { month: m, perInverter: { 1: wh } };
}

function year(y, wh) {
  return { year: y, perInverter: { 1: wh } };
}

test('bestWorstMonth picks the correct extremum and ignores months with no data', () => {
  const months = [month('2024-01', 1000000), month('2024-02', 5000000), month('2024-03', 0)];
  months[2].perInverter = {}; // no data at all, not a real zero
  const { best, worst } = bestWorstMonth(months);
  assert.equal(best.period, '2024-02');
  assert.deepEqual(best.route, { view: 'month', params: { year: 2024, month: 2 } });
  assert.equal(worst.period, '2024-01');
});

test('bestWorstMonth returns nulls when there is no data at all', () => {
  const { best, worst } = bestWorstMonth([]);
  assert.equal(best, null);
  assert.equal(worst, null);
});

test('bestWorstYear picks the correct extremum and ignores years with no data', () => {
  const years = [year(2019, 4000000), year(2024, 6000000)];
  const { best, worst } = bestWorstYear(years);
  assert.equal(best.period, '2024');
  assert.equal(worst.period, '2019');
  assert.deepEqual(best.route, { view: 'year', params: { year: 2024 } });
});

test('maxDailyPower picks the day with the highest recorded peakW, using peakW directly', () => {
  const days = [day('2024-07-01', 30000, 4000), day('2024-07-14', 40000, 8420)];
  const tile = maxDailyPower(days);
  assert.equal(tile.period, '2024-07-14');
  assert.equal(tile.value, '8.420 W');
  assert.equal(tile.caveat, 'statistics.commonTiles.maxDailyPowerCaveat');
  assert.deepEqual(tile.route, { view: 'day', params: { year: 2024, month: 7, day: 14 } });
});

test('maxIstPercent picks the day with the highest yield-vs-Soll ratio', () => {
  const days = [day('2024-08-01', 5000000), day('2024-08-03', 36400000)];
  const tile = maxIstPercent(days, PLANT);
  assert.equal(tile.period, '2024-08-03');
  assert.ok(tile.value.endsWith('%'));
});

test('maxDailyCo2 picks the day with the highest CO2 avoided', () => {
  const days = [day('2019-01-01', 1000000), day('2024-06-01', 5000000)];
  const tile = maxDailyCo2(days);
  assert.equal(tile.period, '2024-06-01');
});

test('maxDailyEuro picks the day with the highest feed-in revenue', () => {
  const days = [day('2024-01-01', 1000000), day('2024-06-01', 5000000)];
  const tile = maxDailyEuro(days, PLANT);
  assert.equal(tile.period, '2024-06-01');
});

test('buildCalendarHeatmap marks absent dates as value: null and scales per-year', () => {
  const days = [day('2024-01-01', 1000000), day('2024-01-02', 3000000)];
  const heatmap = buildCalendarHeatmap(days, 2024, 'energyKwh', PLANT);
  assert.equal(heatmap.cells.length, 366); // 2024 is a leap year
  const jan1 = heatmap.cells.find((c) => c.date === '2024-01-01');
  const jan2 = heatmap.cells.find((c) => c.date === '2024-01-02');
  const jan3 = heatmap.cells.find((c) => c.date === '2024-01-03');
  assert.equal(jan1.value, 1000);
  assert.equal(jan1.relativeIntensity, 0);
  assert.equal(jan2.relativeIntensity, 1);
  assert.equal(jan3.value, null);
  assert.equal(jan3.relativeIntensity, null);
});

test('buildCalendarHeatmap gives relativeIntensity 0 when yearMax === yearMin (single data point)', () => {
  const days = [day('2023-05-01', 2000000)];
  const heatmap = buildCalendarHeatmap(days, 2023, 'energyKwh', PLANT);
  const cell = heatmap.cells.find((c) => c.date === '2023-05-01');
  assert.equal(cell.relativeIntensity, 0);
  assert.equal(heatmap.cells.length, 365);
});

test('computeLongestStreak finds the longest consecutive qualifying run and a gap breaks it', () => {
  const threshold = STREAK_THRESHOLD_KWH;
  const days = [
    day('2024-06-01', threshold * 1_000_000),
    day('2024-06-02', threshold * 1_000_000),
    day('2024-06-04', threshold * 1_000_000), // gap: 06-03 missing
    day('2024-06-05', threshold * 1_000_000),
    day('2024-06-06', threshold * 1_000_000),
  ];
  const streak = computeLongestStreak(days);
  assert.equal(streak.lengthDays, 3);
  assert.equal(streak.startDate, '2024-06-04');
  assert.equal(streak.endDate, '2024-06-06');
});

test('computeLongestStreak marks an ongoing streak (endDate = last date in the data) as isOngoing', () => {
  const threshold = STREAK_THRESHOLD_KWH;
  const days = [day('2024-06-01', threshold * 1_000_000), day('2024-06-02', threshold * 1_000_000)];
  const streak = computeLongestStreak(days);
  assert.equal(streak.isOngoing, true);
});

test('computeLongestStreak marks a tie with the historical record as isOngoing too', () => {
  const threshold = STREAK_THRESHOLD_KWH;
  const days = [
    day('2024-01-01', threshold * 1_000_000),
    day('2024-01-02', threshold * 1_000_000),
    day('2024-06-01', threshold * 1_000_000),
    day('2024-06-02', threshold * 1_000_000),
  ];
  const streak = computeLongestStreak(days);
  assert.equal(streak.isOngoing, true);
  assert.equal(streak.startDate, '2024-06-01');
});

test('computeYoyCumulative aligns Feb 29 without shifting later day-of-year values in non-leap years', () => {
  const days = [
    day('2023-03-01', 1000000), // non-leap year
    day('2024-02-29', 1000000), // leap year
    day('2024-03-01', 1000000),
  ];
  const series = computeYoyCumulative(days);
  const y2023 = series.find((s) => s.year === 2023);
  const y2024 = series.find((s) => s.year === 2024);
  const mar1_2023 = y2023.points.find((p) => p.dayOfYear === 61);
  const mar1_2024 = y2024.points.find((p) => p.dayOfYear === 61);
  assert.ok(mar1_2023);
  assert.ok(mar1_2024);
  const feb29 = y2024.points.find((p) => p.dayOfYear === 60);
  assert.ok(feb29);
});

test('computeLifetimeCumulative runs from the plant commissioning year and accumulates', () => {
  const years = [year(2019, 1000000), year(2020, 2000000), year(2021, 3000000)];
  const series = computeLifetimeCumulative(years, PLANT);
  assert.equal(series.length, 2); // 2019 excluded (before commissionedDate's year 2020)
  assert.equal(series[0].year, 2020);
  assert.ok(series[1].cumulativeEuro > series[0].cumulativeEuro);
});

test('computeSpecificYieldTrend uses specificYieldKwhPerKwp unchanged', () => {
  const years = [year(2020, 6200000)];
  const series = computeSpecificYieldTrend(years, PLANT);
  assert.equal(series[0].specificYieldKwhPerKwp, 1000);
});

test('bestWorstPairs composes bestWorstMonth/bestWorstYear plus a daily-yield pair', () => {
  const days = [day('2024-01-01', 1000000), day('2024-06-01', 5000000)];
  const months = [month('2024-01', 1000000), month('2024-06', 5000000)];
  const years = [year(2024, 6000000)];
  const pairs = bestWorstPairs(days, months, years);
  assert.equal(pairs.length, 3);
  const dailyPair = pairs.find((p) => p.label === 'statistics.bestWorst.dailyYield');
  assert.equal(dailyPair.best.period, '2024-06-01');
  assert.equal(dailyPair.worst.period, '2024-01-01');
});

test('hasEnoughHistory gates heatmaps/streaks/trends and is true given data', () => {
  assert.equal(hasEnoughHistory([], [], 'heatmaps'), false);
  assert.equal(hasEnoughHistory([day('2024-01-01', 1000000)], [], 'heatmaps'), true);
  assert.equal(hasEnoughHistory([], [], 'streaks'), false);
  assert.equal(hasEnoughHistory([], [], 'trends'), false);
  assert.equal(hasEnoughHistory([], [year(2024, 1000000)], 'trends'), true);
});

test('hasEnoughHistoryForYoy requires at least two distinct years of data', () => {
  assert.equal(hasEnoughHistoryForYoy([day('2024-01-01', 1000000)]), false);
  assert.equal(
    hasEnoughHistoryForYoy([day('2023-01-01', 1000000), day('2024-01-01', 1000000)]),
    true,
  );
});

test('empty inputs never throw for the always-runnable functions', () => {
  assert.equal(maxDailyPower([]), null);
  assert.equal(maxIstPercent([], PLANT), null);
  assert.equal(maxDailyCo2([]), null);
  assert.equal(maxDailyEuro([], PLANT), null);
  assert.deepEqual(computeYoyCumulative([]), []);
  assert.deepEqual(computeLifetimeCumulative([], PLANT), []);
  assert.deepEqual(computeSpecificYieldTrend([], PLANT), []);
  assert.equal(computeLongestStreak([]), null);
  assert.deepEqual(buildCalendarHeatmap([], 2024, 'energyKwh', PLANT).cells.length, 366);
});
