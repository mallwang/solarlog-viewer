import { test, expect } from '@playwright/test';

test.describe('Parent navigation (US1: day -> month)', () => {
  test('day view exposes a parent link to its month and navigates there on click', async ({
    page,
  }) => {
    await page.goto('/#/day/2026/03/15');
    await page.waitForLoadState('networkidle');

    const parentLink = page.locator('.period-nav__link--parent');
    await expect(parentLink).toBeVisible();
    await expect(parentLink).toHaveAttribute('href', '#/month/2026/03');

    await parentLink.click();
    await expect(page).toHaveURL(/#\/month\/2026\/03$/);
    await expect(page.locator('.chart-container .apexcharts-svg')).toHaveCount(1);
  });
});

test.describe('Parent navigation (US2: month -> year)', () => {
  test('month view exposes a parent link to its year and navigates there on click', async ({
    page,
  }) => {
    await page.goto('/#/month/2026/03');
    await page.waitForLoadState('networkidle');

    const parentLink = page.locator('.period-nav__link--parent');
    await expect(parentLink).toBeVisible();
    await expect(parentLink).toHaveAttribute('href', '#/year/2026');

    await parentLink.click();
    await expect(page).toHaveURL(/#\/year\/2026$/);
    await expect(page.locator('.chart-container .apexcharts-svg')).toHaveCount(1);
  });
});

test.describe('Parent navigation (US3: year -> total)', () => {
  test('year view exposes a parent link to the total view and navigates there on click', async ({
    page,
  }) => {
    await page.goto('/#/year/2026');
    await page.waitForLoadState('networkidle');

    const parentLink = page.locator('.period-nav__link--parent');
    await expect(parentLink).toBeVisible();
    await expect(parentLink).toHaveAttribute('href', '#/total');

    await parentLink.click();
    await expect(page).toHaveURL(/#\/total$/);
    await expect(page.locator('.chart-container .apexcharts-svg')).toHaveCount(1);
  });

  test('total view (top of hierarchy) shows no parent link', async ({ page }) => {
    await page.goto('/#/total');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.period-nav__link--parent')).toHaveCount(0);
  });
});

test.describe('Parent navigation - language toggle', () => {
  // The DE/EN switcher UI is currently hidden (SHOW_LANGUAGE_SWITCHER = false in config.js,
  // see detail-views.spec.js's pre-existing "Language switching" failures), but the underlying
  // i18n mechanism (localStorage 'solarlog-lang', see i18n.js) still works - seed it directly
  // to verify the parent-link labels themselves are correctly wired to i18n across languages.
  test('parent-link labels switch DE <-> EN across day, month, and year views', async ({
    page,
  }) => {
    await page.goto('/#/day/2026/03/15');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.period-nav__link--parent')).toHaveText('Monat');

    await page.evaluate(() => window.localStorage.setItem('solarlog-lang', 'en'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.period-nav__link--parent')).toHaveText('Month');

    await page.goto('/#/month/2026/03');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.period-nav__link--parent')).toHaveText('Year');

    await page.goto('/#/year/2026');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.period-nav__link--parent')).toHaveText('Total');
  });
});

test.describe('Parent navigation - deep link', () => {
  test('a day view opened directly via URL (no prior in-app navigation) resolves its parent link correctly', async ({
    page,
  }) => {
    await page.goto('/#/day/2020/06/01');
    await page.waitForLoadState('networkidle');

    const parentLink = page.locator('.period-nav__link--parent');
    await expect(parentLink).toHaveAttribute('href', '#/month/2020/06');

    await parentLink.click();
    await expect(page).toHaveURL(/#\/month\/2020\/06$/);
  });
});
