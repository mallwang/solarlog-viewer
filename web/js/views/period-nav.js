import { icon } from '../icons.js';

/**
 * Shared prev/next date-stepping helpers for the day and month views (FR: period navigation).
 * All arithmetic goes through UTC-anchored Date objects so month/year rollovers (e.g.
 * 31.08 -> 01.09, Dec -> Jan) are handled by the platform instead of by hand.
 */

/**
 * @param {{ year: number, month: number, day: number }} params
 * @param {number} delta - Whole days to add (negative to go back).
 * @returns {{ year: number, month: number, day: number }}
 */
export function addDays({ year, month, day }, delta) {
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * @param {{ year: number, month: number }} params
 * @param {number} delta - Whole months to add (negative to go back).
 * @returns {{ year: number, month: number }}
 */
export function addMonths({ year, month }, delta) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** @param {{ year: number, month: number, day: number }} params @returns {boolean} True if params names a date after today. */
export function isFutureDay({ year, month, day }) {
  const now = new Date();
  const key = (y, m, d) => y * 10000 + m * 100 + d;
  return key(year, month, day) > key(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** @param {{ year: number, month: number }} params @returns {boolean} True if params names a month after the current one. */
export function isFutureMonth({ year, month }) {
  const now = new Date();
  const key = (y, m) => y * 100 + m;
  return key(year, month) > key(now.getFullYear(), now.getMonth() + 1);
}

/**
 * @param {{ year: number }} params
 * @param {number} delta - Whole years to add (negative to go back).
 * @returns {{ year: number }}
 */
export function addYears({ year }, delta) {
  return { year: year + delta };
}

/** @param {{ year: number }} params @returns {boolean} True if params names a year after the current one. */
export function isFutureYear({ year }) {
  return year > new Date().getFullYear();
}

/** @param {{ year: number, month: number, day: number }} params @returns {{ year: number, month: number }} The month containing that day. */
export function parentOfDay({ year, month }) {
  return { year, month };
}

/** @param {{ year: number, month: number }} params @returns {{ year: number }} The year containing that month. */
export function parentOfMonth({ year }) {
  return { year };
}

/** @param {{ year: number }} params @returns {{}} The (empty) params for the total view, the year's parent. */
export function parentOfYear() {
  return {};
}

/**
 * Wraps a label in two responsive spans so narrow (below md:) viewports show a shorter generic
 * form (e.g. "Vorheriger") while md: and up show the full, period-specific form (e.g.
 * "Vorheriger Monat") — the noun is what makes these labels wrap onto two lines and go ragged
 * on mobile buttons; the arrow already carries the direction, and the period itself stays
 * visible in the view's own title above the nav. Falls back to `label` on both sizes when no
 * `shortLabel` is given, so callers that don't pass one keep today's single-length behavior.
 * @param {string} label - Full label, shown from md: up.
 * @param {string} [shortLabel] - Abbreviated label, shown below md:.
 * @returns {string} HTML markup for the two spans.
 */
function responsiveLabel(label, shortLabel) {
  return `<span class="hidden md:inline">${label}</span><span class="md:hidden">${shortLabel ?? label}</span>`;
}

/**
 * Renders the prev/next stepper row. `next` is omitted (rendered disabled) when `nextHref`
 * is null, so callers can't link into dates with no data yet (e.g. tomorrow). When `todayLabel`
 * is given, an extra "jump to current period" link (e.g. "Heute" / "Dieser Monat") is appended,
 * itself rendered disabled (like `next`) when `todayHref` is null — i.e. the routed period
 * already *is* the current one. When `parentLabel` is given, an extra "zoom out to parent
 * period" link (e.g. "Monat" / "Jahr" / "Gesamt") is appended, always enabled — a parent period
 * always exists, so unlike `todayHref`/`nextHref` there is no disabled state for it.
 * `prevShortLabel`/`nextShortLabel` are optional shorter forms (e.g. "Vorheriger" instead of
 * "Vorheriger Monat") shown below the md: breakpoint — see `responsiveLabel`.
 * @param {{ prevHref: string, prevLabel: string, prevShortLabel?: string,
 *   nextHref: string | null, nextLabel: string, nextShortLabel?: string,
 *   todayHref?: string | null, todayLabel?: string,
 *   parentHref?: string, parentLabel?: string }} opts
 * @returns {string} HTML markup.
 */
export function periodNavMarkup({
  prevHref,
  prevLabel,
  prevShortLabel,
  nextHref,
  nextLabel,
  nextShortLabel,
  todayHref,
  todayLabel,
  parentHref,
  parentLabel,
}) {
  // The arrow and label are separate text/element nodes, so the visible gap between them comes
  // from `.period-nav__link`'s `gap-xs` (a flex gap), not from any space character here — see
  // that class's comment for why an inline space wouldn't survive layout.
  const nextText = responsiveLabel(nextLabel, nextShortLabel);
  const forwardIcon = icon('forward');
  const backwardIcon = icon('backward');
  const nextMarkup = nextHref
    ? `<a class="period-nav__link" href="${nextHref}">${nextText}${forwardIcon}</a>`
    : `<span class="period-nav__link period-nav__link--disabled" aria-disabled="true">${nextText}${forwardIcon}</span>`;
  let todayMarkup = '';
  if (todayLabel) {
    todayMarkup = todayHref
      ? `<a class="period-nav__link period-nav__link--today" href="${todayHref}">${todayLabel}</a>`
      : `<span class="period-nav__link period-nav__link--today period-nav__link--disabled" aria-disabled="true">${todayLabel}</span>`;
  }
  const parentMarkup = parentLabel
    ? `<a class="period-nav__link period-nav__link--parent" href="${parentHref}">${parentLabel}</a>`
    : '';
  return `<nav class="period-nav flex items-center gap-sm" aria-label="${prevLabel} / ${nextLabel}">
    <a class="period-nav__link" href="${prevHref}">${backwardIcon}${responsiveLabel(prevLabel, prevShortLabel)}</a>
    ${nextMarkup}
    ${todayMarkup}
    ${parentMarkup}
  </nav>`;
}
