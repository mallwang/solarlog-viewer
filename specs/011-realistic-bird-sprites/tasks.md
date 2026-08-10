# Tasks: Realistic Bird Sprites & Flying Object Renderer Registry

**Input**: Design documents from `/specs/011-realistic-bird-sprites/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Tests**: Playwright e2e tests are required per the project constitution
("Tests before implementation: Failing Playwright tests MUST exist before implementation begins").
Unit tests included for the new pure-logic renderer module.

**TDD note**: Test tasks (T005, T006, T008) MUST be completed and confirmed failing before
their corresponding implementation tasks (T007, T009).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P]-marked tasks at the same phase
- **[Story]**: Which user story this task belongs to (US1 / US2 / US3)
- All file paths are repository-relative

---

## Phase 1: Setup (Asset)

**Purpose**: Provision the bird SVG sprite asset before any code is written.
No code task can reference the asset until this is complete.

- [ ] T001 Create the 10-frame bird silhouette SVG sprite strip (900 × 90 px, each frame 90 × 90 px) and save to `web/vendor/bird-cells-new.svg` — source from the referenced CodePen asset or draw an equivalent open-licensed SVG wing-cycle; verify 10 equal frames in a single horizontal strip

---

## Phase 2: Foundational (CSS + Registry Scaffold)

**Purpose**: CSS animations and the renderer registry stub must exist before any user story
can be implemented. The refactored `spawnFlyingObject` dispatcher depends on the registry.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Add bird CSS to `web/css/app.css`: `.sky-bird-sprite` ruleset (`background-image: url('/vendor/bird-cells-new.svg')`, `background-size: 900px 90px`, `background-repeat: no-repeat`), `@keyframes bird-wingbeat` (`background-position-x: 0 → -900px` at `steps(10)`), `@keyframes fly-wavy-a` and `@keyframes fly-wavy-b` (see data-model.md §5 for keyframe stop tables); remove the `font-size: 1.75rem` / `text-content`-oriented rule from `.sky-flying-object--bird`

- [ ] T003 Create `web/js/sky/flying-object-renderers.js` with: file-level JSDoc block, `@typedef {function({durationS: number, laneTopPct: number}): HTMLElement} RendererFn` JSDoc typedef, and `export const FLYING_OBJECT_RENDERERS` initialised with `{ bird: null, plane: null, balloon: null, rocket: null }` — all null at this stage

- [ ] T004 Refactor `spawnFlyingObject` in `web/js/sky/sky-controller.js`: import `FLYING_OBJECT_RENDERERS` from `./flying-object-renderers.js`; replace `FLYING_OBJECT_KIND_CONFIG` (which held `glyph`) with a `KIND_DURATION_RANGES` map (duration ranges only); rewrite `spawnFlyingObject` to look up `FLYING_OBJECT_RENDERERS[kind]`, return early if `null`, compute `durationS`/`laneTopPct` from duration range and `Math.random()`, call `renderer({ durationS, laneTopPct })`, attach `animationend` cleanup listener, and append to container — no `if kind === '...'` branching

**Checkpoint**: Foundation ready — `spawnFlyingObject` delegates to registry; all kinds silently no-op (all null). Site loads without errors. Existing `sky.spec.js` tests pass (birds no longer appear, which the existing test `'not.toHaveCount(0)'` will now fail — this is expected and will be fixed in T007).

---

## Phase 3: User Story 1 — Realistic Birds Cross the Sky (Priority: P1) 🎯 MVP

**Goal**: Birds appear as CSS sprite-sheet silhouettes with flapping wings, random lane/speed/profile, and clean DOM lifecycle.

**Independent Test**: Load the site, observe for 30 seconds. A bird with animated wing-flap and no emoji content appears and crosses the full viewport.

### Tests for User Story 1 ⚠️ Write first — confirm failing before T007

- [ ] T005 [US1] Write failing unit tests in `web/js/sky/flying-object-renderers.test.js`: (1) `createBirdElement` returns an `HTMLElement` with class `sky-flying-object sky-flying-object--bird`; (2) outer element has `--lane-top` and `--flight-duration` CSS vars set to the passed values; (3) outer element contains a child `.sky-bird-sprite`; (4) `.sky-bird-sprite` has `--wingbeat-duration` set within [0.4, 0.9] s; (5) `textContent` of outer element is empty; (6) calling 10 times produces at least two distinct `data-wavy-profile` values (`"a"` and `"b"`)

- [ ] T006 [US1] Write failing Playwright tests in `tests/e2e/sky-birds.spec.js`: (1) after `clock.fastForward(30s)` a `.sky-flying-object--bird` element exists; (2) its `textContent` is empty (no emoji); (3) it contains a `.sky-bird-sprite` child; (4) after `clock.fastForward` past flight duration the element is removed from DOM (`animationend` cleanup); (5) when the SVG is intercepted to return 404 (`page.route()`), spawning produces no `pageerror` and the element is still removed from DOM

### Implementation for User Story 1

- [ ] T007 [US1] Implement `createBirdElement({ durationS, laneTopPct })` in `web/js/sky/flying-object-renderers.js` (with full JSDoc `@param`/`@returns`): create outer `div.sky-flying-object.sky-flying-object--bird` with `data-wavy-profile` attribute (`"a"` or `"b"` chosen at random), `--lane-top` and `--flight-duration` CSS vars; create inner `div.sky-bird-sprite` with `--wingbeat-duration` (random 0.4–0.9 s) and `--wingbeat-phase` (negative random offset in `[-wingbeatDuration, 0]` s) CSS vars; append inner to outer; return outer — then set `FLYING_OBJECT_RENDERERS.bird = createBirdElement`

**Checkpoint**: `node --test web/js/sky/flying-object-renderers.test.js` passes. `npx playwright test tests/e2e/sky-birds.spec.js` US1 tests pass. `npx playwright test tests/e2e/sky.spec.js` passes (update the `'not.toHaveCount(0)'` assertion in the existing bird-spawns test if needed).

---

## Phase 4: User Story 2 — Other Flying Objects Are Quietly Disabled (Priority: P2)

**Goal**: No plane, balloon, or rocket element ever appears in `.sky-flying-objects`. No errors.

**Independent Test**: Fast-forward 5 minutes in Playwright; assert no `.sky-flying-object:not(.sky-flying-object--bird)` in DOM, no `pageerror`.

### Tests for User Story 2 ⚠️ Write first — confirm failing before T009

- [ ] T008 [US2] Add Playwright test for US2 in `tests/e2e/sky-birds.spec.js`: `clock.fastForward(5 * 60 * 1000)`, then assert `page.locator('.sky-flying-object:not(.sky-flying-object--bird)').count()` equals 0 and no `pageerror` was emitted during the run

### Implementation for User Story 2

- [ ] T009 [US2] Verify and annotate null entries in `web/js/sky/flying-object-renderers.js`: add an inline JSDoc comment above each null entry in `FLYING_OBJECT_RENDERERS` explaining it is intentionally disabled pending a future renderer implementation (e.g., `// plane renderer not yet implemented — set to null to disable spawning (FR-007)`); confirm `spawnFlyingObject`'s `if (!renderer) return` in `sky-controller.js` already gates these correctly

