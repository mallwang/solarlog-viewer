import { test, expect } from '@playwright/test';

const CHART_VIEWS = [
  { name: 'day', path: '/#/day/2019/07/15', unit: 'W' },
  { name: 'month', path: '/#/month/2008/07', unit: 'kWh' },
  { name: 'year', path: '/#/year/2019', unit: 'kWh' },
  { name: 'total', path: '/#/total', unit: 'kWh' },
  { name: 'compare', path: '/#/compare', unit: 'kWh' },
];

test.describe('ApexCharts renders all five visualization modes (FR-013)', () => {
  for (const { name, path, unit } of CHART_VIEWS) {
    test(`${name} view renders an ApexCharts SVG with a working tooltip in ${unit}`, async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('.chart-container canvas')).toHaveCount(0);
      const svg = page.locator('.chart-container .apexcharts-svg');
      await expect(svg).toHaveCount(1);

      // Hover a data point to trigger the tooltip and confirm the correct unit is shown.
      const marker = page.locator('.chart-container .apexcharts-series > *').first();
      await marker.hover({ force: true });
      const tooltip = page.locator('.apexcharts-tooltip');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText(unit);
    });
  }
});
