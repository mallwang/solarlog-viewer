import {
  parseMonthsFile,
  parseDailyTotalsFile,
  mergeMonthlyTotals,
  mergeDailyTotals,
  addTodayYield,
} from '../data/aggregates.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { fetchFromBothSources } from '../data/data-source.js';
import { fetchText } from '../data/fetch-text.js';
import { DATA_DIR } from '../config.js';
import { formatRoute } from '../router.js';
import { addMonths, isFutureMonth, parentOfMonth, periodNavMarkup } from './period-nav.js';
import { emptyStateBody } from './empty-state.js';
import { chartWithStatsLayoutMarkup, statsPanelMarkup } from './stats-panel.js';
import { formatKwh, formatCurrency, formatCo2 } from '../format.js';
import {
  maxDailyYieldKwh,
  specificYieldKwhPerKwp,
  monthlySollKwh,
  monthSollAuflaufendKwh,
  istPercent,
} from '../data/yield-stats.js';
import { co2FactorForYear } from '../data/co2-factors.js';

function monthKey({ year, month }) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function todayParams() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** @param {{ year: number, month: number }} params @returns {number} Number of days in that month. */
function daysInMonth({ year, month }) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Expands a month's DailyTotal[] (which only lists days that actually have data) into one entry
 * per calendar day of the month, so the chart's x-axis always spans the full month (FR: always
 * show all days, including future ones with no data yet) instead of stopping at "today".
 * @param {{ year: number, month: number }} params
 * @param {ReturnType<typeof import('../data/aggregates.js').parseDailyTotalsFile>} dailyBreakdown
 * @returns {ReturnType<typeof import('../data/aggregates.js').parseDailyTotalsFile>}
 */
function fillMonthDays(params, dailyBreakdown) {
  const byDate = new Map(dailyBreakdown.map((d) => [d.date, d]));
  const key = monthKey(params);
  return Array.from({ length: daysInMonth(params) }, (_, i) => {
    const date = `${key}-${String(i + 1).padStart(2, '0')}`;
    return byDate.get(date) ?? { date, perInverter: {} };
  });
}

function sumWh(perInverter) {
  return Object.values(perInverter).reduce((s, wh) => s + wh, 0);
}

/**
 * Builds the month-view stats panel's rows (kWh yield, € yield, specific yield, best daily
 * yield, and the Soll/Ist target comparison). For the current (still in-progress) month, Soll is
 * the running "auflaufend" total (see monthSollAuflaufendKwh); for any other month it's the
 * month's full target (see monthlySollKwh), since the month is already complete either way.
 * @param {{ perInverter: object, dailyBreakdown: object[] }} monthTotal
 * @param {object | null} plant - PlantMetadata (see data/plant.js); Soll/tariff figures fall
 *   back to 0 when unavailable.
 * @param {{ year: number, month: number }} params
 * @param {boolean} isCurrentMonth
 * @returns {[string, string][]}
 */
function monthStatsRows(monthTotal, plant, params, isCurrentMonth) {
  const yieldKwh = sumWh(monthTotal.perInverter) / 1000;
  const feedInEuro = yieldKwh * (plant?.tariffRatePerKwh ?? 0);
  const specificYield = specificYieldKwhPerKwp(yieldKwh, plant?.capacityKwp ?? 0);
  const sollKwh = isCurrentMonth
    ? monthSollAuflaufendKwh(plant ?? {}, params.year, params.month)
    : monthlySollKwh(plant ?? {}, params.month);
  const ist = istPercent(yieldKwh, sollKwh);
  const maxDaily = maxDailyYieldKwh(monthTotal.dailyBreakdown);
  const maxDailyDay = maxDaily.date ? Number.parseInt(maxDaily.date.slice(8, 10), 10) : null;
  const maxDailyMonthName = maxDaily.date
    ? t(`month.long.${maxDaily.date.slice(5, 7)}`)
    : null;
  const co2SavedKg = yieldKwh * co2FactorForYear(params.year);

  return [
    ['month.stats.yieldKwh', formatKwh(yieldKwh)],
    ['month.stats.yieldEuro', formatCurrency(feedInEuro)],
    ['month.stats.specificYield', `${formatKwh(specificYield)}/kWp`],
    [
      'month.stats.maxDaily',
      maxDailyDay
        ? `${formatKwh(maxDaily.kwh)} (${maxDailyDay}. ${maxDailyMonthName})`
        : formatKwh(maxDaily.kwh),
    ],
    [
      isCurrentMonth ? 'month.stats.sollAuflaufend' : 'month.stats.sollTotal',
      formatKwh(sollKwh),
    ],
    ['month.stats.ist', `${ist}%`],
    ['month.stats.co2', formatCo2(co2SavedKg)],
  ];
}

