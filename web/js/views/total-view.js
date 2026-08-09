import {
  parseYearsFile,
  parseDailyTotalsFile,
  mergeYearlyTotals,
  deriveLifetimeSummary,
  addTodayYield,
} from '../data/aggregates.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { fetchFromBothSources } from '../data/data-source.js';
import { fetchText } from '../data/fetch-text.js';
import { DATA_DIR } from '../config.js';
import { formatRoute } from '../router.js';
import { emptyStateMarkup } from './empty-state.js';
import { chartWithStatsLayoutMarkup, statsPanelMarkup } from './stats-panel.js';
import { formatKwh, formatCurrency, formatCo2 } from '../format.js';
import {
  maxYearlyYield,
  specificYieldKwhPerKwp,
  lifetimeSollKwh,
  istPercent,
} from '../data/yield-stats.js';

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Builds the total-view stats panel's rows (lifetime kWh yield, € yield, specific yield, best
 * year, and the Soll/Ist target comparison). Soll is the lifetime target: the commissioning
 * year's partial share plus every full year since plus the current year's running "auflaufend"
 * share (see lifetimeSollKwh); Ist compares the actual lifetime yield — which already includes
 * today's live yield via addTodayYield — against that target.
 * @param {ReturnType<typeof import('../data/aggregates.js').deriveLifetimeSummary>} summary
 * @param {object | null} plant - PlantMetadata (see data/plant.js); Soll/tariff figures fall
 *   back to 0 when unavailable.
 * @returns {[string, string][]}
 */
function totalStatsRows(summary, plant) {
  const yieldKwh = summary.totalYieldWh / 1000;
  const specificYield = specificYieldKwhPerKwp(yieldKwh, plant?.capacityKwp ?? 0);
  const best = maxYearlyYield(summary.byYear);
  const sollKwh = lifetimeSollKwh(plant ?? {}, plant?.commissionedDate ?? '');
  const ist = istPercent(yieldKwh, sollKwh);

  return [
    ['total.stats.yieldKwh', formatKwh(yieldKwh)],
    ['total.stats.yieldEuro', formatCurrency(summary.feedInTotal)],
    ['total.stats.specificYield', `${formatKwh(specificYield)}/kWp`],
    ['total.stats.maxYear', best.year ? `${formatKwh(best.kwh)} (${best.year})` : formatKwh(best.kwh)],
    ['total.stats.sollTotal', formatKwh(sollKwh)],
    ['total.stats.ist', `${ist}%`],
    ['total.stats.co2', formatCo2(summary.co2SavedKg)],
  ];
}

/**
 * Mounts the Mode 3 lifetime detail view: one bar per year of production (all years, ascending)
 * plus a stats panel mirroring the month/year views (yield, € yield, specific yield, best year,
 * Soll/Ist) (FR-012, SC-008).
 * @param {HTMLElement} container
 * @param {{ plant: object | null }} ctx
 */
export async function render(container, { plant }) {
  const title = t('nav.totalView');
  container.innerHTML = `<h2 class="view-title text-lg mb-md">${title}</h2>
    ${chartWithStatsLayoutMarkup()}`;
  const periodLayout = container.querySelector('.period-layout');

  const [{ hist, data }, todaySource] = await Promise.all([
    fetchFromBothSources('years.js'),
    fetchText(`${DATA_DIR}/days.js`),
  ]);
  if (!hist.ok && !data.ok) {
    container.innerHTML = emptyStateMarkup(title, 'total.noData');
    return;
  }

  const yearsRaw = mergeYearlyTotals(
    hist.ok ? parseYearsFile(hist.text) : [],
    data.ok ? parseYearsFile(data.text) : [],
  );
  // years.js is only written at day rollover, so the current year never yet includes today's
  // yield; fold today's live entry (days.js) into it (mirrors month-view.js/year-view.js's
  // addTodayYield use).
  const todayEntry = todaySource.ok
    ? parseDailyTotalsFile(todaySource.text).find((d) => d.date === todayIso())
    : undefined;
  const currentYear = new Date().getFullYear();
  let years = yearsRaw;
  if (todayEntry && !yearsRaw.some((y) => y.year === currentYear)) {
    // First day of the year: years.js has no entry yet for it at all.
    years = [...yearsRaw, { year: currentYear, perInverter: {} }].sort((a, b) => a.year - b.year);
  }
  years = years.map((y) => (y.year === currentYear ? addTodayYield(y, todayEntry) : y));
  const summary = deriveLifetimeSummary(years, plant?.tariffRatePerKwh ?? 0);

  periodLayout.insertAdjacentHTML(
    'beforeend',
    statsPanelMarkup('total.stats.title', totalStatsRows(summary, plant)),
  );

  const mount = container.querySelector('.chart-mount');
  renderChart(mount, 'year', years, {
    lang: getLanguage(),
    onDataPointClick: (index) => {
      window.location.hash = formatRoute({ view: 'year', params: { year: years[index].year } });
    },
  });
}
