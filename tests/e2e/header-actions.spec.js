import { test, expect } from '@playwright/test';

const GUIDE_LINK = '#user-guide-link';
const TRANSPARENCY_TOGGLE = '#transparency-toggle';
// The app defaults to German (FR-017/FR-018 in i18n.js) absent a persisted language
// selection, so an unauthenticated test session resolves the German guide file by default.
const GUIDE_URL = 'https://github.com/mallwang/solarlog-viewer/blob/main/docs/user-guide.de.md';

test.describe('User guide header icon (FR-001–FR-010)', () => {
  test('is visible in .app-header__actions immediately before the transparency toggle at desktop width', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const actions = page.locator('.app-header__actions');
    const guideLink = actions.locator(GUIDE_LINK);
    await expect(guideLink).toBeVisible();

    // Immediately before the transparency toggle: the guide link's following sibling is the
    // toggle button itself.
    const nextSibling = await guideLink.evaluate((el) => el.nextElementSibling?.id);
    expect(nextSibling).toBe('transparency-toggle');
  });

  test('is visible and clickable at a mobile viewport without opening the burger nav', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#app-nav-toggle')).toHaveAttribute('aria-expanded', 'false');
    const guideLink = page.locator(GUIDE_LINK);
    await expect(guideLink).toBeVisible();
    await expect(page.locator(TRANSPARENCY_TOGGLE)).toBeVisible();
  });

  test('has a non-empty accessible name', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const ariaLabel = await page.locator(GUIDE_LINK).getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel.length).toBeGreaterThan(0);
  });

  test('clicking it opens the language-specific user guide in a new tab', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.locator(GUIDE_LINK).click(),
    ]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe(GUIDE_URL);
  });

  test('the main nav list contains no link to the user guide (exists in exactly one place)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const navGuideLinks = page.locator('#app-nav-list a[href*="docs/user-guide"]');
    await expect(navGuideLinks).toHaveCount(0);
  });

  test('clicking the transparency toggle does not change the guide icon or its accessible name', async ({
    page,
  }) => {
    // Regression guard: the guide link shares the `.transparency-toggle` class with the real
    // toggle purely for CSS chrome reuse (research.md §3) — the two buttons must stay
    // independently wired, not both respond to `document.querySelectorAll('.transparency-
    // toggle')`-driven state updates.
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const guideLink = page.locator(GUIDE_LINK);
    const guideLabelBefore = await guideLink.getAttribute('aria-label');
    const guideHtmlBefore = await guideLink.innerHTML();

    await page.locator(TRANSPARENCY_TOGGLE).click();

    await expect(guideLink).toHaveAttribute('aria-label', guideLabelBefore);
    expect(await guideLink.innerHTML()).toBe(guideHtmlBefore);
    await expect(guideLink).not.toHaveAttribute('aria-pressed');
  });
});