**Checkpoint**: `npx playwright test tests/e2e/sky-birds.spec.js` US2 test passes.

---

## Phase 5: User Story 3 — Future Flying Objects Follow a Consistent Pattern (Priority: P3)

**Goal**: The extension contract is self-evident to any developer reading `flying-object-renderers.js`. Adding a new kind requires changes to exactly 3 files.

**Independent Test**: Code-review assertion — `spawnFlyingObject` body contains no `if kind === '...'` or `switch(kind)` branching.

### Implementation for User Story 3

- [ ] T010 [P] [US3] Expand JSDoc in `web/js/sky/flying-object-renderers.js`: add an `@example` block to the `FLYING_OBJECT_RENDERERS` JSDoc showing the minimal 3-file diff to add a new kind (`flying-object-renderers.js` registry entry + `flying-objects.js` scheduler band + `app.css` keyframe); ensure the `RendererFn` `@typedef` fully documents the `durationS`/`laneTopPct` contract

- [ ] T011 [P] [US3] Add a one-sentence comment above `spawnFlyingObject` in `web/js/sky/sky-controller.js` stating that kind-specific logic MUST NOT be added to this function — new kinds extend only via the renderer registry

**Checkpoint**: `spawnFlyingObject` body contains zero kind-specific branches. JSDoc in `flying-object-renderers.js` makes the extension pattern self-evident.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Lint, full test suite, and documentation updates required by the project constitution.

