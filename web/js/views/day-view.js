import { fetchText } from '../data/fetch-text.js';
import { parseMinFile } from '../data/min-file.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { sourceDirForDate } from '../data/data-source.js';
import { DATA_DIR } from '../config.js';
import { formatRoute } from '../router.js';
import { addDays, isFutureDay, parentOfDay, periodNavMarkup } from './period-nav.js';
import { emptyStateBody } from './empty-state.js';
import { chartWithStatsLayoutMarkup, statsPanelMarkup } from './stats-panel.js';
import { formatKwh, formatCurrency, formatDate, formatCo2 } from '../format.js';
import {
  dailyYieldWh,
  maxDailyPowerW,
  specificYieldKwhPerKwp,
  dailySollKwh,
  istPercent,
} from '../data/yield-stats.js';
import { co2FactorForYear } from '../data/co2-factors.js';

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
 * Builds the day-view stats panel's rows (kWh yield, € yield, specific yield, best daily yield,
 * and the Soll/Ist target comparison).
 * @param {{ readings: object[] }} trace
 * @param {object | null} plant - PlantMetadata (see data/plant.js); Soll/tariff figures fall
 *   back to 0 when unavailable.
 * @param {{ year: number, month: number }} params
 * @returns {[string, string][]}
 */
function dayStatsRows(trace, plant, params) {
  const yieldKwh = dailyYieldWh(trace) / 1000;
  const feedInEuro = yieldKwh * (plant?.tariffRatePerKwh ?? 0);
  const specificYield = specificYieldKwhPerKwp(yieldKwh, plant?.capacityKwp ?? 0);
  const sollKwh = dailySollKwh(plant ?? {}, params.year, params.month);
  const ist = istPercent(yieldKwh, sollKwh);
  const maxPower = maxDailyPowerW(trace);
  const maxPowerTime = maxPower.timestamp ? maxPower.timestamp.slice(11, 16) : null;
  const co2SavedKg = yieldKwh * co2FactorForYear(params.year);

  return [
    ['day.stats.yieldKwh', formatKwh(yieldKwh)],
    ['day.stats.yieldEuro', formatCurrency(feedInEuro)],
    ['day.stats.specificYield', `${formatKwh(specificYield)}/kWp`],
    [
      'day.stats.maxDaily',
      maxPowerTime ? `${maxPower.w} W (${maxPowerTime} Uhr)` : `${maxPower.w} W`,
    ],
    ['day.stats.soll', formatKwh(sollKwh)],
    ['day.stats.ist', `${ist}%`],
    ['day.stats.co2', formatCo2(co2SavedKg)],
  ];
}

/**
 * Mounts the Mode 0 day detail view: fetches and renders the routed date's 5-minute trace,
 * or the "no data" state if the min file doesn't exist (FR-019).
 * @param {HTMLElement} container
 * @param {{ plant: object | null, route: { params: { year: number, month: number, day: number } } }} ctx
 */
export async function render(container, { route, plant }) {
  const { params } = route;
  const title = `${t('nav.dayView')} - ${formatDate(new Date(params.year, params.month - 1, params.day))}`;
  const isToday = isoFromParams(params) === todayIso();

  const nextParams = addDays(params, 1);
  const nav = periodNavMarkup({
    prevHref: formatRoute({ view: 'day', params: addDays(params, -1) }),
    prevLabel: t('day.prev'),
    prevShortLabel: t('common.prev'),
    nextHref: isFutureDay(nextParams) ? null : formatRoute({ view: 'day', params: nextParams }),
    nextLabel: t('day.next'),
    nextShortLabel: t('common.next'),
    todayHref: isToday ? null : formatRoute({ view: 'day', params: todayParams() }),
    todayLabel: t('day.today'),
    parentHref: formatRoute({ view: 'month', params: parentOfDay(params) }),
    parentLabel: t('day.parentLink'),
  });

  container.innerHTML = `<div class="view-header flex items-center justify-between gap-sm flex-wrap mb-md">
      <h2 class="view-title text-lg m-0">${title}</h2>
      ${nav}
    </div>
    ${chartWithStatsLayoutMarkup()}`;

  // The SolarLog only finalizes min{YYMMDD}.js at end of day (final sync); until then,
  // today's readings live exclusively in the rolling min_day.js, so prefer it for today's date.
  const result = isToday
    ? await fetchText(`${DATA_DIR}/min_day.js`)
    : await fetchText(`${sourceDirForDate(isoFromParams(params))}/min${yymmddFromParams(params)}.js`);

  const periodLayout = container.querySelector('.period-layout');
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

  periodLayout.insertAdjacentHTML(
    'beforeend',
    statsPanelMarkup('day.stats.title', dayStatsRows(trace, plant, params)),
  );

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
