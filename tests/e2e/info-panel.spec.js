import { test, expect } from '@playwright/test';

/**
 * Mocks the live status endpoint (`**\/live/index.php`, contracts/live-endpoint.md of
 * specs/027-navbar-live-panel/) with a fixed-wattage successful reading, or an
 * abort/`sources.solarlog.ok: false` failure. Named `mockProduction` (rather than
 * `mockLiveReading`) to keep every existing call site below unchanged — the navbar's production
 * figure is now sourced from this endpoint instead of `data/min_cur.js` (see
 * info-panel-controller.js's `pollProduction()`).
 * @param {import('@playwright/test').Page} page
 * @param {{ pacW?: number, timestamp?: string, aborted?: boolean, solarlogOk?: boolean }} [options]
 */
async function mockProduction(
  page,
  { pacW = 3100, timestamp = '2026-08-10T14:00:05', aborted = false, solarlogOk = true } = {},
) {
  if (aborted) {
    await page.route('**/live/index.php', (route) => route.abort());
    return;
  }
  await page.route('**/live/index.php', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        watt: pacW,
        timestamp,
        sources: { solarlog: { watt: pacW, ok: solarlogOk, error: null, inverters: [] } },
      }),
    }),
  );
}

/**
 * Test-time override for `LIVE_REFRESH_INTERVAL_MS` (a static `config.js` export), matching
 * `overrideBackgroundWeather()`'s route-patch pattern below.
 * @param {import('@playwright/test').Page} page
 * @param {number} intervalMs
 */
