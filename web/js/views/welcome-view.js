import { fetchText } from '../data/fetch-text.js';
import { parseMinFile } from '../data/min-file.js';
import { renderChart } from '../charts/chart-factory.js';
import { t } from '../i18n.js';
import { DATA_DIR, DATA_REFRESH_INTERVAL_MS, PLANT_PHOTOS } from '../config.js';
import { getBuildId } from '../build-info.js';
import { emptyStateBody } from './empty-state.js';
import { carouselMarkup, initCarousel } from './photo-carousel.js';
import { plantDetailsMarkup } from './plant-details-panel.js';
import { statsPanelMarkup } from './stats-panel.js';
import { formatKwh, formatCurrency, formatCo2 } from '../format.js';
import { fetchFromBothSources } from '../data/data-source.js';
import {
  parseDailyTotalsFile,
  parseMonthsFile,
  parseYearsFile,
  mergeMonthlyTotals,
  mergeYearlyTotals,
  deriveYieldSummary,
} from '../data/aggregates.js';

function todayParams() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function todayDdMmYy() {
  const { year, month, day } = todayParams();
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${pad2(day)}.${pad2(month)}.${String(year).slice(-2)}`;
}

function todayIso() {
  const { year, month, day } = todayParams();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Fetches and parses today's `min_day.js` trace (the SolarLog only finalizes `min{yymmdd}.js` at
 * end of day, so "today" always reads the rolling file — same path day-view.js uses).
 * @returns {Promise<{ readings: object[] } | null>} `null` when the file is missing/unreadable or
 *   has no readings.
 */
async function fetchTodayTrace() {
  const result = await fetchText(`${DATA_DIR}/min_day.js`);
  if (!result.ok) return null;
  const trace = parseMinFile(result.text, todayDdMmYy());
  // The SolarLog device only rolls min_day.js over to the new day on its next sync, so right
  // after midnight it can still be full of yesterday's finished readings for a while — drop
  // anything not actually dated today rather than show yesterday's stale chart (see day-view.js's
  // fetchDayTrace, which applies the same filter).
  trace.readings = trace.readings.filter((r) => r.timestamp.startsWith(todayIso()));
  return trace.readings.length === 0 ? null : trace;
}

/**
 * Mounts today's total-feed-in chart into the given container, wrapped in its own try/catch so a
 * fetch/parse/render failure here never blanks the carousel or plant-details regions (FR-017,
 * SC-004).
 * @param {HTMLElement} mount
 * @param {{ keepOnFailure?: boolean }} [opts] - `keepOnFailure: true` (used by the auto-refresh
 *   cycle below) leaves the currently-rendered chart untouched on a failed/empty fetch instead of
 *   replacing it with the "unavailable" placeholder — a transient refresh hiccup shouldn't blank
 *   an already-working chart, only the initial load should show that state.
 */
async function renderTodayChart(mount, { keepOnFailure = false } = {}) {
  try {
    const trace = await fetchTodayTrace();
    if (!trace) {
      if (!keepOnFailure) mount.innerHTML = emptyStateBody('welcome.chartUnavailable');
      return;
    }
    renderChart(mount, 'day-total', trace, undefined);
  } catch {
    if (!keepOnFailure) mount.innerHTML = emptyStateBody('welcome.chartUnavailable');
  }
}

/**
 * Fetches and derives the yield-summary figures (today/month/year/lifetime yield, lifetime CO2
 * saved, lifetime feed-in revenue). Reuses deriveYieldSummary (data/aggregates.js) so these
 * figures agree by construction with the dashboard's widgets and the month/year/total detail
 * views instead of drifting.
 * @param {object | null} plant - PlantMetadata; tariffRatePerKwh falls back to 0 when unavailable.
 * @returns {Promise<ReturnType<typeof deriveYieldSummary> | null>} `null` when none of the
 *   underlying files could be read.
 */
async function fetchYieldSummary(plant) {
  const { year, month } = todayParams();
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const [daysResult, daysHistResult, months, years] = await Promise.all([
    fetchText('data/days.js'),
    fetchText('data/days_hist.js'),
    fetchFromBothSources('months.js').then(({ hist, data }) =>
      mergeMonthlyTotals(
        hist.ok ? parseMonthsFile(hist.text) : [],
        data.ok ? parseMonthsFile(data.text) : [],
      ),
    ),
    fetchFromBothSources('years.js').then(({ hist, data }) =>
      mergeYearlyTotals(
        hist.ok ? parseYearsFile(hist.text) : [],
        data.ok ? parseYearsFile(data.text) : [],
      ),
    ),
  ]);

  if (!daysResult.ok && months.length === 0 && years.length === 0) return null;

  const todayEntry = daysResult.ok
    ? parseDailyTotalsFile(daysResult.text).find((d) => d.date === todayIso())
    : undefined;
  const dailyHist = daysHistResult.ok ? parseDailyTotalsFile(daysHistResult.text) : [];

  return deriveYieldSummary({
    todayEntry,
    dailyHist,
    months,
    years,
    year,
    monthKey,
    tariffRatePerKwh: plant?.tariffRatePerKwh ?? 0,
  });
}

/**
 * Mounts the yield-summary stats card below the chart - wrapped in its own try/catch so a
 * fetch/parse failure here never blanks the carousel/plant-details/chart regions (FR-017,
 * SC-004).
 * @param {HTMLElement} mount
 * @param {object | null} plant - PlantMetadata; tariffRatePerKwh falls back to 0 when unavailable.
 * @param {{ keepOnFailure?: boolean }} [opts] - see renderTodayChart's own `keepOnFailure` doc;
 *   same rationale here.
 */
async function renderStats(mount, plant, { keepOnFailure = false } = {}) {
  try {
    const summary = await fetchYieldSummary(plant);
    if (!summary) {
      if (!keepOnFailure) mount.innerHTML = emptyStateBody('welcome.statsUnavailable');
      return;
    }

    mount.innerHTML = statsPanelMarkup('welcome.stats.title', [
      ['widget.todayYield', formatKwh(summary.todayKwh)],
      ['widget.monthYield', formatKwh(summary.monthKwh)],
      ['widget.yearYield', formatKwh(summary.yearKwh)],
      ['widget.totalYield', formatKwh(summary.totalKwh)],
      ['total.stats.co2', formatCo2(summary.co2SavedKg), 'explanations.co2'],
      ['total.stats.yieldEuro', formatCurrency(summary.feedInTotal)],
    ]);
  } catch {
    if (!keepOnFailure) mount.innerHTML = emptyStateBody('welcome.statsUnavailable');
  }
}

/**
 * Mounts the welcome page (015-welcome-page-dashboard): the default landing view for empty/
 * unrecognized routes (FR-001/FR-002). Four independent regions - photo carousel, plant details,
 * today's total-feed-in chart, yield-summary stats - each guarded by its own try/catch so one
 * region's failure never blanks the others (FR-013/FR-017, SC-004). The chart and stats regions
 * re-fetch and redraw every `DATA_REFRESH_INTERVAL_MS` (config.js) - the same constant
 * `views/day-view.js` and the info panel use for their own auto-refresh - so a page left open on
 * this landing view stays current too, in lockstep with the rest of the app.
 * @param {HTMLElement} container - mounted into #app-main by dispatch().
 * @param {{ plant: object | null, route: { view: string, params: object } }} ctx
 * @returns {() => void} cleanup - tears down the carousel's rotation interval/listeners and the
 *   chart/stats auto-refresh interval.
 */
export async function render(container, { plant }) {
  container.innerHTML = `<div class="view-header flex items-center justify-between gap-sm flex-wrap mb-md">
      <h2 class="view-title text-lg m-0">${t('nav.welcomeView')}</h2>
    </div>
    <div class="welcome-layout grid grid-cols-1 gap-md lg:grid-cols-3 items-start">
      <div class="welcome-primary flex flex-col gap-md lg:col-span-2 bg-bg-elevated rounded-lg p-md">
        <div class="welcome-carousel-mount"></div>
        <div class="welcome-details-mount"></div>
      </div>
      <div class="welcome-secondary lg:col-span-1">
        <div class="welcome-chart-mount chart-container">
          <h3 class="chart-container__title text-base font-semibold mb-sm">${t('nav.dayView')}</h3>
          <div class="chart-frame">
            <div class="chart-body"><div class="chart-mount"></div></div>
          </div>
        </div>
        <div class="welcome-stats-mount"></div>
      </div>
    </div>`;

  const carouselMount = container.querySelector('.welcome-carousel-mount');
  const detailsMount = container.querySelector('.welcome-details-mount');
  const chartMount = container.querySelector('.welcome-chart-mount');
  const chartMountInner = chartMount.querySelector('.chart-mount');
  const statsMount = container.querySelector('.welcome-stats-mount');

  let carouselCleanup = () => {};
  try {
    const photoSrcs = PLANT_PHOTOS.map((fileName) => `img/plant/${fileName}?v=${getBuildId()}`);
    carouselMount.innerHTML = carouselMarkup(photoSrcs);
    carouselCleanup = initCarousel(carouselMount.querySelector('.carousel')) ?? (() => {});
  } catch {
    carouselMount.innerHTML = emptyStateBody('welcome.carouselPlaceholder');
  }

  try {
    detailsMount.innerHTML = plantDetailsMarkup(plant);
  } catch {
    detailsMount.innerHTML = emptyStateBody('welcome.plantDetailsUnavailable');
  }

  await Promise.all([renderTodayChart(chartMountInner), renderStats(statsMount, plant)]);

  const intervalId = setInterval(() => {
    renderTodayChart(chartMountInner, { keepOnFailure: true });
    renderStats(statsMount, plant, { keepOnFailure: true });
  }, DATA_REFRESH_INTERVAL_MS);

  return () => {
    carouselCleanup();
    clearInterval(intervalId);
  };
}
