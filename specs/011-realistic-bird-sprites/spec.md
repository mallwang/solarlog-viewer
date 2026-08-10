# Feature Specification: Realistic Bird Sprites & Flying Object Renderer Registry

**Feature Branch**: `011-realistic-bird-sprites`

**Created**: 2026-08-10

**Status**: Draft

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Realistic Birds Cross the Sky (Priority: P1)

A visitor watching the animated sky background sees one or several small birds
fly across the viewport from left to right at irregular intervals, with wings
that visibly flap and a gently wavy flight path. The birds look like actual
silhouetted birds — not emojis — and each crossing feels slightly different
in size, height, and wingbeat cadence.

**Why this priority**: Visible, immediate quality improvement that replaces the
existing emoji placeholder for the feature's most frequently spawned object
type. Delivers the core aesthetic upgrade on its own.

**Independent Test**: Can be fully tested by loading the site and observing
birds spawning over a 30-second window. Value delivered: visually convincing
birds that differ from one spawn to the next.

**Acceptance Scenarios**:

1. **Given** the sky background is active and motion is not reduced, **When** a
   bird spawn fires (within 10–25 s), **Then** a silhouette bird with visibly
   flapping wings appears and crosses the full viewport from left to right before
   being removed from the DOM.

2. **Given** multiple bird spawns occur in sequence, **When** each bird is
   observed, **Then** no two consecutive birds share exactly the same vertical
   lane, wingbeat speed, or apparent size (scale).

3. **Given** `prefers-reduced-motion` is active or the sky controller's
   reduced-motion flag is set, **When** a bird spawn would otherwise fire,
   **Then** no bird element is added to the DOM (existing gating is preserved).

4. **Given** the sprite asset fails to load (network error / missing file),
   **When** a bird spawns, **Then** the container element is still added and
   removed cleanly — no JavaScript error is thrown and no layout breakage occurs.

---

### User Story 2 — Other Flying Objects Are Quietly Disabled (Priority: P2)

While the bird renderer is being built, all other flying object kinds
(plane, balloon, rocket) are invisible. The site loads and runs without errors
or console warnings, the scheduler continues to run internally, and re-enabling
a kind in the future requires only adding its renderer implementation.

**Why this priority**: Prevents half-finished emoji objects from appearing
alongside the new bird sprites while the renderer registry is established.

**Independent Test**: Load the site for 5 minutes; no plane, balloon, or
rocket element appears in the DOM. No JavaScript errors.

**Acceptance Scenarios**:

1. **Given** the scheduler fires a `plane`, `balloon`, or `rocket` spawn,
   **When** `spawnFlyingObject` is called for that kind, **Then** no element is
   added to `.sky-flying-objects` and no error is thrown.

2. **Given** a developer wants to re-enable the `plane` kind, **When** they
   implement its renderer function and assign it in the renderer registry,
   **Then** planes appear without any other code change.

---

### User Story 3 — Future Flying Objects Follow a Consistent Pattern (Priority: P3)

A developer adding a new kind of flying object (e.g., a snowflake, an
airplane with a proper SVG, or a hot-air balloon) has a single, documented
extension point: implement a renderer function `({ durationS, laneTopPct }) =>
HTMLElement` and register it in the renderer registry. The scheduler's timing
bands are a separate, independent concern.

**Why this priority**: Architectural quality of life — not immediately visible
to end users but prevents future duplication and keeps the sky system coherent.

**Independent Test**: A developer can add a fifth kind end-to-end — scheduler
entry + renderer + CSS — in a single self-contained diff, with no changes to
any other sky module.

**Acceptance Scenarios**:

1. **Given** a new kind `snow` is added to the renderer registry with a simple
   renderer, **When** the scheduler is extended with a `snow` band, **Then**
   snowflakes appear in the sky without modifying `sky-controller.js`'s
   `spawnFlyingObject` function body.

2. **Given** an existing renderer for `bird` exists, **When** a developer reads
   `flying-object-renderers.js`, **Then** the pattern required to add a new kind
   is self-evident from the existing implementation.

---

### Edge Cases

- What happens when the sprite asset URL resolves to a 404? The container
  element renders as an invisible moving box; it is removed cleanly on
  `animationend`. No error thrown.
