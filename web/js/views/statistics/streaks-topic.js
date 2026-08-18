/**
 * Streaks topic (022-statistics-page, FR-006): a pair of longest-run cards — the longest run of
 * consecutive recorded days each yielding at least STREAK_HIGH_THRESHOLD_KWH ("high-yield"), and
 * the longest run each yielding under STREAK_LOW_THRESHOLD_KWH ("low-yield") — each with an
 * "ongoing" badge when the run is still active (spec.md Edge Cases), a strip of the streak's own
 * days (plus a couple of days of context on each side) to hover over, and a legend explaining
 * what the strip's cells mean.
 */

import { t, getLanguage } from '../../i18n.js';
import { formatKwh, formatDate } from '../../format.js';
import {
  computeLongestHighStreak,
  computeLongestLowStreak,
  hasEnoughHistory,
  sumDailyKwh,
  excludeBackfilledDays,
  STREAK_HIGH_THRESHOLD_KWH,
  STREAK_LOW_THRESHOLD_KWH,
} from '../../data/statistics.js';
import { isBackfilledDate, BACKFILLED_DATES } from '../../data/backfilled-data.js';
import { formatRoute } from '../../router.js';
import { insufficientHistoryMarkup } from './statistics-view.js';

// Both the tooltip and the card's threshold display round to 2 decimals, but a day's exact yield
// can still sit right at a boundary (e.g. 19.998 kWh vs. the 20 kWh threshold) — keeping the
// tooltip's own constant (rather than reusing the threshold's) makes room to show more precision
// there if that boundary case ever needs it, without touching the threshold display.
const TOOLTIP_KWH_DECIMALS = 2;

// Days of unhighlighted context shown on each side of the streak, so the strip reads as "this run,
// within its surroundings" rather than an arbitrary trailing window of the last N calendar days.
const STREAK_STRIP_CONTEXT_DAYS = 2;

function isoDate(dateIso) {
  return formatDate(new Date(`${dateIso}T00:00:00`), { lang: getLanguage() });
}

