import { test, expect } from '@playwright/test';

test.describe('Month detail view (US2)', () => {
  test('2008-07 renders daily bars', async ({ page }) => {
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

test.describe('Bar chart breakdown toggle (US2 — 013-chart-udc-inverter-toggles)', () => {
  test('defaults to the single "Gesamt" bar, with the toggle set to "Gesamt"', async ({ page }) => {
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.chart-container .apexcharts-series')).toHaveCount(1);
    await expect(
      page.locator('.chart-breakdown-toggle button[data-breakdown="total"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.locator('.chart-breakdown-toggle button[data-breakdown="inverters"]'),
    ).toHaveAttribute('aria-pressed', 'false');

    await page.locator('.apexcharts-bar-area').first().hover();
    const tooltip = page.locator('.apexcharts-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Gesamt');
    await expect(tooltip).not.toContainText('WR1');
  });

  test('switching to "Wechselrichter" renders WR1/WR2 stacked segments with a Gesamt+per-string tooltip', async ({
    page,
  }) => {
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');
    await page.locator('.chart-breakdown-toggle button[data-breakdown="inverters"]').click();

    const legend = page.locator('.chart-container .apexcharts-legend-text');
    await expect(legend).toHaveCount(2);
    await expect(legend.nth(0)).toHaveText(/WR1/);
    await expect(legend.nth(1)).toHaveText(/WR2/);
    // One `.apexcharts-series` group per string (WR1, WR2), each containing one bar rect per day.
    await expect(page.locator('.chart-container .apexcharts-series')).toHaveCount(2);

    await page.locator('.apexcharts-bar-area').first().hover();
    const tooltip = page.locator('.apexcharts-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Gesamt');
    await expect(tooltip).toContainText('WR1');
    await expect(tooltip).toContainText('WR2');
  });

  for (const [label, url] of [
    ['year view (months-in-year)', '/#/year/2019'],
    ['lifetime/total view (years)', '/#/total'],
  ]) {
    test(`${label} offers the same toggle`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.chart-container .apexcharts-series')).toHaveCount(1);
      await page.locator('.chart-breakdown-toggle button[data-breakdown="inverters"]').click();
      await expect(page.locator('.chart-container .apexcharts-series')).toHaveCount(2);
      const legend = page.locator('.chart-container .apexcharts-legend-text');
      await expect(legend.nth(0)).toHaveText(/WR1/);
      await expect(legend.nth(1)).toHaveText(/WR2/);
    });
  }

  test('the breakdown selection persists across a reload', async ({ page }) => {
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');
    await page.locator('.chart-breakdown-toggle button[data-breakdown="inverters"]').click();
    await expect(page.locator('.chart-container .apexcharts-series')).toHaveCount(2);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('.chart-breakdown-toggle button[data-breakdown="inverters"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.chart-container .apexcharts-series')).toHaveCount(2);

    // A different bar-chart view (year) picks up the same persisted selection too.
    await page.goto('/#/year/2019');
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('.chart-breakdown-toggle button[data-breakdown="inverters"]'),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('clicking a bar in "Gesamt" mode still drills down into the day view', async ({ page }) => {
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');
    await page.locator('.apexcharts-bar-area').first().click();
    await expect(page).toHaveURL(/#\/day\/2008\/07\/\d+/);
  });

  test('clicking a bar in "Wechselrichter" mode still drills down into the day view', async ({
    page,
  }) => {
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');
    await page.locator('.chart-breakdown-toggle button[data-breakdown="inverters"]').click();
    await page.locator('.apexcharts-bar-area').first().click();
    await expect(page).toHaveURL(/#\/day\/2008\/07\/\d+/);
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
    // This fixture also carries UDC readings, so a third (UDC) series is now present per
    // 013-chart-udc-inverter-toggles — but it starts collapsed/hidden (see the "Day view UDC
    // toggle" describe block below) and its axis is `show: false`, so only 2 *visible* series
    // and 2 rendered y-axis groups exist, matching this test's original intent.
    await expect(
      page.locator('.chart-container .apexcharts-series:not(.apexcharts-series-collapsed)'),
    ).toHaveCount(2);
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

test.describe('Day view UDC toggle (US1 — 013-chart-udc-inverter-toggles)', () => {
  // Epoch 3 layout (6|4 fields, SB4200 block first): pac;pdc1;pdc2;yield;udc1;udc2|pac;pdc;yield;udc
  const lines = [
    'm[mi++]="20.06.24 05:00:00|0;0;0;0;0;0|0;0;0;0"', // pre-sunrise: PAC=0, PDC=0, UDC=0
    'm[mi++]="20.06.24 12:00:00|900;500;400;5000;240;241|300;350;3000;230"', // daytime, UDC present
    'm[mi++]="20.06.24 21:00:00|0;0;0;5079;0;0|0;0;2995;125"', // post-sunset
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('**/hist/min200622.js', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: lines.join('\n') }),
    );
  });

  test('legend shows a single UDC entry but nothing UDC-related is drawn on first load', async ({
    page,
  }) => {
    await page.goto('/#/day/2020/06/22');
    await page.waitForLoadState('networkidle');
    // Internally there are two UDC series (a rangeArea band and a line — see chart-factory.js'
    // `hideUdcRangeLegendEntry`), but the band's own legend row is hidden via CSS so only 3
    // entries are ever visible: Einspeisung, Wirkungsgrad, UDC (V) — one activation point for UDC.
    const visibleLegend = page.locator('.chart-container .apexcharts-legend-series:visible');
    await expect(visibleLegend).toHaveCount(3);
    await expect(visibleLegend.last()).toHaveText('UDC (V)');
    // Both UDC series exist in the DOM (ApexCharts doesn't remove hidden series), but both start
    // collapsed — that's what "nothing UDC-related is drawn" means here, per FR-002.
    await expect(page.locator('.chart-container .apexcharts-series')).toHaveCount(4);
    await expect(
      page.locator('.chart-container .apexcharts-series[seriesName="UDC-Bereich"]'),
    ).toHaveClass(/apexcharts-series-collapsed/);
    await expect(
      page.locator('.chart-container .apexcharts-series[data\\:realIndex="3"]'),
    ).toHaveClass(/apexcharts-series-collapsed/);
    await expect(page.locator('.apexcharts-legend-series', { hasText: 'UDC (V)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('clicking the UDC legend entry reveals both the line and its min/max band together; clicking again hides both', async ({
    page,
  }) => {
    await page.goto('/#/day/2020/06/22');
    await page.waitForLoadState('networkidle');
    const udcLegendItem = page.locator('.apexcharts-legend-series', { hasText: 'UDC (V)' });
    const lineSeries = page.locator('.chart-container .apexcharts-series[data\\:realIndex="3"]');
    const bandSeries = page.locator(
      '.chart-container .apexcharts-series[seriesName="UDC-Bereich"]',
    );

    await udcLegendItem.click();
    await expect(lineSeries).not.toHaveClass(/apexcharts-series-collapsed/);
    // The band has no legend entry of its own — it's kept in sync with the line's single toggle
    // (see `legendClick`'s `toggleSeries` call in buildDayOptions) rather than being independently
    // controllable.
    await expect(bandSeries).not.toHaveClass(/apexcharts-series-collapsed/);
    await expect(udcLegendItem).toHaveAttribute('aria-pressed', 'false');

    await udcLegendItem.click();
    await expect(lineSeries).toHaveClass(/apexcharts-series-collapsed/);
    await expect(bandSeries).toHaveClass(/apexcharts-series-collapsed/);
    await expect(udcLegendItem).toHaveAttribute('aria-pressed', 'true');
  });

  test('tooltip includes a UDC row with a Min/Max detail line while UDC is visible', async ({
    page,
  }) => {
    await page.goto('/#/day/2020/06/22');
    await page.waitForLoadState('networkidle');
    await page.locator('.apexcharts-legend-series', { hasText: 'UDC (V)' }).click();

    const box = await page.locator('.chart-container .apexcharts-svg').boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);

    const tooltip = page.locator('.apexcharts-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('UDC (V)');
    await expect(tooltip).toContainText(/Min: \d+ V \/ Max: \d+ V/);
  });

  test('revealed UDC (line + band) stays visible after a reload and on a different day (persisted)', async ({
    page,
  }) => {
    await page.goto('/#/day/2020/06/22');
    await page.waitForLoadState('networkidle');
    await page.locator('.apexcharts-legend-series', { hasText: 'UDC (V)' }).click();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.apexcharts-legend-series', { hasText: 'UDC (V)' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(
      page.locator('.chart-container .apexcharts-series[data\\:realIndex="3"]'),
    ).not.toHaveClass(/apexcharts-series-collapsed/);
    await expect(
      page.locator('.chart-container .apexcharts-series[seriesName="UDC-Bereich"]'),
    ).not.toHaveClass(/apexcharts-series-collapsed/);

    // Hide it again; the hidden choice is persisted too, and a fresh browser context (no prior
    // localStorage) still defaults to hidden per FR-002.
    await page.locator('.apexcharts-legend-series', { hasText: 'UDC (V)' }).click();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('.chart-container .apexcharts-series[data\\:realIndex="3"]'),
    ).toHaveClass(/apexcharts-series-collapsed/);
    await expect(
      page.locator('.chart-container .apexcharts-series[seriesName="UDC-Bereich"]'),
    ).toHaveClass(/apexcharts-series-collapsed/);
  });

  test('a backfilled/yield-only day (day-yield fallback) offers no UDC legend entry', async ({
    page,
  }) => {
    // Mirrors "a backfilled/yield-only day shows no efficiency series" above: only the
    // cumulative Wh counter survived, PAC/PDC/UDC are all zeroed — day-view.js routes this to
    // buildDayYieldOptions, which never had a UDC series to begin with (FR-005).
    const yieldOnlyLines = [
      'm[mi++]="23.06.24 21:35:00|0;0;0;5079;0;0|0;0;2995;125"',
      'm[mi++]="23.06.24 21:40:00|0;0;0;5079;0;0|0;0;2995;125"',
    ];
    await page.route('**/hist/min200623.js', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: yieldOnlyLines.join('\n') }),
    );
    await page.goto('/#/day/2020/06/23');
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('.chart-container .apexcharts-legend-series', { hasText: 'UDC' }),
    ).toHaveCount(0);
  });
});

test.describe('Day view Wirkungsgrad toggle', () => {
  // Epoch 3 layout (6|4 fields, SB4200 block first): pac;pdc1;pdc2;yield;udc1;udc2|pac;pdc;yield;udc
  const lines = [
    'm[mi++]="20.06.24 05:00:00|0;0;0;0;0;0|0;0;0;0"',
    'm[mi++]="20.06.24 12:00:00|900;500;400;5000;240;241|300;350;3000;230"',
    'm[mi++]="20.06.24 21:00:00|0;0;0;5079;0;0|0;0;2995;125"',
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('**/hist/min200627.js', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: lines.join('\n') }),
    );
    await page.route('**/hist/min200628.js', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: lines.join('\n') }),
    );
  });

  test('is shown by default, unlike UDC', async ({ page }) => {
    await page.goto('/#/day/2020/06/27');
    await page.waitForLoadState('networkidle');
    const effLegendItem = page.locator('.apexcharts-legend-series', { hasText: 'Wirkungsgrad' });
    await expect(effLegendItem).toHaveAttribute('aria-pressed', 'false');
    // Selected by `data:realIndex` (the series' position in the `series` array ApexCharts was
    // built from) rather than DOM position or `seriesName`: ApexCharts groups area/rangeArea and
    // line series into separate paint-order clusters (so `.apexcharts-series` elements don't
    // appear in build order), and sanitizes `seriesName` attribute values by replacing spaces/
    // parens with "x" (e.g. "Wirkungsgrad (%)" → "Wirkungsgradxxxx"), making both unreliable
    // selectors. Series order here (single "Gesamt" feed-in segment) is feed-in=0, efficiency=1.
    await expect(
      page.locator('.chart-container .apexcharts-series[data\\:realIndex="1"]'),
    ).not.toHaveClass(/apexcharts-series-collapsed/);
  });

  test('hidden state persists across a reload and on a different day, without affecting UDC', async ({
    page,
  }) => {
    await page.goto('/#/day/2020/06/27');
    await page.waitForLoadState('networkidle');
    const effLegendItem = page.locator('.apexcharts-legend-series', { hasText: 'Wirkungsgrad' });
    const udcLegendItem = page.locator('.apexcharts-legend-series', { hasText: 'UDC (V)' });

    await effLegendItem.click();
    await expect(effLegendItem).toHaveAttribute('aria-pressed', 'true');
    // Other series (feed-in, UDC) are unaffected by the toggle, mirroring FR-003 for UDC.
    await expect(udcLegendItem).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('.apexcharts-legend-series', { hasText: 'Wirkungsgrad' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.apexcharts-legend-series', { hasText: 'UDC (V)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.goto('/#/day/2020/06/28');
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('.apexcharts-legend-series', { hasText: 'Wirkungsgrad' }),
    ).toHaveAttribute('aria-pressed', 'true');

    // Re-reveal; that choice is persisted too.
    await page.locator('.apexcharts-legend-series', { hasText: 'Wirkungsgrad' }).click();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('.apexcharts-legend-series', { hasText: 'Wirkungsgrad' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('tooltip omits the Wirkungsgrad row while the series is hidden', async ({ page }) => {
    await page.goto('/#/day/2020/06/27');
    await page.waitForLoadState('networkidle');
    await page.locator('.apexcharts-legend-series', { hasText: 'Wirkungsgrad' }).click();

    const box = await page.locator('.chart-container .apexcharts-svg').boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
    const tooltip = page.locator('.apexcharts-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).not.toContainText('Wirkungsgrad');
  });
});

test.describe('Day view breakdown toggle (feed-in total/per-inverter)', () => {
  // Epoch 3 layout (6|4 fields, SB4200 block first): pac;pdc1;pdc2;yield;udc1;udc2|pac;pdc;yield;udc
  const lines = [
    'm[mi++]="20.06.24 05:00:00|0;0;0;0;0;0|0;0;0;0"',
    'm[mi++]="20.06.24 12:00:00|900;500;400;5000;240;241|300;350;3000;230"',
    'm[mi++]="20.06.24 21:00:00|0;0;0;5079;0;0|0;0;2995;125"',
  ];

  test.beforeEach(async ({ page }) => {
    await page.route('**/hist/min200624.js', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: lines.join('\n') }),
    );
  });

  test('defaults to a single combined feed-in line, with the toggle set to "Gesamt"', async ({
    page,
  }) => {
    await page.goto('/#/day/2020/06/24');
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('.chart-breakdown-toggle button[data-breakdown="total"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.chart-container .apexcharts-legend-text').first()).toHaveText(
      /Einspeisung/,
    );
  });

  test('switching to "Wechselrichter" splits the feed-in line into WR1/WR2 with a Gesamt+per-string tooltip', async ({
    page,
  }) => {
    await page.goto('/#/day/2020/06/24');
    await page.waitForLoadState('networkidle');
    await page.locator('.chart-breakdown-toggle button[data-breakdown="inverters"]').click();

    const legend = page.locator('.chart-container .apexcharts-legend-text');
    await expect(legend.nth(0)).toHaveText(/WR1/);
    await expect(legend.nth(1)).toHaveText(/WR2/);

    const box = await page.locator('.chart-container .apexcharts-svg').boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
    const tooltip = page.locator('.apexcharts-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Gesamt');
    await expect(tooltip).toContainText('WR1');
    await expect(tooltip).toContainText('WR2');
  });

  test('the breakdown selection persists across a reload and is shared with the bar-chart views', async ({
    page,
  }) => {
    await page.goto('/#/day/2020/06/24');
    await page.waitForLoadState('networkidle');
    await page.locator('.chart-breakdown-toggle button[data-breakdown="inverters"]').click();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('.chart-breakdown-toggle button[data-breakdown="inverters"]'),
    ).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');
    await expect(
      page.locator('.chart-breakdown-toggle button[data-breakdown="inverters"]'),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('a backfilled/yield-only day offers no breakdown toggle', async ({ page }) => {
    // Mirrors the UDC toggle's own yield-only test above: no per-inverter power data survives to
    // break down (buildDayYieldOptions only plots the combined cumulative-Wh curve).
    const yieldOnlyLines = [
      'm[mi++]="26.06.24 21:35:00|0;0;0;5079;0;0|0;0;2995;125"',
      'm[mi++]="26.06.24 21:40:00|0;0;0;5079;0;0|0;0;2995;125"',
    ];
    await page.route('**/hist/min200626.js', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: yieldOnlyLines.join('\n') }),
    );
    await page.goto('/#/day/2020/06/26');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.chart-breakdown-toggle')).toHaveCount(0);
  });
});

test.describe('Year detail view (US2)', () => {
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
  // Was originally routed to /#/year/2019, but the single-year view (year-view.js) only ever
  // renders that one year's 12 months - "all years, no drops" (one bar per year, spanning back to
  // the partial commissioning year) is what /#/total's chart actually renders (total-view.js
  // passes the full years[] list to chart-factory's 'year' mode); moved here to match.
  test('renders all years with no drops, including the partial 2006 year', async ({ page }) => {
    await page.goto('/#/total');
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

// The compare/year-over-year view (and its #/compare route) was removed entirely by the 013-016/
// 019/020 redesigns - no compare-view.js, no chart-factory 'compare' mode, no router.js route, no
// nav item (see router.js/main.js) - so there is nothing left to exercise here.

// SHOW_LANGUAGE_SWITCHER is `false` in config.js right now ("Only German is maintained for this
// plant right now; flip to `true` to bring back the DE/EN language switcher ... without deleting
// its implementation") - the switcher UI/setLanguage() logic is intentionally kept, just gated
// off by that flag, so these patch the served config.js to force it on, mirroring the same
// route-patch trick welcome-page.spec.js already uses for PLANT_PHOTOS.
async function forceLanguageSwitcherOn(page) {
  await page.route('**/js/config.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const patched = body.replace(
      /export const SHOW_LANGUAGE_SWITCHER = false;/,
      'export const SHOW_LANGUAGE_SWITCHER = true;',
    );
    await route.fulfill({ response, body: patched });
  });
}

test.describe('Language switching (US5)', () => {
  test('switching to English updates nav, axis, and summary-table labels without a full reload', async ({
    page,
  }) => {
    await forceLanguageSwitcherOn(page);
    await page.goto('/#/total');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Gesamterträge' })).toBeVisible();
    await expect(page.locator('.summary-table')).toContainText('Gesamtertrag');

    await page.getByRole('button', { name: 'EN', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Total Yields' })).toBeVisible();
    await expect(page.locator('.summary-table')).toContainText('Total yield');
    await expect(page.getByRole('button', { name: 'EN', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('the language selection persists across a reload', async ({ page }) => {
    await forceLanguageSwitcherOn(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Plant Info' })).toBeVisible();

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Plant Info' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'EN', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
