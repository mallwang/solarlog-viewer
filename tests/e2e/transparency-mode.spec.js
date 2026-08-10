import { test, expect } from '@playwright/test';

const TOGGLE = '#transparency-toggle';

const VIEWS_WITH_PANELS = [
  { name: 'day', path: '/#/day/2019/07/15' },
  { name: 'month', path: '/#/month/2008/07' },
  { name: 'year', path: '/#/year/2019' },
];

// Chromium serializes a color-mix()-derived computed value as `color(srgb r g b / a)` rather
// than `rgb[a](...)`, so both notations' trailing alpha component need to be matched.
function parseAlpha(colorValue) {
  const match =
    colorValue.match(/\/\s*([\d.]+)\s*\)/) ||
    colorValue.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
  return match ? Number(match[1]) : 1;
}

async function readStyles(page) {
  await page.locator('.chart-container').waitFor();
  await page.locator('.stats-panel').waitFor();
  return page.evaluate(() => ({
    attribute: document.documentElement.getAttribute('data-transparency'),
    navBg: getComputedStyle(document.getElementById('app-nav')).backgroundColor,
    // Prev/next/today/parent buttons must stay fully opaque at all times (user correction:
    // these need to stay easy to spot/click, unlike the header nav).
    periodNavLinkBg: getComputedStyle(document.querySelector('.period-nav__link')).backgroundColor,
    chartBg: getComputedStyle(document.querySelector('.chart-container')).backgroundColor,
    statsBg: getComputedStyle(document.querySelector('.stats-panel')).backgroundColor,
    // Content opacity must stay untouched — only the card background may fade (user
    // correction: fading the whole panel via `opacity` also washes out the text/values).
    chartContentOpacity: getComputedStyle(document.querySelector('.chart-mount')).opacity,
    statsContentOpacity: getComputedStyle(document.querySelector('.stats-panel table')).opacity,
  }));
}

test.describe('Transparency mode — User Story 1 (turn on)', () => {
  test('enabling the toggle sets data-transparency="on" and drives nav/panel background opacity, without fading panel content or period-nav buttons (FR-002, FR-003)', async ({
    page,
  }) => {
    await page.goto('/#/day/2019/07/15');
    await page.waitForLoadState('networkidle');

    await page.locator(TOGGLE).click();
    await expect(page.locator('html')).toHaveAttribute('data-transparency', 'on');

    const {
      attribute,
      navBg,
      periodNavLinkBg,
      chartBg,
      statsBg,
      chartContentOpacity,
      statsContentOpacity,
    } = await readStyles(page);
    expect(attribute).toBe('on');
    expect(parseAlpha(navBg)).toBeCloseTo(0, 2);
    expect(parseAlpha(periodNavLinkBg)).toBeCloseTo(1, 2);
    expect(parseAlpha(chartBg)).toBeCloseTo(0.4, 2);
    expect(parseAlpha(statsBg)).toBeCloseTo(0.4, 2);
    expect(Number(chartContentOpacity)).toBeCloseTo(1, 2);
    expect(Number(statsContentOpacity)).toBeCloseTo(1, 2);
  });

  test('transparency effect persists across dashboard/day/month/year navigation (FR-005)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator(TOGGLE).click();
    await expect(page.locator('html')).toHaveAttribute('data-transparency', 'on');

    for (const { path } of VIEWS_WITH_PANELS) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const { attribute, chartBg, statsBg } = await readStyles(page);
      expect(attribute).toBe('on');
      expect(parseAlpha(chartBg)).toBeCloseTo(0.4, 2);
      expect(parseAlpha(statsBg)).toBeCloseTo(0.4, 2);
    }
  });

  test('transparency setting persists across a page reload (FR-006, SC-004)', async ({ page }) => {
    await page.goto('/#/day/2019/07/15');
    await page.waitForLoadState('networkidle');
    await page.locator(TOGGLE).click();
    await expect(page.locator('html')).toHaveAttribute('data-transparency', 'on');

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('data-transparency', 'on');
    const stored = await page.evaluate(() => window.localStorage.getItem('solarlog-transparency'));
    expect(stored).toBe('true');
  });
});

test.describe('Transparency mode — User Story 2 (turn off)', () => {
  test('disabling the toggle removes data-transparency="on" and restores nav/panel background opacity (FR-004)', async ({
    page,
  }) => {
    await page.goto('/#/day/2019/07/15');
    await page.waitForLoadState('networkidle');
    const toggle = page.locator(TOGGLE);
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-transparency', 'on');

    await toggle.click();

    const { attribute, navBg, chartBg, statsBg } = await readStyles(page);
    expect(attribute).not.toBe('on');
    expect(parseAlpha(navBg)).toBeCloseTo(1, 2);
    expect(parseAlpha(chartBg)).toBeCloseTo(1, 2);
    expect(parseAlpha(statsBg)).toBeCloseTo(1, 2);
  });

  test('disabled state persists across a page reload (FR-006)', async ({ page }) => {
    await page.goto('/#/day/2019/07/15');
    await page.waitForLoadState('networkidle');
    const toggle = page.locator(TOGGLE);
    await toggle.click();
    await toggle.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-transparency', 'on');

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).not.toHaveAttribute('data-transparency', 'on');
    const stored = await page.evaluate(() => window.localStorage.getItem('solarlog-transparency'));
    expect(stored).toBe('false');
  });
});