async function overrideLiveRefreshInterval(page, intervalMs) {
  await page.route('**/js/config.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const patched = body.replace(
      /export const LIVE_REFRESH_INTERVAL_MS = [^;]*;/,
      `export const LIVE_REFRESH_INTERVAL_MS = ${intervalMs};`,
    );
    await route.fulfill({ response, body: patched });
  });
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

  test("shows current weather and today's forecast as compact icon-over-value indicators", async ({
    page,
  }) => {
    // Fixed daytime timestamp so the current-conditions indicator shows the regular
    // (non-nighttime-override) icon/label for a "rain" weatherCode (the default mockForecast()
    // code, 61).
    await page.clock.install({ time: new Date('2026-08-10T13:00:00') });
    await mockProduction(page);
    await mockForecast(page);
    await page.goto('/');

    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="weather"]')).toHaveAttribute(
      'data-available',
      'true',
    );

    // Current conditions: compact value only, no condition label visible by default (FR-001/
    // FR-002) — the full text lives in aria-label/the (aria-hidden) tooltip instead, so the
    // "not visible by default" check targets the compact-value span alone, not the whole
    // indicator (whose textContent also includes the hidden tooltip's full text).
    const current = desktop.locator('[data-role="weather-current"]');
    await expect(current.locator('.info-panel__weather-temp')).toHaveText('18°C');
    await expect(current).toHaveAttribute('aria-label', 'Regen, 18°C');
    await expect(current.locator('.info-panel__weather-icon')).toHaveAttribute(
      'aria-hidden',
      'true',
    );

    // Forecast: compact range only, no condition label or "Heute:"/"Morgen:" prefix visible by
    // default (FR-003) — the full text (with prefix) lives in aria-label instead.
    const forecast = desktop.locator('[data-role="weather-forecast"]');
    await expect(forecast.locator('.info-panel__weather-range')).toHaveText('12° - 22°');
    await expect(forecast).toHaveAttribute('aria-label', 'Heute: Regen (12°C - 22°C)');
    await expect(forecast.locator('.info-panel__weather-icon')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  test('a visible divider separates the current-conditions and forecast indicators (FR-008)', async ({
    page,
  }) => {
    await mockProduction(page);
    await mockForecast(page);
    await page.goto('/');

    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="weather-forecast"]')).toHaveCSS(
      'border-left-style',
      'solid',
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

  test('shows no efficiency percentage suffix — the live endpoint carries no per-inverter detail (research.md §6)', async ({
    page,
  }) => {
    await mockProduction(page, { pacW: 1234 });
    await mockForecast(page);
    await page.goto('/');
    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="production-value"]')).toHaveText('1234 W');
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

test.describe('Global info panel — live reading polls on its own decoupled cadence (US1)', () => {
  test('updates the wattage after one patched interval, without a full page reload, and without extra data/hist requests (SC-002)', async ({
    page,
  }) => {
    await overrideLiveRefreshInterval(page, 200);
    await mockProduction(page, { pacW: 3100 });
    await mockForecast(page);

    const dataRequests = [];
    page.on('request', (request) => {
      if (/\/(data|hist)\/.*\.js(\?|$)/.test(request.url())) dataRequests.push(request.url());
    });

    await page.goto('/');
    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="production-value"]')).toHaveText('3100 W');

    const dataRequestCountAfterLoad = dataRequests.length;

    await mockProduction(page, { pacW: 4200 });
    await expect(desktop.locator('[data-role="production-value"]')).toHaveText('4200 W', {
      timeout: 2000,
    });

    // No reload happened (same page identity is implicit — a reload would drop the route mocks
    // and this assertion would time out), and no data/hist file was re-requested outside its own
    // DATA_REFRESH_INTERVAL_MS cadence during that short wait.
    expect(dataRequests).toHaveLength(dataRequestCountAfterLoad);
  });
});

test.describe('Global info panel — live reading degrades gracefully (US2)', () => {
  test('a mid-session failure keeps showing the last successful reading, with no page error (SC-003)', async ({
    page,
  }) => {
    await overrideLiveRefreshInterval(page, 200);
    await mockProduction(page, { pacW: 2500, timestamp: '2026-08-10T14:00:05' });
    await mockForecast(page);

    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    let liveRequestCount = 0;
    page.on('request', (request) => {
      if (request.url().includes('/live/index.php')) liveRequestCount += 1;
    });

    await page.goto('/');
    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="production-value"]')).toHaveText('2500 W');
    const requestCountBeforeFailure = liveRequestCount;

    await mockProduction(page, { aborted: true });
    // Wait for at least one more poll to actually fire against the now-aborting mock, rather
    // than sleeping a fixed duration.
    await expect
      .poll(() => liveRequestCount, { timeout: 2000 })
      .toBeGreaterThan(requestCountBeforeFailure);

    await expect(desktop.locator('[data-role="production-value"]')).toHaveText('2500 W');
    await expect(desktop.locator('[data-role="production-timestamp"]')).toHaveText('Stand: 14:00');
    await expect(desktop.locator('[data-role="production"]')).toHaveAttribute(
      'data-available',
      'true',
    );
    expect(pageErrors).toEqual([]);
  });

  test('a failure from first load with no prior success shows the "no data yet" state, not zero/blank (FR-006)', async ({
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
    await expect(desktop.locator('[data-role="production-value"]')).toHaveText('Nicht verfügbar');
  });

  test('sources.solarlog.ok: false is treated the same as a failed reading (FR-004)', async ({
    page,
  }) => {
    await mockProduction(page, { solarlogOk: false });
    await mockForecast(page);
    await page.goto('/');

    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="production"]')).toHaveAttribute(
      'data-available',
      'false',
    );
  });
});