- How does the system handle extremely fast spawn intervals (manual testing)?
  Each spawn creates an independent element; multiple birds can be in-flight
  simultaneously without interference.
- What if the viewport is very narrow (mobile)? The wavy-path keyframes use
  `vw`/`vh` units and scale gracefully — birds still cross the full width.
- What if the flight duration CSS variable is missing? Each animation falls
  back to a defined default duration via CSS `var(--flight-duration, 14s)`.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST display birds as SVG sprite-sheet animations
  (frame-stepped background-position cycle) instead of emoji text content.

- **FR-002**: Each bird spawn MUST randomise its vertical lane (within the upper
  sky band), apparent scale (via the wavy-path keyframe's built-in scale
  progression), wingbeat duration, and initial wingbeat phase offset so
  consecutive birds look distinct.

- **FR-003**: The system MUST support at least two distinct wavy flight-path
  profiles, chosen at random per spawn, to vary the vertical undulation pattern
  and scale progression visible to the user.

- **FR-004**: The bird sprite asset MUST be hosted locally (bundled with the
  site) so the feature works without an internet connection and without
  dependency on a third-party CDN.

- **FR-005**: The system MUST provide a renderer registry (`FLYING_OBJECT_RENDERERS`)
  mapping each flying-object kind to either a factory function or `null`.
  A `null` value disables that kind without altering the scheduler.

- **FR-006**: `sky-controller.js`'s `spawnFlyingObject` MUST delegate visual
  element creation entirely to the renderer registry and MUST NOT contain
  any kind-specific branching logic (no `if kind === 'bird'` etc.).

- **FR-007**: The plane, balloon, and rocket kinds MUST be registered as `null`
  in the renderer registry, effectively disabling them while the bird renderer
  is the only active implementation.

- **FR-008**: The `animationend`-based DOM cleanup MUST remain unchanged — each
  spawned element is removed from the DOM when its flight animation ends.

- **FR-009**: The existing reduced-motion gating in `sky-controller.js` MUST
  continue to suppress all flying-object spawning when active (no change
  required to that logic).

- **FR-010**: All existing unit tests for `flying-objects.js` and
  `sky-controller.js` MUST continue to pass without modification.

### Key Entities

- **Renderer Registry**: A map of `kind → RendererFn | null`. Each
  `RendererFn` accepts `{ durationS: number, laneTopPct: number }` and returns
  a fully configured `HTMLElement` ready to append to `.sky-flying-objects`.

- **Bird Sprite**: An SVG sprite sheet containing 10 animation frames of a
  bird silhouette in a single horizontal strip, stepped through via CSS
  `background-position` at `steps(10)` timing.

- **Flying Object Element**: The DOM subtree created by a renderer — an outer
  container `div` carrying the flight-path animation, and an inner `div`
  carrying the wingbeat sprite animation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Birds appear visually indistinguishable from a real CSS sprite
  animation when observed for 60 seconds — no emoji glyphs, no blurry scaling
  artefacts.

- **SC-002**: No plane, balloon, or rocket element appears in the
  `.sky-flying-objects` container during a 5-minute observation window.

- **SC-003**: Adding a sixth flying-object kind requires changes to at most
  3 files (renderer registry, scheduler bands, CSS), with zero changes to
  `sky-controller.js`'s `spawnFlyingObject` function body.

- **SC-004**: All existing automated tests (unit + e2e) pass without
  modification after the feature is implemented.

- **SC-005**: The bird sprite asset loads from a local path with no external
  network request at runtime.

## Assumptions

- The SVG sprite sheet (`bird-cells-new.svg`) from the referenced CodePen is
  licensed for reuse or will be treated as a self-hosted third-party asset
  placed in `web/vendor/`.
- The 10-frame, 900 px-wide sprite format of the CodePen asset is fixed and
  the CSS `steps(10)` / `-900px` keyframe values are derived from it.
- Mobile-width support is in scope; the bird must cross the full viewport on
  all screen sizes. The wavy-path keyframes already use `vw`/`vh` units.
- Sound / haptic feedback is out of scope.
- The scheduler timing bands for birds (10–25 s) remain unchanged.
- The `fly-across` and `fly-to-moon` CSS keyframes used by the now-disabled
  kinds are retained in the stylesheet so re-enabling them in the future
  requires no CSS archaeology.
