# Research: Realistic Bird Sprites & Flying Object Renderer Registry

**Feature**: 011-realistic-bird-sprites  
**Phase**: 0 — Research  
**Date**: 2026-08-10

---

## 1. SVG Sprite Sheet — Source and Format

### Decision

Use a locally-hosted 10-frame bird silhouette SVG sprite strip (`bird-cells-new.svg`), placed in `web/vendor/`. The asset is a single horizontal SVG image with 10 equal-width frames, total width 900 px (each frame 90 px wide × 90 px tall). The CSS `steps(10)` timing function is used with a `background-position` keyframe that shifts left by 900 px (the full strip width) to step through all 10 frames.

### Rationale

- FR-004 mandates a locally-hosted asset with zero CDN dependency.
- The 900 × 90 px, 10-frame format is explicitly named in the spec assumptions and is consistent with the CodePen asset description referenced there. This keeps the CSS constants (`steps(10)`, `-900px`) straightforward and commented in the source.
- SVG is preferred over PNG: the vector format means the bird looks crisp at any `background-size` scale; no pixel-blurring at large zoom levels.

### Alternatives Considered

- **Inline SVG animation (SMIL/`<animate>`)**: Possible but would require injecting an `<img>` or `<object>` per spawn and giving up simple CSS-only control of the wingbeat speed. Rejected for complexity.
- **Lottie / JS animation library**: Ruled out — constitution prohibits new JS frameworks; adds a network dependency and parse cost.
- **PNG sprite sheet**: Valid, but SVG gives better sharpness at variable scale. Rejected in favour of SVG.

---

## 2. CSS Sprite-Sheet Animation Technique

### Decision

Two nested `<div>` elements per bird:

1. **Outer container** (`.sky-flying-object--bird`): carries the horizontal flight animation (`fly-wavy-a` or `fly-wavy-b` — chosen at random). This is the element appended to `.sky-flying-objects` and removed on `animationend`.
2. **Inner sprite div** (`.sky-bird-sprite`): carries the wingbeat animation via a `background-position` keyframe using `steps(10)`.

```css
@keyframes bird-wingbeat {
  from {
    background-position-x: 0;
  }
  to {
    background-position-x: -900px;
  }
}

.sky-bird-sprite {
  width: 90px;
  height: 90px;
  background-image: url('/vendor/bird-cells-new.svg');
  background-size: 900px 90px;
  background-repeat: no-repeat;
  background-position-x: 0;
  animation: bird-wingbeat var(--wingbeat-duration, 0.6s) steps(10) infinite;
  animation-delay: var(--wingbeat-phase, 0s);
}
```

### Rationale

- The outer/inner split is a well-established CSS sprite pattern: it decouples the flight path (position of the outer element) from the body animation (background-position cycling on the inner element).
- `steps(10)` gives exact per-frame stepping with no interpolation blur between frames.
- `animation-delay` with a negative value (`--wingbeat-phase`) starts the cycle mid-flight so consecutive birds are not in phase-lock.
- The outer element's `animationend` fires on the flight-path animation (which ends after one full viewport crossing) — this is the cleanup trigger already used by the existing `sky-controller.js` (`el.addEventListener('animationend', () => el.remove())`). Because the inner sprite has `animation: ... infinite`, its `animationend` never fires. The cleanup listener is therefore placed only on the outer container.

### Alternatives Considered

- **Single-element animation with `animation-name` list**: Applying both `bird-wingbeat` and `fly-wavy-a` to the same element would require careful `animation-fill-mode` handling and the cleanup `animationend` would fire for both animations. Rejected — the two-element split is cleaner and less error-prone.

---

## 3. Wavy Flight Path Profiles (FR-003)

### Decision

Two keyframe profiles (`fly-wavy-a`, `fly-wavy-b`) that describe a gently sinusoidal horizontal crossing with a scale progression that makes the bird appear to rise and fall slightly:

- **`fly-wavy-a`**: starts small (0.6×), peaks in the centre (1.0×), returns to 0.6× — a gentle hump.
- **`fly-wavy-b`**: starts at 1.0×, dips to 0.7× at the quarter point, rises to 1.1× at the midpoint, and settles to 0.85× — a more irregular undulation.

