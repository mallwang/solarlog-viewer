import { parseYearsFile, mergeYearlyTotals, deriveLifetimeSummary } from '../data/aggregates.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { fetchFromBothSources } from '../data/data-source.js';
import { formatRoute } from '../router.js';
import { emptyStateMarkup } from './empty-state.js';
import { chartWithStatsLayoutMarkup, statsPanelMarkup } from './stats-panel.js';
import { formatKwh, formatCurrency, formatNumber } from '../format.js';

/**
 * Mounts the Mode 3 lifetime detail view: one bar per year of production (all years, ascending)
 * plus a CO2-saved and feed-in-tariff summary (FR-012, SC-008).
 * @param {HTMLElement} container
 * @param {{ plant: object | null }} ctx
 */
export async function render(container, { plant }) {
  const title = t('nav.totalView');
  container.innerHTML = `<h2 class="view-title text-lg mb-md">${title}</h2>
    ${chartWithStatsLayoutMarkup()}`;
  const periodLayout = container.querySelector('.period-layout');

  const { hist, data } = await fetchFromBothSources('years.js');
  if (!hist.ok && !data.ok) {
    container.innerHTML = emptyStateMarkup(title, 'total.noData');
    return;
  }

  const years = mergeYearlyTotals(
    hist.ok ? parseYearsFile(hist.text) : [],
    data.ok ? parseYearsFile(data.text) : [],
  );
  const summary = deriveLifetimeSummary(years, plant?.tariffRatePerKwh ?? 0);

  periodLayout.insertAdjacentHTML(
    'beforeend',
    statsPanelMarkup('total.stats.title', [
      ['total.totalYield', formatKwh(summary.totalYieldWh / 1000)],
      ['total.co2Saved', `${formatNumber(summary.co2SavedKg, { decimals: 0 })} kg`],
      ['total.feedIn', formatCurrency(summary.feedInTotal)],
    ]),
  );

  const mount = container.querySelector('.chart-mount');
  renderChart(mount, 'year', years, {
    lang: getLanguage(),
    onDataPointClick: (index) => {
      window.location.hash = formatRoute({ view: 'year', params: { year: years[index].year } });
    },
  });
}
