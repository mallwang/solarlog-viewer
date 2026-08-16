/**
 * Trends topic (022-statistics-page, FR-007/008): three stacked ApexCharts blocks — year-over-
 * year cumulative yield, cumulative lifetime €/CO2 savings, and per-year specific-yield
 * degradation — each gated independently per data-model.md's gating table (a plant with exactly
 * one year still shows the lifetime + degradation charts, only the YoY comparison gets its own
 * "not enough data" state).
 */

import { t, getLanguage } from '../../i18n.js';
import { renderChart } from '../../charts/chart-factory.js';
import { formatRoute } from '../../router.js';
import {
  computeYoyCumulative,
  computeLifetimeCumulative,
  computeSpecificYieldTrend,
  hasEnoughHistory,
  hasEnoughHistoryForYoy,
} from '../../data/statistics.js';
import { insufficientHistoryMarkup } from './statistics-view.js';

/**
 * @param {HTMLElement} container - The `.stats-content` mount point.
 * @param {{ plant: object | null, fullDailyHistory: object[], fullYearlyHistory: object[] }} data
 */
export function render(container, { plant, fullDailyHistory, fullYearlyHistory }) {
  if (!hasEnoughHistory(fullDailyHistory, fullYearlyHistory, 'trends')) {
    container.innerHTML = `<section>
      <h2>${t('statistics.trends.title')}</h2>
      ${insufficientHistoryMarkup()}
    </section>`;
    return;
  }

  const canShowYoy = hasEnoughHistoryForYoy(fullDailyHistory);

  container.innerHTML = `<section>
    <h2>${t('statistics.trends.title')}</h2>
    <p class="topic-intro">${t('statistics.trends.intro')}</p>
    <div class="trend-block">
      <h3>${t('statistics.trends.yoyTitle')}</h3>
      ${canShowYoy ? '<div class="trend-mount" data-chart="yoy"></div>' : insufficientHistoryMarkup()}
    </div>
    <div class="trend-block">
      <h3>${t('statistics.trends.lifetimeTitle')}</h3>
      <div class="trend-mount" data-chart="lifetime"></div>
    </div>
    <div class="trend-block">
      <h3>${t('statistics.trends.specificYieldTitle')}</h3>
      <div class="trend-mount" data-chart="specific-yield"></div>
      <p class="trend-caveat">${t('statistics.trends.degradationCaveat')}</p>
    </div>
  </section>`;

  const lang = getLanguage();

  if (canShowYoy) {
    renderChart(
      container.querySelector('[data-chart="yoy"]'),
      'yoy-cumulative',
      computeYoyCumulative(fullDailyHistory),
      { lang },
    );
  }

  renderChart(
    container.querySelector('[data-chart="lifetime"]'),
    'lifetime-cumulative',
    computeLifetimeCumulative(fullYearlyHistory, plant),
    {
      lang,
      onDataPointClick: (index) => {
        const years = computeLifetimeCumulative(fullYearlyHistory, plant);
        window.location.hash = formatRoute({ view: 'year', params: { year: years[index].year } });
      },
    },
  );

  renderChart(
    container.querySelector('[data-chart="specific-yield"]'),
    'specific-yield-trend',
    computeSpecificYieldTrend(fullYearlyHistory, plant),
    {
      lang,
      onDataPointClick: (index) => {
        const years = computeSpecificYieldTrend(fullYearlyHistory, plant);
        window.location.hash = formatRoute({ view: 'year', params: { year: years[index].year } });
      },
    },
  );
}
