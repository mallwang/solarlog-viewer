import { test, expect } from '@playwright/test';

/**
 * Mocks `data/min_cur.js` with a fixed-wattage live reading, matching the real file's
 * var-based format (see `web/js/data/min-file.js#parseLiveReading`).
 * @param {import('@playwright/test').Page} page
 * @param {{ pacW?: number, aborted?: boolean }} [options]
 */
async function mockProduction(page, { pacW = 3100, aborted = false } = {}) {
  if (aborted) {
    await page.route('**/data/min_cur.js', (route) => route.abort());
    return;
  }
  const body = [
    'var Datum="10.08.26"',
    'var Uhrzeit="14:00:00"',
    `PacArr = [[${pacW}]];`,
    'PdcArr = [[0,0]];',
  ].join('\n');
  await page.route('**/data/min_cur.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body }),
  );
}

/**
 * Mocks Open-Meteo's forecast endpoint. Both the sky feature's `weather-client.js` (cloud
 * cover + sunrise/sunset) and this feature's `weather-forecast-client.js` (weather code +
 * temperatures) hit the same host/path with different query params — this responds with a
 * superset shape so both parse successfully, and `aborted: true` fails both, mirroring
 * quickstart.md §3.
 * @param {import('@playwright/test').Page} page
 * @param {{ aborted?: boolean }} [options]
 */
async function mockForecast(page, { aborted = false } = {}) {
  if (aborted) {
    await page.route('**/api.open-meteo.com/**', (route) => route.abort());
    return;
  }
  await page.route('**/api.open-meteo.com/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        current: { cloud_cover: 40, weather_code: 61, temperature_2m: 18.4 },
        daily: {
          sunrise: ['2026-08-10T06:00'],
          sunset: ['2026-08-10T20:30'],
          weather_code: [61],
          temperature_2m_max: [22],
          temperature_2m_min: [12],
        },
      }),
    }),
  );
}

test.describe('Global desktop info panel — User Story 1 (production)', () => {
  test('desktop viewport shows the panel populated with the current production reading', async ({
    page,
  }) => {
    await mockProduction(page, { pacW: 3100 });
    await mockForecast(page);
    await page.goto('/');
    await expect(page.locator('#info-panel')).toBeVisible();
    await expect(page.locator('#info-panel-production-value')).toHaveText('3100 W');
    await expect(page.locator('#info-panel-production')).toHaveAttribute('data-available', 'true');
  });

  test('mobile viewport hides the panel entirely', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockProduction(page);
    await mockForecast(page);
    await page.goto('/');
    await expect(page.locator('#info-panel')).toBeHidden();
  });

  test('a production fetch failure shows an unavailable state without blocking weather', async ({
    page,
  }) => {
    await mockProduction(page, { aborted: true });
    await mockForecast(page);
    await page.goto('/');
    await expect(page.locator('#info-panel-production')).toHaveAttribute('data-available', 'false');
    await expect(page.locator('#info-panel-weather')).toHaveAttribute('data-available', 'true');
  });
});

test.describe("Global desktop info panel — User Story 2 (weather + today's forecast)", () => {
  test("desktop viewport shows current weather and today's forecast summary", async ({ page }) => {
    await mockProduction(page);
    await mockForecast(page);
    await page.goto('/');
    await expect(page.locator('#info-panel-weather')).toHaveAttribute('data-available', 'true');
    await expect(page.locator('#info-panel-weather-current')).toContainText('18°C');
    await expect(page.locator('#info-panel-weather-forecast')).toContainText('22°C');
    await expect(page.locator('#info-panel-weather-forecast')).toContainText('12°C');
  });

  test('a weather fetch failure shows an unavailable state without blocking production', async ({
    page,
  }) => {
    await mockProduction(page, { pacW: 500 });
    await mockForecast(page, { aborted: true });
    await page.goto('/');
    await expect(page.locator('#info-panel-weather')).toHaveAttribute('data-available', 'false');
    await expect(page.locator('#info-panel-production')).toHaveAttribute('data-available', 'true');
    await expect(page.locator('#info-panel-production-value')).toHaveText('500 W');
  });
});

test.describe('Global desktop info panel — User Story 3 (wetteronline.com link)', () => {
  test('clicking the weather area opens the expected wetteronline.de search URL in a new tab', async ({
    page,
    context,
  }) => {
    await mockProduction(page);
    await mockForecast(page);
    await page.goto('/');
    await expect(page.locator('#info-panel-weather')).toHaveAttribute('data-available', 'true');

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('#info-panel-weather').click(),
    ]);
    expect(newPage.url()).toContain('https://www.wetteronline.de/suche?q=');
    expect(decodeURIComponent(newPage.url())).toContain('92266 Ensdorf-Wolfsbach');
  });
});

test.describe('Global desktop info panel — User Story 4 (production animation)', () => {
  test('a near-zero reading renders the idle animation intensity', async ({ page }) => {
    await mockProduction(page, { pacW: 0 });
    await mockForecast(page);
    await page.goto('/');
    await expect(page.locator('#info-panel-pulse')).toHaveAttribute('data-intensity', 'idle');
  });

  test('a near-peak reading renders the peak animation intensity', async ({ page }) => {
    // AnlagenKWP fixture value is 6200 (data/base_vars.js) — 95% of that is well within the
    // peak tier (>= 90%, see production-animation.js).
    await mockProduction(page, { pacW: 5900 });
    await mockForecast(page);
    await page.goto('/');
    await expect(page.locator('#info-panel-pulse')).toHaveAttribute('data-intensity', 'peak');
  });
});
