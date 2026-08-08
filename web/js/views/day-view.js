import { fetchText } from '../data/fetch-text.js';
import { parseMinFile } from '../data/min-file.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { sourceDirForDate } from '../data/data-source.js';
import { DATA_DIR } from '../config.js';
import { formatRoute } from '../router.js';
import { addDays, isFutureDay, periodNavMarkup } from './period-nav.js';
import { emptyStateBody } from './empty-state.js';

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

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function todayParams() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/**
 * Mounts the Mode 0 day detail view: fetches and renders the routed date's 5-minute trace,
 * or the "no data" state if the min file doesn't exist (FR-019).
 * @param {HTMLElement} container
 * @param {{ plant: object | null, route: { params: { year: number, month: number, day: number } } }} ctx
 */
export async function render(container, { route }) {
  const { params } = route;
  const title = `${t('nav.dayView')} - ${ddmmyyFromParams(params)}`;
  const isToday = isoFromParams(params) === todayIso();

  const nextParams = addDays(params, 1);
  const nav = periodNavMarkup({
    prevHref: formatRoute({ view: 'day', params: addDays(params, -1) }),
    prevLabel: t('day.prev'),
    nextHref: isFutureDay(nextParams) ? null : formatRoute({ view: 'day', params: nextParams }),
    nextLabel: t('day.next'),
    todayHref: isToday ? null : formatRoute({ view: 'day', params: todayParams() }),
    todayLabel: t('day.today'),
  });

  container.innerHTML = `<div class="view-header flex items-center justify-between gap-sm flex-wrap mb-md">
      <h2 class="view-title text-lg m-0">${title}</h2>
      ${nav}
    </div>
    <div class="chart-container"><div class="chart-mount"></div></div>`;

  // The SolarLog only finalizes min{YYMMDD}.js at end of day (final sync); until then,
  // today's readings live exclusively in the rolling min_day.js, so prefer it for today's date.
  const result = isToday
    ? await fetchText(`${DATA_DIR}/min_day.js`)
    : await fetchText(`${sourceDirForDate(isoFromParams(params))}/min${yymmddFromParams(params)}.js`);

  const chartContainer = container.querySelector('.chart-container');

  if (!result.ok) {
    chartContainer.innerHTML = emptyStateBody('day.noData');
    return;
  }

  const trace = parseMinFile(result.text, ddmmyyFromParams(params));
  if (trace.readings.length === 0) {
    chartContainer.innerHTML = emptyStateBody('day.noData');
    return;
  }

  // Backfilled/archived days (see .claude/skills/backfill-min-day) only reconstruct the
  // cumulative Wh counter and zero out PDC/PAC/Volt — a flat 0 W line would look identical to
  // "no data". Detect that case and plot the yield curve instead, with an explanatory note.
  const hasPowerData = trace.readings.some((r) =>
    Object.values(r.perInverter).some((inv) => (inv.pacW ?? 0) > 0),
  );
  if (!hasPowerData) {
    chartContainer.insertAdjacentHTML(
      'afterbegin',
      `<p class="chart-note mb-sm text-sm text-text-muted">${t('day.powerUnavailable')}</p>`,
    );
  }

  const mount = container.querySelector('.chart-mount');
  renderChart(mount, hasPowerData ? 'day' : 'day-yield', trace, { lang: getLanguage() });
}
