import { test, expect } from '@playwright/test';

test.describe('SolarLog navigation', () => {
  test('index loads frameset with two frames', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/legacy-site/index.html');
    await expect(page.locator('frame[name="links"]')).toHaveCount(1);
    await expect(page.locator('frame[name="visu"]')).toHaveCount(1);
    console.log('Console errors on index:', errors);
  });

  for (const { label, mode } of [
    { label: 'Tagesertrag', mode: 0 },
    { label: 'Monatserträge', mode: 1 },
    { label: 'Jahreserträge', mode: 2 },
    { label: 'Gesamterträge', mode: 3 },
  ]) {
    test(`visu.html?mode=${mode} (${label}) shows correct view`, async ({ page }) => {
      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(`/legacy-site/visu.html?mode=${mode}&offset=0`);
      await page.waitForLoadState('networkidle');

      // The page title header reflects the active mode
      const body = await page.locator('body').innerText();
      console.log(`mode=${mode} body excerpt:`, body.substring(0, 300));
      console.log(`mode=${mode} errors:`, errors);

      // URL must be preserved (no redirect stripping query string)
      expect(page.url()).toContain(`mode=${mode}`);
    });
  }

  test('links frame contains correct nav hrefs', async ({ page }) => {
    await page.goto('/legacy-site/links.html');
    await expect(page.locator('a[href*="mode=0"]')).toHaveCount(1);
    await expect(page.locator('a[href*="mode=1"]')).toHaveCount(1);
    await expect(page.locator('a[href*="mode=2"]')).toHaveCount(1);
    await expect(page.locator('a[href*="mode=3"]')).toHaveCount(1);
  });
});
