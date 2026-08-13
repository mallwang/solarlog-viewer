import { test, expect } from '@playwright/test';

test.describe('Welcome page (US1: base URL landing view)', () => {
  test('base URL renders the welcome page with all three regions, not a day chart', async ({
    page,
  }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(page.url()).toMatch(/\/(#\/)?$/);
    await expect(page.locator('.carousel')).toHaveCount(1);
    await expect(page.locator('.plant-details, .empty-state')).not.toHaveCount(0);
    await expect(page.locator('.welcome-chart-mount')).toHaveCount(1);
    await expect(page.locator('.stats-panel')).toHaveCount(0);
    console.log('errors:', errors);
  });

  test('desktop viewport shows the 2/3 + 1/3 split', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const primaryBox = await page.locator('.welcome-primary').boundingBox();
    const secondaryBox = await page.locator('.welcome-secondary').boundingBox();
    expect(primaryBox).not.toBeNull();
    expect(secondaryBox).not.toBeNull();
    expect(primaryBox.width).toBeGreaterThan(secondaryBox.width * 1.5);
    // Side-by-side, not stacked.
    expect(Math.abs(primaryBox.y - secondaryBox.y)).toBeLessThan(20);
  });

  test('narrow viewport (375px) stacks carousel -> details -> chart with no horizontal scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    const carouselBox = await page.locator('.welcome-carousel-mount').boundingBox();
    const detailsBox = await page.locator('.welcome-details-mount').boundingBox();
    const chartBox = await page.locator('.welcome-chart-mount').boundingBox();
    expect(carouselBox.y).toBeLessThan(detailsBox.y);
    expect(detailsBox.y).toBeLessThan(chartBox.y);
  });

  for (const { label, href } of [
    { label: 'day', href: '/#/day/2019/07/15' },
    { label: 'month', href: '/#/month/2019/07' },
    { label: 'year', href: '/#/year/2019' },
    { label: 'total', href: '/#/total' },
  ]) {
    test(`explicit ${label} route still renders its own view, not the welcome page`, async ({
      page,
    }) => {
      await page.goto(href);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.welcome-layout')).toHaveCount(0);
    });
  }
});

test.describe('Welcome page (US2: photo carousel)', () => {
  test('2+ configured photos: more than one image reachable via prev/next controls', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const nextButton = page.locator('.carousel__next');
    await expect(nextButton).toBeVisible();
    const firstSrc = await page.locator('.carousel__slide:not([hidden])').getAttribute('src');
    await nextButton.click();
    const secondSrc = await page.locator('.carousel__slide:not([hidden])').getAttribute('src');
    expect(secondSrc).not.toBe(firstSrc);
  });

  test('exactly 1 photo: single image shown, no dead next-arrow in the DOM', async ({ page }) => {
    await page.addInitScript(() => {
      window.__PLANT_PHOTOS_OVERRIDE__ = ['plant-01.jpg'];
    });
    await page.route('**/js/config.js', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const patched = body.replace(
        /export const PLANT_PHOTOS = \[[^\]]*\];/,
        "export const PLANT_PHOTOS = ['plant-01.jpg'];",
      );
      await route.fulfill({ response, body: patched });
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.carousel img')).toHaveCount(1);
    await expect(page.locator('.carousel__next')).toHaveCount(0);
    await expect(page.locator('.carousel__prev')).toHaveCount(0);
  });

  test('0 photos: neutral placeholder present, no broken <img>', async ({ page }) => {
    await page.route('**/js/config.js', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const patched = body.replace(
        /export const PLANT_PHOTOS = \[[^\]]*\];/,
        'export const PLANT_PHOTOS = [];',
      );
      await route.fulfill({ response, body: patched });
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.carousel--empty .empty-state')).toBeVisible();
    await expect(page.locator('.carousel img')).toHaveCount(0);
  });
});

test.describe('Welcome page (US3: today at a glance)', () => {
  test('chart shows exactly one series, no efficiency/UDC legend entries', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const mount = page.locator('.welcome-chart-mount');
    const hasChart = await mount.locator('.apexcharts-svg').count();
    if (hasChart === 0) {
      await expect(mount.locator('.empty-state')).toBeVisible();
      return;
    }
    // Single-series charts render no legend at all (ApexCharts' `legend.showForSingleSeries`
    // defaults to false - same behavior the existing day-yield fallback already relies on), so
    // "no efficiency/UDC entries" holds trivially: there is no legend to hold them.
    await expect(mount.locator('.apexcharts-legend-text')).toHaveCount(0);
    await expect(mount.locator('.apexcharts-series')).toHaveCount(1);
  });

  test("with today's fetch blocked, the chart region shows .empty-state and no console error", async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.route('**/min_day.js', (route) => route.abort());

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.welcome-chart-mount .empty-state')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
