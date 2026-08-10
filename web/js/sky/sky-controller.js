/**
 * @file DOM-glue orchestrator for the dynamic weather-driven sky background. Resolves the
 * installation's location, polls Open-Meteo for weather/solar-time data every 15 minutes,
 * drives the `.sky-clouds` backdrop's `data-cloud-density` attribute (User Story 1), positions
 * `.sky-sun`/`.sky-moon` on a 60-second tick (User Story 2), and schedules short-lived
 * `.sky-flying-object` elements on a faster poll so bird spawns (multiple times a minute)
 * actually get checked (User Story 3). Any failure at any stage (no location, fetch
 * failure, malformed response) leaves the sky untouched so the existing static CSS appearance
 * renders unchanged (FR-005); `prefers-reduced-motion` suppresses flying-object spawning
 * entirely (FR-013). Not unit-tested directly — covered by tests/e2e/sky.spec.js, per plan.md's
 * stated split between pure logic modules (unit-tested) and this DOM-effect layer (Playwright).
 */

import { resolveInstallationLocation } from './location.js';
import { fetchWeather } from './weather-client.js';
import { CLOUD_TIER_RENDER_CONFIG } from './cloud-density.js';
import { computeSkyBodyPosition } from './solar-arc.js';
import { createFlyingObjectScheduler } from './flying-objects.js';
import { FLYING_OBJECT_RENDERERS } from './flying-object-renderers.js';

const POLL_INTERVAL_MS = 15 * 60 * 1000;
const TICK_INTERVAL_MS = 60 * 1000;
/** Checked far more often than TICK_INTERVAL_MS so the bird spawn band (multiple times a
 * minute) actually gets a chance to fire — a 60s tick would miss most of them. */
const SPAWN_POLL_INTERVAL_MS = 5 * 1000;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Flight-duration ranges (seconds) per flying-object kind. */
const KIND_DURATION_RANGES = {
  bird: [16, 24],
  plane: [4, 8],
  balloon: [32, 48],
  rocket: [8, 12],
  butterfly: [20, 30],
  dragonfly: [8, 14],
  goose: [14, 20],
};

/**
 * Maximum number of each kind that may be alive (animating) in the DOM at the same
 * time. `spawnFlyingObject` counts existing elements via a DOM query and skips
 * spawning if the cap is already reached. For grouped kinds the query selector in
 * `KIND_GROUP_SELECTOR` is used so the cap applies to the whole group.
 */
const KIND_MAX_CONCURRENT = {
  bird: 10, // grouped with goose
  goose: 10, // grouped with bird
  butterfly: 5, // grouped with dragonfly
  dragonfly: 5, // grouped with butterfly
  plane: 1,
  balloon: 2,
  rocket: 1,
};

/**
 * CSS selector used to count live elements for the concurrent cap. Kinds that share a
 * pool override the default (`.sky-flying-object--<kind>`) with a multi-class selector
 * so both kinds count against the same maximum.
 * @type {Record<string, string>}
 */
const KIND_GROUP_SELECTOR = {
  bird: '.sky-flying-object--bird, .sky-flying-object--goose',
  goose: '.sky-flying-object--bird, .sky-flying-object--goose',
  butterfly: '.sky-flying-object--butterfly, .sky-flying-object--dragonfly',
  dragonfly: '.sky-flying-object--butterfly, .sky-flying-object--dragonfly',
};

/**
 * Vertical lane band (top %) within `.sky-flying-objects` for each kind.
 * 0 % = top of the sky band, 100 % = bottom. Birds occupy the lower-middle band;
 * planes/rockets stay near the top to simulate higher altitude.
 * For the rocket (vertical flight), this range maps to the HORIZONTAL left position
 * instead, giving it spread across the full sky width.
 */
const KIND_LANE_RANGES = {
  bird: [40, 80],
  plane: [5, 20],
  balloon: [35, 65],
  rocket: [10, 80],
  butterfly: [55, 90],
  dragonfly: [50, 85],
  goose: [20, 55],
};

/**
 * Sets `data-cloud-density` on `.sky-clouds` and shows/hides the six existing `.cloud`
 * elements per the tier's `visibleCount` (fewer visible for the `clear` tier).
 * @param {HTMLElement} skyClouds
 * @param {'clear' | 'partly' | 'overcast'} tier
 */
function applyCloudDensity(skyClouds, tier) {
  skyClouds.dataset.cloudDensity = tier;
  const { visibleCount } = CLOUD_TIER_RENDER_CONFIG[tier];
  const clouds = skyClouds.querySelectorAll('.cloud');
  clouds.forEach((cloud, index) => {
    cloud.hidden = index >= visibleCount;
  });
}

