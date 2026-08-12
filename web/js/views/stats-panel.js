import { t } from '../i18n.js';
import { chartBreakdownToggleMarkup } from './chart-breakdown-toggle.js';

function statsRow(labelKey, value) {
  return `<tr><th>${t(labelKey)}</th><td>${value}</td></tr>`;
}

/**
 * Builds the flex wrapper shared by the day/month/year/total views: a chart-container (70% width
 * on large screens) plus room for a stats panel appended alongside it (see statsPanelMarkup).
 * Stacks to full-width, chart-then-panel on small screens.
 * @param {{ breakdownToggle?: boolean }} [opts] - `breakdownToggle: true` adds the "Gesamt" /
 *   per-inverter toggle (see chart-breakdown-toggle.js) above the chart-mount — used by the
 *   month/year/total bar-chart views only, not the day view's line chart.
 * @returns {string}
 */
export function chartWithStatsLayoutMarkup({ breakdownToggle = false } = {}) {
  // .chart-body (not .chart-mount) is the flex item that actually absorbs/loses height to make
  // room for .chart-breakdown-toggle — ApexCharts resolves a percentage `chart.height` against
  // *.chart-mount's parent*, not .chart-mount itself (see app.css's .chart-body comment), so
  // .chart-mount must stay a plain `height: 100%` box whose parent already has the correctly
  // reduced, real (non-percentage) flex-resolved height.
  return `<div class="period-layout flex flex-col gap-md lg:flex-row lg:items-start">
    <div class="chart-container lg:flex-[7]">
      ${breakdownToggle ? chartBreakdownToggleMarkup() : ''}
      <div class="chart-body"><div class="chart-mount"></div></div>
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