test.describe('Global info panel — live refresh cadence is operator-configurable (US3)', () => {
  test('polls the live endpoint at the configured LIVE_REFRESH_INTERVAL_MS, not the default or DATA_REFRESH_INTERVAL_MS', async ({
    page,
  }) => {
    await overrideLiveRefreshInterval(page, 150);
    await mockProduction(page, { pacW: 1000 });
    await mockForecast(page);

    let liveRequestCount = 0;
    await page.route('**/live/index.php', (route) => {
      liveRequestCount += 1;
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          watt: 1000,
          timestamp: '2026-08-10T14:00:05',
          sources: { solarlog: { watt: 1000, ok: true, error: null, inverters: [] } },
        }),
      });
    });

    await page.goto('/');

    // At least 3 polls within ~4 patched intervals confirms the 150ms cadence is in effect (not
    // the 60s default, and not the much slower DATA_REFRESH_INTERVAL_MS).
    await expect.poll(() => liveRequestCount, { timeout: 2000 }).toBeGreaterThanOrEqual(3);
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
    await expect(desktop.locator('[data-role="weather-current"]')).toHaveAttribute(
      'aria-label',
      /Schnee/,
    );
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
    await expect(desktop.locator('[data-role="weather-current"]')).toHaveAttribute(
      'aria-label',
      /Regen/,
    );
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
    await expect(desktop.locator('[data-role="weather-current"]')).toHaveAttribute(
      'aria-label',
      /Sonnig/,
    );
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
    await expect(current).toHaveAttribute('aria-label', /Klar/);
    await expect(current).not.toHaveAttribute('aria-label', /Sonnig/);
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
    await expect(current).toHaveAttribute('aria-label', /Sonnig/);
    await expect(current).not.toHaveAttribute('aria-label', /Klar/);
  });

  test('a non-"sunny" category at night is unaffected by the nighttime override', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T02:00:00') });
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 61 }); // rain
    await page.goto('/');

    const current = page.locator('[data-info-panel="desktop"] [data-role="weather-current"]');
    await expect(current).toHaveAttribute('aria-label', /Regen/);
    await expect(current).not.toHaveAttribute('aria-label', /Klar/);
  });
});

test.describe('Global info panel — forecast day switch at FORECAST_DAY_SWITCH_HOUR (US2)', () => {
  test('before the cutoff hour, the forecast indicator shows today\'s compact range with a "Heute:" aria-label', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T13:00:00') });
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 61 });
    await page.goto('/');

    const forecast = page.locator('[data-info-panel="desktop"] [data-role="weather-forecast"]');
    await expect(forecast.locator('.info-panel__weather-range')).toHaveText('12° - 22°');
    await expect(forecast).toHaveAttribute('aria-label', 'Heute: Regen (12°C - 22°C)');
    await expect(forecast.locator('.info-panel__weather-icon')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  test('at/after the cutoff hour, the forecast indicator shows tomorrow\'s distinct compact range with a "Morgen:" aria-label', async ({
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
    await expect(forecast.locator('.info-panel__weather-range')).toHaveText('-2° - 5°');
    await expect(forecast).toHaveAttribute('aria-label', 'Morgen: Schnee (-2°C - 5°C)');
  });

  test("at/after the cutoff hour with tomorrow's fields omitted, the forecast indicator falls back to the dimmed dash unavailable state", async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T18:00:00') });
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 61, omitTomorrow: true });
    await page.goto('/');

    const forecast = page.locator('[data-info-panel="desktop"] [data-role="weather-forecast"]');
    // FR-007/data-model.md: independent per-indicator unavailable state, same dimmed dash icon
    // current-conditions already used — a behavior change from 023-weather-panel-icons, which
    // rendered nothing here.
    await expect(forecast).toHaveAttribute('data-available', 'false');
    await expect(forecast.locator('.info-panel__weather-icon')).toHaveText('–');
    await expect(forecast).toHaveAttribute('aria-label', 'Nicht verfügbar');
    // The outer link and the current-conditions indicator stay available — only the forecast
    // side is affected (independent availability, FR-007).
    const desktop = page.locator('[data-info-panel="desktop"]');
    await expect(desktop.locator('[data-role="weather"]')).toHaveAttribute(
      'data-available',
      'true',
    );
    await expect(desktop.locator('[data-role="weather-current"]')).toHaveAttribute(
      'data-available',
      'true',
    );
  });

  test(
    'a "sunny" mocked response at nighttime still shows the regular sun icon/label in the forecast indicator ' +
      "(FR-012's independence from the current-conditions override)",
    async ({ page }) => {
      await page.clock.install({ time: new Date('2026-08-10T02:00:00') });
      await mockProduction(page);
      await mockForecast(page, { weatherCode: 0, tomorrowWeatherCode: 0 }); // sunny
      await page.goto('/');

      const forecast = page.locator('[data-info-panel="desktop"] [data-role="weather-forecast"]');
      await expect(forecast).toHaveAttribute('aria-label', /Sonnig/);
      await expect(forecast).not.toHaveAttribute('aria-label', /Klar/);
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
    await expect(forecast).toContainText('14° - 14°');
    await expect(forecast).toHaveAttribute('aria-label', /\(14°C - 14°C\)/);
  });
});

