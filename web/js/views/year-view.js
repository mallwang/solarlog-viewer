import { parseYearsFile, mergeYearlyTotals } from '../data/aggregates.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { fetchFromBothSources } from '../data/data-source.js';
import { emptyStateMarkup } from './empty-state.js';

/**
 * Mounts the Mode 2 year detail view: all-years annual-total bars, verifying every year from
 * PlantMetadata.commissionedDate to present is represented (FR-011).
 * @param {HTMLElement} container
 * @param {{ plant: object | null }} ctx
 */
export async function render(container, { plant }) {
  const title = t('nav.yearView');
  container.innerHTML = `<h2 class="view-title text-lg mb-md">${title}</h2>
    <div class="chart-container"><div class="chart-mount"></div></div>`;

  const { hist, data } = await fetchFromBothSources('years.js');
  if (!hist.ok && !data.ok) {
    container.innerHTML = emptyStateMarkup(title, 'year.noData');
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
    container.innerHTML = emptyStateMarkup(title, 'year.noData');
    return;
  }

  const mount = container.querySelector('.chart-mount');
  renderChart(mount, 'year', years, { lang: getLanguage() });
}
