/**
 * Streaks topic (022-statistics-page, FR-006): the longest run of consecutive recorded days each
 * yielding at least STREAK_THRESHOLD_KWH, with an "ongoing" badge when the run is still active
 * (spec.md Edge Cases), plus a compact recent-days strip.
 */

import { t, getLanguage } from '../../i18n.js';
import { formatKwh, formatDate } from '../../format.js';
import {
  computeLongestStreak,
  hasEnoughHistory,
  STREAK_THRESHOLD_KWH,
} from '../../data/statistics.js';
import { insufficientHistoryMarkup } from './statistics-view.js';

const RECENT_DAYS_STRIP_LENGTH = 30;

function isoDate(dateIso) {
  return formatDate(new Date(`${dateIso}T00:00:00`), { lang: getLanguage() });
}

function addDaysIso(dateIso, delta) {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/**
 * A horizontal strip of the last RECENT_DAYS_STRIP_LENGTH calendar days ending at the most
 * recent recorded date, with the days that fall inside the streak highlighted.
 */
function recentDaysStripMarkup(streak, fullDailyHistory) {
  const mostRecentDate = fullDailyHistory.reduce(
    (max, d) => (d.date > max ? d.date : max),
    fullDailyHistory[0]?.date ?? '',
  );
  const days = Array.from({ length: RECENT_DAYS_STRIP_LENGTH }, (_, i) =>
    addDaysIso(mostRecentDate, i - (RECENT_DAYS_STRIP_LENGTH - 1)),
  );
  const cells = days
    .map((date) => {
      const inStreak = date >= streak.startDate && date <= streak.endDate;
      return `<span class="day${inStreak ? ' in-streak' : ''}" title="${isoDate(date)}"></span>`;
    })
    .join('');
  return `<div class="streak-strip">${cells}</div>`;
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

  const streak = computeLongestStreak(fullDailyHistory);
  const ongoingBadge = streak?.isOngoing
    ? `<span class="ongoing-badge">● ${t('statistics.streaks.ongoing')}</span>`
    : '';

  container.innerHTML = `<section>
    <h2>${t('statistics.streaks.title')}</h2>
    <p class="topic-intro">${t('statistics.streaks.intro')}</p>
    <div class="streak-card">
      <div class="streak-number">${streak ? streak.lengthDays : 0}</div>
      <div class="streak-detail">
        <h3>${t('statistics.streaks.lengthLabel')}${ongoingBadge}</h3>
        <p>${t('statistics.streaks.thresholdLabel')}: ${formatKwh(STREAK_THRESHOLD_KWH)}</p>
        ${
          streak
            ? `<p>${t('statistics.streaks.dateRange')}: ${isoDate(streak.startDate)} – ${isoDate(streak.endDate)}</p>`
            : ''
        }
      </div>
    </div>
    ${streak ? recentDaysStripMarkup(streak, fullDailyHistory) : ''}
  </section>`;
}