test.describe('Global info panel — weather hover/focus/tap tooltip detail (US2)', () => {
  test('hovering the current-conditions icon reveals a tooltip with the full previous text, hidden again on mouse-out', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T13:00:00') });
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 61 });
    await page.goto('/');

    const current = page.locator('[data-info-panel="desktop"] [data-role="weather-current"]');
    const tooltip = current.locator('.info-panel__weather-tooltip');
    await expect(tooltip).toHaveText('Regen, 18°C');
    await expect(tooltip).not.toBeVisible();

    await current.hover();
    await expect(tooltip).toBeVisible();

    // Moving the pointer elsewhere hides it again.
    await page.locator('body').hover({ position: { x: 5, y: 5 } });
    await expect(tooltip).not.toBeVisible();
  });

  test('hovering the forecast icon reveals its own tooltip (including the day prefix), independent of the current-conditions tooltip', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T13:00:00') });
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 61 });
    await page.goto('/');

    const current = page.locator('[data-info-panel="desktop"] [data-role="weather-current"]');
    const forecast = page.locator('[data-info-panel="desktop"] [data-role="weather-forecast"]');
    const currentTooltip = current.locator('.info-panel__weather-tooltip');
    const forecastTooltip = forecast.locator('.info-panel__weather-tooltip');
    await expect(forecastTooltip).toHaveText('Heute: Regen (12°C - 22°C)');

    await forecast.hover();
    await expect(forecastTooltip).toBeVisible();
    // Hovering forecast never reveals the current-conditions tooltip.
    await expect(currentTooltip).not.toBeVisible();
  });

  test('tabbing to each indicator via keyboard reveals the same tooltip on focus', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T13:00:00') });
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 61 });
    await page.goto('/');

    const current = page.locator('[data-info-panel="desktop"] [data-role="weather-current"]');
    const tooltip = current.locator('.info-panel__weather-tooltip');
    // `.focus()` (unlike `.hover()`) doesn't auto-wait for actionability — wait for the weather
    // fetch to resolve and the panel's `hidden` attribute to clear first, or a focus() called
    // while still hidden silently no-ops.
    await expect(current).toHaveAttribute('aria-label', 'Regen, 18°C');
    await expect(tooltip).not.toBeVisible();

    await current.focus();
    await expect(tooltip).toBeVisible();

    await current.blur();
    await expect(tooltip).not.toBeVisible();
  });

  test("each indicator's aria-label carries the full previous text unconditionally, without hover/focus (FR-006/SC-002)", async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T13:00:00') });
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 61 });
    await page.goto('/');

    const current = page.locator('[data-info-panel="desktop"] [data-role="weather-current"]');
    const forecast = page.locator('[data-info-panel="desktop"] [data-role="weather-forecast"]');
    // Present in the accessibility tree from render, before any interaction.
    await expect(current).toHaveAttribute('aria-label', 'Regen, 18°C');
    await expect(forecast).toHaveAttribute('aria-label', 'Heute: Regen (12°C - 22°C)');
  });

  test('unavailable weather still exposes "Nicht verfügbar" as the aria-label on both indicators', async ({
    page,
  }) => {
    await mockProduction(page);
    await mockForecast(page, { aborted: true });
    await page.goto('/');

    const current = page.locator('[data-info-panel="desktop"] [data-role="weather-current"]');
    const forecast = page.locator('[data-info-panel="desktop"] [data-role="weather-forecast"]');
    await expect(current).toHaveAttribute('data-available', 'false');
    await expect(forecast).toHaveAttribute('data-available', 'false');
    await expect(current).toHaveAttribute('aria-label', 'Nicht verfügbar');
    await expect(forecast).toHaveAttribute('aria-label', 'Nicht verfügbar');
  });

  test('tapping an indicator (touch, no real hover) opens its tooltip, and tapping elsewhere closes it', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'touchstart emulation is most reliable on Chromium');
    await page.clock.install({ time: new Date('2026-08-10T13:00:00') });
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 61 });
    await page.goto('/');

    const current = page.locator('[data-info-panel="desktop"] [data-role="weather-current"]');
    const tooltip = current.locator('.info-panel__weather-tooltip');
    // `.dispatchEvent()` (unlike `.hover()`) doesn't auto-wait for actionability — wait for the
    // weather fetch to resolve first (see the focus test above for the same reasoning).
    await expect(current).toHaveAttribute('aria-label', 'Regen, 18°C');
    await expect(tooltip).not.toBeVisible();

    await current.dispatchEvent('touchstart');
    await expect(tooltip).toBeVisible();

    // Tapping elsewhere closes it.
    await page.locator('body').dispatchEvent('touchstart');
    await expect(tooltip).not.toBeVisible();
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

  test('the mobile compact indicators show the same divider and per-indicator unavailable state as desktop', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T18:00:00') }); // after the day switch
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 61, omitTomorrow: true });
    await page.goto('/');

    const mobile = page.locator('[data-info-panel="mobile"]');
    await expect(mobile.locator('[data-role="weather-forecast"]')).toHaveCSS(
      'border-left-style',
      'solid',
    );
    await expect(mobile.locator('[data-role="weather-current"]')).toHaveAttribute(
      'data-available',
      'true',
    );
    await expect(mobile.locator('[data-role="weather-forecast"]')).toHaveAttribute(
      'data-available',
      'false',
    );
    await expect(
      mobile.locator('[data-role="weather-forecast"] .info-panel__weather-icon'),
    ).toHaveText('–');
  });
});

