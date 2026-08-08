import { parseMonthsFile, mergeMonthlyTotals } from '../data/aggregates.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { fetchFromBothSources } from '../data/data-source.js';
import { formatRoute } from '../router.js';
import { addYears, isFutureYear, periodNavMarkup } from './period-nav.js';
import { emptyStateBody } from './empty-state.js';

function currentYear() {
  return new Date().getFullYear();
}

/**
 * Expands a year's MonthlyTotal[] (which only lists months that actually have data) into one
 * entry per calendar month of the year, so the chart's x-axis always spans Jan-Dec (mirroring
 * fillMonthDays in month-view.js) instead of stopping at the last month with data.
 * @param {number} year
 * @param {ReturnType<typeof import('../data/aggregates.js').parseMonthsFile>} monthlyTotals
 * @returns {ReturnType<typeof import('../data/aggregates.js').parseMonthsFile>}
 */
function fillYearMonths(year, monthlyTotals) {
  const byMonth = new Map(monthlyTotals.map((m) => [m.month, m]));
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`;
    return byMonth.get(key) ?? { month: key, perInverter: {}, dailyBreakdown: [] };
  });
}

/**
 * Mounts the Mode 2 year detail view: per-month yield bars for the routed year (Jan-Dec), with
 * prev/next/this-year navigation mirroring the month view's day navigation.
 * @param {HTMLElement} container
 * @param {{ route: { params: { year: number } } }} ctx
 */
export async function render(container, { route }) {
  const { year } = route.params;
  const title = `${t('nav.yearView')} - ${year}`;
  const isCurrentYear = year === currentYear();

  const nextParams = addYears({ year }, 1);
  const nav = periodNavMarkup({
    prevHref: formatRoute({ view: 'year', params: addYears({ year }, -1) }),
    prevLabel: t('year.prev'),
    nextHref: isFutureYear(nextParams)
      ? null
      : formatRoute({ view: 'year', params: nextParams }),
    nextLabel: t('year.next'),
    todayHref: isCurrentYear ? null : formatRoute({ view: 'year', params: { year: currentYear() } }),
    todayLabel: t('year.thisYear'),
  });

  container.innerHTML = `<div class="view-header flex items-center justify-between gap-sm flex-wrap mb-md">
      <h2 class="view-title text-lg m-0">${title}</h2>
      ${nav}
    </div>
    <div class="chart-container"><div class="chart-mount"></div></div>`;
  const chartContainer = container.querySelector('.chart-container');

  const { hist, data } = await fetchFromBothSources('months.js');
  if (!hist.ok && !data.ok) {
    chartContainer.innerHTML = emptyStateBody('year.noData');
    return;
  }

  const months = mergeMonthlyTotals(
    hist.ok ? parseMonthsFile(hist.text) : [],
    data.ok ? parseMonthsFile(data.text) : [],
  );
  const key = String(year);
  const monthlyBreakdown = months.filter((m) => m.month.startsWith(key));

  if (monthlyBreakdown.length === 0) {
    chartContainer.innerHTML = emptyStateBody('year.noData');
    return;
  }

  const mount = container.querySelector('.chart-mount');
  renderChart(mount, 'year-months', { year, monthlyBreakdown: fillYearMonths(year, monthlyBreakdown) }, {
    lang: getLanguage(),
    onDataPointClick: (index) => {
      window.location.hash = formatRoute({ view: 'month', params: { year, month: index + 1 } });
    },
  });
}
