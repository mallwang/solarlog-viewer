import { test, expect } from '@playwright/test';

/**
 * Routes both Open-Meteo hosts used by the dynamic sky background: geocoding (resolves the
 * demo plant's `HPStandort`, "92266 Ensdorf-Wolfsbach", to coordinates) and the forecast
 * endpoint (cloud cover + sunrise/sunset). Mocked so tests never depend on real network access
 * or real-world weather/time, per quickstart.md §6.
 * @param {import('@playwright/test').Page} page
 * @param {{ cloudCover?: number, sunrise?: string, sunset?: string, nextSunrise?: string,
 *   forecastAborted?: boolean }} [options]
 */
async function mockOpenMeteo(page, options = {}) {
  const {
    cloudCover = 10,
    sunrise = '2026-08-09T06:00',
    sunset = '2026-08-09T20:30',
    nextSunrise = '2026-08-10T06:02',
    forecastAborted = false,
  } = options;

  await page.route('**/geocoding-api.open-meteo.com/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ results: [{ latitude: 49.4, longitude: 12.0 }] }),
    }),
  );

  if (forecastAborted) {
    await page.route('**/api.open-meteo.com/**', (route) => route.abort());
    return;
  }

  await page.route('**/api.open-meteo.com/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        current: { cloud_cover: cloudCover },
        daily: { sunrise: [sunrise, nextSunrise], sunset: [sunset] },
      }),
    }),
  );
}

test.describe('Dynamic sky background — User Story 1 (weather-driven cloud density)', () => {
  test('a clear-sky mocked response renders sparse/no visible clouds', async ({ page }) => {
    await mockOpenMeteo(page, { cloudCover: 5 });
    await page.goto('/');
    const skyClouds = page.locator('.sky-clouds');
    await expect(skyClouds).toHaveAttribute('data-cloud-density', 'clear');
    await expect(page.locator('.cloud:not([hidden])')).toHaveCount(2);
  });

  test('an overcast mocked response renders dense visible clouds', async ({ page }) => {
    await mockOpenMeteo(page, { cloudCover: 95 });
    await page.goto('/');
    const skyClouds = page.locator('.sky-clouds');
    await expect(skyClouds).toHaveAttribute('data-cloud-density', 'overcast');
    await expect(page.locator('.cloud:not([hidden])')).toHaveCount(6);
  });

  test('a weather fetch failure leaves the default unchanged appearance with no console errors', async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockOpenMeteo(page, { forecastAborted: true });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.sky-clouds')).not.toHaveAttribute('data-cloud-density', /.+/);
    await expect(page.locator('.cloud')).toHaveCount(6);
    await expect(page.locator('.cloud[hidden]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('Dynamic sky background — User Story 2 (sun/moon track real time of day)', () => {
  test('the sun renders near top-center at solar noon', async ({ page }) => {
    await mockOpenMeteo(page);
    await page.clock.install({ time: new Date('2026-08-09T13:00:00') });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.sky-sun')).toHaveCSS('opacity', '1');
    await expect(page.locator('.sky-moon')).toHaveCSS('opacity', '0');
    const xPercent = await page
      .locator('.sky-sun')
      .evaluate((el) => Number(getComputedStyle(el).getPropertyValue('--x-percent')));
    const yPercent = await page
      .locator('.sky-sun')
      .evaluate((el) => Number(getComputedStyle(el).getPropertyValue('--y-percent')));
    expect(Math.abs(xPercent - 50)).toBeLessThan(5);
    expect(yPercent).toBeLessThan(10);
  });

  test("the moon is rendered in the sun's place at a nighttime hour", async ({ page }) => {
    await mockOpenMeteo(page);
    await page.clock.install({ time: new Date('2026-08-10T01:00:00') });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.sky-moon')).toHaveCSS('opacity', '1');
    await expect(page.locator('.sky-sun')).toHaveCSS('opacity', '0');
  });
});

test.describe('Dynamic sky background — User Story 3 (flying objects) and reduced motion', () => {
  test('a bird spawns within its ~10-25s cadence band when motion is not reduced', async ({
    page,
  }) => {
    await mockOpenMeteo(page);
    await page.clock.install({ time: new Date('2026-08-09T13:00:00') });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.clock.fastForward(30 * 1000);
    await expect(page.locator('.sky-flying-object')).not.toHaveCount(0);
  });

  test('prefers-reduced-motion: reduce suppresses flying-object spawning and cloud drift', async ({
    page,
  }) => {
    await mockOpenMeteo(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install({ time: new Date('2026-08-09T13:00:00') });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const animationName = await page
      .locator('.cloud')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(animationName).toBe('none');

    // Fast-forward 20 minutes — past even the bird's ~3-8 min spawn band — under fake timers.
    await page.clock.fastForward(20 * 60 * 1000);
    await expect(page.locator('.sky-flying-object')).toHaveCount(0);
  });
});