/**
 * Mounts the Mode 1 month detail view: per-inverter daily-energy bars for the routed month.
 * @param {HTMLElement} container
 * @param {{ plant: object | null, route: { params: { year: number, month: number } } }} ctx
 */
export async function render(container, { route, plant }) {
  const { params } = route;
  const key = monthKey(params);
  const monthName = t(`month.long.${String(params.month).padStart(2, '0')}`);
  const title = `${t('nav.monthView')} - ${monthName} ${params.year}`;
  const isCurrentMonth = key === monthKey(todayParams());

  const nextParams = addMonths(params, 1);
  const nav = periodNavMarkup({
    prevHref: formatRoute({ view: 'month', params: addMonths(params, -1) }),
    prevLabel: t('month.prev'),
    nextHref: isFutureMonth(nextParams)
      ? null
      : formatRoute({ view: 'month', params: nextParams }),
    nextLabel: t('month.next'),
    todayHref: isCurrentMonth ? null : formatRoute({ view: 'month', params: todayParams() }),
    todayLabel: t('month.thisMonth'),
    parentHref: formatRoute({ view: 'year', params: parentOfMonth(params) }),
    parentLabel: t('month.parentLink'),
  });

  container.innerHTML = `<div class="view-header flex items-center justify-between gap-sm flex-wrap mb-md">
      <h2 class="view-title text-lg m-0">${title}</h2>
      ${nav}
    </div>
    ${chartWithStatsLayoutMarkup()}`;
  const periodLayout = container.querySelector('.period-layout');
  const chartContainer = container.querySelector('.chart-container');

  const [monthsSources, daysSources, todaySource] = await Promise.all([
    fetchFromBothSources('months.js'),
    fetchFromBothSources('days_hist.js'),
    isCurrentMonth ? fetchText(`${DATA_DIR}/days.js`) : Promise.resolve({ ok: false }),
  ]);

  if (
    !monthsSources.hist.ok &&
    !monthsSources.data.ok &&
    !daysSources.hist.ok &&
    !daysSources.data.ok
  ) {
    chartContainer.innerHTML = emptyStateBody('month.noData');
    return;
  }

  const months = mergeMonthlyTotals(
    monthsSources.hist.ok ? parseMonthsFile(monthsSources.hist.text) : [],
    monthsSources.data.ok ? parseMonthsFile(monthsSources.data.text) : [],
  );
  // days_hist.js is a rolling archive that never includes today (see day-view.js's min_day.js
  // comment); days.js is the SolarLog's live "today so far" file, so fold it in separately.
  const todayEntry = todaySource.ok
    ? parseDailyTotalsFile(todaySource.text).find((d) => d.date === todayIso())
    : undefined;
  const dailyTotals = mergeDailyTotals(
    daysSources.hist.ok ? parseDailyTotalsFile(daysSources.hist.text) : [],
    [
      ...(daysSources.data.ok ? parseDailyTotalsFile(daysSources.data.text) : []),
      ...(todayEntry ? [todayEntry] : []),
    ],
  );
  const dailyBreakdown = dailyTotals.filter((d) => d.date.startsWith(key));

  // months.js is only written at day rollover, so the current month's total never yet includes
  // today's yield - fold today's live entry in on top (see addTodayYield).
  const monthTotal = addTodayYield(
    months.find((m) => m.month === key) ?? { month: key, perInverter: {}, dailyBreakdown: [] },
    todayEntry,
  );
  monthTotal.dailyBreakdown = dailyBreakdown;

  if (dailyBreakdown.length === 0) {
    chartContainer.innerHTML = emptyStateBody('month.noData');
    return;
  }

  periodLayout.insertAdjacentHTML(
    'beforeend',
    statsPanelMarkup(
      'month.stats.title',
      monthStatsRows(monthTotal, plant, params, isCurrentMonth),
    ),
  );

  monthTotal.dailyBreakdown = fillMonthDays(params, dailyBreakdown);

  const mount = container.querySelector('.chart-mount');
  renderChart(mount, 'month', monthTotal, {
    lang: getLanguage(),
    onDataPointClick: (index) => {
      const day = Number.parseInt(monthTotal.dailyBreakdown[index].date.slice(8, 10), 10);
      window.location.hash = formatRoute({ view: 'day', params: { ...params, day } });
    },
  });
}
