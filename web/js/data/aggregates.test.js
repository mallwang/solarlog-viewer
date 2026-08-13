import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDailyTotalsFile,
  parseMonthsFile,
  parseYearsFile,
  deriveLifetimeSummary,
  deriveYieldSummary,
  mergeDailyTotals,
  mergeMonthlyTotals,
  mergeYearlyTotals,
  addTodayYield,
  addMissingDays,
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

test("parseMonthsFile keeps the record's own day as asOfDate, not just its year-month", () => {
  // The in-progress month is checkpointed on whatever day it was last rolled over, which is not
  // necessarily the 1st (see addMissingDays).
  const fileText = 'mo[mx++]="11.08.26|232337|120512"';
  const [month] = parseMonthsFile(fileText);
  assert.equal(month.asOfDate, '2026-08-11');
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

test('deriveLifetimeSummary sums all years and applies each year its own CO2 factor', () => {
  // 2007 -> 0.626 kg/kWh, 2006 -> 0.608 kg/kWh (see co2-factors.js); per SC-005 this must be the
  // per-year sum, not totalKwh * a single flat factor.
  const yearlyTotals = [
    { year: 2007, perInverter: { 1: 4000000, 2: 2000000 } },
    { year: 2006, perInverter: { 1: 1000000, 2: 500000 } },
  ];
  const summary = deriveLifetimeSummary(yearlyTotals, 0.518);
  assert.equal(summary.totalYieldWh, 7500000);
  const expectedCo2 = 6000 * 0.626 + 1500 * 0.608;
  assert.ok(Math.abs(summary.co2SavedKg - expectedCo2) < 0.001);
  assert.notEqual(summary.co2SavedKg, (7500000 / 1000) * 0.626);
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

test("mergeMonthlyTotals keeps the later of the two sides' asOfDate on overlap", () => {
  const hist = [
    { month: '2026-07', asOfDate: '2026-07-15', perInverter: { 1: 500000 }, dailyBreakdown: [] },
  ];
  const data = [
    { month: '2026-07', asOfDate: '2026-07-20', perInverter: { 1: 10377 }, dailyBreakdown: [] },
  ];
  const merged = mergeMonthlyTotals(hist, data);
  assert.equal(merged[0].asOfDate, '2026-07-20');
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

test('addMissingDays folds in every daily total newer than asOfDate, not just today - covering a stale months.js checkpoint that skipped a rollover', () => {
  // months.js last checkpointed 11.08.26; the device then skipped the 12.08 and 13.08 rollovers,
  // so both days must still be recovered from dailyBreakdown, not just the most recent one.
  const total = { month: '2026-08', asOfDate: '2026-08-11', perInverter: { 1: 232337, 2: 120512 } };
  const dailyBreakdown = [
    { date: '2026-08-10', perInverter: { 1: { yieldWh: 17643 }, 2: { yieldWh: 9061 } } },
    { date: '2026-08-11', perInverter: { 1: { yieldWh: 23749 }, 2: { yieldWh: 12313 } } },
    { date: '2026-08-12', perInverter: { 1: { yieldWh: 24170 }, 2: { yieldWh: 12347 } } },
    { date: '2026-08-13', perInverter: { 1: { yieldWh: 23536 }, 2: { yieldWh: 11961 } } },
  ];
  const result = addMissingDays(total, dailyBreakdown);
  // 08-10 and 08-11 are already baked into the checkpoint, so only 08-12 and 08-13 get added.
  assert.deepEqual(result.perInverter, { 1: 232337 + 24170 + 23536, 2: 120512 + 12347 + 11961 });
});

test('addMissingDays adds every entry when the total has no asOfDate (no months.js entry for this month yet)', () => {
  const total = { month: '2026-08', perInverter: {} };
  const dailyBreakdown = [
    { date: '2026-08-01', perInverter: { 1: { yieldWh: 16456 } } },
    { date: '2026-08-02', perInverter: { 1: { yieldWh: 21611 } } },
  ];
  const result = addMissingDays(total, dailyBreakdown);
  assert.deepEqual(result.perInverter, { 1: 38067 });
});

test('addMissingDays leaves the total unchanged when dailyBreakdown has nothing newer than asOfDate', () => {
  const total = { month: '2026-07', asOfDate: '2026-07-31', perInverter: { 1: 79526 } };
  const dailyBreakdown = [{ date: '2026-07-31', perInverter: { 1: { yieldWh: 3529 } } }];
  const result = addMissingDays(total, dailyBreakdown);
  assert.deepEqual(result.perInverter, { 1: 79526 });
});

test('addMissingDays does not mutate the input total', () => {
  const total = { month: '2026-08', asOfDate: '2026-08-11', perInverter: { 1: 232337 } };
  const dailyBreakdown = [{ date: '2026-08-12', perInverter: { 1: { yieldWh: 24170 } } }];
  addMissingDays(total, dailyBreakdown);
  assert.deepEqual(total.perInverter, { 1: 232337 });
});

test('deriveYieldSummary folds today into month/year (via months.js) and, separately, into the years.js-derived lifetime total (CO2/feed-in)', () => {
  const todayEntry = { date: '2026-08-13', perInverter: { 1: { yieldWh: 20000, peakW: 4000 } } };
  const months = [
    // Checkpointed as of 08-12, so today (08-13) still needs folding in via dailyHist+todayEntry.
    { month: '2026-08', asOfDate: '2026-08-12', perInverter: { 1: 100000 }, dailyBreakdown: [] },
    { month: '2026-07', asOfDate: '2026-07-31', perInverter: { 1: 300000 }, dailyBreakdown: [] },
  ];
  // years.js is its own independent checkpoint (only written at rollover) - here it already
  // covers July (300000 Wh), same as months.js, so lifetime and the month/year-derived figures
  // agree; a years.js checkpoint lagging behind months.js is possible but out of scope here.
  const years = [
    { year: 2025, perInverter: { 1: 1000000 } },
    { year: 2026, perInverter: { 1: 300000 } },
  ];
  const summary = deriveYieldSummary({
    todayEntry,
    dailyHist: [],
    months,
    years,
    year: 2026,
    monthKey: '2026-08',
    tariffRatePerKwh: 0.5,
  });

  assert.equal(summary.todayKwh, 20);
  assert.equal(summary.monthKwh, 120); // 100000 (checkpoint) + 20000 (today), in kWh
  assert.equal(summary.yearKwh, 420); // this month (120) + July (300)
  assert.equal(summary.totalKwh, 1320); // 2025 (1000) + 2026 (300 + 20 today = 320)
  // 2026 has no published UBA factor yet, so the fallback (0.363 kg/kWh) applies to its 320 kWh;
  // 2025's own factor (0.344) applies to its 1000 kWh.
  assert.equal(summary.co2SavedKg, 320 * 0.363 + 1000 * 0.344);
  assert.equal(summary.feedInTotal, 1320 * 0.5);
});

test('deriveYieldSummary handles the first day of a year (no months.js/years.js entry yet)', () => {
  const todayEntry = { date: '2026-01-01', perInverter: { 1: { yieldWh: 5000, peakW: 1200 } } };
  const summary = deriveYieldSummary({
    todayEntry,
    dailyHist: [],
    months: [],
    years: [],
    year: 2026,
    monthKey: '2026-01',
    tariffRatePerKwh: 0.4,
  });

  assert.equal(summary.todayKwh, 5);
  assert.equal(summary.monthKwh, 5);
  assert.equal(summary.yearKwh, 5);
  assert.equal(summary.totalKwh, 5);
});

test('deriveYieldSummary defaults to all zeros with no today entry and no history', () => {
  const summary = deriveYieldSummary({
    todayEntry: undefined,
    dailyHist: [],
    months: [],
    years: [],
    year: 2026,
    monthKey: '2026-08',
    tariffRatePerKwh: 0.5,
  });

  assert.deepEqual(summary, {
    todayKwh: 0,
    monthKwh: 0,
    yearKwh: 0,
    totalKwh: 0,
    co2SavedKg: 0,
    feedInTotal: 0,
  });
});
