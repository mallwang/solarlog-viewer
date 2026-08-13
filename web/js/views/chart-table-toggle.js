import { t } from '../i18n.js';
import { isChartTableVisible, setChartTableVisible } from '../settings.js';

/**
 * Markup for the "show as table" toggle button shown top-right of a chart-container (feature 014
 * — see contracts/chart-data-table.md). Mirrors chart-breakdown-toggle.js's markup shape but with
 * a single `<button aria-pressed>` instead of two mutually exclusive buttons, since this is one
 * on/off flag rather than a named-mode switch.
 * @returns {string}
 */
export function chartTableToggleMarkup() {
  return `<div class="chart-table-toggle">
    <button type="button" aria-pressed="false" aria-label="${t('chart.tableToggleLabel')}">
      ${t('chart.tableToggleOff')}
    </button>
  </div>`;
}

/**
 * Wires the toggle button rendered by chartTableToggleMarkup() inside `container`: syncs its
 * `aria-pressed` state (and label) with the persisted app-wide selection (settings.js's
 * isChartTableVisible), and on click persists the new selection and calls `onChange(visible)` so
 * the caller can show/hide its table in place — no page navigation/reload. `onChange` fires on
 * every click so every chart currently mounted on the page (e.g. a future multi-chart dashboard)
 * stays in sync with the one shared preference (FR-006), each via its own initChartTableToggle
 * call.
 * @param {HTMLElement} container - Element containing the toggle markup (e.g. `.chart-container`).
 * @param {(visible: boolean) => void} onChange
 * @returns {void}
 */
export function initChartTableToggle(container, onChange) {
  const button = container.querySelector('.chart-table-toggle button');
  if (!button) return;

  function sync() {
    const visible = isChartTableVisible();
    button.setAttribute('aria-pressed', String(visible));
    button.textContent = t(visible ? 'chart.tableToggleOn' : 'chart.tableToggleOff');
  }

  sync();
  button.addEventListener('click', () => {
    const visible = !isChartTableVisible();
    setChartTableVisible(visible);
    sync();
    onChange(visible);
  });
}
