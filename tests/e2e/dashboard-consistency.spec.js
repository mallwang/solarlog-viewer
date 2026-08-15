import { test, expect } from '@playwright/test';

const VIEWS = [
  { name: 'welcome', path: '/' },
  { name: 'day', path: '/#/day/2019/07/15' },
  { name: 'month', path: '/#/month/2008/07' },
  { name: 'year', path: '/#/year/2019' },
  { name: 'total', path: '/#/total' },
  { name: 'events', path: '/#/events' },
];

test.describe('Dashboard consistency across all six views (US1)', () => {
  for (const { name, path } of VIEWS) {
    test(`${name} view uses the shared heading and layout classes`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h2.view-title')).toHaveCount(1);
      await expect(page.locator('body')).toHaveCSS('font-family', /.+/);

      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bg).toBeTruthy();
    });
  }

  test('all six views share the same computed background and text color', async ({ page }) => {
    const samples = [];
    for (const { path } of VIEWS) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      samples.push(
        await page.evaluate(() => ({
          bg: getComputedStyle(document.body).backgroundColor,
          color: getComputedStyle(document.body).color,
        })),
      );
    }
    const [first, ...rest] = samples;
    for (const sample of rest) {
      expect(sample.bg).toBe(first.bg);
      expect(sample.color).toBe(first.color);
    }
  });
});
