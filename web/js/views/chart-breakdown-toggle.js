import { t } from '../i18n.js';
import { getChartBreakdownMode, setChartBreakdownMode } from '../settings.js';

/**
 * Markup for the "Gesamt" / per-inverter breakdown toggle shown above the month/year/total bar
 * charts (not the day chart, which uses ApexCharts' own legend-click toggling for its UDC
 * series instead — see chart-factory.js's buildDayOptions). Two mutually-exclusive buttons
 * (mirrors the header's `.lang-switcher` pattern) rather than a checkbox, since there are exactly
 * two named states, not an on/off flag.
 * @returns {string}
 */
export function chartBreakdownToggleMarkup() {
  return `<div
    class="chart-breakdown-toggle flex gap-xs mb-sm"
    role="group"
    aria-label="${t('chart.breakdownToggleLabel')}"
  >
    <button type="button" data-breakdown="total">${t('chart.breakdownTotal')}</button>
    <button type="button" data-breakdown="inverters">${t('chart.breakdownInverters')}</button>
  </div>`;
}

/**
 * Wires the breakdown toggle rendered by `chartBreakdownToggleMarkup()` inside `container`:
 * syncs both buttons' `aria-pressed` state with the persisted selection (see
 * settings.js's getChartBreakdownMode), and on click persists the new selection and calls
 * `onChange(mode)` so the caller can re-render its chart in place — no page navigation/reload.
 * @param {HTMLElement} container - Element containing the toggle markup (e.g. `.chart-container`).
 * @param {(mode: 'total' | 'inverters') => void} onChange
 * @returns {void}
 */
export function initChartBreakdownToggle(container, onChange) {
  const buttons = container.querySelectorAll('.chart-breakdown-toggle button');

  function sync() {
    const mode = getChartBreakdownMode();
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.breakdown === mode));
    });
  }

  sync();
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.breakdown;
      if (mode === getChartBreakdownMode()) return;
      setChartBreakdownMode(mode);
      sync();
      onChange(mode);
    });
  });
}
