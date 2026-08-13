import {
  parseMonthsFile,
  parseDailyTotalsFile,
  mergeMonthlyTotals,
  mergeDailyTotals,
  addMissingDays,
} from '../data/aggregates.js';
import { renderChart } from '../charts/chart-factory.js';
import { getLanguage, t } from '../i18n.js';
import { fetchFromBothSources } from '../data/data-source.js';
import { fetchText } from '../data/fetch-text.js';
import { DATA_DIR } from '../config.js';
import { formatRoute } from '../router.js';
import { addYears, isFutureYear, parentOfYear, periodNavMarkup } from './period-nav.js';
import { emptyStateBody } from './empty-state.js';
import { chartWithStatsLayoutMarkup, statsPanelMarkup } from './stats-panel.js';
import { initChartBreakdownToggle } from './chart-breakdown-toggle.js';
import { initChartTableToggle } from './chart-table-toggle.js';
import { renderChartTable } from './chart-data-table.js';
import { getChartBreakdownMode } from '../settings.js';
import { formatKwh, formatCurrency, formatCo2 } from '../format.js';
import {
  maxMonthlyYieldKwh,
  specificYieldKwhPerKwp,
  yearlySollKwh,
  yearSollAuflaufendKwh,
  istPercent,
} from '../data/yield-stats.js';
import { co2FactorForYear } from '../data/co2-factors.js';

