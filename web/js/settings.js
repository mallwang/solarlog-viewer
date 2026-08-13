const STORAGE_KEY = 'solarlog-transparency';

/** @returns {boolean} Persisted transparency-mode selection (localStorage) or `false` default. */
export function isTransparencyEnabled() {
  return window.localStorage.getItem(STORAGE_KEY) === 'true';
}

/**
 * Persists the transparency-mode selection and applies it to the document immediately.
 * @param {boolean} enabled
 * @returns {void}
 */
export function setTransparencyEnabled(enabled) {
  window.localStorage.setItem(STORAGE_KEY, String(enabled));
  applyTransparencyMode(enabled);
}

/** Applies the persisted/default transparency-mode selection to the document. Call once on bootstrap. */
export function initTransparencyMode() {
  applyTransparencyMode(isTransparencyEnabled());
}

function applyTransparencyMode(enabled) {
  document.documentElement.setAttribute('data-transparency', enabled ? 'on' : 'off');
}

const CHART_BREAKDOWN_KEY = 'solarlog-chart-breakdown';

/**
 * Persisted selection for the month/year/total bar charts' breakdown toggle (see
 * views/chart-breakdown-toggle.js) — whether they show a single "Gesamt" bar per period or one
 * stacked segment per inverter string. Defaults to `'total'` so the charts open exactly as they
 * did before this toggle existed; any stored value other than `'inverters'` (including none)
 * falls back to that default.
 * @returns {'total' | 'inverters'}
 */
export function getChartBreakdownMode() {
  return window.localStorage.getItem(CHART_BREAKDOWN_KEY) === 'inverters' ? 'inverters' : 'total';
}

/**
 * Persists the bar-chart breakdown selection so it's remembered on the next visit.
 * @param {'total' | 'inverters'} mode
 * @returns {void}
 */
export function setChartBreakdownMode(mode) {
  window.localStorage.setItem(CHART_BREAKDOWN_KEY, mode);
}

const DAY_UDC_VISIBLE_KEY = 'solarlog-day-udc-visible';

/**
 * Persisted selection for the day chart's UDC legend toggle (see `charts/chart-factory.js`'s
 * `renderChart`) — whether the UDC line stays revealed across visits. Defaults to `false` (UDC
 * starts hidden) so a day chart with no persisted choice yet renders exactly as it did before
 * this setting existed; any stored value other than `'true'` (including none) falls back to that
 * default.
 * @returns {boolean}
 */
export function isDayUdcVisible() {
  return window.localStorage.getItem(DAY_UDC_VISIBLE_KEY) === 'true';
}

/**
 * Persists the day chart's current UDC visibility so it's restored on the next day chart render.
 * @param {boolean} visible
 * @returns {void}
 */
export function setDayUdcVisible(visible) {
  window.localStorage.setItem(DAY_UDC_VISIBLE_KEY, String(visible));
}

const DAY_EFFICIENCY_VISIBLE_KEY = 'solarlog-day-efficiency-visible';

/**
 * Persisted selection for the day chart's Wirkungsgrad (efficiency) legend toggle (see
 * `charts/chart-factory.js`'s `renderChart`) — whether the efficiency line stays shown across
 * visits. Defaults to `true` (shown) so a day chart with no persisted choice yet renders exactly
 * as it did before this setting existed; any stored value other than `'false'` (including none)
 * falls back to that default — the inverse default of `isDayUdcVisible`, which starts hidden.
 * @returns {boolean}
 */
export function isDayEfficiencyVisible() {
  return window.localStorage.getItem(DAY_EFFICIENCY_VISIBLE_KEY) !== 'false';
}

/**
 * Persists the day chart's current Wirkungsgrad visibility so it's restored on the next day
 * chart render.
 * @param {boolean} visible
 * @returns {void}
 */
export function setDayEfficiencyVisible(visible) {
  window.localStorage.setItem(DAY_EFFICIENCY_VISIBLE_KEY, String(visible));
}

const CHART_TABLE_KEY = 'solarlog-chart-table';

/**
 * Persisted app-wide selection for the "show as table" toggle (see
 * views/chart-table-toggle.js) — whether every chart across the app also renders a condensed
 * data table below it. Defaults to `false` (hidden) so a first visit with no stored preference
 * renders exactly as it did before this toggle existed; any stored value other than `'true'`
 * (including none) falls back to that default. If `localStorage` is unavailable (e.g. private
 * browsing), this catches and returns the same default rather than throwing (FR-009) — the
 * toggle module keeps its own in-memory fallback for that case, not this function.
 * @returns {boolean}
 */
export function isChartTableVisible() {
  try {
    return window.localStorage.getItem(CHART_TABLE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Persists the chart-data-table visibility selection, app-wide, so every chart (current page and
 * any visited afterward) reflects the same choice. No-ops without throwing if `localStorage` is
 * unavailable (FR-009).
 * @param {boolean} visible
 * @returns {void}
 */
export function setChartTableVisible(visible) {
  try {
    window.localStorage.setItem(CHART_TABLE_KEY, String(visible));
  } catch {
    // localStorage unavailable (e.g. private browsing) — the current page's toggle still works
    // via chart-table-toggle.js's in-memory fallback; only cross-page/reload persistence is lost.
  }
}
