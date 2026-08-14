import { test, expect } from '@playwright/test';

test.describe('Ereignisse (events) datatable', () => {
  test('navigating to #/events renders a table with rows', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/#/events');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.events-table tbody tr').first()).toBeVisible();
    expect(await page.locator('.events-table tbody tr').count()).toBeGreaterThan(1);
    expect(errors).toEqual([]);
  });

  test('an event with no end time shows the ongoing indicator, not a blank cell', async ({
    page,
  }) => {
    await page.goto('/#/events');
    await page.waitForLoadState('networkidle');

    const ongoingRow = page.locator('.events-table tbody tr[data-ongoing="true"]').first();
    await expect(ongoingRow).toBeVisible();
    await expect(ongoingRow.locator('.events-ongoing-badge')).toBeVisible();
  });

  test('selecting an inverter filter narrows the visible rows to that inverter only', async ({
    page,
  }) => {
    await page.goto('/#/events');
    await page.waitForLoadState('networkidle');

    const inverterSelect = page.locator('select[data-filter="inverter"]');
    const options = await inverterSelect.locator('option').all();
    // Pick the first real inverter option (index 1 — index 0 is the "all" placeholder).
    const targetValue = await options[1].getAttribute('value');
    await inverterSelect.selectOption(targetValue);

    const rows = page.locator('.events-table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(rows.nth(i)).toHaveAttribute('data-inverter-idx', targetValue);
    }
  });

  test('clicking a sortable column header changes row order; clicking again reverses it', async ({
    page,
  }) => {
    await page.goto('/#/events');
    await page.waitForLoadState('networkidle');

    const startsBefore = await page
      .locator('.events-table tbody tr')
      .evaluateAll((rows) => rows.map((r) => r.dataset.start));

    const startHeader = page.locator('.events-sort-button[data-column="start"]');
    await startHeader.click();
    const startsAfterFirstClick = await page
      .locator('.events-table tbody tr')
      .evaluateAll((rows) => rows.map((r) => r.dataset.start));
    expect(startsAfterFirstClick).not.toEqual(startsBefore);
    expect([...startsAfterFirstClick].reverse()).toEqual(startsBefore);

    await startHeader.click();
    const startsAfterSecondClick = await page
      .locator('.events-table tbody tr')
      .evaluateAll((rows) => rows.map((r) => r.dataset.start));
    expect(startsAfterSecondClick).toEqual(startsBefore);
  });

  test('a filter combination with zero matches shows the empty state, table shell (with its filters) intact', async ({
    page,
  }) => {
    await page.goto('/#/events');
    await page.waitForLoadState('networkidle');

    // Force an impossible filter combination directly (the UI's own dropdown narrowing never
    // offers an incompatible pair by design — see data-model.md's State transitions — so this
    // simulates the FilterState the empty-state render branch must handle regardless of how a
    // user could arrive at it).
    await page.evaluate(() => {
      const daySelect = document.querySelector('select[data-filter="day"]');
      const bogusOption = document.createElement('option');
      bogusOption.value = '01.01.01';
      daySelect.appendChild(bogusOption);
      daySelect.value = '01.01.01';
      daySelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // The count/reset/filters live in the table's own caption+header now, so a zero-match
    // filter swaps only the tbody content — the table (and its filters) stay reachable.
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.events-table')).toHaveCount(1);
    await expect(page.locator('select[data-filter="day"]')).toBeVisible();
  });

  test('mobile viewport: filter row wraps, table scrolls within itself, no horizontal page scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/#/events');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.events-filter-row')).toBeVisible();
    await expect(page.locator('.events-table-wrap')).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