function currentYear() {
  return new Date().getFullYear();
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function sumWh(perInverter) {
  return Object.values(perInverter).reduce((s, wh) => s + wh, 0);
}

/**
 * Builds the year-view stats panel's rows (kWh yield, € yield, specific yield, best monthly
 * yield, and the Soll/Ist target comparison). For the current (still in-progress) year, Soll is
 * the running "auflaufend" total (see yearSollAuflaufendKwh); for any other year it's the whole
 * year's target (see yearlySollKwh), since the year is already complete either way.
 * @param {ReturnType<typeof import('../data/aggregates.js').parseMonthsFile>} monthlyBreakdown
 * @param {object | null} plant - PlantMetadata (see data/plant.js); Soll/tariff figures fall
 *   back to 0 when unavailable.
 * @param {number} year
 * @param {boolean} isCurrentYear
 * @returns {[string, string][]}
 */
function yearStatsRows(monthlyBreakdown, plant, year, isCurrentYear) {
  const yieldKwh = monthlyBreakdown.reduce((s, m) => s + sumWh(m.perInverter), 0) / 1000;
  const feedInEuro = yieldKwh * (plant?.tariffRatePerKwh ?? 0);
  const specificYield = specificYieldKwhPerKwp(yieldKwh, plant?.capacityKwp ?? 0);
  const sollKwh = isCurrentYear
    ? yearSollAuflaufendKwh(plant ?? {}, year)
    : yearlySollKwh(plant ?? {});
  const ist = istPercent(yieldKwh, sollKwh);
  const maxMonth = maxMonthlyYieldKwh(monthlyBreakdown);
  const maxMonthName = maxMonth.month ? t(`month.long.${maxMonth.month.slice(5, 7)}`) : null;
  const co2SavedKg = yieldKwh * co2FactorForYear(year);

  return [
    ['year.stats.yieldKwh', formatKwh(yieldKwh)],
    ['year.stats.yieldEuro', formatCurrency(feedInEuro)],
    ['year.stats.specificYield', `${formatKwh(specificYield)}/kWp`],
    [
      'year.stats.maxMonth',
      maxMonthName ? `${formatKwh(maxMonth.kwh)} (${maxMonthName})` : formatKwh(maxMonth.kwh),
    ],
    [isCurrentYear ? 'year.stats.sollAuflaufend' : 'year.stats.sollTotal', formatKwh(sollKwh)],
    ['year.stats.ist', `${ist}%`],
    ['year.stats.co2', formatCo2(co2SavedKg)],
  ];
}

/**
 * Expands a year's MonthlyTotal[] (which only lists months that actually have data) into one
 * entry per calendar month of the year, so the chart's x-axis always spans Jan-Dec (mirroring
 * fillMonthDays in month-view.js) instead of stopping at the last month with data.
 * @param {number} year
 * @param {ReturnType<typeof import('../data/aggregates.js').parseMonthsFile>} monthlyTotals
 * @returns {ReturnType<typeof import('../data/aggregates.js').parseMonthsFile>}
 */
function fillYearMonths(year, monthlyTotals) {
  const byMonth = new Map(monthlyTotals.map((m) => [m.month, m]));
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`;
    return byMonth.get(key) ?? { month: key, perInverter: {}, dailyBreakdown: [] };
  });
}

/**
 * Mounts the Mode 2 year detail view: per-month yield bars for the routed year (Jan-Dec), with
 * prev/next/this-year navigation mirroring the month view's day navigation.
 * @param {HTMLElement} container
 * @param {{ plant: object | null, route: { params: { year: number } } }} ctx
 */
export async function render(container, { route, plant }) {
  const { year } = route.params;
  const title = `${t('nav.yearView')} - ${year}`;
  const isCurrentYear = year === currentYear();

  const nextParams = addYears({ year }, 1);
  const nav = periodNavMarkup({
    prevHref: formatRoute({ view: 'year', params: addYears({ year }, -1) }),
    prevLabel: t('year.prev'),
    // "Jahr" is neuter, so it takes "Vorheriges"/"Nächstes", not the masculine
    // "Vorheriger"/"Nächster" that day/month use (shared via common.prev/common.next) —
    // a year-specific short label instead of the generic one.
    prevShortLabel: t('year.prevShort'),
    nextHref: isFutureYear(nextParams) ? null : formatRoute({ view: 'year', params: nextParams }),
    nextLabel: t('year.next'),
    nextShortLabel: t('year.nextShort'),
    todayHref: isCurrentYear
      ? null
      : formatRoute({ view: 'year', params: { year: currentYear() } }),
    todayLabel: t('year.thisYear'),
    parentHref: formatRoute({ view: 'total', params: parentOfYear({ year }) }),
    parentLabel: t('year.parentLink'),
  });

  container.innerHTML = `<div class="view-header flex items-center justify-between gap-sm flex-wrap mb-md">
      <h2 class="view-title text-lg m-0">${title}</h2>
      ${nav}
    </div>
    ${chartWithStatsLayoutMarkup({ breakdownToggle: true })}`;
  const periodLayout = container.querySelector('.period-layout');
  const chartContainer = container.querySelector('.chart-container');

  const [{ hist, data }, todaySource, daysHistSource] = await Promise.all([
    fetchFromBothSources('months.js'),
    isCurrentYear ? fetchText(`${DATA_DIR}/days.js`) : Promise.resolve({ ok: false }),
    isCurrentYear ? fetchText(`${DATA_DIR}/days_hist.js`) : Promise.resolve({ ok: false }),
  ]);
  if (!hist.ok && !data.ok) {
    chartContainer.innerHTML = emptyStateBody('year.noData');
    return;
  }

  const months = mergeMonthlyTotals(
    hist.ok ? parseMonthsFile(hist.text) : [],
    data.ok ? parseMonthsFile(data.text) : [],
  );
  const key = String(year);
  // months.js is only written at day rollover - and isn't guaranteed to hit every one - so fold
  // every daily total newer than the current month's checkpoint into that month before summing
  // the year (mirrors month-view.js's addMissingDays use).
  const todayEntry = todaySource.ok
    ? parseDailyTotalsFile(todaySource.text).find((d) => d.date === todayIso())
    : undefined;
  const currentMonthDailyBreakdown = mergeDailyTotals(
    daysHistSource.ok ? parseDailyTotalsFile(daysHistSource.text) : [],
    todayEntry ? [todayEntry] : [],
  ).filter((d) => d.date.startsWith(currentMonthKey()));
  const monthsInYear = months.filter((m) => m.month.startsWith(key));
  if (
    currentMonthDailyBreakdown.length > 0 &&
    !monthsInYear.some((m) => m.month === currentMonthKey())
  ) {
    // First day(s) of the month: months.js has no entry yet for it at all.
    monthsInYear.push({ month: currentMonthKey(), perInverter: {}, dailyBreakdown: [] });
  }
  const monthlyBreakdown = monthsInYear.map((m) =>
    m.month === currentMonthKey() ? addMissingDays(m, currentMonthDailyBreakdown) : m,
  );

  if (monthlyBreakdown.length === 0) {
    chartContainer.innerHTML = emptyStateBody('year.noData');
    return;
  }

  periodLayout.insertAdjacentHTML(
    'beforeend',
    statsPanelMarkup(
      'year.stats.title',
      yearStatsRows(monthlyBreakdown, plant, year, isCurrentYear),
    ),
  );

  const mount = container.querySelector('.chart-mount');
  const tableMount = chartContainer.querySelector('.chart-table');
  const drawChart = () => {
    const chart = renderChart(
      mount,
      'year-months',
      { year, monthlyBreakdown: fillYearMonths(year, monthlyBreakdown) },
      {
        lang: getLanguage(),
        breakdown: getChartBreakdownMode(),
        onDataPointClick: (index) => {
          window.location.hash = formatRoute({
            view: 'month',
            params: { year, month: index + 1 },
          });
        },
      },
    );
    renderChartTable(tableMount, chart.w.config);
  };
  drawChart();
  initChartBreakdownToggle(chartContainer, drawChart);
  initChartTableToggle(chartContainer, (visible) => {
    tableMount.hidden = !visible;
  });
}
