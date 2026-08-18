/**
 * Heatmaps topic (022-statistics-page, FR-004/005/015): a year selector plus three stacked
 * CSS-grid calendar heatmaps (energy/money/CO2), color-scaled per-year, with missing days
 * visually distinct from real recorded zeros. The selected year is in-page state only, not
 * routed (research.md R4).
 */

import { t, getLanguage } from '../../i18n.js';
import { formatKwh, formatCurrency, formatCo2, formatDate } from '../../format.js';
import { buildCalendarHeatmap, hasEnoughHistory } from '../../data/statistics.js';
import { isUnreliableDailyYield } from '../../data/backfilled-data.js';
import { insufficientHistoryMarkup } from './statistics-view.js';

const METRICS = [
  {
    key: 'energyKwh',
    labelKey: 'statistics.heatmaps.energy',
    heatColorVar: '--color-primary',
    format: (v) => formatKwh(v, { decimals: 2 }),
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

// Two different backfilled captions (see config.js's UNRELIABLE_DAILY_YIELD_RANGES): most
// backfilled days kept a real per-day total and only lost their minute-level power curve, but a
// day inside that narrower range is itself an even split of one offline meter reading, not a real
// per-day measurement - the tooltip says which one a given cell is, rather than one caption
// silently overclaiming accuracy for the other case.
function backfilledCaption(dateIso) {
  return isUnreliableDailyYield(dateIso)
    ? t('statistics.heatmaps.legendBackfilledEstimated')
    : t('statistics.heatmaps.legendBackfilledRealTotal');
}

function cellTitle(cell, metric) {
  const dateLabel = formatDate(new Date(`${cell.date}T00:00:00`), { lang: getLanguage() });
  if (cell.value === null) return `${dateLabel}: ${t('statistics.heatmaps.legendMissing')}`;
  const value = `${dateLabel}: ${metric.format(cell.value)}`;
  return cell.backfilled ? `${value} (${backfilledCaption(cell.date)})` : value;
}

function cellMarkup(cell, metric) {
  const missing = cell.value === null;
  const style = missing
    ? ''
    : `style="--v:${cell.relativeIntensity};--heat-color:var(${metric.heatColorVar})"`;
  return `<div class="heatmap-cell" data-missing="${missing}" data-backfilled="${cell.backfilled}" ${style} title="${cellTitle(cell, metric)}"></div>`;
}

// Groups cells (day-of-year order) by calendar month so each month renders as its own 7-row
// sub-grid, with a thin divider between them (see .heatmap-month + .heatmap-month in app.css) —
// the day-of-year sequence has no fixed alignment to a 7-row grid, so month boundaries otherwise
// fall in the middle of a column rather than at a clean edge.
function groupCellsByMonth(cells) {
  const months = [];
  let current = null;
  for (const cell of cells) {
    const month = cell.date.slice(0, 7);
    if (month !== current) {
      current = month;
      months.push([]);
    }
    months.at(-1).push(cell);
  }
  return months;
}

// Cap how large cells are allowed to grow (see the fr-based sizing in app.css) so a very wide
// panel gets a bigger, more legible heatmap rather than one that keeps stretching indefinitely.
const MAX_CELL_PX = 16;

function heatmapBlockMarkup(heatmap, metric) {
  const months = groupCellsByMonth(heatmap.cells)
    .map((monthCells) => {
      const cols = Math.ceil(monthCells.length / 7);
      const cells = monthCells.map((cell) => cellMarkup(cell, metric)).join('');
      // --cols drives the month's own grid-template-columns; flex-grow (proportional to --cols)
      // and max-width (capped per cell) are set here too since both depend on the same per-month
      // value that only JS knows — see .heatmap-month in app.css for how they're consumed.
      const style = `--cols:${cols};flex-grow:${cols};max-width:calc(${cols} * ${MAX_CELL_PX}px + ${cols - 1} * 2px)`;
      return `<div class="heatmap-month" style="${style}">${cells}</div>`;
    })
    .join('');
  return `<div class="heatmap-block">
    <h3>${t(metric.labelKey)}</h3>
    <div class="heatmap-grid">${months}</div>
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
        <span class="legend-item"><span class="swatch" style="--v:0.2;--heat-color:var(--color-primary)"></span>${t('statistics.heatmaps.legendLow')}</span>
        <span class="legend-item"><span class="swatch" style="--v:1;--heat-color:var(--color-primary)"></span>${t('statistics.heatmaps.legendHigh')}</span>
        <span class="legend-item"><span class="swatch missing"></span>${t('statistics.heatmaps.legendMissing')}</span>
        <span class="legend-item"><span class="swatch backfilled" style="--v:0.6;--heat-color:var(--color-primary)"></span>${t('statistics.heatmaps.legendBackfilled')}</span>
      </div>
    </div>
    <div class="heatmap-blocks"></div>
  </section>`;

  draw();

  container.querySelector('.year-select').addEventListener('change', (event) => {
    selectedYear = Number.parseInt(event.target.value, 10);
    draw();
  });

  // Click a cell to pin a highlight on it (in addition to the :hover outline), so the exact day
  // stays marked while reading the tooltip/value — helpful since cells are small and touch
  // devices have no hover at all. Clicking the same cell again clears the selection.
  container.querySelector('.heatmap-blocks').addEventListener('click', (event) => {
    const cell = event.target.closest('.heatmap-cell');
    if (!cell) return;
    const wasSelected = cell.classList.contains('is-selected');
    container
      .querySelectorAll('.heatmap-cell.is-selected')
      .forEach((el) => el.classList.remove('is-selected'));
    if (!wasSelected) cell.classList.add('is-selected');
  });
}
