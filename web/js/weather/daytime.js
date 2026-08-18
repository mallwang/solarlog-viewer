/**
 * @file Pure day/night boundary check for the current-conditions line's nighttime "sunny"→
 * "clear" override (research.md §5, data-model.md §Nighttime Clear Display). Deliberately
 * mirrors — rather than imports — `sky/solar-arc.js`'s own sunrise/sunset comparison: that
 * module computes full arc-position data (x/y percent, crossfade) this feature doesn't need and
 * lives in the `sky/` feature directory, not `weather/`. Only today's sunrise/sunset are needed
 * here (no `nextSunrise`) — see research.md §5 for why that's sufficient.
 */

/**
 * @param {Date} now
 * @param {string | undefined} sunriseIso - Today's sunrise (ISO timestamp), or missing.
 * @param {string | undefined} sunsetIso - Today's sunset (ISO timestamp), or missing.
 * @returns {boolean} `true` if `now` falls within `[sunrise, sunset)`. Returns `true` (the safer
 *   default, FR-013 — never assume nighttime without proof) when `sunriseIso`/`sunsetIso` are
 *   missing or unparseable.
 */
export function isDaytime(now, sunriseIso, sunsetIso) {
  const sunriseMs = sunriseIso === undefined ? Number.NaN : new Date(sunriseIso).getTime();
  const sunsetMs = sunsetIso === undefined ? Number.NaN : new Date(sunsetIso).getTime();
  if (!Number.isFinite(sunriseMs) || !Number.isFinite(sunsetMs)) return true;

  const nowMs = now.getTime();
  return nowMs >= sunriseMs && nowMs < sunsetMs;
}
