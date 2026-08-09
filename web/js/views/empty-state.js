import { t } from '../i18n.js';

/**
 * Renders just the FR-009 empty/placeholder message, without a heading — for views (e.g. the
 * day view) that keep their own title/nav header visible and only swap out the chart area.
 * @param {string} messageKey - i18n key for the "no data" message (e.g. "day.noData").
 * @returns {string} HTML markup to assign to the chart container's `innerHTML`.
 */
export function emptyStateBody(messageKey) {
  return `<p class="empty-state rounded-lg bg-bg-elevated p-lg text-center text-text-muted">${t(messageKey)}</p>`;
}

/**
 * Renders the shared FR-009 empty/placeholder state used by day/month/year/total/compare views
 * when no data is available for the routed period — never a blank page or console error.
 * @param {string} titleText - Already-resolved view heading (e.g. "Tageswerte — 01.01.2099").
 * @param {string} messageKey - i18n key for the "no data" message (e.g. "day.noData").
 * @returns {string} HTML markup to assign to the view container's `innerHTML`.
 */
export function emptyStateMarkup(titleText, messageKey) {
  return `<h2 class="view-title text-lg mb-md">${titleText}</h2>
    ${emptyStateBody(messageKey)}`;
}
