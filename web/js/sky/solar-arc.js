/**
 * @file Computes a simplified, non-astronomical sun/moon arc position from sunrise/sunset/
 * next-sunrise timestamps (part of the same Open-Meteo response as the weather condition).
 * Pure function of `(now, sunrise, sunset, nextSunrise)` — no hidden state, no trigonometry.
 * See research.md §2 and data-model.md §Solar Time State.
 */

/** How far either side of sunrise/sunset the sun/moon crossfade window extends. */
const CROSSFADE_WINDOW_MS = 5 * 60 * 1000;

/**
 * @param {number} progress - 0 (rise) to 1 (set).
 * @returns {number} 0 (top of the sky band) to 100 (horizon), peaking at `progress === 0.5`.
 */
function arcYPercent(progress) {
  return 100 - 100 * (1 - (2 * progress - 1) ** 2);
}

/**
 * @param {number} distanceMs - Distance in ms from the nearest sunrise/sunset boundary.
 * @returns {number} 0 (outside the window) to 1 (exactly at the boundary).
 */
function crossfadeFromDistance(distanceMs) {
  if (distanceMs >= CROSSFADE_WINDOW_MS) return 0;
  return 1 - distanceMs / CROSSFADE_WINDOW_MS;
}

/**
 * Computes where the sun or moon should render in the sky right now.
 * @param {Date} now
 * @param {string | Date} sunrise - Today's sunrise.
 * @param {string | Date} sunset - Today's sunset.
 * @param {string | Date} nextSunrise - Tomorrow's sunrise (bounds the night-time arc).
 * @returns {{ body: 'sun' | 'moon', xPercent: number, yPercent: number, crossfade: number }}
 */
export function computeSkyBodyPosition(now, sunrise, sunset, nextSunrise) {
  const nowMs = now.getTime();
  const sunriseMs = new Date(sunrise).getTime();
  const sunsetMs = new Date(sunset).getTime();
  const nextSunriseMs = new Date(nextSunrise).getTime();

  const isDaytime = nowMs >= sunriseMs && nowMs < sunsetMs;
  const [rangeStart, rangeEnd] = isDaytime ? [sunriseMs, sunsetMs] : [sunsetMs, nextSunriseMs];
  const progress = (nowMs - rangeStart) / (rangeEnd - rangeStart);

  const distanceToBoundary = Math.min(Math.abs(nowMs - sunriseMs), Math.abs(nowMs - sunsetMs));

  return {
    body: isDaytime ? 'sun' : 'moon',
    xPercent: progress * 100,
    yPercent: arcYPercent(progress),
    crossfade: crossfadeFromDistance(distanceToBoundary),
  };
}
