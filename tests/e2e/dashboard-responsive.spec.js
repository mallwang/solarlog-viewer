import { test, expect } from '@playwright/test';

const VIEWPORTS = [320, 375, 768, 1024, 1440, 2560];

const VIEWS = [
  { name: 'welcome', path: '/' },
  { name: 'day', path: '/#/day/2019/07/15' },
  { name: 'month', path: '/#/month/2008/07' },
  { name: 'year', path: '/#/year/2019' },
  { name: 'total', path: '/#/total' },
  { name: 'events', path: '/#/events' },
];

test.describe('Responsive layout, 320px–2560px, zero horizontal scroll (US3, SC-002)', () => {
  for (const width of VIEWPORTS) {
    for (const { name, path } of VIEWS) {
      test(`${name} view has no horizontal scroll at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
      });
    }
  }
});

// The compare view (and its #/compare route) was removed entirely by the 013-016/019/020
// redesigns (see router.js/main.js) - the total view is the remaining chart+summary page,
// mirroring the same retarget detail-views.spec.js already made for its "all years, no drops"
// assertion.
test.describe('Total view reflows without overlap or clipping (US3)', () => {
  for (const width of VIEWPORTS) {
    test(`total view at ${width}px: chart and summary content stay within the viewport`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#/total');
      await page.waitForLoadState('networkidle');

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

      const chartBox = await page.locator('.chart-container').boundingBox();
      expect(chartBox).not.toBeNull();
      expect(chartBox.x).toBeGreaterThanOrEqual(0);
      expect(chartBox.x + chartBox.width).toBeLessThanOrEqual(width + 1);
    });
  }
});
