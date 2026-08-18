/**
 * Best vs. Worst topic (022-statistics-page, FR-009/016): pairs every Common-topic stat that has
 * a best/worst counterpart (month, year, daily yield) side by side, shown by default with no
 * toggle needed.
 */

import { t } from '../../i18n.js';
import { formatRoute } from '../../router.js';
import { bestWorstPairs, excludeBackfilledDays } from '../../data/statistics.js';

function pairSideMarkup(tile, { worst }) {
  const sideClass = worst ? 'worst' : 'best';
  if (!tile) {
    return `<span class="pair-side ${sideClass}">
      <span class="pair-tag">${t(worst ? 'statistics.bestWorst.worst' : 'statistics.bestWorst.best')}</span>
      <span class="pair-value">${t('statistics.commonTiles.notEnough')}</span>
    </span>`;
  }
  const href = tile.route ? formatRoute(tile.route) : '#';
  // Surfaces bestWorstYear's worst-year-excludes-current-year note (and any future per-side
  // caveat) as a native hover tooltip - a small aside, not worth a second visible line here.
  const titleAttr = tile.caveat ? ` title="${t(tile.caveat)}"` : '';
  return `<a class="pair-side ${sideClass}" href="${href}"${titleAttr}>
    <span class="pair-tag">${t(tile.label)}</span>
    <span class="pair-value">${tile.value}</span>
    <small class="pair-period">${tile.period}</small>
  </a>`;
}

/**
 * @param {HTMLElement} container - The `.stats-content` mount point.
 * @param {{ plant: object | null, fullDailyHistory: object[], fullMonthlyHistory: object[], fullYearlyHistory: object[] }} data
 */
export function render(
  container,
  { plant, fullDailyHistory, fullMonthlyHistory, fullYearlyHistory },
) {
  // Backfilled days (see backfilled-data.js) are excluded from the daily best/worst pick only -
  // month/year picks stay on the device's own pre-aggregated totals, unaffected by this filter.
  const pairs = bestWorstPairs(
    excludeBackfilledDays(fullDailyHistory),
    fullMonthlyHistory,
    fullYearlyHistory,
    plant,
  );

  const rows = pairs
    .map(
      (pair) => `<div class="pair-row">
        <span class="pair-label">${t(pair.label)}</span>
        ${pairSideMarkup(pair.best, { worst: false })}
        ${pairSideMarkup(pair.worst, { worst: true })}
      </div>`,
    )
    .join('');

  container.innerHTML = `<section>
    <h2>${t('statistics.bestWorst.title')}</h2>
    <p class="topic-intro">${t('statistics.bestWorst.intro')}</p>
    ${rows}
  </section>`;
}