/**
 * Positions the sun/moon elements per `computeSkyBodyPosition()`'s result: the current
 * `body` gets full opacity, the other body gets `crossfade`'s opacity (0 outside the
 * sunrise/sunset transition window), both sharing the same arc position (FR-008).
 * @param {HTMLElement} sunEl
 * @param {HTMLElement} moonEl
 * @param {{ body: 'sun' | 'moon', xPercent: number, yPercent: number, crossfade: number }} position
 */
function applySkyBodyPosition(sunEl, moonEl, position) {
  for (const el of [sunEl, moonEl]) {
    el.style.setProperty('--x-percent', String(position.xPercent));
    el.style.setProperty('--y-percent', String(position.yPercent));
  }
  const primary = position.body === 'sun' ? sunEl : moonEl;
  const secondary = position.body === 'sun' ? moonEl : sunEl;
  primary.style.opacity = '1';
  secondary.style.opacity = String(position.crossfade);
}

/**
 * Kind-specific logic MUST NOT be added to this function — new kinds extend only via the
 * renderer registry in `flying-object-renderers.js`.
 *
 * Looks up the renderer for `kind` in {@link FLYING_OBJECT_RENDERERS}; returns immediately
 * if the renderer is `null` (kind is disabled). Otherwise creates the element via the
 * renderer and appends it to `container`, attaching an `animationend` cleanup listener.
 * @param {HTMLElement} container
 * @param {'bird' | 'plane' | 'balloon' | 'rocket'} kind
 * @param {{ laneTopPct?: number, durationS?: number, direction?: 'ltr' | 'rtl' }} [overrides]
 */
function spawnFlyingObject(container, kind, { laneTopPct, durationS, direction } = {}) {
  const renderer = FLYING_OBJECT_RENDERERS[kind];
  if (!renderer) return;

  // Enforce concurrent cap: count live elements of this kind (or its group) in the DOM.
  const max = KIND_MAX_CONCURRENT[kind];
  const groupSelector = KIND_GROUP_SELECTOR[kind] ?? `.sky-flying-object--${kind}`;
  if (max !== undefined && container.querySelectorAll(groupSelector).length >= max) return;

  const [minS, maxS] = KIND_DURATION_RANGES[kind];
  const [minLane, maxLane] = KIND_LANE_RANGES[kind];
  const resolvedDuration = durationS ?? minS + Math.random() * (maxS - minS);
  const resolvedLane = laneTopPct ?? minLane + Math.random() * (maxLane - minLane);
  const resolvedDirection = direction ?? (Math.random() < 0.5 ? 'ltr' : 'rtl');

  const el = renderer({
    durationS: resolvedDuration,
    laneTopPct: resolvedLane,
    direction: resolvedDirection,
  });
  el.addEventListener('animationend', () => el.remove());
  container.append(el);
}

/**
 * Returns a random flock size biased towards solo flight.
 * Distribution: ~60 % solo, ~25 % pair, ~12 % trio, ~3 % quartet.
 * @returns {1|2|3|4}
 */
function pickFlockSize() {
  const r = Math.random();
  if (r < 0.6) return 1;
  if (r < 0.85) return 2;
  if (r < 0.97) return 3;
  return 4;
}

/**
 * Initializes the dynamic sky background. Safe to call even when the DOM has no
 * `.sky-clouds` element (no-ops) or when location/weather resolution fails at any stage (also
 * a silent no-op, per FR-005 — the default static backdrop keeps rendering).
 * @param {{ plant: { location?: string } | null, locationOverride: { lat: number, lon: number } | null }} options
 * @returns {Promise<void>}
 */
