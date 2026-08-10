# Quickstart Validation Guide: Realistic Bird Sprites & Flying Object Renderer Registry

**Feature**: 011-realistic-bird-sprites  
**Phase**: 1 — Design  
**Date**: 2026-08-10

---

## Prerequisites

- Node.js 20+ and npm installed.
- `npm install` run at least once.
- Playwright browsers installed: `npx playwright install chromium` (first run only).
- `web/vendor/bird-cells-new.svg` committed — a 900 × 90 px, 10-frame SVG sprite strip.

---

## 1. Start the Development Server

```bash
npm start
```

The terminal will print a local URL (e.g., `http://localhost:3000`). Open it in a browser.
Do **not** use the VS Code built-in preview — it returns 404s for the frameset.

---

## 2. Visual Smoke Test (Manual)

**Goal**: Confirm a bird appears and looks like a silhouetted sprite, not an emoji.

1. Open the dashboard in a browser.
2. Observe the sky area for up to 30 seconds. A bird should appear and fly left-to-right.
3. Confirm:
   - The bird is a **sprite animation** (silhouette with flapping wings), not a `🐦` emoji.
   - The bird crosses the full viewport width.
   - The bird is removed from the DOM after crossing (right-click → Inspect → no lingering `.sky-flying-object` elements).
4. Wait for a second bird. Confirm it uses a **different** vertical position, apparent size,
   and/or wingbeat cadence from the first.

**Goal**: Confirm plane / balloon / rocket do NOT appear.

5. Observe for 5 minutes (or shorten `SPAWN_DELAY_BANDS_MS.rare` temporarily in DevTools
   by modifying the in-memory module). No non-bird flying object should appear in the DOM.

---

## 3. Reduced-Motion Smoke Test (Manual)

1. In DevTools → Rendering → Emulate CSS media → `prefers-reduced-motion: reduce`.
2. Reload the page.
3. Fast-forward time by opening DevTools Console and running:
   ```js
   // (Only works if fake timers are active — in e2e tests. For manual testing:)
   // Just wait 30 seconds or increase the clock with page.clock.fastForward in Playwright
   ```
4. Confirm **no** `.sky-flying-object` element is appended to the DOM.

---

## 4. Unit Tests

Run the renderer unit tests:

```bash
node --test web/js/sky/flying-object-renderers.test.js
```

Expected output: all tests pass (TAP format, exit 0).

Run the existing flying-objects scheduler tests (must remain unchanged):

```bash
node --test web/js/sky/flying-objects.test.js
```

Expected output: all tests pass.

---

## 5. Playwright End-to-End Tests

Run only the new bird-sprite spec:

```bash
npx playwright test tests/e2e/sky-birds.spec.js --reporter=line
```

Run the full sky spec suite to confirm no regressions:

```bash
npx playwright test tests/e2e/sky.spec.js tests/e2e/sky-birds.spec.js --reporter=line
```

Run the full test suite:

```bash
npm test
```

Expected: **all tests pass**, including the pre-existing navigation, dashboard, and sky specs.

---

## 6. Lint Check

```bash
npm run lint
```

Expected: exit 0, no errors or warnings.

---

## Validation Scenarios (maps to Acceptance Criteria in spec.md)

| Scenario                                                            | How to Validate                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **US1-AC1**: Bird appears and crosses viewport (motion not reduced) | Playwright `sky-birds.spec.js`: `clock.fastForward(30s)` → `.sky-flying-object--bird` count > 0                                 |
| **US1-AC2**: Consecutive birds differ in lane / wingbeat / scale    | Playwright: spawn two birds, compare `--lane-top`, `--wingbeat-duration` CSS variables — assert they differ                     |
| **US1-AC3**: `prefers-reduced-motion` suppresses spawning           | Playwright `sky.spec.js` (existing) + `sky-birds.spec.js` reduced-motion test                                                   |
| **US1-AC4**: Sprite 404 → no JS error, clean DOM cleanup            | Playwright: intercept SVG URL with `page.route()` to return 404; assert no `pageerror`, `.sky-flying-object` eventually removed |
| **US2-AC1**: Plane/balloon/rocket never appear                      | Playwright: fast-forward 5 min, assert `.sky-flying-object:not(.sky-flying-object--bird)` count = 0                             |
| **US2-AC2**: Re-enabling a kind needs only renderer assignment      | Code review: confirm adding a non-null entry to `FLYING_OBJECT_RENDERERS` is sufficient                                         |
| **US3-AC1**: New kind needs no changes to `spawnFlyingObject`       | Code review: confirm `spawnFlyingObject` body contains no kind-specific branching                                               |
| **FR-001**: No emoji text content in bird element                   | Playwright: assert `el.textContent` is empty for `.sky-flying-object--bird`                                                     |
| **SC-005**: Bird SVG loads from local path                          | Network tab: no external requests for the bird asset; or `page.route()` + `fulfill()` from local file                           |

---

## Cross-References

- Entity definitions: [data-model.md](./data-model.md)
- Design decisions: [research.md](./research.md)
- Full requirements: [spec.md](./spec.md)
