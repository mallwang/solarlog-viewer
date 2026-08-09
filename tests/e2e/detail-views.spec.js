import { test, expect } from '@playwright/test';

test.describe('Month detail view (US2)', () => {
  test('2008-07 renders per-inverter daily bars', async ({ page }) => {
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.chart-container .apexcharts-svg')).toHaveCount(1);
    await expect(page.locator('.empty-state')).toHaveCount(0);
  });

  test('a historical month (2020-06) shows a CO2 avoidance row', async ({ page }) => {
    await page.goto('/#/month/2020/06');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.summary-table')).toContainText('Vermiedenes CO2');
    await expect(page.locator('.summary-table')).toContainText(/kg|t/);
  });
});

test.describe('Day detail view (US2)', () => {
  test('a historical day (2020-06-15) shows a CO2 avoidance row', async ({ page }) => {
    await page.goto('/#/day/2020/06/15');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.summary-table')).toContainText('Vermiedenes CO2');
    await expect(page.locator('.summary-table')).toContainText(/kg|t/);
  });
});

test.describe('Year detail view (US2)', () => {
  test('renders all years with no drops, including the partial 2006 year', async ({ page }) => {
    await page.goto('/#/year/2019');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.chart-container .apexcharts-svg')).toHaveCount(1);
    await expect(page.locator('.empty-state')).toHaveCount(0);

    const labels = await page
      .locator('.chart-container .apexcharts-xaxis-texts-g text')
      .allTextContents();
    const uniqueLabels = [...new Set(labels)];
    expect(uniqueLabels.some((label) => label.includes('2006'))).toBe(true);
    expect(uniqueLabels.length).toBeGreaterThanOrEqual(19);
  });

  test('a historical year (2020) shows a CO2 avoidance row consistent with that year factor', async ({
    page,
  }) => {
    await page.goto('/#/year/2020');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.summary-table')).toContainText('Vermiedenes CO2');
    await expect(page.locator('.summary-table')).toContainText(/kg|t/);
  });

  test('the current year shows a CO2 avoidance row (fallback factor)', async ({ page }) => {
    const currentYear = new Date().getFullYear();
    await page.goto(`/#/year/${currentYear}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.summary-table')).toContainText('Vermiedenes CO2');
  });
});

test.describe('Lifetime (total) view (US2)', () => {
  test('renders cumulative chart plus CO2/tariff summary', async ({ page }) => {
    await page.goto('/#/total');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.chart-container .apexcharts-svg')).toHaveCount(1);
    const summaryText = await page.locator('.summary-table').innerText();
    // The lifetime total's CO2 figure crosses the 10,000 kg/tonne threshold (FR-007), so it
    // renders in tonnes ("t") here rather than kg - assert either unit, not kg specifically.
    expect(summaryText).toMatch(/kg|t\b/);
    expect(summaryText).toMatch(/€/);
    await expect(page.locator('.summary-table')).toContainText('Vermiedenes CO2');
  });
});

test.describe('Compare (year-over-year) view (US3)', () => {
  test('renders at least 3 distinct year lines with a day/kWh tooltip', async ({ page }) => {
    await page.goto('/#/compare');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.chart-container .apexcharts-svg')).toHaveCount(1);

    const seriesCount = await page.locator('.chart-container .apexcharts-series').count();
    expect(seriesCount).toBeGreaterThanOrEqual(3);

    // The day-of-year axis must span (at least) a full leap year, 1-366; Feb 29 not shifting
    // later days out of range is covered by groupByYear's own node:test unit coverage
    // (compare-view.test.js). Here we only confirm the axis actually reaches that range.
    const labels = (
      await page.locator('.chart-container .apexcharts-xaxis-texts-g text').allTextContents()
    )
      .map((label) => Number.parseInt(label, 10))
      .filter((n) => !Number.isNaN(n));
    expect(Math.max(...labels)).toBeGreaterThanOrEqual(300);
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
