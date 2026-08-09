import { test, expect } from '@playwright/test';

const VIEWS = [
  { name: 'dashboard', path: '/', label: 'Übersicht' },
  { name: 'day', path: '/#/day/2019/07/15', label: 'Tageswerte' },
  { name: 'month', path: '/#/month/2008/07', label: 'Monatswerte' },
  { name: 'year', path: '/#/year/2019', label: 'Jahreswerte' },
  { name: 'total', path: '/#/total', label: 'Gesamtübersicht' },
  { name: 'compare', path: '/#/compare', label: 'Jahresvergleich' },
];

test.describe('Navigation lists all six views and marks the active one (FR-002, FR-003)', () => {
  for (const { name, path } of VIEWS) {
    test(`${name} view: nav lists all six routes with exactly one aria-current="page"`, async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const links = page.locator('#app-nav-list li a');
      await expect(links).toHaveCount(VIEWS.length);
      for (const { label } of VIEWS) {
        await expect(page.locator('#app-nav-list')).toContainText(label);
      }

      const current = page.locator('#app-nav-list a[aria-current="page"]');
      await expect(current).toHaveCount(1);
    });
  }

  test('clicking a nav item updates aria-current and content without a full page reload', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    let reloaded = false;
    page.once('load', () => {
      reloaded = true;
    });

    await page.locator('#app-nav-list a', { hasText: 'Gesamtübersicht' }).click();
    await expect(page.locator('#app-nav-list a[aria-current="page"]')).toContainText(
      'Gesamtübersicht',
    );
    await expect(page.getByRole('heading', { name: 'Gesamtübersicht' })).toBeVisible();
    expect(reloaded).toBe(false);
  });
});
