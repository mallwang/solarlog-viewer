# Quickstart: Validating the Global Desktop Info Panel

## Prerequisites

- Dependencies installed: `npm install`
- Dev server running: `npm start` (browser-sync; copy the printed URL into your browser —
  see `CLAUDE.md`, do not use the VS Code built-in preview)
- Playwright browsers installed (`npx playwright install` if not already done)

## 1. Unit tests (pure logic modules)

```bash
node --test "web/js/info-panel/*.test.js"
```

Expected: all pass, covering (per module):

- `production-animation.test.js` — `productionIntensity()` boundary values (0 W → idle tier,
  values across each tier's threshold, ≥ ~90% of `capacityKwp` → peak tier, values above
  nameplate capacity clamp rather than overflow).
- `weather-forecast-client.test.js` — successful response parsed into `{ weatherCode,
  temperatureC, todayWeatherCode, todayMaxC, todayMinC, available: true }`; failed/malformed
  response resolves to `available: false` (mocked `fetch`, no real network call).
- `wetteronline-link.test.js` — address correctly URL-encoded into the search URL; empty/
  missing address returns `null` rather than a broken URL.

## 2. Manual smoke test — current production + animation (User Story 1 & 4)

1. Open the dashboard in the browser at a desktop-width window (≥ 768px).
2. Confirm the info panel is visible in the header area and shows a current production value
   matching `data/min_cur.js`'s latest reading (compare against the existing dashboard
   "Current production" widget, which reads the same file).
3. Confirm the production animation is visibly calmer near-zero output (e.g. at night) and
   visibly more active near the plant's peak (`AnlagenKWP` in `data/base_vars.js`).
4. In DevTools, block requests to `data/min_cur.js` and reload → the production side of the
   panel should show a clear "unavailable" state; the rest of the panel (weather) should
   still attempt to render normally (FR-008).

## 3. Manual smoke test — weather + today's forecast (User Story 2)

1. Open DevTools → Network, confirm one request to `api.open-meteo.com/v1/forecast?...
   weather_code...` fires shortly after load.
2. Confirm the panel shows a current weather label and today's forecast summary
   (min/max temperature and/or condition) for the installation's configured location.
3. Block requests to `api.open-meteo.com` and reload → the weather/forecast side of the
   panel should show a clear "unavailable" state; the production value should still display
   normally (FR-008).

## 4. Manual smoke test — wetteronline.com link (User Story 3)

1. Click (or tap) the weather/forecast area of the panel.
2. Confirm a new browser tab opens to `https://www.wetteronline.de/suche?q=...` with the
   installation's configured address (`HPStandort` in `data/base_vars.js`) as the query.
3. Confirm the original dashboard tab is unaffected (still on the same page/route).

## 5. Manual smoke test — desktop-only visibility

1. Resize the browser window (or use DevTools device toolbar) from desktop width down past
   768px → the info panel should disappear entirely, contributing no layout space or gap.
2. Resize back up past 768px → the panel should reappear and repopulate without a full page
   reload.

## 6. Manual smoke test — persistence across navigation

1. With the panel visible, navigate between dashboard/day/month/year/total views via the nav.
2. Confirm the panel remains visible and its values are retained (not re-fetched from
   scratch or blanked) across each in-app route change (FR-011).

## 7. Automated e2e coverage

```bash
npx playwright test tests/e2e/info-panel.spec.js --reporter=line
```

Expected scenarios (network-mocked via Playwright route interception, `page.setViewportSize`
for desktop/mobile widths — no dependency on real-world weather/production data at test run
time):

- Desktop viewport: panel renders with production value and weather/forecast summary from
  mocked responses.
- Mobile viewport: panel is not rendered / occupies no layout space.
- Clicking the weather area opens the expected wetteronline.com search URL in a new tab
  (`page.context().waitForEvent('page')` or `target=_blank` assertion).
- Mocked `min_cur.js` failure → production side shows "unavailable" while weather side still
  renders from its own mocked success response, and vice versa.
