/**
 * @file Maps a raw cloud-cover percentage to a discrete density tier and the per-tier render
 * config (`.cloud` opacity/animation speed and how many of the six existing cloud elements
 * stay visible) used by `sky-controller.js` to drive the `.sky-clouds` backdrop. Pure logic,
 * no DOM access — see research.md §4 and data-model.md §Weather Condition.
 */

/** Cloud-cover percentage below which the sky is considered clear (FR-003). */
const CLEAR_MAX_PERCENT = 20;
/** Cloud-cover percentage above which the sky is considered overcast (FR-003). */
const OVERCAST_MIN_PERCENT = 70;

/**
 * Derives a discrete cloud-density tier from a raw cloud-cover percentage.
 * `<20 → clear`, `20–70 → partly`, `>70 → overcast`.
 * @param {number} cloudCoverPercent - 0–100.
 * @returns {'clear' | 'partly' | 'overcast'}
 */
export function cloudCoverToTier(cloudCoverPercent) {
  if (cloudCoverPercent < CLEAR_MAX_PERCENT) return 'clear';
  if (cloudCoverPercent > OVERCAST_MIN_PERCENT) return 'overcast';
  return 'partly';
}

/**
 * Per-tier render config for the six existing `.cloud` elements: `opacity` and
 * `animationDuration` are applied via CSS (see `[data-cloud-density]` rules in app.css);
 * `visibleCount` is how many of the six elements `sky-controller.js` should keep visible
 * (the rest get `hidden` set) so the `clear` tier renders visibly sparser.
 * @type {Record<'clear' | 'partly' | 'overcast', { opacity: number, animationDurationScale: number, visibleCount: number }>}
 */
export const CLOUD_TIER_RENDER_CONFIG = {
  clear: { opacity: 0.35, animationDurationScale: 0.85, visibleCount: 2 },
  partly: { opacity: 0.7, animationDurationScale: 1, visibleCount: 4 },
  overcast: { opacity: 0.95, animationDurationScale: 1.3, visibleCount: 6 },
};