- [ ] T012 [P] Run `npm run lint` across all new and modified files; fix any ESLint errors in `web/js/sky/flying-object-renderers.js`, `web/js/sky/flying-object-renderers.test.js`, `web/js/sky/sky-controller.js`, `tests/e2e/sky-birds.spec.js`

- [ ] T013 Run `npm test` (full Playwright + unit suite) and confirm exit 0; update `tests/e2e/sky.spec.js` bird-spawn assertion if the test now needs to assert on `.sky-bird-sprite` presence rather than bare `.sky-flying-object` count

- [ ] T014 [P] Update `README.md` and `README.de.md`: add a brief mention of the bird sprite upgrade and the renderer registry extension point under the sky background section (per constitution documentation standard)

- [ ] T015 [P] Update `docs/user-guide.md` and `docs/user-guide.de.md`: note that birds are now silhouette sprites (visual improvement, no user action required); keep to one or two sentences

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (T001) → Phase 2 (T002–T004) → Phase 3 (T005–T007) → Phase 4 (T008–T009)
                                                                       ↓
                                                              Phase 5 (T010–T011)
                                                                       ↓
                                                              Phase 6 (T012–T015)
```

- **Phase 1**: No dependencies — start immediately
- **Phase 2**: Depends on T001 (SVG asset must exist for CSS `url()` reference to be verifiable)
- **Phase 3**: Depends on Phase 2 completion (registry + CSS must be in place)
- **Phase 4**: Depends on Phase 2 completion; can begin in parallel with Phase 3 (different files: T008 is a test file, T009 is comments only — no conflict with T007)
- **Phase 5**: Depends on Phase 3 + Phase 4 complete (full registry state known)
- **Phase 6**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2 foundation
- **US2 (P2)**: Depends only on Phase 2 foundation; can overlap with US1 (test + annotation are non-conflicting)
- **US3 (P3)**: Depends on US1 + US2 complete (documents the final registry state)

### Within Each User Story

- Test tasks MUST be written and confirmed failing before implementation tasks
- Unit tests (T005) before renderer implementation (T007)
- Playwright test (T006) before integration is observable in the browser

### Parallel Opportunities

Within **Phase 2**: T002 (CSS) and T003 (registry stub) can be written in parallel — different files. T004 depends on T003 (imports registry).

Within **Phase 3**: T005 (unit tests) and T006 (Playwright tests) can be written in parallel — different files.

Within **Phase 5**: T010 and T011 are different files — run in parallel.

Within **Phase 6**: T012, T014, T015 are independent — run in parallel. T013 (full test run) runs after T012.

---

## Parallel Example: Phase 2

```
Developer A                        Developer B
───────────────────────────────    ───────────────────────────────
T002: Add bird CSS to app.css  →   T003: Create renderers.js stub
                                         ↓
                                   T004: Refactor sky-controller.js
                                         (depends on T003)
```

---

## Implementation Strategy

**MVP (User Story 1 only)**: Complete Phases 1–3. Birds appear as proper sprites.
Deliverable: `web/vendor/bird-cells-new.svg` + CSS additions + `flying-object-renderers.js`
with `createBirdElement` + refactored `sky-controller.js`. Passes all tests.

**Full feature**: Continue with Phase 4 (disable other kinds — already architecturally done
by null entries, just needs tests + comments) and Phase 5 (extension docs). Phase 6 required
before any commit is pushed.

**Total tasks**: 15  
**Tasks per story**: US1 = 3 (T005–T007), US2 = 2 (T008–T009), US3 = 2 (T010–T011)  
**Setup/Foundational**: 4 (T001–T004)  
**Polish**: 4 (T012–T015)
