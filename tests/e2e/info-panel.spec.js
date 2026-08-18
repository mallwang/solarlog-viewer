import { test, expect } from '@playwright/test';

/**
 * Mocks `data/min_cur.js` with a fixed-wattage live reading, matching the real file's
 * var-based format (see `web/js/data/min-file.js#parseLiveReading`).
 * @param {import('@playwright/test').Page} page
 * @param {{ pacW?: number, aborted?: boolean }} [options]
 */
async function mockProduction(page, { pacW = 3100, pdcW = [0, 0], aborted = false } = {}) {
  if (aborted) {
    await page.route('**/data/min_cur.js', (route) => route.abort());
    return;
  }
  const body = [
    'var Datum="10.08.26"',
    'var Uhrzeit="14:00:00"',
    `PacArr = [[${pacW}]];`,
    `PdcArr = [[${pdcW.join(',')}]];`,
  ].join('\n');
  await page.route('**/data/min_cur.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body }),
  );
}

/**
 * Mocks Open-Meteo's forecast endpoint. Both the sky feature's `weather-client.js` (weather
 * code + sunrise/sunset) and this feature's `weather-forecast-client.js` (weather code +
 * temperatures) hit the same host/path with different query params — this responds with a
 * superset shape so both parse successfully, and `aborted: true` fails both, mirroring
 * quickstart.md §3.
 * @param {import('@playwright/test').Page} page
 * @param {{ aborted?: boolean, weatherCode?: number, sunrise?: string, sunset?: string,
 *   tomorrowWeatherCode?: number, tomorrowMaxC?: number, tomorrowMinC?: number,
 *   omitTomorrow?: boolean }} [options]
 */
async function mockForecast(
  page,
  {
    aborted = false,
    weatherCode = 61,
    sunrise = '2026-08-10T06:00',
    sunset = '2026-08-10T20:30',
    tomorrowWeatherCode = weatherCode,
    tomorrowMaxC = 22,
    tomorrowMinC = 12,
    omitTomorrow = false,
  } = {},
) {
  if (aborted) {
    await page.route('**/api.open-meteo.com/**', (route) => route.abort());
    return;
  }
  await page.route('**/api.open-meteo.com/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        current: { weather_code: weatherCode, temperature_2m: 18.4 },
        daily: {
          // Two sunrise entries: the sky feature's weather-client.js also hits this same mocked
          // endpoint and requires today's *and* tomorrow's sunrise (nextSunrise) to parse
          // successfully — see data-model.md §Sky Weather Reading.
          sunrise: omitTomorrow ? [sunrise] : [sunrise, '2026-08-11T06:02'],
          sunset: [sunset],
          weather_code: omitTomorrow ? [weatherCode] : [weatherCode, tomorrowWeatherCode],
          temperature_2m_max: omitTomorrow ? [22] : [22, tomorrowMaxC],
          temperature_2m_min: omitTomorrow ? [12] : [12, tomorrowMinC],
        },
      }),
    }),
  );
}

