import { fetchText } from '../data/fetch-text.js';
import { parseMinFile } from '../data/min-file.js';
import { renderChart } from '../charts/chart-factory.js';
import { t } from '../i18n.js';
import { DATA_DIR, PLANT_PHOTOS } from '../config.js';
import { emptyStateBody } from './empty-state.js';
import { carouselMarkup, initCarousel } from './photo-carousel.js';
import { plantDetailsMarkup } from './plant-details-panel.js';

function todayDdMmYy() {
  const now = new Date();
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${pad2(now.getDate())}.${pad2(now.getMonth() + 1)}.${String(now.getFullYear()).slice(-2)}`;
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
 * Mounts the welcome page (015-welcome-page-dashboard): the default landing view for empty/
 * unrecognized routes (FR-001/FR-002). Three independent regions - photo carousel, plant details,
 * today's total-feed-in chart - each guarded by its own try/catch so one region's failure never
 * blanks the other two (FR-013/FR-017, SC-004).
 * @param {HTMLElement} container - mounted into #app-main by dispatch().
 * @param {{ plant: object | null, route: { view: string, params: object } }} ctx
 * @returns {() => void} cleanup - tears down the carousel's rotation interval/listeners.
 */
export async function render(container, { plant }) {
  const title = plant?.title || t('welcome.title');

  container.innerHTML = `<div class="view-header flex items-center justify-between gap-sm flex-wrap mb-md">
      <h2 class="view-title text-lg m-0">${title}</h2>
    </div>
    <div class="welcome-layout grid grid-cols-1 gap-md lg:grid-cols-3">
      <div class="welcome-primary flex flex-col gap-md lg:col-span-2">
        <div class="welcome-carousel-mount"></div>
        <div class="welcome-details-mount"></div>
      </div>
      <div class="welcome-secondary lg:col-span-1">
        <div class="welcome-chart-mount chart-container">
          <div class="chart-frame">
            <div class="chart-body"><div class="chart-mount"></div></div>
          </div>
        </div>
      </div>
    </div>`;

  const carouselMount = container.querySelector('.welcome-carousel-mount');
  const detailsMount = container.querySelector('.welcome-details-mount');
  const chartMount = container.querySelector('.welcome-chart-mount');
  const chartMountInner = chartMount.querySelector('.chart-mount');

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

  await renderTodayChart(chartMountInner);

  return () => {
    carouselCleanup();
  };
}
