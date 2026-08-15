import { t } from '../i18n.js';
import { chartBreakdownToggleMarkup } from './chart-breakdown-toggle.js';
import { chartTableToggleMarkup } from './chart-table-toggle.js';
import { isChartTableVisible } from '../settings.js';

// Monotonic counter backing each info-trigger/tooltip pair's generated DOM id, so
// aria-describedby never collides even when the same explanationKey is reused across different
// panels (e.g. day view's "Soll" and month view's "Soll" both resolve explanations.soll — see
// data-model.md's Stats row tuple / contracts/info-tooltip.md).
let infoTooltipIdCounter = 0;

/**
 * Builds the info button + tooltip markup for a stats row that opted into an explanation.
 * @param {string} explanationKey - i18n key under `explanations.*` (see data-model.md).
 * @returns {string} HTML for a `.info-trigger` button, to be placed inside `.stat-label`.
 */
function infoTooltipMarkup(explanationKey) {
  infoTooltipIdCounter += 1;
  const id = `info-tooltip-${infoTooltipIdCounter}`;
  return `<button type="button" class="info-trigger" aria-describedby="${id}">i<span class="info-tooltip" id="${id}" role="tooltip">${t(explanationKey)}</span></button>`;
}

/**
 * Splits a formatted stat value into a bold primary line plus an optional smaller, muted second
 * line for a parenthetical detail (e.g. "38,0 kWh" + "(12. Juni)") — used by rows whose value
 * includes a "(day/month/year)" qualifier (day/month/year/total-view's maxDaily/maxMonth/
 * maxYear rows). Putting the detail on its own line keeps the primary number from ever having to
 * wrap mid-unit inside the value column's fixed width (see the `.summary-table` width contract).
 * @param {string} primary - The main formatted value, e.g. "38,0 kWh".
 * @param {string} [detail] - An optional parenthetical qualifier, e.g. "(12. Juni)". Omit (or
 *   pass a falsy value) to render just `primary`, unchanged.
 * @returns {string} HTML for the `<td>`'s content.
 */
export function statValueMarkup(primary, detail) {
  if (!detail) return primary;
  return `${primary}<span class="stat-value-detail">${detail}</span>`;
}

/**
 * @param {string} labelKey - i18n key for the stat's label.
 * @param {string} value - Pre-formatted display value.
 * @param {string} [explanationKey] - i18n key under `explanations.*` (see data-model.md). When
 *   given, renders a focusable info button + tooltip next to the label; when omitted, renders
 *   exactly as before this feature (no markup change, no layout footprint).
 * @returns {string} HTML for one `<tr>`.
 */
function statsRow(labelKey, value, explanationKey) {
  // Label text lives in its own `.stat-label-text` span (rather than a plain text node) so its
  // own ellipsis-truncation CSS can target just the text, not the `<th>` as a whole — a `<th>`
  // wide enough to clip its own overflow would also clip the `.info-trigger`'s absolutely
  // positioned `.info-tooltip` descendant, hiding the tooltip on hover/focus entirely.
  const label = `<span class="stat-label-text">${t(labelKey)}</span>`;
  if (!explanationKey) {
    return `<tr><th>${label}</th><td>${value}</td></tr>`;
  }
  return `<tr><th><span class="stat-label">${label}${infoTooltipMarkup(explanationKey)}</span></th><td>${value}</td></tr>`;
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
 * @param {([string, string] | [string, string, string])[]} rows - [labelKey, value] pairs, or
 *   [labelKey, value, explanationKey] triples to opt a row into an info tooltip (see
 *   contracts/info-tooltip.md), in display order.
 * @returns {string}
 */
export function statsPanelMarkup(titleKey, rows) {
  return `<div class="stats-panel w-full mt-lg lg:flex-[3] bg-bg-elevated rounded-lg p-md box-border">
    <h3 class="text-base font-semibold m-0 mb-sm">${t(titleKey)}</h3>
    <table class="summary-table w-full border-collapse">
      <tbody>
        ${rows.map(([labelKey, value, explanationKey]) => statsRow(labelKey, value, explanationKey)).join('')}
      </tbody>
    </table>
  </div>`;
}

/**
 * Wires the one shared edge-flip behavior for every `.info-trigger` on the page (present or
 * future — delegated at the document level, so it needs no re-wiring when a view's `innerHTML`
 * is replaced on route change). Call once, at app startup (see contracts/info-tooltip.md).
 *
 * On `focusin`/`pointerenter` of an `.info-trigger`, measures whether its tooltip (about to
 * become visible via CSS) would overflow the viewport's right edge and toggles
 * `.info-trigger--flip` accordingly (FR-007).
 * @returns {void}
 */
export function initInfoTooltips() {
  const maybeFlip = (event) => {
    const trigger = event.target.closest?.('.info-trigger');
    if (!trigger) return;
    const tooltip = trigger.querySelector('.info-tooltip');
    if (!tooltip) return;
    // .info-tooltip is centered on the trigger by default (transform: translateX(-50%)); estimate
    // its projected right edge from the trigger's own center plus half the tooltip's width, since
    // getBoundingClientRect() on a not-yet-visible (opacity: 0, but not display: none) element
    // still reports its laid-out box.
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const projectedRight = triggerRect.left + triggerRect.width / 2 + tooltipRect.width / 2;
    trigger.classList.toggle('info-trigger--flip', projectedRight > window.innerWidth);
  };
  document.addEventListener('focusin', maybeFlip);
  document.addEventListener('pointerenter', maybeFlip, true);
}
