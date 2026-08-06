import { fetchText } from '../data/fetch-text.js';
import { parseMinFile } from '../data/min-file.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { sourceDirForDate } from '../data/data-source.js';

function ddmmyyFromParams({ year, month, day }) {
  const yy = String(year).slice(-2);
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${yy}`;
}

function yymmddFromParams({ year, month, day }) {
  const yy = String(year).slice(-2);
  return `${yy}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
}

function isoFromParams({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Mounts the Mode 0 day detail view: fetches and renders the routed date's 5-minute trace,
 * or the "no data" state if the min file doesn't exist (FR-019).
 * @param {HTMLElement} container
 * @param {{ plant: object | null, route: { params: { year: number, month: number, day: number } } }} ctx
 */
export async function render(container, { route }) {
  const { params } = route;

  container.innerHTML = `<h2 class="view-title">${t('nav.dayView')} — ${ddmmyyFromParams(params)}</h2>
    <div class="chart-container"><canvas></canvas></div>`;

  const sourceDir = sourceDirForDate(isoFromParams(params));
  const result = await fetchText(`${sourceDir}/min${yymmddFromParams(params)}.js`);

  if (!result.ok) {
    container.innerHTML = `<h2 class="view-title">${t('nav.dayView')} — ${ddmmyyFromParams(params)}</h2>
      <p class="empty-state">${t('day.noData')}</p>`;
    return;
  }

  const trace = parseMinFile(result.text, ddmmyyFromParams(params));
  if (trace.readings.length === 0) {
    container.innerHTML = `<h2 class="view-title">${t('nav.dayView')} — ${ddmmyyFromParams(params)}</h2>
      <p class="empty-state">${t('day.noData')}</p>`;
    return;
  }

  const canvas = container.querySelector('canvas');
  renderChart(canvas, 'day', trace, { lang: getLanguage() });
}
