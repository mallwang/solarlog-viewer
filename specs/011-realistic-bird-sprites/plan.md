# Implementation Plan: Realistic Bird Sprites & Flying Object Renderer Registry

**Branch**: `011-realistic-bird-sprites` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-realistic-bird-sprites/spec.md`

## Summary

Replace the existing emoji-based bird glyph (`🐦`) in the sky background's flying-object
system with a CSS sprite-sheet animation driven by a locally-hosted 10-frame SVG strip
(`web/vendor/bird-cells-new.svg`). Each bird spawn randomises its vertical lane, apparent
scale (encoded in the two wavy-path keyframe profiles), wingbeat speed, and phase offset so
consecutive birds look distinct. Alongside the visual upgrade, a **renderer registry**
(`FLYING_OBJECT_RENDERERS` in the new `flying-object-renderers.js` module) is introduced so
`sky-controller.js`'s `spawnFlyingObject` contains zero kind-specific branching — it simply
looks up the renderer for the spawned kind, calls it if non-null, and appends the resulting
element. Plane, balloon, and rocket are registered as `null`, disabling them cleanly while
the bird renderer is the only active implementation. See [research.md](./research.md) for
all design decisions.

## Technical Context

**Language/Version**: JavaScript ES2022+ (native ES modules) + CSS3 — identical to the
existing `web/js/` and `web/css/` codebase. No new build tooling introduced.

**Primary Dependencies**: None new. The browser's native `fetch`, `setInterval`, CSS
`@keyframes`/custom properties, and `background-position` animation. The only new runtime
asset is `web/vendor/bird-cells-new.svg` (locally committed, zero CDN dependency — FR-004).

**Storage**: N/A. No `localStorage`, IndexedDB, SQLite, or `.js` data file changes.

**Testing**: `node --test` unit tests in `web/js/sky/flying-object-renderers.test.js`
(pure renderer logic — element structure, CSS variable values, randomisation contracts);
Playwright e2e in `tests/e2e/sky-birds.spec.js` (sprite element present in DOM after spawn,
no emoji text content, reduced-motion suppression, sprite load error degrades cleanly);
existing `tests/e2e/sky.spec.js` tests continue to pass without modification.

**Target Platform**: Browser (static site deployment) — same as all of `web/`.

**Project Type**: Single web project (`web/` tree); no new top-level project directory.

**Performance Goals**: Each spawn adds one composite-layer `div` pair (outer flight +
inner sprite). The wingbeat animation is pure CSS (`steps(10)`), GPU-composited. Multiple
birds may be in-flight simultaneously without interference (each is an independent DOM
subtree). No continuous JS loop per-bird — cleanup is event-driven (`animationend` on the
outer container). Target: ≤1 ms JS per spawn on a mid-range device.

**Constraints**: Offline-capable (FR-004 — all assets local). `prefers-reduced-motion`
gating unchanged (FR-009). Sprite 404 must be a silent no-op with no JS error (FR-009 /
edge-case spec). Mobile-width support required (320 px – 2560 px, Principle IV).

**Scale/Scope**: One new JS module (~60–80 lines), one CSS addition (~50 lines), one SVG
vendor asset, two test files. Scope is deliberately narrow.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                  | Applies? | Status     | Notes                                                                              |
| ------------------------------------------ | -------- | ---------- | ---------------------------------------------------------------------------------- |
| I — Static-File Data Model is Sacred       | No       | ✅ Pass    | No SolarLog `.js` data files touched                                               |
| II — Zero Historical Data Loss             | No       | ✅ Pass    | Visual-only change; no data reading or writing                                     |
| III — No Backend Introduction              | Yes      | ✅ Pass    | Purely client-side; new asset is a static file committed to `web/vendor/`          |
| IV — Responsive-First Layout               | Yes      | ✅ Pass    | Flight-path keyframes use `vw`/`vh` units; birds cross full viewport at all widths |
| V — Modern Charting (no pixel math)        | No       | ✅ Pass    | Not applicable                                                                     |
| VI — Preserve All Five Visualization Modes | No       | ✅ Pass    | Not applicable; no route/chart changes                                             |
| Frontend Standard — Vanilla JS/CSS         | Yes      | ✅ Pass    | No framework introduced; new module uses ES modules                                |
| Testing Standard — Playwright e2e required | Yes      | ✅ Pass    | New `sky-birds.spec.js` covers visual regression and DOM-cleanup scenarios         |
| JSDoc / File-level description required    | Yes      | ⬜ Pending | Must be satisfied in implementation                                                |

**Post-design re-check**: No new violations identified after Phase 1 design.

## Project Structure

### Documentation (this feature)

```text
specs/011-realistic-bird-sprites/
├── plan.md              # This file
├── research.md          # Phase 0 output ✅
├── data-model.md        # Phase 1 output ✅
├── quickstart.md        # Phase 1 output ✅
└── tasks.md             # Phase 2 output (created by /speckit-tasks)
```

### Source Code (repository root)

```text
web/
├── vendor/
│   └── bird-cells-new.svg           # NEW: 10-frame SVG sprite strip (900 × 90 px)
├── css/
│   └── app.css                      # MODIFIED: add bird-wingbeat keyframe, .sky-bird-sprite,
│                                    #           update fly-wavy-a / fly-wavy-b keyframes,
│                                    #           remove emoji font-size rule from --bird
├── js/
│   └── sky/
│       ├── flying-object-renderers.js       # NEW: renderer registry + createBirdElement()
│       ├── flying-object-renderers.test.js  # NEW: unit tests for renderer module
│       └── sky-controller.js                # MODIFIED: use renderer registry, drop glyph logic

tests/
└── e2e/
    ├── sky.spec.js         # UNCHANGED (existing tests continue to pass)
    └── sky-birds.spec.js   # NEW: Playwright tests for bird sprite behaviour
```

**Structure Decision**: Single `web/` project. No new top-level directory. The renderer
module sits alongside the existing sky modules in `web/js/sky/`. The vendor asset joins
the existing `web/vendor/apexcharts/` precedent for locally-committed third-party assets.
