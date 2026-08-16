import { test, expect } from '@playwright/test';

const VIEWS = [
  { name: 'welcome', path: '/', label: 'Anlageninfo' },
  { name: 'day', path: '/#/day/2019/07/15', label: 'Tagesertrag' },
  { name: 'month', path: '/#/month/2008/07', label: 'Monatserträge' },
  { name: 'year', path: '/#/year/2019', label: 'Jahreserträge' },
  { name: 'total', path: '/#/total', label: 'Gesamterträge' },
  { name: 'statistics', path: '/#/statistics', label: 'Statistik' },
  { name: 'events', path: '/#/events', label: 'Ereignisse' },
];

// The nav also carries a trailing external "Benutzerhandbuch" (user guide) link, rendered as a
// plain `<li><a>` alongside the routed views above (see main.js's NAV_ITEMS) — one more than
// VIEWS.length, but never `aria-current` (it's not a routed view).
const NAV_LINK_COUNT = VIEWS.length + 1;

test.describe('Navigation lists all routed views and marks the active one (FR-002, FR-003)', () => {
  for (const { name, path } of VIEWS) {
    test(`${name} view: nav lists every route with exactly one aria-current="page"`, async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const links = page.locator('#app-nav-list li a');
      await expect(links).toHaveCount(NAV_LINK_COUNT);
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

    await page.locator('#app-nav-list a', { hasText: 'Gesamterträge' }).click();
    await expect(page.locator('#app-nav-list a[aria-current="page"]')).toContainText(
      'Gesamterträge',
    );
    await expect(page.getByRole('heading', { name: 'Gesamterträge' })).toBeVisible();
    expect(reloaded).toBe(false);
  });
});
