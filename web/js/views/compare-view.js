import { parseDailyTotalsFile, mergeDailyTotals } from '../data/aggregates.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { fetchFromBothSources } from '../data/data-source.js';

function dayOfYear(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  return Math.round((current - start) / 86400000) + 1;
}

/**
 * Groups DailyTotal records by calendar year for the Mode 4 comparison chart.
 * dayOfYear (1-366) naturally includes Feb 29 in leap years without shifting other years'
 * alignment, since it is derived from each date directly rather than a fixed day index.
 * @param {{ date: string, perInverter: object }[]} dailyTotals
 * @returns {{ year: number, points: { dayOfYear: number, totalWh: number }[] }[]}
 */
export function groupByYear(dailyTotals) {
  const byYear = new Map();
  for (const total of dailyTotals) {
    const year = Number.parseInt(total.date.slice(0, 4), 10);
    const totalWh = Object.values(total.perInverter).reduce((s, v) => s + v.yieldWh, 0);
    const point = { dayOfYear: dayOfYear(total.date), totalWh };
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push(point);
  }
  return [...byYear.entries()]
    .map(([year, points]) => ({ year, points: points.sort((a, b) => a.dayOfYear - b.dayOfYear) }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Mounts the Mode 4 year-over-year comparison view: overlays each year's daily production
 * on a shared day-of-year axis.
 * @param {HTMLElement} container
 */
export async function render(container) {
  container.innerHTML = `<h2 class="view-title">${t('nav.compareView')}</h2>
    <div class="chart-container"><canvas></canvas></div>`;

  const { hist, data } = await fetchFromBothSources('days_hist.js');
  if (!hist.ok && !data.ok) {
    container.innerHTML = `<h2 class="view-title">${t('nav.compareView')}</h2>
      <p class="empty-state">${t('compare.noData')}</p>`;
    return;
  }

  const dailyTotals = mergeDailyTotals(
    hist.ok ? parseDailyTotalsFile(hist.text) : [],
    data.ok ? parseDailyTotalsFile(data.text) : [],
  );
  const series = groupByYear(dailyTotals);
  const canvas = container.querySelector('canvas');
  renderChart(canvas, 'compare', series, { lang: getLanguage() });
}