The `translateX` in both keyframes moves from `-10vw` to `110vw` (full viewport crossing, mobile-safe). The vertical position is fixed by `--lane-top` on the outer container — the wavy profiles add only scale + a small vertical `translateY` offset at each waypoint (expressed in `vh` units, typically ±2–4 vh) so the apparent flight path undulates without changing the element's actual CSS `top`.

The profile is selected uniformly at random per spawn by the renderer (`Math.random() < 0.5`).

### Rationale

- Two distinct profiles satisfy FR-003's "at least two distinct wavy flight-path profiles" with minimal CSS.
- Scale-based apparent altitude variation (`scale()` on the transform) is composited entirely by the GPU; no JS involvement per tick.
- `vw`/`vh` units ensure the path scales gracefully down to 320 px wide viewports (Principle IV, Responsive-First).

---

## 4. Renderer Registry Architecture (FR-005 / FR-006 / FR-007)

### Decision

Extract visual element creation into a new module `web/js/sky/flying-object-renderers.js` that exports:

```js
/** @type {Record<string, (({ durationS, laneTopPct }) => HTMLElement) | null>} */
export const FLYING_OBJECT_RENDERERS = {
  bird: createBirdElement,
  plane: null,
  balloon: null,
  rocket: null,
};
```

`sky-controller.js`'s `spawnFlyingObject` becomes a thin dispatcher:

```js
function spawnFlyingObject(container, kind) {
  const renderer = FLYING_OBJECT_RENDERERS[kind];
  if (!renderer) return; // null → kind disabled (FR-007)
  const [minS, maxS] = KIND_DURATION_RANGES[kind];
  const durationS = minS + Math.random() * (maxS - minS);
  const laneTopPct = 5 + Math.random() * 25;
  const el = renderer({ durationS, laneTopPct });
  el.addEventListener('animationend', () => el.remove());
  container.append(el);
}
```

`FLYING_OBJECT_KIND_CONFIG` in `sky-controller.js` retains the duration ranges but drops the `glyph` field. The glyph logic moves into each renderer.

### Rationale

- FR-006 forbids kind-specific branching inside `spawnFlyingObject`. A registry keyed by `kind` satisfies this without a switch/if chain.
- FR-007 is satisfied by the `null` guard: `if (!renderer) return` is kind-agnostic.
- SC-003 is satisfied: adding a sixth kind requires only: (1) add entry to `FLYING_OBJECT_RENDERERS`, (2) add scheduler band, (3) add CSS — `spawnFlyingObject` body is untouched.

### Alternatives Considered

- **Strategy pattern with class instances**: Heavier than a plain function registry for this use case. Rejected.
- **Dynamic `import()`-based lazy registry**: Unnecessary — all renderers are small and loaded together. Rejected.

---

## 5. Sprite Asset Sourcing (FR-004)

### Decision

The `bird-cells-new.svg` asset is placed in `web/vendor/`. The file must be created or sourced before implementation and committed to the repository so the feature works fully offline (FR-004). The asset format is 900 × 90 px, 10 equal frames in a single horizontal strip.

If the exact CodePen asset (`bird-cells-new.svg`) turns out to be proprietary, an equivalent 10-frame SVG sprite strip should be drawn using a bird-silhouette wing-cycle path (open/glide/closed/glide cycle repeated), committed under the project's license. The key constraint is the 900 × 90 px / 10-frame geometry so the CSS constants remain stable.

### Rationale

- `web/vendor/` already exists and is used for ApexCharts — consistent placement.
- A committed local file ensures offline capability and eliminates CDN availability risk.

---

## 6. Existing Tests Compatibility (FR-010)

### Analysis

`web/js/sky/flying-objects.test.js` tests only the scheduler module (`flying-objects.js`). The scheduler is **not modified** by this feature — it continues to emit `{ kind, spawnedAt }` events; the renderer decision happens downstream in `sky-controller.js`. Therefore all existing scheduler tests pass unchanged.

`sky-controller.js` is not directly unit-tested (intentional per its existing plan.md note — covered by Playwright e2e). The Playwright e2e test `tests/e2e/sky.spec.js` needs reviewing to confirm it doesn't assert on emoji text content; if it does, those assertions should be updated.

### Decision

No changes to `flying-objects.js` or its tests. The new `flying-object-renderers.test.js` covers only the new renderer module. The Playwright sky spec is reviewed and updated as needed.
