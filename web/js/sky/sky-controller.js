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

const POLL_INTERVAL_MS = 15 * 60 * 1000;
const TICK_INTERVAL_MS = 60 * 1000;
/** Checked far more often than TICK_INTERVAL_MS so the bird spawn band (multiple times a
 * minute) actually gets a chance to fire — a 60s tick would miss most of them. */
const SPAWN_POLL_INTERVAL_MS = 5 * 1000;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Glyph and flight-duration range per flying-object kind. */
const FLYING_OBJECT_KIND_CONFIG = {
  bird: { glyph: '🐦', durationRangeS: [10, 16] },
  plane: { glyph: '✈️', durationRangeS: [18, 26] },
  balloon: { glyph: '🎈', durationRangeS: [22, 32] },
  rocket: { glyph: '🚀', durationRangeS: [8, 12] },
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
 * Creates and appends one `.sky-flying-object` element for a scheduler spawn, in a random
 * lane within the upper sky band, and removes it from the DOM once its flight animation ends.
 * @param {HTMLElement} container
 * @param {'bird' | 'plane' | 'balloon' | 'rocket'} kind
 */
function spawnFlyingObject(container, kind) {
  const { glyph, durationRangeS } = FLYING_OBJECT_KIND_CONFIG[kind];
  const [minS, maxS] = durationRangeS;

  const el = document.createElement('div');
  el.className = `sky-flying-object sky-flying-object--${kind}`;
  el.textContent = glyph;
  el.style.setProperty('--lane-top', `${5 + Math.random() * 25}%`);
  el.style.setProperty(
    '--flight-duration',
    `${(minS + Math.random() * (maxS - minS)).toFixed(1)}s`,
  );
  el.addEventListener('animationend', () => el.remove());

  container.append(el);
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
  const scheduler = createFlyingObjectScheduler();

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
      spawnFlyingObject(flyingObjectsEl, spawn.kind);
    }
  }

  await poll();
  tick();
  spawnPoll();

  const pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  const tickTimer = setInterval(tick, TICK_INTERVAL_MS);
  const spawnPollTimer = setInterval(spawnPoll, SPAWN_POLL_INTERVAL_MS);
  window.addEventListener('pagehide', () => {
    clearInterval(pollTimer);
    clearInterval(tickTimer);
    clearInterval(spawnPollTimer);
  });
}