/**
 * Test-time override for `BACKGROUND_WEATHER` (a static `config.js` export) — see
 * tests/e2e/sky.spec.js's identical helper for rationale.
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

    // Shares the single combined header+nav row (not a separate row of its own), alongside the
    // nav links and the transparency toggle.
    await expect(page.locator('.app-header [data-info-panel="desktop"]')).toHaveCount(1);
    await expect(page.locator('.app-header #app-nav-list')).toHaveCount(1);
    await expect(page.locator('.app-header #transparency-toggle')).toBeVisible();

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
    // Fixed daytime timestamp so the current-conditions line shows the regular (non-nighttime-
    // override) icon/label for a "rain" weatherCode (the default mockForecast() code, 61).
    await page.clock.install({ time: new Date('2026-08-10T13:00:00') });
    await mockProduction(page);
    await mockForecast(page);
    await page.goto('/');

    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="weather"]')).toHaveAttribute(
      'data-available',
      'true',
    );
    const current = desktop.locator('[data-role="weather-current"]');
    await expect(current).toContainText('18°C');
    await expect(current).not.toContainText('Aktuell:');
    await expect(current.locator('.info-panel__weather-icon')).toHaveAttribute(
      'aria-hidden',
      'true',
    );

    const forecast = desktop.locator('[data-role="weather-forecast"]');
    await expect(forecast).toContainText('Heute:');
    await expect(forecast).toContainText('(12°C - 22°C)');
    await expect(forecast.locator('.info-panel__weather-icon')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
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

  test('the weather area is configured to open the wetteronline.de search URL in a new tab', async ({
    page,
  }) => {
    // Asserts on the link's own href/target rather than actually following it: wetteronline.de
    // auto-redirects this exact query shape to a real forecast page (confirmed manually — see
    // wetteronline-link.js's header comment), so a real click-through would depend on that
    // live third-party redirect rather than anything this codebase controls, which is exactly
    // what quickstart.md's "no dependency on real-world data at test run time" rules out.
    await mockProduction(page);
    await mockForecast(page);
    await page.goto('/');

    const weatherLink = page.locator('[data-info-panel="desktop"] [data-role="weather"]');
    await expect(weatherLink).toHaveAttribute('data-available', 'true');
    await expect(weatherLink).toHaveAttribute('target', '_blank');
    await expect(weatherLink).toHaveAttribute('rel', 'noopener');
    const href = await weatherLink.getAttribute('href');
    expect(href).toContain('https://www.wetteronline.de/suche?searchstring=');
    // Query-string encoding (URLSearchParams), not encodeURIComponent — spaces are '+', not
    // '%20' — see wetteronline-link.js.
    expect(href).toContain('92266+Ensdorf-Wolfsbach');
    expect(href).toContain('searchpcid=pc_city_weather');
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

  test('shows efficiency percentage next to the wattage when PAC>0 and PDC>0', async ({ page }) => {
    await mockProduction(page, { pacW: 1234, pdcW: [1312] }); // 1234/1312*100 ≈ 94%
    await mockForecast(page);
    await page.goto('/');
    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="production-value"]')).toHaveText('1234 W · 94%');
  });

  test('shows no efficiency percentage when idle (PAC=0, PDC=0)', async ({ page }) => {
    await mockProduction(page, { pacW: 0, pdcW: [0, 0] });
    await mockForecast(page);
    await page.goto('/');
    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="production-value"]')).not.toContainText('%');
  });

  test('shows no efficiency percentage when PDC is 0/missing but PAC>0', async ({ page }) => {
    await mockProduction(page, { pacW: 800, pdcW: [0, 0] });
    await mockForecast(page);
    await page.goto('/');
    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="production-value"]')).toHaveText('800 W');
  });

  test('shows no efficiency percentage on fetch failure', async ({ page }) => {
    await mockProduction(page, { aborted: true });
    await mockForecast(page);
    await page.goto('/');
    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="production"]')).toHaveAttribute(
      'data-available',
      'false',
    );
    await expect(desktop.locator('[data-role="production-value"]')).not.toContainText('%');
  });

  test("shows the reading's own time as a subline, so a stale value is recognizable", async ({
    page,
  }) => {
    await mockProduction(page, { pacW: 3100 }); // fixture's Uhrzeit is "14:00:00"
    await mockForecast(page);
    await page.goto('/');
    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="production-timestamp"]')).toHaveText('Stand: 14:00');
  });

  test('clears the timestamp subline on fetch failure', async ({ page }) => {
    await mockProduction(page, { aborted: true });
    await mockForecast(page);
    await page.goto('/');
    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="production-timestamp"]')).toHaveText('');
  });
});

test.describe('Global info panel weather text — background/nav-bar agreement (US1-US3)', () => {
  test('in auto mode, the nav bar weather text names the same condition as the sky background', async ({
    page,
  }) => {
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 71 }); // snow
    await page.goto('/');

    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="weather-current"]')).toContainText('Schnee');
    await expect(page.locator('.sky-clouds')).toHaveAttribute('data-weather', 'snow');
  });

  test('BACKGROUND_WEATHER = "off" leaves the nav bar showing the real, live condition', async ({
    page,
  }) => {
    await overrideBackgroundWeather(page, 'off');
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 61 }); // rain
    await page.goto('/');

    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="weather-current"]')).toContainText('Regen');
    await expect(page.locator('.sky-clouds')).not.toHaveAttribute('data-weather', /.+/);
  });

  test('a fixed BACKGROUND_WEATHER override leaves the nav bar showing the real, live condition', async ({
    page,
  }) => {
    // Fixed daytime timestamp so the "sunny" weatherCode below shows the regular "Sonnig" text,
    // not the nighttime "Klar" override (mockForecast()'s default sunrise/sunset are
    // 2026-08-10T06:00/20:30).
    await page.clock.install({ time: new Date('2026-08-10T13:00:00') });
    await overrideBackgroundWeather(page, 'snow');
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 0 }); // sunny — differs from the fixed "snow"
    await page.goto('/');

    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="weather-current"]')).toContainText('Sonnig');
    await expect(page.locator('.sky-clouds')).toHaveAttribute('data-weather', 'snow');
  });
});

test.describe('Global info panel — current-conditions nighttime "sunny" override (US1)', () => {
  test('a nighttime "sunny" reading shows the moon icon and "Klar" instead of "Sonnig"', async ({
    page,
  }) => {
    // 02:00, well after sunset (20:30) and well before sunrise (06:00) on the same mocked day.
    await page.clock.install({ time: new Date('2026-08-10T02:00:00') });
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 0 }); // sunny
    await page.goto('/');

    const current = page.locator('[data-info-panel="desktop"] [data-role="weather-current"]');
    await expect(current).toContainText('Klar');
    await expect(current).not.toContainText('Sonnig');
    await expect(current.locator('.info-panel__weather-icon')).toHaveText('🌙');
  });

  test('a daytime "sunny" reading still shows the regular sun icon and "Sonnig"', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T13:00:00') });
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 0 }); // sunny
    await page.goto('/');

    const current = page.locator('[data-info-panel="desktop"] [data-role="weather-current"]');
    await expect(current).toContainText('Sonnig');
    await expect(current).not.toContainText('Klar');
  });

  test('a non-"sunny" category at night is unaffected by the nighttime override', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T02:00:00') });
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 61 }); // rain
    await page.goto('/');

    const current = page.locator('[data-info-panel="desktop"] [data-role="weather-current"]');
    await expect(current).toContainText('Regen');
    await expect(current).not.toContainText('Klar');
  });
});

test.describe('Global info panel — forecast day switch at FORECAST_DAY_SWITCH_HOUR (US2)', () => {
  test('before the cutoff hour, the forecast line shows "Heute:" and today\'s icon/label/range', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T13:00:00') });
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 61 });
    await page.goto('/');

    const forecast = page.locator('[data-info-panel="desktop"] [data-role="weather-forecast"]');
    await expect(forecast).toContainText('Heute:');
    await expect(forecast).toContainText('(12°C - 22°C)');
    await expect(forecast.locator('.info-panel__weather-icon')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  test('at/after the cutoff hour, the forecast line shows "Morgen:" and tomorrow\'s distinct icon/label/range', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T18:00:00') });
    await mockProduction(page);
    await mockForecast(page, {
      weatherCode: 61, // today: rain
      tomorrowWeatherCode: 71, // tomorrow: snow — distinct from today's
      tomorrowMaxC: 5,
      tomorrowMinC: -2,
    });
    await page.goto('/');

    const forecast = page.locator('[data-info-panel="desktop"] [data-role="weather-forecast"]');
    await expect(forecast).toContainText('Morgen:');
    await expect(forecast).toContainText('Schnee');
    await expect(forecast).toContainText('(-2°C - 5°C)');
    await expect(forecast).not.toContainText('(12°C - 22°C)');
  });

  test("at/after the cutoff hour with tomorrow's fields omitted, the forecast line falls back to empty", async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T18:00:00') });
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 61, omitTomorrow: true });
    await page.goto('/');

    const forecast = page.locator('[data-info-panel="desktop"] [data-role="weather-forecast"]');
    await expect(forecast).toHaveText('');
  });

  test(
    'a "sunny" mocked response at nighttime still shows the regular sun icon in the forecast line ' +
      "(FR-012's independence from the current-conditions override)",
    async ({ page }) => {
      await page.clock.install({ time: new Date('2026-08-10T02:00:00') });
      await mockProduction(page);
      await mockForecast(page, { weatherCode: 0, tomorrowWeatherCode: 0 }); // sunny
      await page.goto('/');

      const forecast = page.locator('[data-info-panel="desktop"] [data-role="weather-forecast"]');
      await expect(forecast).toContainText('Sonnig');
      await expect(forecast).not.toContainText('Klar');
    },
  );

  test('a low/high that round to the same whole degree still renders both bounds', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T13:00:00') });
    await mockProduction(page);
    await page.route('**/api.open-meteo.com/**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          current: { weather_code: 61, temperature_2m: 18.4 },
          daily: {
            sunrise: ['2026-08-10T06:00'],
            sunset: ['2026-08-10T20:30'],
            weather_code: [61, 61],
            temperature_2m_max: [14.3, 14.3],
            temperature_2m_min: [13.6, 13.6],
          },
        }),
      }),
    );
    await page.goto('/');

    const forecast = page.locator('[data-info-panel="desktop"] [data-role="weather-forecast"]');
    await expect(forecast).toContainText('(14°C - 14°C)');
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

    // Lives right after .app-header as its own sub-navigation bar, not inside the header, and
    // doesn't share its row with the transparency toggle (that stays in the header on mobile,
    // where the nav links themselves have collapsed into the burger dropdown instead).
    const headerThenPanel = page.locator('.app-header + [data-info-panel="mobile"]');
    await expect(headerThenPanel).toHaveCount(1);
    await expect(mobile.locator('.transparency-toggle')).toHaveCount(0);
    await expect(page.locator('#transparency-toggle')).toBeVisible();
    await expect(page.locator('#app-nav-list')).toBeHidden();

    await expect(mobile.locator('[data-role="production-value"]')).toHaveText('2200 W');
  });

  test('the mobile weather area is configured to open the wetteronline.de search URL in a new tab', async ({
    page,
  }) => {
    await mockProduction(page);
    await mockForecast(page);
    await page.goto('/');

    const weatherLink = page.locator('[data-info-panel="mobile"] [data-role="weather"]');
    await expect(weatherLink).toHaveAttribute('data-available', 'true');
    await expect(weatherLink).toHaveAttribute('target', '_blank');
    const href = await weatherLink.getAttribute('href');
    expect(href).toContain('https://www.wetteronline.de/suche?searchstring=');
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
