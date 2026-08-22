import { test, expect } from '@playwright/test';

// The current-production stat moved from the (now-unreachable) dashboard.js widget grid into the
// persistent nav info panel — see web/js/info-panel/info-panel-controller.js's top comment and
// web/js/views/dashboard.js's own doc comment ("Current production moved to the global nav info
// panel"). It has no `.widget-grid`/`.status-icon`/`data-status` markup any more (grep confirms
// those classes/attributes don't exist anywhere in web/); the non-color indicator is the
// `[data-role="pulse"]` dot's `data-intensity`/`data-available` state plus the always-present text
// label (see productionValueText in info-panel-controller.js), matching FR-010's "icon/text, not
// color alone" intent. Sourced from the live status endpoint (specs/027-navbar-live-panel/), not
// `data/min_cur.js` any more — see live-reading-client.js.
test.describe('Non-color status communication for the current-production stat (FR-010)', () => {
  test('"not producing" is conveyed via icon/text, not color alone', async ({ page }) => {
    await page.route('**/live/index.php', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          watt: 0,
          timestamp: '2026-08-06T22:00:00',
          sources: { solarlog: { watt: 0, ok: true, error: null, inverters: [] } },
        }),
      }),
    );

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const production = page.locator('[data-info-panel="desktop"] [data-role="production"]');
    await expect(production).toHaveAttribute('data-available', 'true');
    // A non-color indicator (the pulse dot's intensity attribute) must accompany the text label.
    await expect(production.locator('[data-role="pulse"]')).toHaveAttribute(
      'data-intensity',
      'idle',
    );
    const valueEl = production.locator('[data-role="production-value"]');
    await expect(valueEl).not.toHaveText(/^\s*$/);
    await expect(valueEl).toHaveText(/not producing|keine Einspeisung/);
  });
});
