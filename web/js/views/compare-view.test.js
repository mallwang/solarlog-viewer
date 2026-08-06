import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByYear } from './compare-view.js';

function dailyTotal(date, wr1, wr2) {
  return { date, perInverter: { 1: { yieldWh: wr1, peakW: 0 }, 2: { yieldWh: wr2, peakW: 0 } } };
}

test('groups daily totals into one series per year', () => {
  const totals = [
    dailyTotal('2018-01-01', 100, 50),
    dailyTotal('2018-01-02', 200, 100),
    dailyTotal('2019-01-01', 300, 150),
  ];
  const series = groupByYear(totals);
  assert.equal(series.length, 2);
  const y2018 = series.find((s) => s.year === 2018);
  const y2019 = series.find((s) => s.year === 2019);
  assert.equal(y2018.points.length, 2);
  assert.equal(y2019.points.length, 1);
});

test('computes dayOfYear correctly (1-indexed) and sums both inverters', () => {
  const totals = [dailyTotal('2019-01-01', 300, 150), dailyTotal('2019-02-01', 100, 50)];
  const series = groupByYear(totals);
  const [y2019] = series;
  assert.deepEqual(
    y2019.points.find((p) => p.dayOfYear === 1),
    { dayOfYear: 1, totalWh: 450 },
  );
  assert.deepEqual(
    y2019.points.find((p) => p.dayOfYear === 32),
    { dayOfYear: 32, totalWh: 150 },
  );
});

test('includes Feb 29 in a leap year without shifting later days', () => {
  const totals = [
    dailyTotal('2020-02-28', 10, 0), // day 59
    dailyTotal('2020-02-29', 20, 0), // day 60 (leap day)
    dailyTotal('2020-03-01', 30, 0), // day 61
  ];
  const series = groupByYear(totals);
  const [y2020] = series;
  assert.deepEqual(y2020.points, [
    { dayOfYear: 59, totalWh: 10 },
    { dayOfYear: 60, totalWh: 20 },
    { dayOfYear: 61, totalWh: 30 },
  ]);
});

test('a non-leap year has no day 60 gap shift: March 1 is day 60', () => {
  const totals = [dailyTotal('2019-03-01', 30, 0)];
  const series = groupByYear(totals);
  assert.deepEqual(series[0].points, [{ dayOfYear: 60, totalWh: 30 }]);
});

test('supports at least 3 distinct years for the comparison view', () => {
  const totals = [
    dailyTotal('2017-06-15', 10, 5),
    dailyTotal('2018-06-15', 20, 10),
    dailyTotal('2019-06-15', 30, 15),
  ];
  const series = groupByYear(totals);
  assert.equal(series.length, 3);
  assert.deepEqual(series.map((s) => s.year).sort(), [2017, 2018, 2019]);
});
