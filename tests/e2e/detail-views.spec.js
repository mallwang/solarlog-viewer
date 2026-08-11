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

test.describe('Day view efficiency curve (US2 — 012-efficiency-display)', () => {
  // Epoch 3 layout (6|4 fields, SB4200 block first): pac;pdc1;pdc2;yield;udc1;udc2|pac;pdc;yield;udc
  const lines = [
    'm[mi++]="20.06.24 05:00:00|0;0;0;0;0;0|0;0;0;0"', // pre-sunrise: PAC=0, PDC=0
    'm[mi++]="20.06.24 12:00:00|900;500;400;5000;240;241|300;350;3000;230"', // daytime, PAC/PDC>0
    'm[mi++]="20.06.24 21:00:00|0;0;0;5079;0;0|0;0;2995;125"', // post-sunset: PAC=0, PDC=0
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('**/hist/min200620.js', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: lines.join('\n') }),
    );
  });

  test('shows a second efficiency series/axis alongside the power series', async ({ page }) => {
    await page.goto('/#/day/2020/06/20');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.chart-container .apexcharts-series')).toHaveCount(2);
    await expect(page.locator('.chart-container .apexcharts-yaxis')).toHaveCount(2);
  });

  /**
   * Hovers the chart at a given fraction of its width, mirroring how ApexCharts resolves the
   * nearest x data point from cursor position — no marker elements exist at rest
   * (`markers: { size: 0 }`), so a targeted `.hover()` on a specific point isn't possible; moving
   * the mouse to the corresponding pixel position is. Empirically (confirmed against the
   * pre-existing power-only day chart too, not something this feature introduced), the chart's
   * plot area maps the *last* reading to the left edge and the *first* to the right edge.
   * @param {import('@playwright/test').Page} page
   * @param {number} xFraction
   */
  async function hoverChartAt(page, xFraction) {
    const box = await page.locator('.chart-container .apexcharts-svg').boundingBox();
    await page.mouse.move(box.x + box.width * xFraction, box.y + box.height / 2);
  }

  test('hovering the daytime point shows both the W value and a % value in the tooltip', async ({
    page,
  }) => {
    await page.goto('/#/day/2020/06/20');
    await page.waitForLoadState('networkidle');
    // Middle reading (12:00 daytime, index 1 of 3) sits at the chart's horizontal midpoint.
    await hoverChartAt(page, 0.5);
    const tooltip = page.locator('.apexcharts-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('W');
    await expect(tooltip).toContainText('%');
  });

  test('hovering the pre-sunrise point (PDC=0) shows the power series with the efficiency series gapped', async ({
    page,
  }) => {
    await page.goto('/#/day/2020/06/20');
    await page.waitForLoadState('networkidle');
    // First reading (05:00 pre-sunrise, PAC=0, PDC=0) sits near the chart's right edge.
    await hoverChartAt(page, 0.85);
    const tooltip = page.locator('.apexcharts-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('0 W');
    await expect(tooltip).toContainText('—');
  });

  test('a backfilled/yield-only day shows no efficiency series', async ({ page }) => {
    const yieldOnlyLines = [
      'm[mi++]="21.06.24 21:35:00|0;0;0;5079;0;0|0;0;2995;125"',
      'm[mi++]="21.06.24 21:40:00|0;0;0;5079;0;0|0;0;2995;125"',
    ];
    await page.route('**/hist/min200621.js', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: yieldOnlyLines.join('\n') }),
    );
    await page.goto('/#/day/2020/06/21');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.chart-note')).toContainText('Leistungsverlauf');
    await expect(page.locator('.chart-container .apexcharts-series')).toHaveCount(1);
    await expect(page.locator('.chart-container .apexcharts-yaxis')).toHaveCount(1);
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

    await page.getByRole('button', { name: 'EN', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Lifetime Overview' })).toBeVisible();
    await expect(page.locator('.summary-table')).toContainText('Total yield');
    await expect(page.getByRole('button', { name: 'EN', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('the language selection persists across a reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'EN', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
