import { fetchText } from '../data/fetch-text.js';
import { parseMinFile } from '../data/min-file.js';
import { renderChart } from '../charts/chart-factory.js';
import { t } from '../i18n.js';
import { DATA_DIR, PLANT_PHOTOS } from '../config.js';
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
 * Mounts today's total-feed-in chart into the given container, wrapped in its own try/catch so a
 * fetch/parse/render failure here never blanks the carousel or plant-details regions (FR-017,
 * SC-004). Reuses the same `min_day.js` fetch path day-view.js already uses for "today" (the
 * SolarLog only finalizes `min{yymmdd}.js` at end of day).
 * @param {HTMLElement} mount
 */
async function renderTodayChart(mount) {
  try {
    const result = await fetchText(`${DATA_DIR}/min_day.js`);
    if (!result.ok) {
      mount.innerHTML = emptyStateBody('welcome.chartUnavailable');
      return;
    }
    const trace = parseMinFile(result.text, todayDdMmYy());
    if (trace.readings.length === 0) {
      mount.innerHTML = emptyStateBody('welcome.chartUnavailable');
      return;
    }
    renderChart(mount, 'day-total', trace, undefined);
  } catch {
    mount.innerHTML = emptyStateBody('welcome.chartUnavailable');
  }
}

/**
 * Mounts the yield-summary stats card below the chart (today/month/year/lifetime yield, lifetime
 * CO2 saved, lifetime feed-in revenue) - wrapped in its own try/catch so a fetch/parse failure
 * here never blanks the carousel/plant-details/chart regions (FR-017, SC-004). Reuses
 * deriveYieldSummary (data/aggregates.js) so these figures agree by construction with the
 * dashboard's widgets and the month/year/total detail views instead of drifting.
 * @param {HTMLElement} mount
 * @param {object | null} plant - PlantMetadata; tariffRatePerKwh falls back to 0 when unavailable.
 */
async function renderStats(mount, plant) {
  try {
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

    if (!daysResult.ok && months.length === 0 && years.length === 0) {
      mount.innerHTML = emptyStateBody('welcome.statsUnavailable');
      return;
    }

    const todayEntry = daysResult.ok
      ? parseDailyTotalsFile(daysResult.text).find((d) => d.date === todayIso())
      : undefined;
    const dailyHist = daysHistResult.ok ? parseDailyTotalsFile(daysHistResult.text) : [];

    const summary = deriveYieldSummary({
      todayEntry,
      dailyHist,
      months,
      years,
      year,
      monthKey,
      tariffRatePerKwh: plant?.tariffRatePerKwh ?? 0,
    });

    mount.innerHTML = statsPanelMarkup('welcome.stats.title', [
      ['widget.todayYield', formatKwh(summary.todayKwh)],
      ['widget.monthYield', formatKwh(summary.monthKwh)],
      ['widget.yearYield', formatKwh(summary.yearKwh)],
      ['widget.totalYield', formatKwh(summary.totalKwh)],
      ['total.stats.co2', formatCo2(summary.co2SavedKg)],
      ['total.stats.yieldEuro', formatCurrency(summary.feedInTotal)],
    ]);
  } catch {
    mount.innerHTML = emptyStateBody('welcome.statsUnavailable');
  }
}

/**
 * Mounts the welcome page (015-welcome-page-dashboard): the default landing view for empty/
 * unrecognized routes (FR-001/FR-002). Four independent regions - photo carousel, plant details,
 * today's total-feed-in chart, yield-summary stats - each guarded by its own try/catch so one
 * region's failure never blanks the others (FR-013/FR-017, SC-004).
 * @param {HTMLElement} container - mounted into #app-main by dispatch().
 * @param {{ plant: object | null, route: { view: string, params: object } }} ctx
 * @returns {() => void} cleanup - tears down the carousel's rotation interval/listeners.
 */
export async function render(container, { plant }) {
  container.innerHTML = `<div class="welcome-layout grid grid-cols-1 gap-md lg:grid-cols-3 items-start">
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
    const photoSrcs = PLANT_PHOTOS.map((fileName) => `img/plant/${fileName}`);
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

  return () => {
    carouselCleanup();
  };
}
