/**
 * @file Pure spawn-scheduling logic for the sky's decorative flying objects (birds, planes,
 * balloons, and a moon-bound rocket easter egg). Given an injectable clock and RNG, decides
 * *when* the next object of each rarity tier should spawn and *which* kind to pick — no DOM
 * access, fully deterministic given a fixed RNG seed. The DOM effect (creating/animating/
 * removing elements) lives in `sky-controller.js`. See research.md §5 and data-model.md
 * §Sky Flying Object.
 */

/**
 * Per-tier next-spawn delay bands in milliseconds. Birds recur at a light, regular cadence
 * (FR-009), multiple times a minute; planes/balloons ("rare") every couple of minutes; the
 * rocket easter egg is rarer still (around every 5 minutes) and additionally gated on the
 * moon being currently shown (FR-011).
 * @type {{ bird: [number, number], rare: [number, number], rocket: [number, number] }}
 */
export const SPAWN_DELAY_BANDS_MS = {
  bird: [5 * 1000, 15 * 1000],
  rare: [30 * 1000, 60 * 1000],
  rocket: [60 * 1000, 120 * 1000],
};

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
 * Picks which "rare" kind to spawn — plane or balloon, equally likely.
 * @param {() => number} [rng]
 * @returns {'plane' | 'balloon'}
 */
export function pickRareKind(rng = Math.random) {
  return rng() < 0.5 ? 'plane' : 'balloon';
}

/**
 * Creates a scheduler with three independent per-kind timers (bird, rare[plane/balloon],
 * rocket), each starting at a random offset from `now()`.
 * @param {{ now?: () => number, rng?: () => number }} [deps] - Injectable clock (ms epoch)
 *   and RNG, overridable for tests.
 * @returns {{ poll: (body: 'sun' | 'moon') => { kind: 'bird' | 'plane' | 'balloon' | 'rocket', spawnedAt: Date }[] }}
 */
export function createFlyingObjectScheduler({ now = () => Date.now(), rng = Math.random } = {}) {
  let birdAt = now() + randomDelayMs(SPAWN_DELAY_BANDS_MS.bird, rng);
  let rareAt = now() + randomDelayMs(SPAWN_DELAY_BANDS_MS.rare, rng);
  let rocketAt = now() + randomDelayMs(SPAWN_DELAY_BANDS_MS.rocket, rng);

  /**
   * Checks all three timers against the current time. Any timer at or past its scheduled
   * time fires, is added to the returned list, and is rescheduled to a new random delay
   * from now. (The body parameter is accepted for API compatibility but no longer gates
   * any kind.)
   * @param {'sun' | 'moon'} body - Current Solar Time State body, from `solar-arc.js`.
   * @returns {{ kind: 'bird' | 'plane' | 'balloon' | 'rocket', spawnedAt: Date }[]}
   */
  function poll(body) {
    const spawned = [];
    const t = now();

    if (t >= birdAt) {
      spawned.push({ kind: 'bird', spawnedAt: new Date(t) });
      birdAt = t + randomDelayMs(SPAWN_DELAY_BANDS_MS.bird, rng);
    }

    if (t >= rareAt) {
      spawned.push({ kind: pickRareKind(rng), spawnedAt: new Date(t) });
      rareAt = t + randomDelayMs(SPAWN_DELAY_BANDS_MS.rare, rng);
    }

    if (t >= rocketAt) {
      spawned.push({ kind: 'rocket', spawnedAt: new Date(t) });
      rocketAt = t + randomDelayMs(SPAWN_DELAY_BANDS_MS.rocket, rng);
    }

    return spawned;
  }

  return { poll };
}
