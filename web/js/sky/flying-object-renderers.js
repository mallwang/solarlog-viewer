/**
 * @file Renderer registry for sky flying objects. Each entry maps a flying-object
 * kind string to a {@link RendererFn} factory (or `null` to silently disable that kind).
 * `spawnFlyingObject` in `sky-controller.js` looks up the kind here; if the value is
 * `null` it returns early without appending any element. Adding a new kind requires changes
 * to exactly three files: this registry, `flying-objects.js` (scheduler band), and
 * `app.css` (keyframes). No changes to `sky-controller.js` are ever needed for new kinds.
 */

/**
 * Factory function that creates one fully-configured flying-object DOM subtree.
 * The returned element must be ready to append directly to `.sky-flying-objects`; the
 * `animationend` cleanup listener is attached by `spawnFlyingObject`, not by the renderer.
 *
 * @typedef {function({durationS: number, laneTopPct: number, direction: 'ltr' | 'rtl'}): HTMLElement} RendererFn
 * @param {object} options
 * @param {number} options.durationS  Total flight duration in seconds (e.g. 10–16 for birds).
 *   Set as `--flight-duration` CSS custom property on the returned element.
 * @param {number} options.laneTopPct Vertical position within `.sky-flying-objects` as a
 *   percentage (0–100). Set as `--lane-top` CSS custom property on the returned element.
 * @param {'ltr' | 'rtl'} options.direction Flight direction. Set as `data-direction` attribute;
 *   CSS picks the matching animation keyframes and flips the sprite for RTL.
 * @returns {HTMLElement} Outer container element with class
 *   `sky-flying-object sky-flying-object--<kind>`, ready for `container.append()`.
 */

/**
 * Creates a CSS-sprite bird element ready to append to `.sky-flying-objects`.
 *
 * The outer container carries the horizontal flight animation (fly-wavy-a or fly-wavy-b,
 * chosen at random via `data-wavy-profile`). The inner `.sky-bird-sprite` carries the
 * independent wingbeat animation that steps through the 10-frame SVG strip. Random
 * `--wingbeat-phase` offsets ensure consecutive birds are not in phase-lock.
 *
 * @param {object} options
 * @param {number} options.durationS   Total flight duration in seconds (e.g. 10–16).
 * @param {number} options.laneTopPct  Vertical lane as a percentage of the container (0–100).
 * @param {'ltr' | 'rtl'} [options.direction='ltr'] Flight direction; drives the CSS animation
 *   and flips the sprite so the bird always faces the way it is flying.
 * @returns {HTMLElement} Outer container div with classes `sky-flying-object sky-flying-object--bird`.
 */
export function createBirdElement({ durationS, laneTopPct, direction = 'ltr' }) {
  const outer = document.createElement('div');
  outer.className = 'sky-flying-object sky-flying-object--bird';
  outer.setAttribute('data-wavy-profile', Math.random() < 0.5 ? 'a' : 'b');
  outer.setAttribute('data-direction', direction);
  outer.style.setProperty('--lane-top', `${laneTopPct}%`);
  outer.style.setProperty('--flight-duration', `${durationS}s`);

  const wingbeatDuration = 0.4 + Math.random() * 0.5; // [0.4, 0.9] s
  const wingbeatPhase = -(Math.random() * wingbeatDuration); // [−duration, 0] s
  const birdScale = 0.25 + Math.random() * 0.25; // [0.25, 0.5] — mocks small vs. large birds

  const sprite = document.createElement('div');
  sprite.className = 'sky-bird-sprite';
  sprite.style.setProperty('--wingbeat-duration', `${wingbeatDuration.toFixed(3)}s`);
  sprite.style.setProperty('--wingbeat-phase', `${wingbeatPhase.toFixed(3)}s`);
  sprite.style.setProperty('--bird-scale', birdScale.toFixed(3));

  outer.append(sprite);
  return outer;
}

