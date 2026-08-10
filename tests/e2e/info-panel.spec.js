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

test.describe('Global info panel — desktop placement (beneath the header icons)', () => {
  test('the desktop variant is visible, right-aligned in the header, and populated', async ({
    page,
  }) => {
    await mockProduction(page, { pacW: 3100 });
    await mockForecast(page);
    await page.goto('/');

    const desktop = page.locator('[data-info-panel="desktop"]');
    const mobile = page.locator('[data-info-panel="mobile"]');
    await expect(desktop).toBeVisible();
    await expect(mobile).toBeHidden();

    // Shares the persistent nav row (not a separate row of its own), alongside the desktop
    // transparency toggle.
    await expect(page.locator('.app-nav [data-info-panel="desktop"]')).toHaveCount(1);
    await expect(page.locator('.app-nav__end [data-info-panel="desktop"]')).toHaveCount(1);
    await expect(page.locator('.app-nav__end #transparency-toggle-desktop')).toBeVisible();
    await expect(page.locator('#transparency-toggle-mobile')).toBeHidden();

    await expect(desktop.locator('[data-role="production-value"]')).toHaveText('3100 W');
    await expect(desktop.locator('[data-role="production"]')).toHaveAttribute(
      'data-available',
      'true',
    );
  });

  test("the production value links to today's day view", async ({ page }) => {
    await page.clock.install({ time: new Date('2026-08-10T14:00:00') });
    await mockProduction(page, { pacW: 1800 });
    await mockForecast(page);
    await page.goto('/');

    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="production"]')).toHaveAttribute(
      'href',
      '#/day/2026/08/10',
    );
  });

  test('a production fetch failure shows an unavailable state without blocking weather', async ({
    page,
  }) => {
    await mockProduction(page, { aborted: true });
    await mockForecast(page);
    await page.goto('/');

    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="production"]')).toHaveAttribute(
      'data-available',
      'false',
    );
    await expect(desktop.locator('[data-role="weather"]')).toHaveAttribute(
      'data-available',
      'true',
    );
  });

  test("shows current weather and today's forecast summary", async ({ page }) => {
    await mockProduction(page);
    await mockForecast(page);
    await page.goto('/');

    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="weather"]')).toHaveAttribute(
      'data-available',
      'true',
    );
    await expect(desktop.locator('[data-role="weather-current"]')).toContainText('18°C');
    await expect(desktop.locator('[data-role="weather-forecast"]')).toContainText('22°C');
    await expect(desktop.locator('[data-role="weather-forecast"]')).toContainText('12°C');
  });

  test('a weather fetch failure shows an unavailable state without blocking production', async ({
    page,
  }) => {
    await mockProduction(page, { pacW: 500 });
    await mockForecast(page, { aborted: true });
    await page.goto('/');

    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="weather"]')).toHaveAttribute(
      'data-available',
      'false',
    );
    await expect(desktop.locator('[data-role="production"]')).toHaveAttribute(
      'data-available',
      'true',
    );
    await expect(desktop.locator('[data-role="production-value"]')).toHaveText('500 W');
  });

  test('clicking the weather area opens the expected wetteronline.de search URL in a new tab', async ({
    page,
    context,
  }) => {
    await mockProduction(page);
    await mockForecast(page);
    await page.goto('/');

    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="weather"]')).toHaveAttribute(
      'data-available',
      'true',
    );

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      desktop.locator('[data-role="weather"]').click(),
    ]);
    expect(newPage.url()).toContain('https://www.wetteronline.de/suche?q=');
    expect(decodeURIComponent(newPage.url())).toContain('92266 Ensdorf-Wolfsbach');
  });

  test('a near-zero reading renders the idle animation intensity and a gray pulse', async ({
    page,
  }) => {
    await mockProduction(page, { pacW: 0 });
    await mockForecast(page);
    await page.goto('/');
    const pulse = page.locator('[data-info-panel="desktop"] [data-role="pulse"]');
    await expect(pulse).toHaveAttribute('data-intensity', 'idle');
    await expect(pulse).toHaveCSS('background-color', 'rgb(91, 100, 112)');
  });

  test('a near-peak reading renders the peak animation intensity and a green pulse', async ({
    page,
  }) => {
    // AnlagenKWP fixture value is 6200 (data/base_vars.js) — 95% of that is well within both
    // the peak tier (>= 90%, see production-animation.js) and the green color band (>= 75%).
    await mockProduction(page, { pacW: 5900 });
    await mockForecast(page);
    await page.goto('/');
    const pulse = page.locator('[data-info-panel="desktop"] [data-role="pulse"]');
    await expect(pulse).toHaveAttribute('data-intensity', 'peak');
    await expect(pulse).toHaveCSS('background-color', 'rgb(46, 125, 50)');
  });

  test('a mid-range reading renders an interpolated yellow-to-green pulse color', async ({
    page,
  }) => {
    // 4000 W of the 6200 W fixture capacity is ~64.5% — the exact worked example from the
    // user's request, landing between the yellow (50%) and green (75%) stops.
    await mockProduction(page, { pacW: 4000 });
    await mockForecast(page);
    await page.goto('/');
    const pulse = page.locator('[data-info-panel="desktop"] [data-role="pulse"]');
    await expect(pulse).toHaveCSS('background-color', 'rgb(132, 153, 48)');
  });
});

test.describe('Global info panel — mobile placement (bar below the nav)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the mobile variant is visible as a bar below the nav, desktop variant hidden', async ({
    page,
  }) => {
    await mockProduction(page, { pacW: 2200 });
    await mockForecast(page);
    await page.goto('/');

    const desktop = page.locator('[data-info-panel="desktop"]');
    const mobile = page.locator('[data-info-panel="mobile"]');
    await expect(mobile).toBeVisible();
    await expect(desktop).toBeHidden();

    // Lives right after .app-nav, not inside the header, and doesn't share its row with the
    // transparency toggle (that stays in the header on mobile).
    const navThenPanel = page.locator('.app-nav + [data-info-panel="mobile"]');
    await expect(navThenPanel).toHaveCount(1);
    await expect(mobile.locator('.transparency-toggle')).toHaveCount(0);
    await expect(page.locator('#transparency-toggle-mobile')).toBeVisible();
    await expect(page.locator('#transparency-toggle-desktop')).toBeHidden();

    await expect(mobile.locator('[data-role="production-value"]')).toHaveText('2200 W');
  });

  test('mobile weather click opens the wetteronline.de search URL in a new tab', async ({
    page,
    context,
  }) => {
    await mockProduction(page);
    await mockForecast(page);
    await page.goto('/');

    const mobile = page.locator('[data-info-panel="mobile"]');
    await expect(mobile.locator('[data-role="weather"]')).toHaveAttribute('data-available', 'true');

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      mobile.locator('[data-role="weather"]').click(),
    ]);
    expect(newPage.url()).toContain('https://www.wetteronline.de/suche?q=');
  });

  test('renders without horizontal scroll at 375px with the info bar present', async ({ page }) => {
    await mockProduction(page);
    await mockForecast(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
