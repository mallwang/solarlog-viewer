import {
  parseMonthsFile,
  parseDailyTotalsFile,
  mergeMonthlyTotals,
  mergeDailyTotals,
} from '../data/aggregates.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { fetchFromBothSources } from '../data/data-source.js';
import { formatRoute } from '../router.js';
import { addMonths, isFutureMonth, periodNavMarkup } from './period-nav.js';
import { emptyStateBody } from './empty-state.js';

function monthKey({ year, month }) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function todayParams() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
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

/**
 * Mounts the Mode 1 month detail view: per-inverter daily-energy bars for the routed month.
 * @param {HTMLElement} container
 * @param {{ route: { params: { year: number, month: number } } }} ctx
 */
export async function render(container, { route }) {
  const { params } = route;
  const key = monthKey(params);
  const title = `${t('nav.monthView')} - ${key}`;
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
  });

  container.innerHTML = `<div class="view-header flex items-center justify-between gap-sm flex-wrap mb-md">
      <h2 class="view-title text-lg m-0">${title}</h2>
      ${nav}
    </div>
    <div class="chart-container"><div class="chart-mount"></div></div>`;
  const chartContainer = container.querySelector('.chart-container');

  const [monthsSources, daysSources] = await Promise.all([
    fetchFromBothSources('months.js'),
    fetchFromBothSources('days_hist.js'),
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
  const dailyTotals = mergeDailyTotals(
    daysSources.hist.ok ? parseDailyTotalsFile(daysSources.hist.text) : [],
    daysSources.data.ok ? parseDailyTotalsFile(daysSources.data.text) : [],
  );
  const dailyBreakdown = dailyTotals.filter((d) => d.date.startsWith(key));

  const monthTotal = months.find((m) => m.month === key) ?? {
    month: key,
    perInverter: {},
    dailyBreakdown: [],
  };
  monthTotal.dailyBreakdown = dailyBreakdown;

  if (dailyBreakdown.length === 0) {
    chartContainer.innerHTML = emptyStateBody('month.noData');
    return;
  }
  monthTotal.dailyBreakdown = fillMonthDays(params, dailyBreakdown);

  const mount = container.querySelector('.chart-mount');
  renderChart(mount, 'month', monthTotal, { lang: getLanguage() });
}
