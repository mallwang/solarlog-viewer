/**
 * Statistics page shell (022-statistics-page): fetches the plant's full merged history once per
 * page load (never refetched on a topic-only route change, per SC-004), renders the left topic
 * nav, and mounts the active topic's renderer into the right content area based on
 * `route.params.topic`.
 */

import {
  parseDailyTotalsFile,
  parseMonthsFile,
  parseYearsFile,
  mergeDailyTotals,
  mergeMonthlyTotals,
  mergeYearlyTotals,
} from '../../data/aggregates.js';
import { fetchFromBothSources } from '../../data/data-source.js';
import { fetchText } from '../../data/fetch-text.js';
import { DATA_DIR } from '../../config.js';
import { t } from '../../i18n.js';
import { formatRoute } from '../../router.js';

const TOPICS = ['common', 'heatmaps', 'streaks', 'trends', 'best-worst'];

const TOPIC_MODULES = {
  common: () => import('./common-topic.js'),
  heatmaps: () => import('./heatmaps-topic.js'),
  streaks: () => import('./streaks-topic.js'),
  trends: () => import('./trends-topic.js'),
  'best-worst': () => import('./best-worst-topic.js'),
};

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Memoized across every render() call for the lifetime of the page (module-level, not per-call)
// so switching topics never refetches the same aggregate files a second time (SC-004) — the same
// promise is awaited by every caller, including one already in flight.
let statisticsDataPromise = null;

/**
 * Fetches + merges the full daily/monthly/yearly history (see research.md R1) exactly once per
 * page load, regardless of how many times the topic route changes.
 * @returns {Promise<{ fullDailyHistory: object[], fullMonthlyHistory: object[], fullYearlyHistory: object[] }>}
 */
function loadStatisticsData() {
  if (!statisticsDataPromise) {
    statisticsDataPromise = (async () => {
      const [daysSources, monthsSources, yearsSources, todaySource] = await Promise.all([
        fetchFromBothSources('days_hist.js'),
        fetchFromBothSources('months.js'),
        fetchFromBothSources('years.js'),
        fetchText(`${DATA_DIR}/days.js`),
      ]);

      const dailyMerged = mergeDailyTotals(
        daysSources.hist.ok ? parseDailyTotalsFile(daysSources.hist.text) : [],
        daysSources.data.ok ? parseDailyTotalsFile(daysSources.data.text) : [],
      );
      const todayEntry = todaySource.ok
        ? parseDailyTotalsFile(todaySource.text).find((d) => d.date === todayIso())
        : undefined;
      const fullDailyHistory = todayEntry
        ? mergeDailyTotals(dailyMerged, [todayEntry])
        : dailyMerged;

      const fullMonthlyHistory = mergeMonthlyTotals(
        monthsSources.hist.ok ? parseMonthsFile(monthsSources.hist.text) : [],
        monthsSources.data.ok ? parseMonthsFile(monthsSources.data.text) : [],
      );
      const fullYearlyHistory = mergeYearlyTotals(
        yearsSources.hist.ok ? parseYearsFile(yearsSources.hist.text) : [],
        yearsSources.data.ok ? parseYearsFile(yearsSources.data.text) : [],
      );

      return { fullDailyHistory, fullMonthlyHistory, fullYearlyHistory };
    })();
  }
  return statisticsDataPromise;
}

/**
 * One `.stat-tile` card (data-model.md "Stat tile"). `null` (no data for that stat yet) renders
 * as an "n/a" placeholder tile instead of being omitted — every topic keeps a fixed tile count.
 * `fallbackLabelKey` supplies the tile's label when `tile` itself is null (statistics.js returns
 * null, not a tile, when a stat has no data to compute from).
 * @param {{ label: string, value: string, period: string, route: object | null, caveat: string | null } | null} tile
 * @param {{ worst?: boolean, fallbackLabelKey?: string }} [opts]
 * @returns {string}
 */
export function statTileMarkup(tile, { worst = false, fallbackLabelKey } = {}) {
  if (!tile) {
    return `<div class="stat-tile${worst ? ' worst' : ''}">
      <span class="tile-label">${fallbackLabelKey ? t(fallbackLabelKey) : ''}</span>
      <span class="tile-value">${t('statistics.commonTiles.notEnough')}</span>
    </div>`;
  }
  const viewLabelKey = tile.route
    ? `statistics.common.view${tile.route.view.charAt(0).toUpperCase()}${tile.route.view.slice(1)}`
    : null;
  const link = tile.route
    ? `<a class="tile-link" href="${formatRoute(tile.route)}">${t(viewLabelKey)}</a>`
    : '';
  const caveat = tile.caveat ? `<span class="power-caveat">${t(tile.caveat)}</span>` : '';
  return `<div class="stat-tile${worst ? ' worst' : ''}">
    <span class="tile-label">${t(tile.label)}</span>
    <span class="tile-value">${tile.value}</span>
    <span class="tile-meta">${tile.period}</span>
    ${caveat}
    ${link}
  </div>`;
}

/**
 * Shared "not enough data yet" card for Heatmaps/Streaks/Trends (FR-012, SC-005, design.md's
 * "Shared states"). Common/Best vs. Worst never call this — they're never gated.
 * @returns {string}
 */
export function insufficientHistoryMarkup() {
  return `<div class="stats-empty-state">
    <h3>${t('statistics.emptyState.title')}</h3>
    <p>${t('statistics.emptyState.body')}</p>
  </div>`;
}

function topicNavMarkup(activeTopic) {
  const items = TOPICS.map((topicId) => {
    const href = formatRoute({ view: 'statistics', params: { topic: topicId } });
    const current = topicId === activeTopic ? ' aria-current="page"' : '';
    const labelKey = `statistics.topics.${topicId === 'best-worst' ? 'bestWorst' : topicId}`;
    return `<a href="${href}"${current}>${t(labelKey)}</a>`;
  }).join('');
  return `<nav class="stats-nav" aria-label="${t('statistics.navLabel')}">${items}</nav>`;
}

/**
 * Mounts the Statistics page shell: page title, split-view topic nav + content area, fetches the
 * merged full history once (see loadStatisticsData), then mounts the routed topic's renderer.
 * @param {HTMLElement} container
 * @param {{ plant: object | null, route: { params: { topic: string } } }} ctx
 */
export async function render(container, { plant, route }) {
  const topic = TOPICS.includes(route.params.topic) ? route.params.topic : 'common';

  container.innerHTML = `<div class="view-header flex items-center justify-between gap-sm flex-wrap mb-md">
      <h2 class="view-title text-lg m-0">${t('nav.statisticsView')}</h2>
    </div>
    <div class="stats-page">
      ${topicNavMarkup(topic)}
      <div class="stats-content"></div>
    </div>`;

  const contentEl = container.querySelector('.stats-content');

  const { fullDailyHistory, fullMonthlyHistory, fullYearlyHistory } = await loadStatisticsData();
  const loadTopic = TOPIC_MODULES[topic];
  const topicModule = await loadTopic();
  topicModule.render(contentEl, {
    plant,
    fullDailyHistory,
    fullMonthlyHistory,
    fullYearlyHistory,
  });
}
