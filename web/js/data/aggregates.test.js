import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDailyTotalsFile,
  parseMonthsFile,
  parseYearsFile,
  deriveLifetimeSummary,
  mergeDailyTotals,
  mergeMonthlyTotals,
  mergeYearlyTotals,
  addTodayYield,
} from './aggregates.js';

test('parseDailyTotalsFile extracts date, yield, and peak per inverter', () => {
  const fileText = 'da[dx++]="29.07.26|9748;3209|5070;1645"';
  const [total] = parseDailyTotalsFile(fileText);
  assert.equal(total.date, '2026-07-29');
  assert.deepEqual(total.perInverter, {
    1: { yieldWh: 9748, peakW: 3209 },
    2: { yieldWh: 5070, peakW: 1645 },
  });
});

test('parseDailyTotalsFile preserves file order across multiple records', () => {
  const fileText = ['da[dx++]="31.07.26|0;0|0;0"', 'da[dx++]="30.07.26|21270;0|11171;0"'].join(
    '\n',
  );
  const totals = parseDailyTotalsFile(fileText);
  assert.equal(totals.length, 2);
  assert.equal(totals[0].date, '2026-07-31');
  assert.equal(totals[1].date, '2026-07-30');
});

test('parseMonthsFile extracts month and per-inverter whole-month totals', () => {
  const fileText = 'mo[mx++]="01.07.26|584376|290797"';
  const [month] = parseMonthsFile(fileText);
  assert.equal(month.month, '2026-07');
  assert.deepEqual(month.perInverter, { 1: 584376, 2: 290797 });
  assert.deepEqual(month.dailyBreakdown, []);
});

test('parseMonthsFile handles a full year of records', () => {
  const fileText = ['mo[mx++]="01.02.26|145575|81540"', 'mo[mx++]="01.01.26|159254|85866"'].join(
    '\n',
  );
  const months = parseMonthsFile(fileText);
  assert.equal(months.length, 2);
  assert.equal(months[0].month, '2026-02');
  assert.equal(months[1].month, '2026-01');
});

test('parseYearsFile extracts year and per-inverter whole-year totals', () => {
  const fileText = 'ye[yx++]="01.01.06|4123877|2118265"';
  const [year] = parseYearsFile(fileText);
  assert.equal(year.year, 2006);
  assert.deepEqual(year.perInverter, { 1: 4123877, 2: 2118265 });
});

test('parseYearsFile renders a partial year (2006) with its actual total, not padded', () => {
  const fileText = [
    'ye[yx++]="01.01.07|4532069|2389727"',
    'ye[yx++]="01.01.06|4123877|2118265"',
  ].join('\n');
  const years = parseYearsFile(fileText);
  const partial = years.find((y) => y.year === 2006);
  assert.deepEqual(partial.perInverter, { 1: 4123877, 2: 2118265 });
});

test('deriveLifetimeSummary sums all years and applies the CO2 factor and tariff', () => {
  const yearlyTotals = [
    { year: 2007, perInverter: { 1: 4000000, 2: 2000000 } },
    { year: 2006, perInverter: { 1: 1000000, 2: 500000 } },
  ];
  const summary = deriveLifetimeSummary(yearlyTotals, 0.518);
  assert.equal(summary.totalYieldWh, 7500000);
  assert.equal(summary.co2SavedKg, 5250);
  assert.ok(Math.abs(summary.feedInTotal - 3885) < 0.01);
  assert.equal(summary.byYear, yearlyTotals);
});

test('mergeDailyTotals concatenates non-overlapping hist/data entries and sorts ascending by date', () => {
  const hist = [{ date: '2026-07-28', perInverter: { 1: { yieldWh: 100, peakW: 10 } } }];
  const data = [{ date: '2026-07-29', perInverter: { 1: { yieldWh: 200, peakW: 20 } } }];
  const merged = mergeDailyTotals(hist, data);
  assert.deepEqual(
    merged.map((e) => e.date),
    ['2026-07-28', '2026-07-29'],
  );
});

test('mergeDailyTotals prefers the data-side entry when the same date appears in both', () => {
  const hist = [{ date: '2026-07-29', perInverter: { 1: { yieldWh: 100, peakW: 10 } } }];
  const data = [{ date: '2026-07-29', perInverter: { 1: { yieldWh: 999, peakW: 99 } } }];
  const merged = mergeDailyTotals(hist, data);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].perInverter, { 1: { yieldWh: 999, peakW: 99 } });
});

test('mergeMonthlyTotals sums per-inverter Wh for a month present in both hist and data (installation-month overlap)', () => {
  const hist = [{ month: '2026-07', perInverter: { 1: 500000, 2: 250000 }, dailyBreakdown: [] }];
  const data = [{ month: '2026-07', perInverter: { 1: 10377, 2: 5521 }, dailyBreakdown: [] }];
  const merged = mergeMonthlyTotals(hist, data);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].perInverter, { 1: 510377, 2: 255521 });
});

test('mergeMonthlyTotals keeps months present in only one side untouched, sorted ascending', () => {
  const hist = [{ month: '2026-06', perInverter: { 1: 400000 }, dailyBreakdown: [] }];
  const data = [{ month: '2026-08', perInverter: { 1: 20849 }, dailyBreakdown: [] }];
  const merged = mergeMonthlyTotals(hist, data);
  assert.deepEqual(
    merged.map((e) => e.month),
    ['2026-06', '2026-08'],
  );
});

test('mergeYearlyTotals sums per-inverter Wh for a year present in both hist and data (installation-year overlap)', () => {
  const hist = [{ year: 2026, perInverter: { 1: 4000000, 2: 2000000 } }];
  const data = [{ year: 2026, perInverter: { 1: 111069, 2: 58081 } }];
  const merged = mergeYearlyTotals(hist, data);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].perInverter, { 1: 4111069, 2: 2058081 });
});

test('mergeYearlyTotals keeps years present in only one side untouched, sorted ascending', () => {
  const hist = [{ year: 2006, perInverter: { 1: 1000000 } }];
  const data = [{ year: 2026, perInverter: { 1: 111069 } }];
  const merged = mergeYearlyTotals(hist, data);
  assert.deepEqual(
    merged.map((e) => e.year),
    [2006, 2026],
  );
});

test('addTodayYield adds today per-inverter Wh onto a month/year total', () => {
  const total = { month: '2026-08', perInverter: { 1: 169583, 2: 88219 } };
  const today = {
    date: '2026-08-09',
    perInverter: { 1: { yieldWh: 19268, peakW: 3421 }, 2: { yieldWh: 9738, peakW: 1754 } },
  };
  const result = addTodayYield(total, today);
  assert.deepEqual(result.perInverter, { 1: 188851, 2: 97957 });
});

test('addTodayYield returns the total unchanged when today has no entry', () => {
  const total = { month: '2026-08', perInverter: { 1: 169583 } };
  const result = addTodayYield(total, undefined);
  assert.equal(result, total);
});

test('addTodayYield does not mutate the input total', () => {
  const total = { month: '2026-08', perInverter: { 1: 169583 } };
  const today = { date: '2026-08-09', perInverter: { 1: { yieldWh: 19268, peakW: 3421 } } };
  addTodayYield(total, today);
  assert.deepEqual(total.perInverter, { 1: 169583 });
});
