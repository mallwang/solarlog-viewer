import { parseYearsFile, mergeYearlyTotals } from '../data/aggregates.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { fetchFromBothSources } from '../data/data-source.js';

/**
 * Mounts the Mode 2 year detail view: all-years annual-total bars, verifying every year from
 * PlantMetadata.commissionedDate to present is represented (FR-011).
 * @param {HTMLElement} container
 * @param {{ plant: object | null }} ctx
 */
export async function render(container, { plant }) {
  container.innerHTML = `<h2 class="view-title">${t('nav.yearView')}</h2>
    <div class="chart-container"><canvas></canvas></div>`;

  const { hist, data } = await fetchFromBothSources('years.js');
  if (!hist.ok && !data.ok) {
    container.innerHTML = `<h2 class="view-title">${t('nav.yearView')}</h2>
      <p class="empty-state">${t('year.noData')}</p>`;
    return;
  }

  const years = mergeYearlyTotals(
    hist.ok ? parseYearsFile(hist.text) : [],
    data.ok ? parseYearsFile(data.text) : [],
  );
  const earliestYear = plant?.commissionedDate ? Number(plant.commissionedDate.slice(0, 4)) : null;
  const missing = earliestYear
    ? years.length === 0 || years[0].year > earliestYear
    : years.length === 0;

  if (missing) {
    container.innerHTML = `<h2 class="view-title">${t('nav.yearView')}</h2>
      <p class="empty-state">${t('year.noData')}</p>`;
    return;
  }

  const canvas = container.querySelector('canvas');
  renderChart(canvas, 'year', years, { lang: getLanguage() });
}
