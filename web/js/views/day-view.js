import { fetchText } from '../data/fetch-text.js';
import { parseMinFile } from '../data/min-file.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { sourceDirForDate } from '../data/data-source.js';
import { DATA_DIR, DATA_REFRESH_INTERVAL_MS } from '../config.js';
import { formatRoute } from '../router.js';
import { addDays, isFutureDay, parentOfDay, periodNavMarkup } from './period-nav.js';
import { emptyStateBody } from './empty-state.js';
import { chartWithStatsLayoutMarkup, statsPanelMarkup, statValueMarkup } from './stats-panel.js';
import { initChartBreakdownToggle } from './chart-breakdown-toggle.js';
import { initChartTableToggle } from './chart-table-toggle.js';
import { renderChartTable } from './chart-data-table.js';
import { getChartBreakdownMode } from '../settings.js';
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
 * @returns {([string, string] | [string, string, string])[]}
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
    ['day.stats.yieldKwh', formatKwh(yieldKwh, { decimals: 2 })],
    ['day.stats.yieldEuro', formatCurrency(feedInEuro), 'explanations.yieldEuro'],
    ['day.stats.specificYield', `${formatKwh(specificYield, { decimals: 2 })}/kWp`],
    [
      'day.stats.maxDaily',
      statValueMarkup(`${maxPower.w} W`, maxPowerTime ? `(${maxPowerTime} Uhr)` : null),
    ],
    ['day.stats.soll', formatKwh(sollKwh, { decimals: 2 }), 'explanations.soll'],
    ['day.stats.ist', `${ist}%`, 'explanations.ist'],
    ['day.stats.co2', formatCo2(co2SavedKg), 'explanations.co2'],
  ];
}

/**
 * Fetches and parses the routed date's 5-minute trace (min_day.js for today, the archived
 * min{YYMMDD}.js otherwise — see render()'s comment).
 * @param {{ year: number, month: number, day: number }} params
 * @param {boolean} isToday
 * @returns {Promise<{ readings: object[] } | null>} `null` when the file is missing/unreadable
 *   or has no readings — callers treat that as "nothing new to show" rather than an error.
 */
async function fetchDayTrace(params, isToday) {
  const result = isToday
    ? await fetchText(`${DATA_DIR}/min_day.js`)
    : await fetchText(
        `${sourceDirForDate(isoFromParams(params))}/min${yymmddFromParams(params)}.js`,
      );
  if (!result.ok) return null;
  const trace = parseMinFile(result.text, ddmmyyFromParams(params));
  if (isToday) {
    // The SolarLog device only rolls min_day.js over to the new day on its next sync, so right
    // after midnight it can still be full of yesterday's finished readings for a while. Each
    // reading carries its own date (parsed from the file, not from `params`), so drop anything
    // that isn't actually dated today rather than let the new day's page show yesterday's stale
    // chart/table until the device catches up.
    trace.readings = trace.readings.filter((r) => r.timestamp.startsWith(isoFromParams(params)));
  }
  return trace.readings.length === 0 ? null : trace;
}

/**
 * Mounts the Mode 0 day detail view: fetches and renders the routed date's 5-minute trace,
 * or the "no data" state if the min file doesn't exist (FR-019). For today's date, re-fetches
 * `min_day.js` every `DATA_REFRESH_INTERVAL_MS` (config.js) and re-renders the stats panel +
 * chart + table in place so a page left open keeps reflecting new readings without a manual
 * reload.
 * @param {HTMLElement} container
 * @param {{ plant: object | null, route: { params: { year: number, month: number, day: number } } }} ctx
 * @returns {() => void} Cleanup function that stops the auto-refresh (called on route change).
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
    ${chartWithStatsLayoutMarkup({ breakdownToggle: true })}`;

  const periodLayout = container.querySelector('.period-layout');
  const chartContainer = container.querySelector('.chart-container');

  // The SolarLog only finalizes min{YYMMDD}.js at end of day (final sync); until then,
  // today's readings live exclusively in the rolling min_day.js, so prefer it for today's date.
  const trace = await fetchDayTrace(params, isToday);
  if (!trace) {
    chartContainer.innerHTML = emptyStateBody('day.noData');
    return () => {};
  }

  let statsPanelEl = null;
  function updateStatsPanel(currentTrace) {
    const markup = statsPanelMarkup('day.stats.title', dayStatsRows(currentTrace, plant, params));
    if (statsPanelEl) {
      statsPanelEl.outerHTML = markup;
    } else {
      periodLayout.insertAdjacentHTML('beforeend', markup);
    }
    statsPanelEl = periodLayout.querySelector('.stats-panel');
  }
  updateStatsPanel(trace);

  // Backfilled/archived days (see .claude/skills/backfill-min-day) only reconstruct the
  // cumulative Wh counter and zero out PDC/PAC/Volt — a flat 0 W line would look identical to
  // "no data". Detect that case and plot the yield curve instead, with an explanatory note. Only
  // relevant on initial load: today's rolling min_day.js is never a backfilled reconstruction, so
  // this can't flip mid-refresh.
  const hasPowerData = trace.readings.some((r) =>
    Object.values(r.perInverter).some((inv) => (inv.pacW ?? 0) > 0),
  );
  if (!hasPowerData) {
    chartContainer.insertAdjacentHTML(
      'afterbegin',
      `<p class="chart-note mb-sm text-sm text-text-muted">${t('day.powerUnavailable')}</p>`,
    );
    // Backfilled/yield-only days have no per-inverter power data to break down (buildDayYieldOptions
    // only plots the combined cumulative-Wh curve) — omit the toggle entirely rather than offer a
    // control with nothing to switch, mirroring how the UDC legend entry is omitted for FR-005.
    chartContainer.querySelector('.chart-breakdown-toggle')?.remove();
  }

  const mount = container.querySelector('.chart-mount');
  const tableMount = chartContainer.querySelector('.chart-table');
  let currentTrace = trace;
  const drawChart = () => {
    const chart = renderChart(mount, hasPowerData ? 'day' : 'day-yield', currentTrace, {
      lang: getLanguage(),
      breakdown: getChartBreakdownMode(),
    });
    renderChartTable(tableMount, chart.w.config);
  };
  drawChart();
  if (hasPowerData) {
    initChartBreakdownToggle(chartContainer, drawChart);
  }
  initChartTableToggle(chartContainer, (visible) => {
    tableMount.hidden = !visible;
  });

  if (!isToday) return () => {};

  const intervalId = setInterval(async () => {
    if (todayIso() !== isoFromParams(params)) {
      // Midnight passed while this page was left open on "today" — follow the calendar so a
      // tab left open overnight ends up showing the new day instead of freezing on the one that
      // just ended. dispatch() (main.js) clears this interval as part of handling the route
      // change triggered by the hash update.
      window.location.hash = formatRoute({ view: 'day', params: todayParams() });
      return;
    }
    const freshTrace = await fetchDayTrace(params, isToday);
    if (!freshTrace) return; // Transient fetch failure — keep showing the last good reading.
    currentTrace = freshTrace;
    updateStatsPanel(freshTrace);
    drawChart();
  }, DATA_REFRESH_INTERVAL_MS);

  return () => clearInterval(intervalId);
}
