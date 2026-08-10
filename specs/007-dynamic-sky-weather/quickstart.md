# Quickstart: Validating the Dynamic Weather-Driven Sky Background

## Prerequisites

- Dependencies installed: `npm install`
- Dev server running: `npm start` (browser-sync; copy the printed URL into your browser —
  see `CLAUDE.md`, do not use the VS Code built-in preview)
- Playwright browsers installed (`npx playwright install` if not already done)

## 1. Unit tests (pure logic modules)

```bash
node --test "web/js/sky/*.test.js"
```

Expected: all pass, covering (per module):

- `cloud-density.test.js` — `cloudCoverToTier()` boundary values (0, 19, 20, 70, 71, 100).
- `solar-arc.test.js` — sun position at sunrise/solar-noon/sunset, moon position at
  midnight, and the sunrise/sunset crossfade window.
- `flying-objects.test.js` — bird cadence stays within its configured band, rocket is never
  picked while `body === 'sun'`, deterministic given a fixed RNG seed.
- `location.test.js` — override takes precedence over geocoding; invalid lat/lon (out of
  range) is rejected; `null` returned when no override/cache/geocode result is available.
- `weather-client.test.js` — successful response parsed into `{ cloudCoverPercent, tier,
sunrise, sunset, nextSunrise }`; failed/malformed response leaves last-known-good state
  untouched (mocked `fetch`, no real network call in unit tests).

## 2. Manual smoke test — weather-driven cloud density (User Story 1)

1. Open the dashboard in the browser.
2. Open DevTools → Network, confirm one request to
   `api.open-meteo.com/v1/forecast?...cloud_cover...` fires shortly after load.
3. Note the current real cloud cover for the configured installation location (e.g. check
   a weather site for the same coordinates) and confirm the rendered sky's cloud density
   (sparse/moderate/dense) visually matches the tier it should fall into.
4. In DevTools, block requests to `api.open-meteo.com` and reload → the backdrop should
   render its default (current, unchanged) heavy-cloud appearance with **no console errors**
   and no visible error UI (FR-005).

## 3. Manual smoke test — sun/moon position (User Story 2)

1. In DevTools → Sensors (or `page.clock`/`Date` override via Playwright), set the system
   clock to solar noon for the installation's location → sun should render near top-center.
2. Set the clock to just before sunset → sun should render low, toward the side matching
   its real setting direction.
3. Set the clock to a nighttime hour → a moon should render in the sun's place.
4. Step the clock across a sunrise or sunset boundary in small increments → the sun/moon
   swap should visibly crossfade rather than instantly flip.

## 4. Manual smoke test — flying objects (User Story 3)

1. Leave the dashboard open and idle for several minutes.
2. Confirm at least one bird (or small flock) crosses the sky within the first ~10 minutes.
3. Confirm no flying object ever overlaps the header, nav, or main content area (they stay
   within the sky band above/beside content, per FR-012).
4. (Optional, faster check) Temporarily lower the plane/balloon/rocket spawn-delay bounds in
   `flying-objects.js` locally, reload, and confirm each kind's animation plays start-to-
   finish and cleans up its DOM node afterward (`document.querySelectorAll('.sky-flying-object')`
   returns `[]` a few seconds after each flight ends). Revert the change before committing.

## 5. Reduced motion

1. In DevTools → Rendering → "Emulate CSS media feature `prefers-reduced-motion`" → set to
   `reduce`.
2. Reload. Confirm: cloud density/sun-moon position/day-vs-night state still reflect real
   conditions (static, no animation), no birds/planes/balloons/rockets spawn, and the
   drifting cloud CSS animation is stopped (inspect computed style: `animation-name: none`
   or equivalent).

## 6. Automated e2e coverage

```bash
npx playwright test tests/e2e/sky.spec.js --reporter=line
```

Expected scenarios (network-mocked via Playwright route interception, system clock
overridden via Playwright's clock API — no dependency on real-world weather/time at test
run time):

- Clear-sky mock → sparse/no visible clouds.
- Overcast mock → dense visible clouds.
- Weather fetch failure → default fallback appearance, zero console errors.
- Clock set to solar noon → sun near top-center; clock set to a night hour → moon shown.
- `prefers-reduced-motion: reduce` emulated → no flying-object elements appear over an
  observation window; cloud animation is disabled.

## 7. Regression check

```bash
npm run lint
npm run format:check
npx playwright test --reporter=line
node --test scripts/*.test.js "web/js/**/*.test.js"
```

All must pass before the feature is considered done (Testing standard, constitution
Development Workflow §5).
