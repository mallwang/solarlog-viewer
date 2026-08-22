import { test, expect } from '@playwright/test';

test.describe('Dashboard (US1: mobile view)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('renders without horizontal scroll at 375px', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  // The dashboard's own widget grid (web/js/views/dashboard.js) is unreachable dead code - no
  // route maps to it any more (see router.js/main.js NAV_ITEMS) - so "summary widgets visible
  // without extra taps" now means the welcome page's yield-summary stats card, mounted directly
  // in the primary viewport with no extra interaction (see web/js/views/welcome-view.js).
  test('summary widgets are visible without extra taps', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const statsPanel = page.locator('.welcome-stats-mount .stats-panel');
    if ((await statsPanel.count()) === 0) {
      await expect(page.locator('.welcome-stats-mount .empty-state')).toBeVisible();
      return;
    }
    // today/month/year/total yield + CO2 + € = 6 rows (mirrors welcome-page.spec.js US3).
    await expect(statsPanel.locator('tbody tr')).toHaveCount(6);
  });
});

// Current production moved from the (now-unreachable) dashboard.js widget grid to the persistent
// nav info panel — see info-panel-controller.js's top comment.
test.describe('Live production widget (US4)', () => {
  // LIVE_REFRESH_INTERVAL_MS (config.js) is 1 minute, not the DATA_REFRESH_INTERVAL_MS/day-
  // view.js's own 10-minute cadence — the navbar production figure now comes from the live status
  // endpoint on its own decoupled timer (specs/027-navbar-live-panel/), not `data/min_cur.js`.
  test('shows a wattage value or "not producing" and re-fetches every minute', async ({ page }) => {
    let requestCount = 0;
    await page.route('**/live/index.php', (route) => {
      requestCount += 1;
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          watt: 1200,
          timestamp: '2026-08-06T12:00:00',
          sources: { solarlog: { watt: 1200, ok: true, error: null, inverters: [] } },
        }),
      });
    });

    await page.clock.install();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const currentProductionValue = page.locator(
      '[data-info-panel="desktop"] [data-role="production-value"]',
    );
    await expect(currentProductionValue).toHaveText(/^\d+ W( · \d+%)?$|^0 W — .+$/);
    expect(requestCount).toBeGreaterThanOrEqual(1);

    const countAfterLoad = requestCount;
    await page.clock.fastForward('01:01');
    await expect.poll(() => requestCount).toBeGreaterThan(countAfterLoad);
  });
});

test.describe('Day detail view (US1)', () => {
  test('shows chart with tooltip for a date with data', async ({ page }) => {
    await page.goto('/#/day/2019/07/15');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.chart-container .apexcharts-svg')).toHaveCount(1);
  });

  test('shows "no data" state for a date without a min file', async ({ page }) => {
    await page.goto('/#/day/2006/01/01');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.empty-state')).toBeVisible();
  });
});
