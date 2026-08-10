/**
 * @file Maps a current production reading to a discrete production-animation intensity tier
 * (size/speed, consumed by `app.css`'s `data-intensity` selectors — FR-009/FR-010, research.md
 * §4) and to a continuous red→orange→yellow→green color (the pulse's fill/glow color, at the
 * user's request) reflecting exactly how close current output is to the plant's configured
 * capacity. Pure logic, no DOM access — see data-model.md's "Derivation → Production Animation
 * Intensity" and `info-panel-controller.js`, which calls both on every poll tick.
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

/** Gray shown for "no production" — matches tokens.css's `--color-text-muted`, kept as a
 * literal here since this module has no DOM/CSS access of its own. */
export const PRODUCTION_COLOR_IDLE = '#5b6470';

/** Four color stops the ratio is interpolated across, each spanning 25% of `[0, 1]` — red at
 * 0%, orange at 25%, yellow at 50%, green at 75% (and flat green from 75–100%). Red/green match
 * tokens.css's `--color-danger`/`--color-accent`; orange/yellow are new, chosen to sit visually
 * between them. */
const COLOR_STOPS = [
  { at: 0, rgb: [198, 40, 40] }, // red (--color-danger)
  { at: 0.25, rgb: [245, 124, 0] }, // orange
  { at: 0.5, rgb: [251, 192, 45] }, // yellow
  { at: 0.75, rgb: [46, 125, 50] }, // green (--color-accent)
];

/**
 * @param {number[]} a - `[r, g, b]`
 * @param {number[]} b - `[r, g, b]`
 * @param {number} t - 0–1
 * @returns {string} `rgb(r, g, b)`, channels rounded to integers.
 */
function lerpRgb(a, b, t) {
  const channel = (i) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

/**
 * Derives the pulse's color from the plant's current output and its configured capacity: gray
 * when there's no production at all, otherwise a continuous interpolation across
 * red→orange→yellow→green (each stop 25% of the ratio apart — e.g. 4000 W of a 6200 W plant is
 * 64.5%, landing just over half way between the yellow and green stops).
 * @param {number} currentPacW - Current total AC output in watts (0 is a valid idle reading).
 * @param {number} capacityKwp - Plant's configured capacity in watts (see
 *   `productionIntensity`'s note on the misleading name).
 * @returns {string} A CSS `rgb(...)` color, or `PRODUCTION_COLOR_IDLE`.
 */
export function productionColor(currentPacW, capacityKwp) {
  if (!Number.isFinite(currentPacW) || currentPacW <= 0) return PRODUCTION_COLOR_IDLE;
  const firstStop = COLOR_STOPS[0];
  if (!Number.isFinite(capacityKwp) || capacityKwp <= 0) {
    return lerpRgb(firstStop.rgb, firstStop.rgb, 0);
  }

  const ratio = Math.min(1, Math.max(0, currentPacW / capacityKwp));
  const lastStop = COLOR_STOPS.at(-1);
  if (ratio >= lastStop.at) return lerpRgb(lastStop.rgb, lastStop.rgb, 0);

  const upperIndex = COLOR_STOPS.findIndex((stop) => stop.at > ratio);
  const lower = COLOR_STOPS[upperIndex - 1];
  const upper = COLOR_STOPS[upperIndex];
  const t = (ratio - lower.at) / (upper.at - lower.at);
  return lerpRgb(lower.rgb, upper.rgb, t);
}
