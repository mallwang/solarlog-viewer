/**
 * @file Maps a current production reading to a discrete production-animation intensity tier
 * consumed by `app.css`'s `--intensity` custom property (FR-009/FR-010, research.md §4).
 * Pure logic, no DOM access — see data-model.md's "Derivation → Production Animation
 * Intensity" and `info-panel-controller.js`, which calls this on every poll tick.
 */

/** Ratio (currentPacW / capacityW) at/above which the animation is considered at peak
 * activity — matches "typical peak output" per the spec's Assumptions section. */
const PEAK_RATIO = 0.9;
const HIGH_RATIO = 0.6;
const MEDIUM_RATIO = 0.3;
const LOW_RATIO = 0.05;

/**
 * Derives a discrete production-animation intensity tier from the plant's current output and
 * its configured capacity. The ratio is clamped to `[0, 1]` first so above-nameplate readings
 * (possible under real sun, per SolarLog's own "Peak"/derating status codes) don't overflow
 * the animation into an undefined tier.
 * @param {number} currentPacW - Current total AC output in watts (0 is a valid idle reading).
 * @param {number} capacityKwp - Plant's configured capacity in watts (despite the name — see
 *   `web/js/data/plant.js`'s `capacityKwp`, a raw watt value e.g. `6200`).
 * @returns {'idle' | 'low' | 'medium' | 'high' | 'peak'}
 */
export function productionIntensity(currentPacW, capacityKwp) {
  if (!Number.isFinite(currentPacW) || !Number.isFinite(capacityKwp) || capacityKwp <= 0) {
    return 'idle';
  }
  const ratio = Math.min(1, Math.max(0, currentPacW / capacityKwp));
  if (ratio >= PEAK_RATIO) return 'peak';
  if (ratio >= HIGH_RATIO) return 'high';
  if (ratio >= MEDIUM_RATIO) return 'medium';
  if (ratio >= LOW_RATIO) return 'low';
  return 'idle';
}
