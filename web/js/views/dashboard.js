import { formatRoute } from '../router.js';
import { t } from '../i18n.js';
import { formatKwh } from '../format.js';
import { fetchText } from '../data/fetch-text.js';
import {
  parseDailyTotalsFile,
  parseMonthsFile,
  parseYearsFile,
  mergeMonthlyTotals,
  mergeYearlyTotals,
  addTodayYield,
} from '../data/aggregates.js';
import { fetchFromBothSources } from '../data/data-source.js';

function todayParams() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function sumWh(perInverter) {
  return Object.values(perInverter).reduce((s, v) => s + (v.yieldWh ?? v), 0);
}

function widget(titleKey, value, href) {
  return `<div class="widget rounded-lg bg-bg-elevated p-md transition-colors hover:bg-border/40">
    <a class="block no-underline text-inherit" href="${href}">
      <p class="widget__title m-0 mb-xs text-sm uppercase tracking-wide text-text-muted">${t(titleKey)}</p>
      <p class="m-0"><span class="widget__value text-xl font-semibold">${value}</span></p>
    </a>
  </div>`;
}

/**
 * Mounts the dashboard: the 4 yield-totals widgets (today/month/year/total), each linking to its
 * detail view (SC-003: dashboard-to-any-chart in <=2 interactions). Current production moved to
 * the global nav info panel (see info-panel/info-panel-controller.js), so it is no longer shown
 * here. Month/year/total figures fold in today's live yield (days.js) on top of
 * months.js/years.js the same way the month/year/total detail views do (see addTodayYield),
 * so the dashboard and detail pages always agree.
 * @param {HTMLElement} container
 * @param {{ plant: object | null }} ctx
 */
export async function render(container) {
  const { year, month, day } = todayParams();
  const dayHref = formatRoute({ view: 'day', params: { year, month, day } });
  const monthHref = formatRoute({ view: 'month', params: { year, month } });
  const yearHref = formatRoute({ view: 'year', params: { year } });
  const totalHref = formatRoute({ view: 'total', params: {} });

  container.innerHTML = `
    <h2 class="view-title text-lg mb-md">${t('nav.dashboard')}</h2>
    <div class="widget-grid grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3" id="widget-grid">
      ${widget('widget.todayYield', '—', dayHref)}
      ${widget('widget.monthYield', '—', monthHref)}
      ${widget('widget.yearYield', '—', yearHref)}
      ${widget('widget.totalYield', '—', totalHref)}
    </div>
  `;

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const grid = container.querySelector('#widget-grid');
  const values = grid.querySelectorAll('.widget__value');

  const [daysResult, months, years] = await Promise.all([
    fetchText('data/days.js'),
    fetchFromBothSources('months.js').then(({ hist, data }) =>
      mergeMonthlyTotals(
        hist.ok ? parseMonthsFile(hist.text) : [],
        data.ok ? parseMonthsFile(data.text) : [],
      ),
    ),
    fetchFromBothSources('years.js').then(({ hist, data }) =>
      mergeYearlyTotals(
        hist.ok ? parseYearsFile(hist.text) : [],
        data.ok ? parseYearsFile(data.text) : [],
      ),
    ),
  ]);

  const todayEntry = daysResult.ok
    ? parseDailyTotalsFile(daysResult.text).find((d) => d.date === todayIso())
    : undefined;

  if (todayEntry) values[0].textContent = formatKwh(sumWh(todayEntry.perInverter) / 1000);

  // months.js/years.js are only written at day rollover, so fold today's live entry into the
  // current month before summing, mirroring month-view.js/year-view.js/total-view.js.
  const thisMonth = addTodayYield(
    months.find((m) => m.month === monthKey) ?? { month: monthKey, perInverter: {} },
    todayEntry,
  );
  values[1].textContent = formatKwh(sumWh(thisMonth.perInverter) / 1000);

  // year-view.js derives the year's total from months.js (summed across the year's months, with
  // today folded into the current month) rather than from years.js directly, so mirror that here
  // instead of years.js's own total, which can drift from the months.js-derived figure.
  const monthsInYear = months.filter((m) => m.month.startsWith(String(year)));
  const monthlyBreakdown = monthsInYear.some((m) => m.month === monthKey)
    ? monthsInYear.map((m) => (m.month === monthKey ? thisMonth : m))
    : [...monthsInYear, thisMonth];
  const yearWh = monthlyBreakdown.reduce((s, m) => s + sumWh(m.perInverter), 0);
  values[2].textContent = formatKwh(yearWh / 1000);

  // total-view.js derives the lifetime total from years.js (with today folded into the current
  // year), so mirror that here too.
  const yearsWithToday = years.some((y) => y.year === year)
    ? years
    : [...years, { year, perInverter: {} }];
  const totalWh = yearsWithToday.reduce((s, y) => {
    const perInverter = y.year === year ? addTodayYield(y, todayEntry).perInverter : y.perInverter;
    return s + sumWh(perInverter);
  }, 0);
  values[3].textContent = formatKwh(totalWh / 1000);
}
