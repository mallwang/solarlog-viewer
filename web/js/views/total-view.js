import { parseYearsFile, mergeYearlyTotals, deriveLifetimeSummary } from '../data/aggregates.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { fetchFromBothSources } from '../data/data-source.js';

function formatKwh(wh) {
  return (wh / 1000).toFixed(1);
}

/**
 * Mounts the Mode 3 lifetime detail view: cumulative bar chart plus CO2-saved and
 * feed-in-tariff summary (FR-012, SC-008).
 * @param {HTMLElement} container
 * @param {{ plant: object | null }} ctx
 */
export async function render(container, { plant }) {
  container.innerHTML = `<h2 class="view-title">${t('nav.totalView')}</h2>
    <div class="chart-container"><canvas></canvas></div>
    <table class="summary-table"><tbody id="total-summary"></tbody></table>`;

  const { hist, data } = await fetchFromBothSources('years.js');
  if (!hist.ok && !data.ok) {
    container.innerHTML = `<h2 class="view-title">${t('nav.totalView')}</h2>
      <p class="empty-state">${t('total.noData')}</p>`;
    return;
  }

  const years = mergeYearlyTotals(
    hist.ok ? parseYearsFile(hist.text) : [],
    data.ok ? parseYearsFile(data.text) : [],
  );
  const summary = deriveLifetimeSummary(years, plant?.tariffRatePerKwh ?? 0);

  const canvas = container.querySelector('canvas');
  renderChart(canvas, 'total', summary, { lang: getLanguage() });

  const summaryBody = container.querySelector('#total-summary');
  summaryBody.innerHTML = `
    <tr><th>${t('total.totalYield')}</th><td>${formatKwh(summary.totalYieldWh)} kWh</td></tr>
    <tr><th>${t('total.co2Saved')}</th><td>${summary.co2SavedKg.toFixed(0)} kg</td></tr>
    <tr><th>${t('total.feedIn')}</th><td>${summary.feedInTotal.toFixed(2)} €</td></tr>
  `;
}