/**
 * Creates a CSS-sprite airplane element ready to append to `.sky-flying-objects`.
 *
 * The outer container carries the horizontal flight animation (`fly-across` or
 * `fly-across-rtl` selected by `data-direction`). The inner `.sky-plane-sprite` cycles
 * through the 10-frame SVG strip for the jet-exhaust flicker effect.
 * The sprite is mirrored with `scaleX(-1)` for RTL via CSS.
 *
 * @param {object} options
 * @param {number} options.durationS   Total flight duration in seconds (e.g. 18–26).
 * @param {number} options.laneTopPct  Vertical lane as a percentage of the container (0–100).
 * @param {'ltr' | 'rtl'} [options.direction='ltr'] Flight direction.
 * @returns {HTMLElement} Outer container div with classes `sky-flying-object sky-flying-object--plane`.
 */
export function createPlaneElement({ durationS, laneTopPct, direction = 'ltr' }) {
  const outer = document.createElement('div');
  outer.className = 'sky-flying-object sky-flying-object--plane';
  outer.setAttribute('data-direction', direction);
  outer.style.setProperty('--lane-top', `${laneTopPct}%`);
  outer.style.setProperty('--flight-duration', `${durationS}s`);

  const planeScale = 1.7 + Math.random() * 0.6; // [1.7, 2.3] — mocks near vs. distant planes

  const sprite = document.createElement('div');
  sprite.className = 'sky-plane-sprite';
  sprite.style.setProperty('--plane-scale', planeScale.toFixed(3));

  outer.append(sprite);
  return outer;
}

/**
 * Creates a CSS-sprite balloon element ready to append to `.sky-flying-objects`.
 *
 * The outer container carries the horizontal drift animation (`fly-across` or
 * `fly-across-rtl`). The inner `.sky-balloon-sprite` cycles through the 10-frame
 * SVG strip for the burner-flame variation effect.
 *
 * @param {object} options
 * @param {number} options.durationS   Total flight duration in seconds (e.g. 22–32).
 * @param {number} options.laneTopPct  Vertical lane as a percentage of the container (0–100).
 * @param {'ltr' | 'rtl'} [options.direction='ltr'] Drift direction.
 * @returns {HTMLElement} Outer container div with classes `sky-flying-object sky-flying-object--balloon`.
 */
export function createBalloonElement({ durationS, laneTopPct, direction = 'ltr' }) {
  const outer = document.createElement('div');
  outer.className = 'sky-flying-object sky-flying-object--balloon';
  outer.setAttribute('data-direction', direction);
  outer.style.setProperty('--lane-top', `${laneTopPct}%`);
  outer.style.setProperty('--flight-duration', `${durationS}s`);

  const balloonScale = 0.8 + Math.random() * 0.2; // [0.8, 1.0] — mocks near vs. distant balloons

  const sprite = document.createElement('div');
  sprite.className = 'sky-balloon-sprite';
  sprite.style.setProperty('--balloon-scale', balloonScale.toFixed(3));

  outer.append(sprite);
  return outer;
}

/**
 * Creates a CSS-sprite rocket element ready to append to `.sky-flying-objects`.
 *
 * Unlike the other kinds, the rocket flies **vertically** (bottom → top), so
 * `laneTopPct` is repurposed as the horizontal left position within the container.
 * The direction parameter is accepted for interface compatibility but ignored —
 * rockets always fly straight up.
 *
 * @param {object} options
 * @param {number} options.durationS   Total flight duration in seconds (e.g. 8–12).
 * @param {number} options.laneTopPct  Horizontal left position as a percentage (0–100).
 * @returns {HTMLElement} Outer container div with classes `sky-flying-object sky-flying-object--rocket`.
 */
