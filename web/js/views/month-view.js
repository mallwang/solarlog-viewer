import {
  parseMonthsFile,
  parseDailyTotalsFile,
  mergeMonthlyTotals,
  mergeDailyTotals,
} from '../data/aggregates.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { fetchFromBothSources } from '../data/data-source.js';
import { emptyStateMarkup } from './empty-state.js';

function monthKey({ year, month }) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Mounts the Mode 1 month detail view: per-inverter daily-energy bars for the routed month.
 * @param {HTMLElement} container
 * @param {{ route: { params: { year: number, month: number } } }} ctx
 */
export async function render(container, { route }) {
  const key = monthKey(route.params);
  const title = `${t('nav.monthView')} — ${key}`;
  container.innerHTML = `<h2 class="view-title text-lg mb-md">${title}</h2>
    <div class="chart-container"><div class="chart-mount"></div></div>`;

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
    container.innerHTML = emptyStateMarkup(title, 'month.noData');
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
    container.innerHTML = emptyStateMarkup(title, 'month.noData');
    return;
  }

  const mount = container.querySelector('.chart-mount');
  renderChart(mount, 'month', monthTotal, { lang: getLanguage() });
}
