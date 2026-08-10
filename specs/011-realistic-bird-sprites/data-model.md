# Data Model: Realistic Bird Sprites & Flying Object Renderer Registry

**Feature**: 011-realistic-bird-sprites  
**Phase**: 1 — Design  
**Date**: 2026-08-10

---

## Entities

### 1. Renderer Registry (`FLYING_OBJECT_RENDERERS`)

The single authoritative map from a flying-object `kind` string to either a factory
function or `null`. Defined and exported from `web/js/sky/flying-object-renderers.js`.

| Field      | Type                 | Description                                                                                                               |
| ---------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `kind` key | `string`             | Matches the `kind` values emitted by `createFlyingObjectScheduler().poll()`: `'bird'`, `'plane'`, `'balloon'`, `'rocket'` |
| value      | `RendererFn \| null` | Factory function that returns a ready-to-append `HTMLElement`, or `null` to silently disable the kind                     |

**Initial state (this feature)**:

```js
export const FLYING_OBJECT_RENDERERS = {
  bird: createBirdElement, // active
  plane: null, // disabled
  balloon: null, // disabled
  rocket: null, // disabled
};
```

**Extension contract**: Adding a new kind requires assigning its renderer here plus adding
a scheduler band in `flying-objects.js` — no other file changes (FR-006, SC-003).

---

### 2. `RendererFn` (Function Type)

A factory that creates one fully-configured flying-object DOM subtree.

```ts
type RendererFn = (options: { durationS: number; laneTopPct: number }) => HTMLElement;
```

| Parameter    | Type     | Range        | Description                                                                                       |
| ------------ | -------- | ------------ | ------------------------------------------------------------------------------------------------- |
| `durationS`  | `number` | 10–16 (bird) | Total flight duration in seconds; set as `--flight-duration` CSS variable on the returned element |
| `laneTopPct` | `number` | 5–30         | Vertical position within the `.sky-flying-objects` container as a percentage; set as `--lane-top` |

**Returns**: The outer container `HTMLElement`, with class `sky-flying-object sky-flying-object--<kind>`, ready to `container.append()`. The `animationend` cleanup listener is attached by `spawnFlyingObject` in `sky-controller.js` (not by the renderer), keeping renderers pure DOM-factories.

---

### 3. Bird Flying Object Element (DOM Subtree)

Created by `createBirdElement({ durationS, laneTopPct })`.

```
div.sky-flying-object.sky-flying-object--bird   ← outer container
  [data-wavy-profile="a" | "b"]
  style="--lane-top: {laneTopPct}%; --flight-duration: {durationS}s"
  animation: fly-wavy-a | fly-wavy-b

  └── div.sky-bird-sprite                        ← inner sprite
        style="--wingbeat-duration: {n}s; --wingbeat-phase: -{m}s"
        animation: bird-wingbeat steps(10) infinite
```

**Outer container CSS variables**:

| Variable            | Source             | Example |
| ------------------- | ------------------ | ------- |
| `--lane-top`        | `laneTopPct` param | `12%`   |
| `--flight-duration` | `durationS` param  | `13.2s` |

**Inner sprite CSS variables**:

| Variable              | Randomised range                            | Description                                                       |
| --------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| `--wingbeat-duration` | 0.4 s – 0.9 s                               | Full 10-frame cycle duration; lower = faster flap                 |
| `--wingbeat-phase`    | −(wingbeat-duration) – 0 s (negative delay) | Shifts the start frame so consecutive birds are not in phase-lock |

**`data-wavy-profile` attribute**: `"a"` or `"b"`, chosen at random per spawn. Controls which `@keyframes` (fly-wavy-a or fly-wavy-b) is applied via the CSS class's `animation-name`. (Alternatively the animation-name can be set inline on the element's style — implementation detail to be decided in tasks.)

---

### 4. Bird Sprite Asset