function addDaysIso(dateIso, delta) {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** @param {string} dateIso @returns {string} href for that date's day view, e.g. '#/day/2026/05/16'. */
function dayHref(dateIso) {
  const [year, month, day] = dateIso.split('-').map(Number);
  return formatRoute({ view: 'day', params: { year, month, day } });
}

/** Maps each recorded date to its daily kWh yield, for the strip's per-day tooltips. */
function buildDailyKwhByDate(fullDailyHistory) {
  return new Map(fullDailyHistory.map((d) => [d.date, sumDailyKwh(d.perInverter)]));
}

function dayCellTitle(date, dailyKwhByDate) {
  const dateLabel = isoDate(date);
  const kwh = dailyKwhByDate.get(date);
  if (kwh === undefined) return `${dateLabel}: ${t('statistics.heatmaps.legendMissing')}`;
  const value = formatKwh(kwh, { decimals: TOOLTIP_KWH_DECIMALS });
  return isBackfilledDate(date)
    ? `${dateLabel}: ${value} (${t('statistics.heatmaps.legendBackfilled')})`
    : `${dateLabel}: ${value}`;
}

/**
 * A horizontal strip spanning the streak's own days plus STREAK_STRIP_CONTEXT_DAYS of context on
 * each side, with the days that fall inside the streak highlighted and every cell hoverable (via
 * the `title` tooltip, showing its date and exact daily yield) and clickable through to that
 * day's detail view.
 */
function streakDaysStripMarkup(streak, dailyKwhByDate) {
  const from = addDaysIso(streak.startDate, -STREAK_STRIP_CONTEXT_DAYS);
  const to = addDaysIso(streak.endDate, STREAK_STRIP_CONTEXT_DAYS);
  const cells = [];
  for (let date = from; date <= to; date = addDaysIso(date, 1)) {
    const inStreak = date >= streak.startDate && date <= streak.endDate;
    const title = dayCellTitle(date, dailyKwhByDate);
    cells.push(
      `<a class="day${inStreak ? ' in-streak' : ''}" href="${dayHref(date)}" title="${title}"></a>`,
    );
  }
  return `<div class="streak-strip">${cells.join('')}</div>`;
}

/**
 * Explains what the strip's two cell colors mean, since a bare row of gray/colored squares reads
 * as decoration without it (the swatch colors are set via inline style so they always match the
 * `.streak-card--*` modifier's accent, see .streak-strip .day.in-streak in app.css).
 */
function stripLegendMarkup(qualifyingLabel, nonQualifyingLabel) {
  return `<div class="streak-legend">
    <span class="legend-item"><span class="swatch in-streak"></span>${qualifyingLabel}</span>
    <span class="legend-item"><span class="swatch"></span>${nonQualifyingLabel}</span>
  </div>`;
}

/**
 * Renders one streak card (high- or low-yield) given its computed streak, the date→kWh lookup for
 * the strip's tooltips, and its copy.
 * @param {{ modifierClass: string, titleKey: string, introKey: string, thresholdLabel: string,
 *   qualifyingLabel: string, nonQualifyingLabel: string }} copy
 */
function streakBlockMarkup(streak, dailyKwhByDate, copy) {
  const ongoingBadge = streak?.isOngoing
    ? `<span class="ongoing-badge">● ${t('statistics.streaks.ongoing')}</span>`
    : '';

  return `<div class="streak-block ${copy.modifierClass}">
    <h4>${t(copy.titleKey)}</h4>
    <p class="topic-intro">${t(copy.introKey)}</p>
    <div class="streak-card">
      <div class="streak-number">${streak ? streak.lengthDays : 0}</div>
      <div class="streak-detail">
        <h4>${t('statistics.streaks.lengthLabel')}${ongoingBadge}</h4>
        <p>${t('statistics.streaks.thresholdLabel')}: ${copy.thresholdLabel}</p>
        ${
          streak
            ? `<p>${t('statistics.streaks.dateRange')}: ${isoDate(streak.startDate)} – ${isoDate(streak.endDate)}</p>`
            : ''
        }
      </div>
    </div>
    ${streak ? streakDaysStripMarkup(streak, dailyKwhByDate) : ''}
    ${streak ? stripLegendMarkup(copy.qualifyingLabel, copy.nonQualifyingLabel) : ''}
  </div>`;
}

/**
 * @param {HTMLElement} container - The `.stats-content` mount point.
 * @param {{ fullDailyHistory: object[], fullYearlyHistory: object[] }} data
 */
export function render(container, { fullDailyHistory, fullYearlyHistory }) {
  if (!hasEnoughHistory(fullDailyHistory, fullYearlyHistory, 'streaks')) {
    container.innerHTML = `<section>
      <h2>${t('statistics.streaks.title')}</h2>
      ${insufficientHistoryMarkup()}
    </section>`;
    return;
  }

  // Backfilled days (see backfilled-data.js) are excluded from the streak runs themselves - a
  // reconstructed day correctly breaks a run instead of extending it on data nobody measured -
  // but stay in dailyKwhByDate below so a backfilled day inside the strip's context window still
  // shows its real (flagged) value rather than reading as "no data".
  const reliableDailyHistory = excludeBackfilledDays(fullDailyHistory);
  const highStreak = computeLongestHighStreak(reliableDailyHistory);
  const lowStreak = computeLongestLowStreak(reliableDailyHistory);
  const highThresholdLabel = formatKwh(STREAK_HIGH_THRESHOLD_KWH, { decimals: 2 });
  const lowThresholdLabel = formatKwh(STREAK_LOW_THRESHOLD_KWH, { decimals: 2 });
  const dailyKwhByDate = buildDailyKwhByDate(fullDailyHistory);

  const highBlock = streakBlockMarkup(highStreak, dailyKwhByDate, {
    modifierClass: 'streak-card--high',
    titleKey: 'statistics.streaks.highTitle',
    introKey: 'statistics.streaks.highIntro',
    thresholdLabel: `≥ ${highThresholdLabel}`,
    qualifyingLabel: `≥ ${highThresholdLabel}`,
    nonQualifyingLabel: `< ${highThresholdLabel}`,
  });

  const lowBlock = streakBlockMarkup(lowStreak, dailyKwhByDate, {
    modifierClass: 'streak-card--low',
    titleKey: 'statistics.streaks.lowTitle',
    introKey: 'statistics.streaks.lowIntro',
    thresholdLabel: `< ${lowThresholdLabel}`,
    qualifyingLabel: `< ${lowThresholdLabel}`,
    nonQualifyingLabel: `≥ ${lowThresholdLabel}`,
  });

  // Only worth mentioning when there's actually something excluded from the runs above.
  const backfilledNote =
    BACKFILLED_DATES.size > 0
      ? `<p class="topic-note text-sm text-text-muted">${t('statistics.streaks.backfilledNote')}</p>`
      : '';

  container.innerHTML = `<section>
    <h2>${t('statistics.streaks.title')}</h2>
    <p class="topic-intro">${t('statistics.streaks.intro')}</p>
    ${backfilledNote}
    ${highBlock}
    ${lowBlock}
  </section>`;
}
