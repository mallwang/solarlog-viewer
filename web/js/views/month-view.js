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

/**
 * Mounts the Mode 1 month detail view: per-inverter daily-energy bars for the routed month.
 * @param {HTMLElement} container
 * @param {{ route: { params: { year: number, month: number } } }} ctx
 */
export async function render(container, { route }) {
  const { params } = route;
  const key = monthKey(params);
  const title = `${t('nav.monthView')} — ${key}`;

  const nextParams = addMonths(params, 1);
  const nav = periodNavMarkup({
    prevHref: formatRoute({ view: 'month', params: addMonths(params, -1) }),
    prevLabel: t('month.prev'),
    nextHref: isFutureMonth(nextParams)
      ? null
      : formatRoute({ view: 'month', params: nextParams }),
    nextLabel: t('month.next'),
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

  const mount = container.querySelector('.chart-mount');
  renderChart(mount, 'month', monthTotal, { lang: getLanguage() });
}
