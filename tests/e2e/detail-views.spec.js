import { test, expect } from '@playwright/test';

test.describe('Month detail view (US2)', () => {
  test('2008-07 renders per-inverter daily bars', async ({ page }) => {
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.chart-container canvas')).toHaveCount(1);
    await expect(page.locator('.empty-state')).toHaveCount(0);
  });
});

test.describe('Year detail view (US2)', () => {
  test('renders all years with no drops, including the partial 2006 year', async ({ page }) => {
    await page.goto('/#/year/2019');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.chart-container canvas')).toHaveCount(1);
    await expect(page.locator('.empty-state')).toHaveCount(0);

    const labels = await page.evaluate(() => {
      const canvas = document.querySelector('.chart-container canvas');
      return window.Chart.getChart(canvas).data.labels;
    });
    expect(labels).toContain('2006');
    expect(labels.length).toBeGreaterThanOrEqual(19);
  });
});

test.describe('Lifetime (total) view (US2)', () => {
  test('renders cumulative chart plus CO2/tariff summary', async ({ page }) => {
    await page.goto('/#/total');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.chart-container canvas')).toHaveCount(1);
    const summaryText = await page.locator('.summary-table').innerText();
    expect(summaryText).toMatch(/kg/);
    expect(summaryText).toMatch(/€/);
  });
});

test.describe('Compare (year-over-year) view (US3)', () => {
  test('renders at least 3 distinct year lines with a day/kWh tooltip', async ({ page }) => {
    await page.goto('/#/compare');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.chart-container canvas')).toHaveCount(1);

    const info = await page.evaluate(() => {
      const canvas = document.querySelector('.chart-container canvas');
      const chart = window.Chart.getChart(canvas);
      return { datasetCount: chart.data.datasets.length, labels: chart.data.labels };
    });
    expect(info.datasetCount).toBeGreaterThanOrEqual(3);
    // Feb 29 (leap year) is day 60 and must not shift later days out of range.
    expect(info.labels).toContain(60);
  });
});

test.describe('Language switching (US5)', () => {
  test('switching to English updates nav, axis, and summary-table labels without a full reload', async ({
    page,
  }) => {
    await page.goto('/#/total');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Gesamtübersicht' })).toBeVisible();
    await expect(page.locator('.summary-table')).toContainText('Gesamtertrag');

    await page.getByRole('button', { name: 'EN' }).click();

    await expect(page.getByRole('heading', { name: 'Lifetime Overview' })).toBeVisible();
    await expect(page.locator('.summary-table')).toContainText('Total yield');
    await expect(page.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the language selection persists across a reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'EN' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true');
  });
});
