import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyYieldWh,
  maxDailyPowerW,
  maxDailyYieldKwh,
  maxMonthlyYieldKwh,
  maxYearlyYield,
  specificYieldKwhPerKwp,
  monthlySollKwh,
  dailySollKwh,
  elapsedDaysInMonth,
  monthSollAuflaufendKwh,
  yearlySollKwh,
  daysInYear,
  firstYearSollKwh,
  lifetimeSollKwh,
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

test('maxDailyPowerW finds the peak instantaneous power (summed per reading across inverters) and when it happened', () => {
  const trace = {
    readings: [
      { timestamp: '2026-08-09T08:00:00', perInverter: { 1: { pacW: 1200 }, 2: { pacW: 800 } } }, // 2000 W
      { timestamp: '2026-08-09T14:35:00', perInverter: { 1: { pacW: 3175 }, 2: { pacW: 2000 } } }, // 5175 W
      { timestamp: '2026-08-09T18:00:00', perInverter: { 1: { pacW: 500 }, 2: { pacW: 300 } } }, // 800 W
    ],
  };
  assert.deepEqual(maxDailyPowerW(trace), { w: 5175, timestamp: '2026-08-09T14:35:00' });
});

test('maxDailyPowerW treats null/missing pacW (backfilled days) as 0', () => {
  const trace = { readings: [{ timestamp: '2026-08-09T08:00:00', perInverter: { 1: { pacW: null } } }] };
  assert.deepEqual(maxDailyPowerW(trace), { w: 0, timestamp: null });
});

test('maxDailyPowerW returns w 0 and timestamp null for an empty trace', () => {
  assert.deepEqual(maxDailyPowerW({ readings: [] }), { w: 0, timestamp: null });
});

test('maxDailyYieldKwh finds the best single day (summed per day across inverters) and its date', () => {
  const dailyTotals = [
    { date: '2026-08-14', perInverter: { 1: { yieldWh: 20000 }, 2: { yieldWh: 10000 } } }, // 30 kWh
    { date: '2026-08-15', perInverter: { 1: { yieldWh: 25000 }, 2: { yieldWh: 11600 } } }, // 36.6 kWh
  ];
  assert.deepEqual(maxDailyYieldKwh(dailyTotals), { kwh: 36.6, date: '2026-08-15' });
});

test('maxDailyYieldKwh returns kwh 0 and date null for an empty list', () => {
  assert.deepEqual(maxDailyYieldKwh([]), { kwh: 0, date: null });
});

test('maxMonthlyYieldKwh finds the best single month (summed per month across inverters) and which month', () => {
  const monthlyTotals = [
    { month: '2026-07', perInverter: { 1: 200000, 2: 90000 } }, // 290 kWh
    { month: '2026-08', perInverter: { 1: 350000, 2: 160000 } }, // 510 kWh
  ];
  assert.deepEqual(maxMonthlyYieldKwh(monthlyTotals), { kwh: 510, month: '2026-08' });
});

test('maxMonthlyYieldKwh returns kwh 0 and month null for an empty list', () => {
  assert.deepEqual(maxMonthlyYieldKwh([]), { kwh: 0, month: null });
});

test('maxYearlyYield finds the best single year (summed per year across inverters)', () => {
  const yearlyTotals = [
    { year: 2019, perInverter: { 1: 3200000, 2: 1500000 } }, // 4700 kWh
    { year: 2020, perInverter: { 1: 3600000, 2: 1700000 } }, // 5300 kWh
  ];
  assert.deepEqual(maxYearlyYield(yearlyTotals), { kwh: 5300, year: 2020 });
});

test('maxYearlyYield returns kwh 0 and year null for an empty list', () => {
  assert.deepEqual(maxYearlyYield([]), { kwh: 0, year: null });
});

test('daysInYear returns 365 for a non-leap year and 366 for a leap year', () => {
  assert.equal(daysInYear(2026), 365);
  assert.equal(daysInYear(2024), 366);
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

test('yearSollAuflaufendKwh sums full months plus the elapsed days of the current month (Aug 9th: 3877.2)', () => {
  const today = new Date(2026, 7, 9);
  assert.equal(Number(yearSollAuflaufendKwh(PLANT, 2026, today).toFixed(1)), 3877.2);
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

test('firstYearSollKwh prorates the commissioning year from the commissioning date to year-end (15 Mar 2006: 292/365 days)', () => {
  const today = new Date(2026, 7, 9); // well past 2006, so 2006 is a fully-elapsed past year
  assert.equal(
    Number(firstYearSollKwh(PLANT, '2006-03-15', today).toFixed(1)),
    Number(((yearlySollKwh(PLANT) * 292) / 365).toFixed(1)),
  );
});

test('firstYearSollKwh prorates only up to today when commissioned this same year', () => {
  const today = new Date(2026, 7, 9); // 9 August 2026 = day 221 of 2026
  assert.equal(
    Number(firstYearSollKwh(PLANT, '2026-01-01', today).toFixed(1)),
    Number(((yearlySollKwh(PLANT) * 221) / 365).toFixed(1)),
  );
});

test('firstYearSollKwh returns 0 when commissioning date is unavailable', () => {
  assert.equal(firstYearSollKwh(PLANT, ''), 0);
});

test('lifetimeSollKwh sums the partial commissioning year, every full year since, and the current year auflaufend', () => {
  const today = new Date(2026, 7, 9);
  const expected =
    firstYearSollKwh(PLANT, '2006-03-15', today) +
    yearlySollKwh(PLANT) * (2026 - 2006 - 1) + // full years 2007..2025
    yearSollAuflaufendKwh(PLANT, 2026, today);
  assert.equal(
    Number(lifetimeSollKwh(PLANT, '2006-03-15', today).toFixed(1)),
    Number(expected.toFixed(1)),
  );
});

test('lifetimeSollKwh equals just the partial year when commissioned this same year', () => {
  const today = new Date(2026, 7, 9);
  assert.equal(
    lifetimeSollKwh(PLANT, '2026-01-01', today),
    firstYearSollKwh(PLANT, '2026-01-01', today),
  );
});

test('lifetimeSollKwh returns 0 when commissioning date is unavailable', () => {
  assert.equal(lifetimeSollKwh(PLANT, ''), 0);
});

test('istPercent matches the worked example (36.4 / 21.6 = 169%)', () => {
  assert.equal(istPercent(36.4, 21.6), 169);
});

test('istPercent returns 0 when soll is 0 (avoids Infinity/NaN)', () => {
  assert.equal(istPercent(36.4, 0), 0);
});
