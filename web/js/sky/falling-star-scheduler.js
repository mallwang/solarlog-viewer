/**
 * @file Pure poll-based scheduler for the sky's occasional falling-star replay (Day/Night Sky
 * Background, User Story 3). Given an injectable clock and RNG, decides *when* the next replay
 * should fire — no DOM access, fully deterministic given a fixed RNG seed. Mirrors
 * `flying-objects.js`'s `createFlyingObjectScheduler()` shape and rationale (see research.md §3);
 * the DOM effect (toggling the `--play` replay class, cleaning it up on `animationend`) lives in
 * `sky-controller.js`. See data-model.md §Falling Star Event.
 */

/**
 * Next-replay delay band in milliseconds — "occasional, randomized... not on a fixed schedule,
 * not continuously, and not on every page load" (FR-007). Exact tuning is an implementation
 * detail per spec.md's Assumptions, not a fixed requirement value.
 * @type {[number, number]}
 */
export const FALLING_STAR_DELAY_BAND_MS = [2 * 60 * 1000, 5 * 60 * 1000];

/**
 * Rolls a random delay within a `[min, max]` band.
 * @param {[number, number]} band
 * @param {() => number} [rng] - Returns a float in [0, 1); defaults to `Math.random`.
 * @returns {number} Milliseconds.
 */
export function randomDelayMs([min, max], rng = Math.random) {
  return min + rng() * (max - min);
}

/**
 * Creates a scheduler with a single internal timer for the falling-star replay, starting at a
 * random offset from `now()`.
 * @param {{ now?: () => number, rng?: () => number }} [deps] - Injectable clock (ms epoch) and
 *   RNG, overridable for tests.
 * @returns {{ poll: (nowMs?: number) => boolean }}
 */
export function createFallingStarScheduler({ now = () => Date.now(), rng = Math.random } = {}) {
  let nextFireAtMs = now() + randomDelayMs(FALLING_STAR_DELAY_BAND_MS, rng);

  /**
   * Checks the timer against the current time. If due, resets it to a new randomized future
   * time and returns `true` (replay now); otherwise returns `false`.
   * @param {number} [nowMs] - Defaults to `now()`.
   * @returns {boolean}
   */
  function poll(nowMs = now()) {
    if (nowMs < nextFireAtMs) return false;
    nextFireAtMs = nowMs + randomDelayMs(FALLING_STAR_DELAY_BAND_MS, rng);
    return true;
  }

  return { poll };
}
