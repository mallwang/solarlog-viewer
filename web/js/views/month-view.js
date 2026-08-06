import {
  parseMonthsFile,
  parseDailyTotalsFile,
  mergeMonthlyTotals,
  mergeDailyTotals,
} from '../data/aggregates.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { fetchFromBothSources } from '../data/data-source.js';

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
  container.innerHTML = `<h2 class="view-title">${t('nav.monthView')} — ${key}</h2>
    <div class="chart-container"><canvas></canvas></div>`;

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
    container.innerHTML = `<h2 class="view-title">${t('nav.monthView')} — ${key}</h2>
      <p class="empty-state">${t('month.noData')}</p>`;
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
    container.innerHTML = `<h2 class="view-title">${t('nav.monthView')} — ${key}</h2>
      <p class="empty-state">${t('month.noData')}</p>`;
    return;
  }

  const canvas = container.querySelector('canvas');
  renderChart(canvas, 'month', monthTotal, { lang: getLanguage() });
}
