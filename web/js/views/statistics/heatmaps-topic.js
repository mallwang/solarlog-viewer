/**
 * Heatmaps topic (022-statistics-page, FR-004/005/015): a year selector plus three stacked
 * CSS-grid calendar heatmaps (energy/money/CO2), color-scaled per-year, with missing days
 * visually distinct from real recorded zeros. The selected year is in-page state only, not
 * routed (research.md R4).
 */

import { t, getLanguage } from '../../i18n.js';
import { formatKwh, formatCurrency, formatCo2, formatDate } from '../../format.js';
import { buildCalendarHeatmap, hasEnoughHistory } from '../../data/statistics.js';
import { insufficientHistoryMarkup } from './statistics-view.js';

const METRICS = [
  {
    key: 'energyKwh',
    labelKey: 'statistics.heatmaps.energy',
    heatColorVar: '--color-primary',
    format: (v) => formatKwh(v),
  },
  {
    key: 'moneyEuro',
    labelKey: 'statistics.heatmaps.money',
    heatColorVar: '--color-accent',
    format: (v) => formatCurrency(v),
  },
  {
    key: 'co2Kg',
    labelKey: 'statistics.heatmaps.co2',
    heatColorVar: '--chart-color-3',
    format: (v) => formatCo2(v),
  },
];

function availableYears(fullDailyHistory) {
  const years = new Set(
    fullDailyHistory
      .filter((d) => Object.keys(d.perInverter ?? {}).length > 0)
      .map((d) => Number.parseInt(d.date.slice(0, 4), 10)),
  );
  return [...years].sort((a, b) => b - a);
}

function cellTitle(cell, metric) {
  const dateLabel = formatDate(new Date(`${cell.date}T00:00:00`), { lang: getLanguage() });
  if (cell.value === null) return `${dateLabel}: ${t('statistics.heatmaps.legendMissing')}`;
  return `${dateLabel}: ${metric.format(cell.value)}`;
}

function heatmapBlockMarkup(heatmap, metric) {
  const cells = heatmap.cells
    .map((cell) => {
      const missing = cell.value === null;
      const style = missing
        ? ''
        : `style="--v:${cell.relativeIntensity};--heat-color:var(${metric.heatColorVar})"`;
      return `<div class="heatmap-cell" data-missing="${missing}" ${style} title="${cellTitle(cell, metric)}"></div>`;
    })
    .join('');
  return `<div class="heatmap-block">
    <h3>${t(metric.labelKey)}</h3>
    <div class="heatmap-grid">${cells}</div>
  </div>`;
}

/**
 * @param {HTMLElement} container - The `.stats-content` mount point.
 * @param {{ plant: object | null, fullDailyHistory: object[], fullYearlyHistory: object[] }} data
 */
export function render(container, { plant, fullDailyHistory, fullYearlyHistory }) {
  if (!hasEnoughHistory(fullDailyHistory, fullYearlyHistory, 'heatmaps')) {
    container.innerHTML = `<section>
      <h2>${t('statistics.heatmaps.title')}</h2>
      ${insufficientHistoryMarkup()}
    </section>`;
    return;
  }

  const years = availableYears(fullDailyHistory);
  let selectedYear = years[0];

  const draw = () => {
    const blocksEl = container.querySelector('.heatmap-blocks');
    blocksEl.innerHTML = METRICS.map((metric) =>
      heatmapBlockMarkup(
        buildCalendarHeatmap(fullDailyHistory, selectedYear, metric.key, plant),
        metric,
      ),
    ).join('');
  };

  container.innerHTML = `<section>
    <h2>${t('statistics.heatmaps.title')}</h2>
    <p class="topic-intro">${t('statistics.heatmaps.intro')}</p>
    <div class="heatmap-controls">
      <label>
        ${t('statistics.heatmaps.yearLabel')}
        <select class="year-select">
          ${years.map((y) => `<option value="${y}">${y}</option>`).join('')}
        </select>
      </label>
      <div class="heatmap-legend">
        <span class="swatch" style="--v:0.2;--heat-color:var(--color-primary)"></span>${t('statistics.heatmaps.legendLow')}
        <span class="swatch" style="--v:1;--heat-color:var(--color-primary)"></span>${t('statistics.heatmaps.legendHigh')}
        <span class="swatch missing"></span>${t('statistics.heatmaps.legendMissing')}
      </div>
    </div>
    <div class="heatmap-blocks"></div>
  </section>`;

  draw();

  container.querySelector('.year-select').addEventListener('change', (event) => {
    selectedYear = Number.parseInt(event.target.value, 10);
    draw();
  });
}
