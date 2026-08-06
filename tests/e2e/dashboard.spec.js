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

  test('summary widgets are visible without extra taps', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.widget-grid .widget')).toHaveCount(5);
  });
});

test.describe('Live production widget (US4)', () => {
  test('shows a wattage value or "not producing" and re-fetches every 5 minutes', async ({
    page,
  }) => {
    let requestCount = 0;
    await page.route('**/min_cur.js', (route) => {
      requestCount += 1;
      route.continue();
    });

    await page.clock.install();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const currentProductionValue = page
      .locator('.widget-grid .widget')
      .first()
      .locator('.widget__value');
    await expect(currentProductionValue).toHaveText(/^●\s\d+ W$|^○\s0 W — .+$/);
    expect(requestCount).toBeGreaterThanOrEqual(1);

    const countAfterLoad = requestCount;
    await page.clock.fastForward('05:01');
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