test.describe('Global info panel — weather tooltip fits within a 320px viewport (constitution Principle IV)', () => {
  test.use({ viewport: { width: 320, height: 800 } });

  test('an open tooltip on either indicator does not overflow the viewport edge', async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2026-08-10T13:00:00') });
    await mockProduction(page);
    await mockForecast(page, { weatherCode: 61 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const mobile = page.locator('[data-info-panel="mobile"]');
    const current = mobile.locator('[data-role="weather-current"]');
    const forecast = mobile.locator('[data-role="weather-forecast"]');

    // Baseline before either tooltip opens — whether or not the rest of the mobile info panel
    // row itself already fits exactly at 320px is a pre-existing, out-of-scope layout concern;
    // this feature's own requirement (Constraints) is narrower: revealing a tooltip must not add
    // *further* horizontal overflow on top of whatever baseline already exists.
    const baseline = await page.evaluate(() => document.documentElement.scrollWidth);

    await current.focus();
    const currentTooltipBox = await current.locator('.info-panel__weather-tooltip').boundingBox();
    // Anchored to its own (leftmost) indicator's left edge (app.css), so it can't hang off the
    // left side of the viewport regardless of where that indicator sits.
    expect(currentTooltipBox.x).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      baseline,
    );
    await current.blur();

    await forecast.focus();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      baseline,
    );
  });
});
