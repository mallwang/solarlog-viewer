/**
 * Common topic (022-statistics-page, FR-002/003/011): an 8-tile grid of the plant's key records
 * (best/worst month & year, max daily power, max Ist %, max daily CO2, max daily €), each linking
 * to its source day/month/year view. Never gated by history (spec.md: "even a few days of
 * history produces a meaningful 'best so far'").
 */

import { t } from '../../i18n.js';
import {
  bestWorstMonth,
  bestWorstYear,
  maxDailyPower,
  maxIstPercent,
  maxDailyCo2,
  maxDailyEuro,
  excludeBackfilledDays,
  excludeUnreliableDailyYield,
} from '../../data/statistics.js';
import { statTileMarkup } from './statistics-view.js';

/**
 * @param {HTMLElement} container - The `.stats-content` mount point.
 * @param {{ plant: object | null, fullDailyHistory: object[], fullMonthlyHistory: object[], fullYearlyHistory: object[] }} data
 */
export function render(
  container,
  { plant, fullDailyHistory, fullMonthlyHistory, fullYearlyHistory },
) {
  const months = bestWorstMonth(fullMonthlyHistory);
  const years = bestWorstYear(fullYearlyHistory, undefined, plant);
  // Backfilled days (see excludeBackfilledDays's doc comment in statistics.js) only need
  // excluding from the peakW-based pick below - their peakW reads 0 regardless of the real power
  // that day. The other three picks are kWh-based (Ist %, CO2, €): most backfilled days keep a
  // real per-day total, so only the narrower excludeUnreliableDailyYield range (an outage
  // backfilled from one meter reading spread evenly across its days) needs excluding from those.
  const reliableDailyHistory = excludeBackfilledDays(fullDailyHistory);
  const reliableDailySplitHistory = excludeUnreliableDailyYield(fullDailyHistory);

  const tiles = [
    [months.best, false, 'statistics.common.bestMonth'],
    [months.worst, true, 'statistics.common.worstMonth'],
    [years.best, false, 'statistics.common.bestYear'],
    [years.worst, true, 'statistics.common.worstYear'],
    [maxDailyPower(reliableDailyHistory), false, 'statistics.common.maxDailyPower'],
    [maxIstPercent(reliableDailySplitHistory, plant), false, 'statistics.common.maxIstPercent'],
    [maxDailyCo2(reliableDailySplitHistory), false, 'statistics.common.maxDailyCo2'],
    [maxDailyEuro(reliableDailySplitHistory, plant), false, 'statistics.common.maxDailyEuro'],
  ];

  container.innerHTML = `<section>
    <h2>${t('statistics.common.title')}</h2>
    <p class="topic-intro">${t('statistics.common.intro')}</p>
    <div class="tile-grid">
      ${tiles.map(([tile, worst, fallbackLabelKey]) => statTileMarkup(tile, { worst, fallbackLabelKey })).join('')}
    </div>
  </section>`;
}