export function createRocketElement({ durationS, laneTopPct }) {
  const outer = document.createElement('div');
  outer.className = 'sky-flying-object sky-flying-object--rocket';
  // --lane-left overrides the horizontal position; --lane-top is not set so the
  // rocket's top: 100% rule in CSS takes precedence, placing it below the container.
  outer.style.setProperty('--lane-left', `${laneTopPct}%`);
  outer.style.setProperty('--flight-duration', `${durationS}s`);

  const sprite = document.createElement('div');
  sprite.className = 'sky-rocket-sprite';

  outer.append(sprite);
  return outer;
}

/**
 * Creates a CSS-sprite butterfly element ready to append to `.sky-flying-objects`.
 *
 * The outer container carries the horizontal flight animation (fly-wavy-a or fly-wavy-b,
 * chosen at random via `data-wavy-profile`). The inner `.sky-butterfly-sprite` cycles
 * through the 10-frame SVG strip for the wingbeat animation. The butterfly sprite faces
 * LEFT in the SVG, so the LTR sprite is flipped via CSS.
 *
 * @param {object} options
 * @param {number} options.durationS   Total flight duration in seconds (e.g. 20–30).
 * @param {number} options.laneTopPct  Vertical lane as a percentage of the container (0–100).
 * @param {'ltr' | 'rtl'} [options.direction='ltr'] Flight direction.
 * @returns {HTMLElement} Outer container div with classes `sky-flying-object sky-flying-object--butterfly`.
 */
export function createButterflyElement({ durationS, laneTopPct, direction = 'ltr' }) {
  const outer = document.createElement('div');
  outer.className = 'sky-flying-object sky-flying-object--butterfly';
  outer.setAttribute('data-wavy-profile', Math.random() < 0.5 ? 'a' : 'b');
  outer.setAttribute('data-direction', direction);
  outer.style.setProperty('--lane-top', `${laneTopPct}%`);
  outer.style.setProperty('--flight-duration', `${durationS}s`);

  const wingbeatDuration = 0.3 + Math.random() * 0.3; // [0.3, 0.6] s — faster than birds
  const wingbeatPhase = -(Math.random() * wingbeatDuration);
  const butterflyScale = 0.1 + Math.random() * 0.1; // [0.1, 0.2] — small relative to birds

  const sprite = document.createElement('div');
  sprite.className = 'sky-butterfly-sprite';
  sprite.style.setProperty('--wingbeat-duration', `${wingbeatDuration.toFixed(3)}s`);
  sprite.style.setProperty('--wingbeat-phase', `${wingbeatPhase.toFixed(3)}s`);
  sprite.style.setProperty('--butterfly-scale', butterflyScale.toFixed(3));

  outer.append(sprite);
  return outer;
}

/**
 * Creates a CSS-sprite dragonfly element ready to append to `.sky-flying-objects`.
 *
 * The outer container carries a direct horizontal flight animation (`fly-across` or
 * `fly-across-rtl`). The inner `.sky-dragonfly-sprite` cycles through the 10-frame SVG
 * strip for the high-frequency wing shimmer. The sprite is a top-down view facing LEFT,
 * so the LTR sprite is flipped via CSS.
 *
 * @param {object} options
 * @param {number} options.durationS   Total flight duration in seconds (e.g. 8–14).
 * @param {number} options.laneTopPct  Vertical lane as a percentage of the container (0–100).
 * @param {'ltr' | 'rtl'} [options.direction='ltr'] Flight direction.
 * @returns {HTMLElement} Outer container div with classes `sky-flying-object sky-flying-object--dragonfly`.
 */
export function createDragonflyElement({ durationS, laneTopPct, direction = 'ltr' }) {
  const outer = document.createElement('div');
  outer.className = 'sky-flying-object sky-flying-object--dragonfly';
  outer.setAttribute('data-direction', direction);
  outer.style.setProperty('--lane-top', `${laneTopPct}%`);
  outer.style.setProperty('--flight-duration', `${durationS}s`);

  const wingbeatDuration = 0.08 + Math.random() * 0.06; // [0.08, 0.14] s — very fast shimmer
  const wingbeatPhase = -(Math.random() * wingbeatDuration);
  const dragonflyScale = 0.08 + Math.random() * 0.08; // [0.08, 0.16] — small relative to birds

  const sprite = document.createElement('div');
  sprite.className = 'sky-dragonfly-sprite';
  sprite.style.setProperty('--wingbeat-duration', `${wingbeatDuration.toFixed(3)}s`);
  sprite.style.setProperty('--wingbeat-phase', `${wingbeatPhase.toFixed(3)}s`);
  sprite.style.setProperty('--dragonfly-scale', dragonflyScale.toFixed(3));

  outer.append(sprite);
  return outer;
}

