import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyYieldWh,
  maxDailyYieldKwh,
  maxMonthlyYieldKwh,
  specificYieldKwhPerKwp,
  monthlySollKwh,
  dailySollKwh,
  elapsedDaysInMonth,
  monthSollAuflaufendKwh,
  yearlySollKwh,
  elapsedDaysInYear,
  yearSollAuflaufendKwh,
  istPercent,
} from './yield-stats.js';

const PLANT = { sollYearKwp: 900, capacityKwp: 6200, sollMonth: [2, 6, 9, 11, 12, 13, 13, 12, 10, 7, 3, 2] };

function reading(entries) {
  const perInverter = {};
  entries.forEach(([pacW, dailyYieldWh], i) => {
    perInverter[i + 1] = { pacW, dailyYieldWh };
  });
  return { perInverter };
}

test('dailyYieldWh sums the last reading across inverters', () => {
  const trace = {
    readings: [
      { perInverter: reading([[100, 500]]).perInverter },
      {
        perInverter: {
          1: { pacW: 200, dailyYieldWh: 1200 },
          2: { pacW: 50, dailyYieldWh: 300 },
        },
      },
    ],
  };
  assert.equal(dailyYieldWh(trace), 1500);
});

test('dailyYieldWh treats null counters (live/backfilled readings) as 0', () => {
  const trace = { readings: [{ perInverter: { 1: { pacW: 0, dailyYieldWh: null } } }] };
  assert.equal(dailyYieldWh(trace), 0);
});

test('dailyYieldWh returns 0 for an empty trace', () => {
  assert.equal(dailyYieldWh({ readings: [] }), 0);
});

test('maxDailyYieldKwh finds the best single day (summed per day across inverters)', () => {
  const dailyTotals = [
    { perInverter: { 1: { yieldWh: 20000 }, 2: { yieldWh: 10000 } } }, // 30 kWh
    { perInverter: { 1: { yieldWh: 25000 }, 2: { yieldWh: 11600 } } }, // 36.6 kWh
  ];
  assert.equal(maxDailyYieldKwh(dailyTotals), 36.6);
});

test('maxDailyYieldKwh returns 0 for an empty list', () => {
  assert.equal(maxDailyYieldKwh([]), 0);
});

test('maxMonthlyYieldKwh finds the best single month (summed per month across inverters)', () => {
  const monthlyTotals = [
    { perInverter: { 1: 200000, 2: 90000 } }, // 290 kWh
    { perInverter: { 1: 350000, 2: 160000 } }, // 510 kWh
  ];
  assert.equal(maxMonthlyYieldKwh(monthlyTotals), 510);
});

test('maxMonthlyYieldKwh returns 0 for an empty list', () => {
  assert.equal(maxMonthlyYieldKwh([]), 0);
});

test('specificYieldKwhPerKwp divides yield by installed kWp', () => {
  assert.equal(Number(specificYieldKwhPerKwp(36.4, 6200).toFixed(1)), 5.9);
});

test('specificYieldKwhPerKwp returns 0 when capacity is unknown', () => {
  assert.equal(specificYieldKwhPerKwp(36.4, 0), 0);
});

test('monthlySollKwh matches the worked August example (900*6200*12/100000)', () => {
  assert.equal(monthlySollKwh(PLANT, 8), 669.6);
});

test('dailySollKwh spreads the monthly Soll across the month\'s days', () => {
  assert.equal(Number(dailySollKwh(PLANT, 2026, 8).toFixed(1)), 21.6);
});

test('dailySollKwh returns 0 when Soll data is unavailable', () => {
  assert.equal(dailySollKwh({}, 2026, 8), 0);
});

test('elapsedDaysInMonth returns today\'s day-of-month for the current month', () => {
  const today = new Date(2026, 7, 8); // 8 August 2026 (month is 0-indexed here)
  assert.equal(elapsedDaysInMonth(2026, 8, today), 8);
});

test('elapsedDaysInMonth returns the full month length for a past month', () => {
  const today = new Date(2026, 7, 8);
  assert.equal(elapsedDaysInMonth(2026, 7, today), 31); // July has 31 days
});

test('elapsedDaysInMonth returns 0 for a future month', () => {
  const today = new Date(2026, 7, 8);
  assert.equal(elapsedDaysInMonth(2026, 9, today), 0);
});

test('monthSollAuflaufendKwh matches the worked August 8th example (21.6 * 8 = 172.8)', () => {
  const today = new Date(2026, 7, 8);
  assert.equal(Number(monthSollAuflaufendKwh(PLANT, 2026, 8, today).toFixed(1)), 172.8);
});

test('monthSollAuflaufendKwh equals the full monthly Soll once the month has fully elapsed', () => {
  const today = new Date(2026, 8, 1); // 1 September 2026 - August is over
  assert.equal(
    Number(monthSollAuflaufendKwh(PLANT, 2026, 8, today).toFixed(1)),
    Number(monthlySollKwh(PLANT, 8).toFixed(1)),
  );
});

test('elapsedDaysInYear returns today\'s day-of-year for the current year', () => {
  const today = new Date(2026, 7, 8); // 8 August 2026 is day 220 of the year
  assert.equal(elapsedDaysInYear(2026, today), 220);
});

test('elapsedDaysInYear returns the full year length for a past year', () => {
  const today = new Date(2026, 7, 8);
  assert.equal(elapsedDaysInYear(2025, today), 365);
});

test('elapsedDaysInYear returns 366 for a past leap year', () => {
  const today = new Date(2026, 7, 8);
  assert.equal(elapsedDaysInYear(2024, today), 366);
});

test('elapsedDaysInYear returns 0 for a future year', () => {
  const today = new Date(2026, 7, 8);
  assert.equal(elapsedDaysInYear(2027, today), 0);
});

test('yearSollAuflaufendKwh matches the day-220-of-365 example (5580 / 365 * 220 = 3363.3)', () => {
  const today = new Date(2026, 7, 8);
  assert.equal(Number(yearSollAuflaufendKwh(PLANT, 2026, today).toFixed(1)), 3363.3);
});

test('yearSollAuflaufendKwh equals the full yearly Soll once the year has fully elapsed', () => {
  const today = new Date(2027, 0, 1); // 1 January 2027 - 2026 is over
  assert.equal(
    Number(yearSollAuflaufendKwh(PLANT, 2026, today).toFixed(1)),
    Number(yearlySollKwh(PLANT).toFixed(1)),
  );
});

test('yearlySollKwh multiplies the annual specific-yield target by installed kWp', () => {
  assert.equal(yearlySollKwh(PLANT), 5580);
});

test('yearlySollKwh returns 0 when Soll data is unavailable', () => {
  assert.equal(yearlySollKwh({}), 0);
});

test('istPercent matches the worked example (36.4 / 21.6 = 169%)', () => {
  assert.equal(istPercent(36.4, 21.6), 169);
});

test('istPercent returns 0 when soll is 0 (avoids Infinity/NaN)', () => {
  assert.equal(istPercent(36.4, 0), 0);
});
