import { t } from '../i18n.js';
import { chartBreakdownToggleMarkup } from './chart-breakdown-toggle.js';
import { chartTableToggleMarkup } from './chart-table-toggle.js';
import { isChartTableVisible } from '../settings.js';

function statsRow(labelKey, value) {
  return `<tr><th>${t(labelKey)}</th><td>${value}</td></tr>`;
}

/**
 * Builds the flex wrapper shared by the day/month/year/total views: a chart-container (70% width
 * on large screens) plus room for a stats panel appended alongside it (see statsPanelMarkup).
 * Stacks to full-width, chart-then-panel on small screens.
 * @param {{ breakdownToggle?: boolean }} [opts] - `breakdownToggle: true` adds the "Gesamt" /
 *   per-inverter toggle (see chart-breakdown-toggle.js) above the chart-mount — used by the
 *   month/year/total bar-chart views and the day view's feed-in line (omitted there for
 *   backfilled/yield-only days, which have no per-inverter power data to break down).
 * @returns {string}
 */
export function chartWithStatsLayoutMarkup({ breakdownToggle = false } = {}) {
  // .chart-frame (not .chart-mount) is the flex item that actually absorbs/loses height to make
  // room for .chart-container__header (breakdown/table toggles) — ApexCharts resolves a
  // percentage `chart.height` against *.chart-mount's parent*, not .chart-mount itself (see
  // app.css's .chart-body comment), so .chart-mount must stay a plain `height: 100%` box whose
  // parent already has the correctly reduced, real (non-percentage) flex-resolved height.
  //
  // The `.chart-table` mount (feature 014) is always present — never omitted — so
  // initChartTableToggle's onChange always has somewhere to write on the very first click; its
  // `hidden` attribute is set directly from the persisted app-wide preference here (rather than
  // left for JS to apply after an async data fetch) so a chart whose table preference is already
  // "on" doesn't flash hidden-then-shown on load (FR-005).
  const tableHidden = isChartTableVisible() ? '' : 'hidden';
  return `<div class="period-layout flex flex-col gap-md lg:flex-row lg:items-start">
    <div class="chart-container lg:flex-[7]">
      <div class="chart-container__header flex items-center flex-wrap gap-sm mb-sm">
        ${breakdownToggle ? chartBreakdownToggleMarkup() : ''}
        ${chartTableToggleMarkup()}
      </div>
      <div class="chart-frame">
        <div class="chart-body"><div class="chart-mount"></div></div>
      </div>
      <div class="chart-table overflow-x-auto" ${tableHidden}></div>
    </div>
  </div>`;
}

/**
 * Builds a key/value stats table panel sized to sit at ~30% width beside a chart-container in a
 * chartWithStatsLayoutMarkup() row (mirrors chart-container's own top margin so both align).
 * @param {string} titleKey - i18n key for the panel heading.
 * @param {[string, string][]} rows - [labelKey, formatted value] pairs, in display order.
 * @returns {string}
 */
export function statsPanelMarkup(titleKey, rows) {
  return `<div class="stats-panel w-full mt-lg lg:flex-[3] bg-bg-elevated rounded-lg p-md box-border">
    <h3 class="text-base font-semibold m-0 mb-sm">${t(titleKey)}</h3>
    <table class="summary-table w-full border-collapse">
      <tbody>
        ${rows.map(([labelKey, value]) => statsRow(labelKey, value)).join('')}
      </tbody>
    </table>
  </div>`;
}