/**
 * Creates a CSS-sprite goose V-formation element ready to append to `.sky-flying-objects`.
 *
 * The sprite sheet shows three Canada geese in a V-formation; one element represents the
 * whole formation. The outer container carries the horizontal flight animation (fly-wavy-a
 * or fly-wavy-b). The sprite faces LEFT, so the LTR sprite is flipped via CSS.
 *
 * @param {object} options
 * @param {number} options.durationS   Total flight duration in seconds (e.g. 14–20).
 * @param {number} options.laneTopPct  Vertical lane as a percentage of the container (0–100).
 * @param {'ltr' | 'rtl'} [options.direction='ltr'] Flight direction.
 * @returns {HTMLElement} Outer container div with classes `sky-flying-object sky-flying-object--goose`.
 */
export function createGooseElement({ durationS, laneTopPct, direction = 'ltr' }) {
  const outer = document.createElement('div');
  outer.className = 'sky-flying-object sky-flying-object--goose';
  outer.setAttribute('data-wavy-profile', Math.random() < 0.5 ? 'a' : 'b');
  outer.setAttribute('data-direction', direction);
  outer.style.setProperty('--lane-top', `${laneTopPct}%`);
  outer.style.setProperty('--flight-duration', `${durationS}s`);

  const wingbeatDuration = 0.5 + Math.random() * 0.4; // [0.5, 0.9] s — slow powerful wingbeat
  const wingbeatPhase = -(Math.random() * wingbeatDuration);
  const gooseScale = 0.7 + Math.random() * 0.4; // [0.7, 1.1] — geese are large

  const sprite = document.createElement('div');
  sprite.className = 'sky-goose-sprite';
  sprite.style.setProperty('--wingbeat-duration', `${wingbeatDuration.toFixed(3)}s`);
  sprite.style.setProperty('--wingbeat-phase', `${wingbeatPhase.toFixed(3)}s`);
  sprite.style.setProperty('--goose-scale', gooseScale.toFixed(3));

  outer.append(sprite);
  return outer;
}

/**
 * Authoritative map from flying-object kind to its renderer factory function.
 * Assign `null` to silently disable a kind — `spawnFlyingObject` skips it with no error.
 *
 * @example <caption>Minimal 3-file diff to add a new kind (e.g. "kite")</caption>
 * // 1. flying-object-renderers.js — add factory + register:
 * //    export function createKiteElement({ durationS, laneTopPct }) { ... }
 * //    FLYING_OBJECT_RENDERERS.kite = createKiteElement;
 * //
 * // 2. flying-objects.js — add scheduler band:
 * //    { kind: 'kite', minCadenceS: 60, maxCadenceS: 120, ... }
 * //
 * // 3. app.css — add flight-path keyframes and any sprite-specific rules.
 * //
 * // sky-controller.js requires NO changes.
 *
 * @type {{ bird: RendererFn | null, plane: RendererFn | null, balloon: RendererFn | null, rocket: RendererFn | null, butterfly: RendererFn | null, dragonfly: RendererFn | null, goose: RendererFn | null }}
 */
export const FLYING_OBJECT_RENDERERS = {
  bird: createBirdElement,
  plane: createPlaneElement,
  balloon: createBalloonElement,
  rocket: createRocketElement,
  butterfly: createButterflyElement,
  dragonfly: createDragonflyElement,
  goose: createGooseElement,
};
