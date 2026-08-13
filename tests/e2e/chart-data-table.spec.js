import { test, expect } from '@playwright/test';

const TABLE_TOGGLE = '.chart-table-toggle button';

// No explicit localStorage-clearing beforeEach: Playwright Test gives every `test()` its own
// fresh browser context (see transparency-mode.spec.js), so `solarlog-chart-table` always starts
// unset here — and an init script that fires on every navigation would also wipe the preference
// on `page.reload()` mid-test, breaking the persistence scenarios below.

test.describe('Chart data table — User Story 1 (reveal/hide)', () => {
  test('toggle button is visible top-right of the chart, table starts hidden (FR-001, FR-005)', async ({
    page,
  }) => {
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');

    await expect(page.locator(TABLE_TOGGLE)).toBeVisible();
    await expect(page.locator(TABLE_TOGGLE)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.chart-table')).toHaveAttribute('hidden', '');
  });

  test('clicking the toggle shows a table whose rows match the chart, pressed state updates (FR-002, FR-003, FR-008)', async ({
    page,
  }) => {
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');

    await page.locator(TABLE_TOGGLE).click();

    await expect(page.locator('.chart-table')).not.toHaveAttribute('hidden', '');
    await expect(page.locator(TABLE_TOGGLE)).toHaveAttribute('aria-pressed', 'true');

    const rowCount = await page.locator('.chart-table tbody tr').count();
    // July 2008 has 31 calendar days — month-view always fills the full month (fillMonthDays).
    expect(rowCount).toBe(31);
  });

  test('clicking the toggle again hides the table and restores the "off" appearance (Acceptance Scenario 2)', async ({
    page,
  }) => {
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');

    const toggle = page.locator(TABLE_TOGGLE);
    await toggle.click();
    await expect(page.locator('.chart-table')).not.toHaveAttribute('hidden', '');

    await toggle.click();
    await expect(page.locator('.chart-table')).toHaveAttribute('hidden', '');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  test('table updates when the underlying period changes without re-toggling (FR-007)', async ({
    page,
  }) => {
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');
    await page.locator(TABLE_TOGGLE).click();
    await expect(page.locator('.chart-table')).not.toHaveAttribute('hidden', '');

    await page.goto('/#/month/2008/08');
    await page.waitForLoadState('networkidle');

    // Preference is app-wide/persisted, so the new page's table should already be visible with
    // August's 31 rows, no re-click needed (also exercises FR-006/FR-007 together).
    await expect(page.locator('.chart-table')).not.toHaveAttribute('hidden', '');
    const rowCount = await page.locator('.chart-table tbody tr').count();
    expect(rowCount).toBe(31);
  });

  test('a period with no data file at all still falls back to the pre-existing empty state without erroring (regression, FR-009)', async ({
    page,
  }) => {
    // month-view's own pre-existing "no file" empty state (see empty-state.js) replaces the whole
    // .chart-container — including the new toggle button — before any chart/table code runs; this
    // just confirms the new feature's markup additions don't break that existing fallback.
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/#/month/2099/01');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.empty-state')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('Chart data table — User Story 2 (persistence across pages/visits)', () => {
  test('toggling on the month view shows the table on the year view too, no re-click needed (FR-006, SC-002)', async ({
    page,
  }) => {
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');
    await page.locator(TABLE_TOGGLE).click();
    await expect(page.locator('.chart-table')).not.toHaveAttribute('hidden', '');

    await page.goto('/#/year/2008');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.chart-table')).not.toHaveAttribute('hidden', '');
    await expect(page.locator(TABLE_TOGGLE)).toHaveAttribute('aria-pressed', 'true');
  });

  test('preference survives a full page reload (FR-005, SC-002)', async ({ page }) => {
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');
    await page.locator(TABLE_TOGGLE).click();
    await expect(page.locator('.chart-table')).not.toHaveAttribute('hidden', '');

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.chart-table')).not.toHaveAttribute('hidden', '');
    await expect(page.locator(TABLE_TOGGLE)).toHaveAttribute('aria-pressed', 'true');
    const stored = await page.evaluate(() => window.localStorage.getItem('solarlog-chart-table'));
    expect(stored).toBe('true');
  });

  test('turning the table off persists too — a freshly loaded page starts hidden again (FR-004)', async ({
    page,
  }) => {
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');
    const toggle = page.locator(TABLE_TOGGLE);
    await toggle.click();
    await toggle.click();
    await expect(page.locator('.chart-table')).toHaveAttribute('hidden', '');

    await page.goto('/#/month/2008/08');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.chart-table')).toHaveAttribute('hidden', '');
    await expect(page.locator(TABLE_TOGGLE)).toHaveAttribute('aria-pressed', 'false');
    const stored = await page.evaluate(() => window.localStorage.getItem('solarlog-chart-table'));
    expect(stored).toBe('false');
  });
});

test.describe('Chart data table — User Story 3 (condensed styling, responsive/theme)', () => {
  test('a full month table at 360px scrolls within itself, page stays free of horizontal scroll (SC-003)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');

    await page.locator(TABLE_TOGGLE).click();
    // Widest realistic case: per-inverter breakdown adds one column per string on top of the
    // label column.
    await page.locator('.chart-breakdown-toggle button[data-breakdown="inverters"]').click();
    await expect(page.locator('.chart-table table')).toBeVisible();

    const { pageScrollWidth, pageClientWidth } = await page.evaluate(() => ({
      pageScrollWidth: document.documentElement.scrollWidth,
      pageClientWidth: document.documentElement.clientWidth,
    }));
    // Page itself never gains horizontal scroll (constitution Principle IV) — the table's own
    // `.chart-table.overflow-x-auto` wrapper (app.css) absorbs any overflow from a wide table
    // internally instead, however many columns the per-inverter breakdown adds.
    expect(pageScrollWidth).toBeLessThanOrEqual(pageClientWidth + 1);
  });

  test("table cell borders track the app's --color-border design token, not a hardcoded color", async ({
    page,
  }) => {
    // tokens.css deliberately renders the app in light theme regardless of OS color-scheme (see
    // its own comment) — there is no separate dark palette to diverge from yet — so this proves
    // `.chart-table td`'s border-bottom-color isn't hardcoded but actually resolves to whatever
    // --color-border evaluates to (design-system consistency, spec User Story 3).
    await page.goto('/#/month/2008/07');
    await page.waitForLoadState('networkidle');
    await page.locator(TABLE_TOGGLE).click();
    await expect(page.locator('.chart-table td').first()).toBeVisible();

    const { borderColor, token } = await page.evaluate(() => {
      const cell = document.querySelector('.chart-table td');
      const tokenValue = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-border')
        .trim();
      // Resolve the token the same way the browser would, for an apples-to-apples string compare.
      const probe = document.createElement('div');
      probe.style.borderBottomColor = tokenValue;
      document.body.appendChild(probe);
      const resolvedToken = getComputedStyle(probe).borderBottomColor;
      probe.remove();
      return { borderColor: getComputedStyle(cell).borderBottomColor, token: resolvedToken };
    });

    expect(borderColor).toBe(token);
  });
});
