import { formatRoute } from '../router.js';
import { t } from '../i18n.js';
import { fetchText } from '../data/fetch-text.js';
import {
  parseDailyTotalsFile,
  parseMonthsFile,
  parseYearsFile,
  mergeMonthlyTotals,
  mergeYearlyTotals,
} from '../data/aggregates.js';
import { parseMinFile } from '../data/min-file.js';
import { fetchFromBothSources } from '../data/data-source.js';

const LIVE_REFRESH_MS = 5 * 60 * 1000;

function todayParams() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function sumWh(perInverter) {
  return Object.values(perInverter).reduce((s, v) => s + (v.yieldWh ?? v), 0);
}

function widget(titleKey, value, href) {
  return `<div class="widget">
    <a href="${href}">
      <p class="widget__title">${t(titleKey)}</p>
      <p><span class="widget__value">${value}</span></p>
    </a>
  </div>`;
}

function todayDdMmYy() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getFullYear()).slice(-2)}`;
}

async function refreshCurrentProduction(valueEl) {
  const result = await fetchText('data/min_cur.js');
  if (!result.ok) return;
  const trace = parseMinFile(result.text, todayDdMmYy());
  const [reading] = trace.readings;
  if (!reading) return;
  const totalPacW = Object.values(reading.perInverter).reduce((s, inv) => s + inv.pacW, 0);
  valueEl.textContent = totalPacW === 0 ? t('widget.notProducing') : `${totalPacW} W`;
}

/**
 * Mounts the dashboard: all summary widgets (current production + 4 totals) at once,
 * each linking to its detail view (SC-003: dashboard-to-any-chart in <=2 interactions).
 * Current production auto-refreshes every 5 minutes from min_cur.js (FR-016, SC-005).
 * @param {HTMLElement} container
 * @param {{ plant: object | null }} ctx
 * @returns {() => void} Cleanup function that stops the live-refresh interval.
 */
export async function render(container) {
  const { year, month, day } = todayParams();
  const dayHref = formatRoute({ view: 'day', params: { year, month, day } });
  const monthHref = formatRoute({ view: 'month', params: { year, month } });
  const yearHref = formatRoute({ view: 'year', params: { year } });
  const totalHref = formatRoute({ view: 'total', params: {} });

  container.innerHTML = `
    <h2 class="view-title">${t('nav.dashboard')}</h2>
    <div class="widget-grid" id="widget-grid">
      ${widget('widget.currentProduction', '—', dayHref)}
      ${widget('widget.todayYield', '—', dayHref)}
      ${widget('widget.monthYield', '—', monthHref)}
      ${widget('widget.yearYield', '—', yearHref)}
      ${widget('widget.totalYield', '—', totalHref)}
    </div>
  `;

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const grid = container.querySelector('#widget-grid');
  const values = grid.querySelectorAll('.widget__value');

  refreshCurrentProduction(values[0]);
  const intervalId = setInterval(() => refreshCurrentProduction(values[0]), LIVE_REFRESH_MS);

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

  if (daysResult.ok) {
    const [today] = parseDailyTotalsFile(daysResult.text);
    if (today) values[1].textContent = `${(sumWh(today.perInverter) / 1000).toFixed(1)} kWh`;
  }
  const thisMonth = months.find((m) => m.month === monthKey);
  if (thisMonth) values[2].textContent = `${(sumWh(thisMonth.perInverter) / 1000).toFixed(1)} kWh`;

  const thisYear = years.find((y) => y.year === year);
  if (thisYear) values[3].textContent = `${(sumWh(thisYear.perInverter) / 1000).toFixed(1)} kWh`;
  const totalWh = years.reduce((s, y) => s + sumWh(y.perInverter), 0);
  values[4].textContent = `${(totalWh / 1000).toFixed(1)} kWh`;

  return () => clearInterval(intervalId);
}
