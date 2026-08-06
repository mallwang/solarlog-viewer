import { test, expect } from '@playwright/test';

test.describe('Empty/placeholder states for periods without data (FR-009, Edge Cases)', () => {
  test('day view shows a styled empty state for a date with no min file', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/#/day/2099/01/01');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.empty-state')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('month view shows a styled empty state for a month with no data', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/#/month/2099/01');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.empty-state')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('year view shows a styled empty state when no yearly totals are available', async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.route('**/years.js', (route) => route.fulfill({ status: 404, body: 'not found' }));

    await page.goto('/#/year/2099');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.empty-state')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