export async function initSkyController({ plant, locationOverride }) {
  const skyClouds = document.querySelector('.sky-clouds');
  if (!skyClouds) return;

  const location = await resolveInstallationLocation(plant, locationOverride);
  if (!location) return;

  const sunEl = skyClouds.querySelector('.sky-sun');
  const moonEl = skyClouds.querySelector('.sky-moon');
  const flyingObjectsEl = document.querySelector('.sky-flying-objects');
  let scheduler = createFlyingObjectScheduler();

  /** Last-known-good weather reading; a failed poll leaves this untouched (FR-005). */
  let lastWeather = null;
  let reducedMotion = false;
  /** Updated on each position tick; read by spawnPoll() to gate the rocket kind (FR-011). */
  let currentBody = 'sun';

  function applyReducedMotion() {
    skyClouds.dataset.reduceMotion = String(reducedMotion);
    if (flyingObjectsEl) flyingObjectsEl.dataset.reduceMotion = String(reducedMotion);
  }

  const reducedMotionQuery = window.matchMedia?.(REDUCED_MOTION_QUERY);
  if (reducedMotionQuery) {
    reducedMotion = reducedMotionQuery.matches;
    reducedMotionQuery.addEventListener('change', (event) => {
      reducedMotion = event.matches;
      applyReducedMotion();
    });
  }
  applyReducedMotion();

  async function poll() {
    const weather = await fetchWeather(location);
    if (!weather) return;
    lastWeather = weather;
    applyCloudDensity(skyClouds, weather.tier);
  }

  function tick() {
    if (!lastWeather || !sunEl || !moonEl) return;
    const position = computeSkyBodyPosition(
      new Date(),
      lastWeather.sunrise,
      lastWeather.sunset,
      lastWeather.nextSunrise,
    );
    currentBody = position.body;
    applySkyBodyPosition(sunEl, moonEl, position);
  }

  function spawnPoll() {
    if (reducedMotion || !flyingObjectsEl || !lastWeather) return;
    for (const spawn of scheduler.poll(currentBody)) {
      if (spawn.kind === 'bird') {
        // Spawn 1–4 birds per event to simulate solo fliers and loose flocks.
        // The whole flock shares one direction so they don't fly through each other.
        const count = pickFlockSize();
        const [minS, maxS] = KIND_DURATION_RANGES.bird;
        const [minLane, maxLane] = KIND_LANE_RANGES.bird;
        const baseDuration = minS + Math.random() * (maxS - minS);
        const baseLane = minLane + Math.random() * (maxLane - minLane);
        const direction = Math.random() < 0.5 ? 'ltr' : 'rtl';
        for (let i = 0; i < count; i++) {
          // Flock members fly close together vertically; each gets its own speed variation.
          const laneTopPct = Math.max(
            minLane - 3,
            Math.min(maxLane + 3, baseLane + (Math.random() * 6 - 3)),
          );
          const durationS = baseDuration * (0.85 + Math.random() * 0.3);
          spawnFlyingObject(flyingObjectsEl, spawn.kind, { laneTopPct, durationS, direction });
        }
      } else if (spawn.kind === 'goose') {
        // Geese often travel in multiple V-formations; spawn 1–2 formations sharing a direction.
        const count = Math.random() < 0.65 ? 1 : 2;
        const [minS, maxS] = KIND_DURATION_RANGES.goose;
        const [minLane, maxLane] = KIND_LANE_RANGES.goose;
        const baseLane = minLane + Math.random() * (maxLane - minLane);
        const direction = Math.random() < 0.5 ? 'ltr' : 'rtl';
        for (let i = 0; i < count; i++) {
          const laneTopPct = Math.max(
            minLane - 3,
            Math.min(maxLane + 3, baseLane + (Math.random() * 8 - 4)),
          );
          const durationS = (minS + Math.random() * (maxS - minS)) * (0.9 + Math.random() * 0.2);
          spawnFlyingObject(flyingObjectsEl, spawn.kind, { laneTopPct, durationS, direction });
        }
      } else if (spawn.kind === 'butterfly') {
        // Butterflies occasionally travel in pairs; share a direction when paired.
        const count = Math.random() < 0.65 ? 1 : 2;
        const direction = Math.random() < 0.5 ? 'ltr' : 'rtl';
        for (let i = 0; i < count; i++) {
          spawnFlyingObject(flyingObjectsEl, spawn.kind, { direction });
        }
      } else {
        spawnFlyingObject(flyingObjectsEl, spawn.kind);
      }
    }
  }

  await poll();
  tick();
  spawnPoll();

  const pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  const tickTimer = setInterval(tick, TICK_INTERVAL_MS);
  let spawnPollTimer = setInterval(spawnPoll, SPAWN_POLL_INTERVAL_MS);

  // When the tab/window goes to the background the browser throttles setInterval heavily.
  // On return, deferred ticks would fire in a burst AND the scheduler's internal next-spawn
  // timestamps would all be in the past — both combine to flood the sky with objects.
  // Fix: stop the spawn poll while hidden; on return, recreate the scheduler (resets all
  // next-fire times to now + a fresh random delay) then restart the interval cleanly.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(spawnPollTimer);
    } else {
      scheduler = createFlyingObjectScheduler();
      spawnPollTimer = setInterval(spawnPoll, SPAWN_POLL_INTERVAL_MS);
    }
  });

  window.addEventListener('pagehide', () => {
    clearInterval(pollTimer);
    clearInterval(tickTimer);
    clearInterval(spawnPollTimer);
  });
}