| Property                    | Value                                                |
| --------------------------- | ---------------------------------------------------- |
| Path                        | `web/vendor/bird-cells-new.svg`                      |
| Format                      | SVG, single horizontal strip                         |
| Dimensions                  | 900 px wide × 90 px tall                             |
| Frames                      | 10, each 90 × 90 px                                  |
| Frame order                 | Left-to-right; frame 0 at `background-position-x: 0` |
| Background-size used in CSS | `900px 90px`                                         |
| Keyframe shift              | `background-position-x: 0 → -900px` at `steps(10)`   |

---

### 5. CSS Animations

#### `bird-wingbeat`

Steps through all 10 sprite frames in one cycle. Applied to `.sky-bird-sprite`.

| Property                    | Value                                                      |
| --------------------------- | ---------------------------------------------------------- |
| `animation-name`            | `bird-wingbeat`                                            |
| `animation-duration`        | `var(--wingbeat-duration, 0.6s)`                           |
| `animation-timing-function` | `steps(10)`                                                |
| `animation-iteration-count` | `infinite`                                                 |
| `animation-delay`           | `var(--wingbeat-phase, 0s)` (negative for mid-cycle start) |

#### `fly-wavy-a` (wavy profile A — gentle hump)

Applied to the outer container when `data-wavy-profile="a"`.

| Keyframe stop | `transform`                                     | Description            |
| ------------- | ----------------------------------------------- | ---------------------- |
| `0%`          | `translateX(-10vw) translateY(0) scale(0.6)`    | Enter from left, small |
| `25%`         | `translateX(20vw) translateY(-2vh) scale(0.8)`  | Rise gently            |
| `50%`         | `translateX(55vw) translateY(-4vh) scale(1.0)`  | Peak, full size        |
| `75%`         | `translateX(85vw) translateY(-2vh) scale(0.85)` | Descend                |
| `100%`        | `translateX(110vw) translateY(0) scale(0.7)`    | Exit right             |

#### `fly-wavy-b` (wavy profile B — irregular undulation)

Applied to the outer container when `data-wavy-profile="b"`.

| Keyframe stop | `transform`                                     | Description                  |
| ------------- | ----------------------------------------------- | ---------------------------- |
| `0%`          | `translateX(-10vw) translateY(0) scale(1.0)`    | Enter from left, full size   |
| `20%`         | `translateX(15vw) translateY(3vh) scale(0.75)`  | Dip down                     |
| `45%`         | `translateX(45vw) translateY(-3vh) scale(1.1)`  | Rise higher, slightly larger |
| `70%`         | `translateX(80vw) translateY(1vh) scale(0.9)`   | Minor dip                    |
| `100%`        | `translateX(110vw) translateY(-1vh) scale(0.8)` | Exit right                   |

**Note**: Both profiles use `linear` timing on the outer container; the scale + translateY
changes within the keyframe create the illusion of altitude variation without JS involvement.

---

### 6. Duration Ranges (Retained in `sky-controller.js`)

`FLYING_OBJECT_KIND_CONFIG` is slimmed to duration ranges only (glyph field removed):

```js
const KIND_DURATION_RANGES = {
  bird: [10, 16], // seconds
  plane: [18, 26],
  balloon: [22, 32],
  rocket: [8, 12],
};
```

---

## State Transitions

Flying objects have a single, linear lifecycle:

```
[Scheduler fires] → createBirdElement() → append to .sky-flying-objects
                 → [CSS animation runs] → animationend fires
                 → el.remove() → [gone from DOM]
```

Multiple birds may be in-flight simultaneously; each lifecycle is independent with no shared state.

---

## Validation Rules

| Rule                   | Enforcement                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `laneTopPct` ∈ [5, 30] | Caller (`spawnFlyingObject`) is responsible; no assertion in renderer (simple factory)                                                 |
| `durationS` > 0        | Caller responsible; CSS silently ignores ≤0 duration                                                                                   |
| Sprite 404             | CSS renders invisible box; `animationend` still fires; `el.remove()` runs cleanly (FR-009 edge case)                                   |
| Renderer returns null  | Not possible for `createBirdElement` — it always returns an `HTMLElement`. The `null` guard is only for disabled kinds in the registry |
