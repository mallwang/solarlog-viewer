import { test, expect } from '@playwright/test';

/**
 * Routes both Open-Meteo hosts used by the dynamic sky background: geocoding (resolves the
 * demo plant's `HPStandort`, "92266 Ensdorf-Wolfsbach", to coordinates) and the forecast
 * endpoint (weather code + sunrise/sunset). Mocked so tests never depend on real network access
 * or real-world weather/time, per quickstart.md §6.
 * @param {import('@playwright/test').Page} page
 * @param {{ weatherCode?: number, sunrise?: string, sunset?: string, nextSunrise?: string,
 *   forecastAborted?: boolean }} [options]
 */
async function mockOpenMeteo(page, options = {}) {
  const {
    weatherCode = 0,
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
        current: { weather_code: weatherCode },
        daily: { sunrise: [sunrise, nextSunrise], sunset: [sunset] },
      }),
    }),
  );
}

/**
 * Test-time override for `BACKGROUND_WEATHER` (a static `config.js` export, not a
 * runtime-reactive value — see data-model.md). Intercepts the `config.js` module request and
 * serves a patched copy with the export's literal value substituted, since there is no runtime
 * hook to override an ES module's binding from outside the page.
 * @param {import('@playwright/test').Page} page
 * @param {string} backgroundWeather
 */
async function overrideBackgroundWeather(page, backgroundWeather) {
  await page.route('**/js/config.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const patched = body.replace(
      /export const BACKGROUND_WEATHER = '[^']*';/,
      `export const BACKGROUND_WEATHER = '${backgroundWeather}';`,
    );
    await route.fulfill({ response, body: patched });
  });
}

/** One representative WMO weather_code per Weather Background Category (research.md §3). */
const CATEGORY_CODES = {
  sunny: 0,
  mixed: 2,
  cloudy: 3,
  rain: 61,
  snow: 71,
};

test.describe('Dynamic sky background — User Story 1 (auto mode matches live weather)', () => {
  for (const [category, weatherCode] of Object.entries(CATEGORY_CODES)) {
    test(`a mocked "${category}" weather_code renders the matching data-weather value`, async ({
      page,
    }) => {
      await mockOpenMeteo(page, { weatherCode });
      await page.goto('/');
      const skyClouds = page.locator('.sky-clouds');
      await expect(skyClouds).toHaveAttribute('data-weather', category);

      const rainLayer = page.locator('.sky-rain-drop').first();
      const snowLayer = page.locator('.sky-snow-flake').first();
      if (category === 'rain') {
        await expect(rainLayer).toBeVisible();
      } else {
        await expect(rainLayer).toBeHidden();
      }
      if (category === 'snow') {
        await expect(snowLayer).toBeVisible();
      } else {
        await expect(snowLayer).toBeHidden();
      }
    });
  }

  test('a clear-sky (sunny) mocked response renders sparse visible clouds', async ({ page }) => {
    await mockOpenMeteo(page, { weatherCode: 0 });
    await page.goto('/');
    const skyClouds = page.locator('.sky-clouds');
    await expect(skyClouds).toHaveAttribute('data-weather', 'sunny');
    await expect(page.locator('.cloud:not([hidden])')).toHaveCount(2);
  });

  test('an overcast (cloudy) mocked response renders dense visible clouds', async ({ page }) => {
    await mockOpenMeteo(page, { weatherCode: 3 });
    await page.goto('/');
    const skyClouds = page.locator('.sky-clouds');
    await expect(skyClouds).toHaveAttribute('data-weather', 'cloudy');
    await expect(page.locator('.cloud:not([hidden])')).toHaveCount(16);
  });

  test('a weather fetch failure leaves the default unchanged appearance with no console errors', async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await mockOpenMeteo(page, { forecastAborted: true });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.sky-clouds')).not.toHaveAttribute('data-weather', /.+/);
    // Sixteen `.cloud` elements exist in the markup, but only the original six are visible by
    // default (index.html marks the other ten `hidden`) — this is the pre-feature fallback look.
    await expect(page.locator('.cloud')).toHaveCount(16);
    await expect(page.locator('.cloud[hidden]')).toHaveCount(10);
    expect(errors).toEqual([]);
  });
});

test.describe('Dynamic sky background — User Story 2 (BACKGROUND_WEATHER = "off")', () => {
  test('hides the entire sky animation (clouds, sun/moon, flying objects) regardless of mocked weather', async ({
    page,
  }) => {
    await overrideBackgroundWeather(page, 'off');
    await mockOpenMeteo(page, { weatherCode: 61 }); // rain — should still not apply
    await page.clock.install({ time: new Date('2026-08-09T13:00:00') });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.sky-clouds')).toBeHidden();
    await expect(page.locator('.sky-clouds')).not.toHaveAttribute('data-weather', /.+/);
    await expect(page.locator('.sky-flying-objects')).toBeEmpty();
  });
});

test.describe('Dynamic sky background — User Story 3 (fixed override + invalid fallback)', () => {
  test('a fixed category always shows that data-weather value regardless of mocked weather', async ({
    page,
  }) => {
    await overrideBackgroundWeather(page, 'snow');
    await mockOpenMeteo(page, { weatherCode: 0 }); // sunny — should be overridden
    await page.goto('/');

    await expect(page.locator('.sky-clouds')).toHaveAttribute('data-weather', 'snow');
    await expect(page.locator('.sky-snow-flake').first()).toBeVisible();
  });

  test('an invalid BACKGROUND_WEATHER value behaves identically to auto mode', async ({ page }) => {
    await overrideBackgroundWeather(page, 'not-a-real-value');
    await mockOpenMeteo(page, { weatherCode: 61 }); // rain
    await page.goto('/');

    await expect(page.locator('.sky-clouds')).toHaveAttribute('data-weather', 'rain');
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

  test('rain/snow layers render statically (no motion) under reduced motion', async ({ page }) => {
    await overrideBackgroundWeather(page, 'rain');
    await mockOpenMeteo(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const rainAnimationName = await page
      .locator('.sky-rain-drop')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(rainAnimationName).toBe('none');
  });

  test('snow layer renders statically (no motion) under reduced motion', async ({ page }) => {
    await overrideBackgroundWeather(page, 'snow');
    await mockOpenMeteo(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const snowAnimationName = await page
      .locator('.sky-snow-flake')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(snowAnimationName).toBe('none');
  });
});
