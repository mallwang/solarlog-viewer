import { test, expect, devices } from '@playwright/test';

// See specs/020-explanatory-tooltips/quickstart.md for the manual scenarios this spec automates,
// and contracts/info-tooltip.md for the markup contract exercised here (.info-trigger button,
// aria-describedby -> .info-tooltip[role="tooltip"]).

/** @param {string} text @returns {string} */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Locates the info-trigger button belonging to the stats row whose label is exactly `labelText`
 * (anchored so e.g. "Soll" never matches the "Ist" row, whose tooltip text happens to mention
 * "Soll-Werts" — see statsRow()'s markup: label text is immediately followed by the button's own
 * "i" glyph with no separator, so `^label` + the button's "i" is an unambiguous anchor).
 * @param {import('@playwright/test').Page} page
 * @param {string} labelText
 * @returns {import('@playwright/test').Locator}
 */
function infoTriggerFor(page, labelText) {
  return page
    .locator('.stat-label', { hasText: new RegExp(`^${escapeRegExp(labelText)}i`) })
    .locator('.info-trigger');
}

/**
 * Locates the stats row (`<tr>`) whose label is exactly `labelText` — same anchoring rationale as
 * infoTriggerFor(), but for rows that may have no `.info-trigger` at all (e.g. FR-009 comparisons).
 * @param {import('@playwright/test').Page} page
 * @param {string} labelText
 * @returns {import('@playwright/test').Locator}
 */
function rowFor(page, labelText) {
  return page.locator('.summary-table tr').filter({
    has: page.locator('th', { hasText: new RegExp(`^${escapeRegExp(labelText)}(i|$)`) }),
  });
}

test.describe('Explanatory tooltips — desktop hover reveal (US1, quickstart Scenario 1)', () => {
  test('month view: yieldEuro/soll/ist/co2 tooltips are stat-specific and disappear on mouse-out', async ({
    page,
  }) => {
    await page.goto('/#/month/2020/06');
    await page.waitForLoadState('networkidle');

    const yieldTrigger = infoTriggerFor(page, 'Monatsertrag in €');
    await yieldTrigger.hover();
    await expect(yieldTrigger.locator('.info-tooltip')).toBeVisible();
    await expect(yieldTrigger.locator('.info-tooltip')).toContainText('Einspeisetarif');

    // Move the pointer off the icon; the tooltip must disappear.
    await page.mouse.move(0, 0);
    await expect(yieldTrigger.locator('.info-tooltip')).toBeHidden();

    const sollTrigger = infoTriggerFor(page, 'Soll');
    await sollTrigger.hover();
    await expect(sollTrigger.locator('.info-tooltip')).toContainText('Ertragsziel');
    await page.mouse.move(0, 0);

    const istTrigger = infoTriggerFor(page, 'Ist');
    await istTrigger.hover();
    await expect(istTrigger.locator('.info-tooltip')).toContainText('Prozentsatz');
    await page.mouse.move(0, 0);

    const co2Trigger = infoTriggerFor(page, 'Vermiedenes CO2');
    await co2Trigger.hover();
    await expect(co2Trigger.locator('.info-tooltip')).toContainText('CO2-Emissionsfaktor');
    await page.mouse.move(0, 0);
  });

  test('month view (current month): "Soll (auflaufend)" gets the running-target explanation', async ({
    page,
  }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    await page.goto(`/#/month/${year}/${month}`);
    await page.waitForLoadState('networkidle');

    const sollTrigger = infoTriggerFor(page, 'Soll (auflaufend)');
    await sollTrigger.hover();
    await expect(sollTrigger.locator('.info-tooltip')).toContainText('anteilige Ziel bis heute');
  });

  test('day view: "Tagesertrag in €" shows the yield×tariff explanation', async ({ page }) => {
    await page.goto('/#/day/2020/06/15');
    await page.waitForLoadState('networkidle');

    const yieldTrigger = infoTriggerFor(page, 'Tagesertrag in €');
    await yieldTrigger.hover();
    await expect(yieldTrigger.locator('.info-tooltip')).toContainText('Einspeisetarif');
  });
});

test.describe('Explanatory tooltips — keyboard focus reveal (US1, FR-008/SC-005, quickstart Scenario 2)', () => {
  test('tabbing to an info icon reveals its tooltip without moving the mouse', async ({ page }) => {
    await page.goto('/#/month/2020/06');
    await page.waitForLoadState('networkidle');

    const yieldTrigger = infoTriggerFor(page, 'Monatsertrag in €');
    await yieldTrigger.focus();
    await expect(yieldTrigger.locator('.info-tooltip')).toBeVisible();

    // Tab away — focus moves to the next focusable element, the tooltip must disappear.
    await page.keyboard.press('Tab');
    await expect(yieldTrigger.locator('.info-tooltip')).toBeHidden();
  });
});

test.describe('Explanatory tooltips — no clutter on touch-only viewports (US2, SC-002, quickstart Scenario 3)', () => {
  // Only the touch-capability bits of devices['iPhone 14'] — not its browserName/userAgent —
  // so this stays on the same chromium project as every other spec (playwright.config.js has a
  // single "chromium" project; overriding defaultBrowserType inside a describe block is
  // rejected by Playwright). `isMobile: true` + `hasTouch: true` together is what makes Chromium
  // report `(hover: none) and (pointer: coarse)`, which is what the CSS contract (T006) keys off.
  test.use({
    viewport: devices['iPhone 14'].viewport,
    hasTouch: true,
    isMobile: true,
  });

  test('no .info-trigger is rendered anywhere in the stats panel on a touch-only viewport', async ({
    page,
  }) => {
    await page.goto('/#/month/2020/06');
    await page.waitForLoadState('networkidle');

    // The button is unconditionally present in the markup (research.md's touch-omission
    // decision) but `display: none` outside `(hover: hover) and (pointer: fine)`, so assert
    // visibility, not DOM absence — no `.info-trigger` is *rendered*.
    await expect(page.locator('.stats-panel .info-trigger:visible')).toHaveCount(0);

    // The annotated row's height matches an unannotated row — no layout footprint (FR-004/FR-009).
    // Both are short, single-line labels (an explained row that wraps for an unrelated reason,
    // e.g. a long value forcing a second line, would be a false positive here) — "Soll" carries
    // an explanationKey, "Monatsertrag" (the yield row) does not.
    const annotatedRow = rowFor(page, 'Soll');
    const unannotatedRow = rowFor(page, 'Monatsertrag');
    const annotatedBox = await annotatedRow.boundingBox();
    const unannotatedBox = await unannotatedRow.boundingBox();
    expect(annotatedBox).not.toBeNull();
    expect(unannotatedBox).not.toBeNull();
    expect(Math.abs(annotatedBox.height - unannotatedBox.height)).toBeLessThanOrEqual(1);

    // Normal tap/scroll interaction is unaffected — a tap on the row doesn't error or hang.
    await annotatedRow.tap();
    await page.mouse.wheel(0, 200);
  });
});

test.describe('Explanatory tooltips — edge-of-viewport flip (US1, FR-007/SC-004, quickstart Scenario 4)', () => {
  test('a tooltip near the right edge stays fully within the viewport', async ({ page }) => {
    // The real stats-panel layout (label/icon on the left `<th>`, value on the right `<td>`) keeps
    // every icon comfortably clear of the viewport's right edge at every responsive breakpoint —
    // there's no natural page state that clips a real tooltip right now, which is exactly why
    // FR-007's edge-flip exists as a defensive geometry check rather than a today-reachable bug.
    // initInfoTooltips() (T007) is a single document-level delegated listener wired once at
    // bootstrap, so it applies to *any* `.info-trigger` — including one injected after load. This
    // exercises the real, unmodified production code (contracts/info-tooltip.md) against a
    // synthetic icon deliberately placed flush against the right edge, deterministically
    // reproducing the clipping condition FR-007 guards against.
    await page.setViewportSize({ width: 400, height: 300 });
    await page.goto('/#/month/2020/06');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position: fixed; top: 150px; right: 4px;';
      wrapper.innerHTML =
        '<button type="button" class="info-trigger" style="display: inline-flex" ' +
        'aria-describedby="edge-flip-test-tip">i<span class="info-tooltip" ' +
        'id="edge-flip-test-tip" role="tooltip">A sufficiently long synthetic explanation to ' +
        'force the tooltip wider than the remaining space near the viewport edge.</span></button>';
      document.body.append(wrapper);
    });

    const trigger = page.locator('#edge-flip-test-tip').locator('..');
    await trigger.hover();
    const tooltip = page.locator('#edge-flip-test-tip');
    await expect(tooltip).toBeVisible();
    await expect(trigger).toHaveClass(/info-trigger--flip/);

    const box = await tooltip.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(400 + 1);
  });
});
