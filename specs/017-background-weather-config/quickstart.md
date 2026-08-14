# Quickstart: Validating Configurable Weather Backgrounds

## Prerequisites

- Dependencies installed: `npm install`
- Dev server running: `npm start` (browser-sync; copy the printed URL into your browser — see
  `CLAUDE.md`, do not use the VS Code built-in preview)
- Playwright browsers installed (`npx playwright install` if not already done)

## 1. Unit tests (pure logic modules)

```bash
node --test "web/js/weather/*.test.js" "web/js/sky/*.test.js" "web/js/info-panel/*.test.js"
```

Expected: all pass, covering (per module):

- `weather/weather-category.test.js` — `weatherCodeToCategory()` returns each of the five
  categories for a representative code in every bucket (research.md §3), and falls back to
  `'cloudy'` for an unrecognized code (FR-004).
- `weather/weather-render-config.test.js` (renamed from `sky/cloud-density.test.js`) —
  `WEATHER_CATEGORY_RENDER_CONFIG` defines all five categories; `rain`/`snow` set
  `hasRainLayer`/`hasSnowLayer` respectively.
- `sky/weather-client.test.js` — successful response parsed into `{ weatherCode, category,
sunrise, sunset, nextSunrise }`; failed/malformed response returns `null` (mocked `fetch`, no
  real network call).
- `info-panel/weather-forecast-client.test.js` — `weatherCodeToLabelKey`/label rendering now
  uses the shared five-category classifier (see below) rather than the old seven-bucket table.

## 2. Manual smoke test — auto mode, background matches nav bar (User Story 1)

1. Confirm `web/js/config.js` has `BACKGROUND_WEATHER = 'auto'` (the default).
2. Open the dashboard. Note the nav bar's current-weather text (e.g. "Rain").
3. Confirm the animated backdrop shows the matching treatment (rain streaks visible).
4. In DevTools, mock the Open-Meteo response (route interception, or temporarily lower
   `WEATHER_REFRESH_INTERVAL_MS`/`POLL_INTERVAL_MS` locally) to cycle through each of the five
   `weather_code` buckets from research.md §3 in turn, reloading between each — confirm the
   backdrop and nav bar text agree on every one, with no "unknown"/unclassified state ever
   shown (SC-001).
5. Block `api.open-meteo.com` entirely and reload → backdrop keeps its last-known-good category
   (or the plain default if this is the very first load), no console errors (FR-009).

## 3. Manual smoke test — `'off'` mode (User Story 2)

1. Set `BACKGROUND_WEATHER = 'off'` in `config.js`, reload.
2. Confirm the backdrop shows the pre-feature plain default appearance regardless of real
   weather, while the sun/moon still positions correctly and flying objects still spawn.
3. Confirm the nav bar's weather text is unaffected — still showing real, live conditions.

## 4. Manual smoke test — fixed override (User Story 3)

1. Set `BACKGROUND_WEATHER = 'snow'` (or any other fixed category) in `config.js`, reload under
   real weather that differs from it.
2. Confirm the backdrop always shows the "snow" treatment regardless of actual conditions, while
   the nav bar's weather text keeps reporting the real, live condition.
3. Set `BACKGROUND_WEATHER = 'not-a-real-value'` (an invalid string), reload → confirm the site
   falls back to `'auto'` behavior rather than failing to render (FR-008, SC-005).
4. Revert `config.js` to `'auto'` before committing.

## 5. Reduced motion (rain/snow layers)

1. In DevTools → Rendering → "Emulate CSS media feature `prefers-reduced-motion`" → `reduce`.
2. With `BACKGROUND_WEATHER` fixed to `'rain'`, then `'snow'`, reload each time and confirm the
   new rain-streak/snow-flake layers render statically (no motion), matching how the existing
   cloud-drift animation already stops under reduced motion.

## 6. Automated e2e coverage

```bash
npx playwright test tests/e2e/sky.spec.js tests/e2e/info-panel.spec.js --reporter=line
```

Expected scenarios (network-mocked via Playwright route interception — no dependency on
real-world weather at test run time):

- Each of the five `weather_code` buckets, `BACKGROUND_WEATHER = 'auto'` → matching
  `data-weather` value on `.sky-clouds` AND matching nav bar text, for all five.
- `BACKGROUND_WEATHER = 'off'` → no `data-weather` attribute regardless of mocked weather; nav
  bar still shows the mocked live condition.
- `BACKGROUND_WEATHER` fixed to a category → `data-weather` always that category regardless of
  mocked weather; nav bar still shows the mocked live condition.
- Invalid `BACKGROUND_WEATHER` value → behaves identically to `'auto'`.
- Weather fetch failure → last-known-good (or default) appearance retained, zero console errors.
- `rain`/`snow` treatments → new streak/flake layer elements present; absent for the other three
  categories.

## 7. Regression check

```bash
npm run lint
npm run format:check
npx playwright test --reporter=line
node --test scripts/*.test.js "web/js/**/*.test.js"
```

All must pass before the feature is considered done (Testing standard, constitution Development
Workflow §5).
