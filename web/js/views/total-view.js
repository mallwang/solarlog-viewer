import { parseYearsFile, mergeYearlyTotals, deriveLifetimeSummary } from '../data/aggregates.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { fetchFromBothSources } from '../data/data-source.js';
import { formatRoute } from '../router.js';
import { emptyStateMarkup } from './empty-state.js';

function formatKwh(wh) {
  return (wh / 1000).toFixed(1);
}

/**
 * Mounts the Mode 3 lifetime detail view: one bar per year of production (all years, ascending)
 * plus a CO2-saved and feed-in-tariff summary (FR-012, SC-008).
 * @param {HTMLElement} container
 * @param {{ plant: object | null }} ctx
 */
export async function render(container, { plant }) {
  const title = t('nav.totalView');
  container.innerHTML = `<h2 class="view-title text-lg mb-md">${title}</h2>
    <div class="chart-container"><div class="chart-mount"></div></div>
    <table class="summary-table w-full mt-md border-collapse"><tbody id="total-summary"></tbody></table>`;

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

  const mount = container.querySelector('.chart-mount');
  renderChart(mount, 'year', years, {
    lang: getLanguage(),
    onDataPointClick: (index) => {
      window.location.hash = formatRoute({ view: 'year', params: { year: years[index].year } });
    },
  });

  const summaryBody = container.querySelector('#total-summary');
  summaryBody.innerHTML = `
    <tr><th>${t('total.totalYield')}</th><td>${formatKwh(summary.totalYieldWh)} kWh</td></tr>
    <tr><th>${t('total.co2Saved')}</th><td>${summary.co2SavedKg.toFixed(0)} kg</td></tr>
    <tr><th>${t('total.feedIn')}</th><td>${summary.feedInTotal.toFixed(2)} €</td></tr>
  `;
}
