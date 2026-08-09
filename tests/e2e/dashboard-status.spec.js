import { test, expect } from '@playwright/test';

const ZERO_PRODUCTION_FIXTURE = `var Datum="06.08.26"
var Uhrzeit="22:00:00"
var Pac=0
var aPdc=new Array(0,0,0)
var curStatusCode = new Array(2)
curStatusCode[0]=1
curStatusCode[1]=1
var curFehlerCode = new Array(2)
curFehlerCode[0]=0
curFehlerCode[1]=0
var PacArr= [[0], [0]];
var PdcArr= [[0,0,0], [0,0,0]];
`;

test.describe('Non-color status communication for the current-production stat (FR-010)', () => {
  test('"not producing" is conveyed via icon/text, not color alone', async ({ page }) => {
    await page.route('**/data/min_cur.js', (route) =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: ZERO_PRODUCTION_FIXTURE }),
    );

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const currentProductionWidget = page.locator('.widget-grid .widget').first();
    await expect(currentProductionWidget.locator('.widget__value')).toHaveAttribute(
      'data-status',
      'idle',
    );
    // A non-color indicator (icon element) must be present alongside the text label.
    await expect(currentProductionWidget.locator('.status-icon')).toBeVisible();
    await expect(currentProductionWidget.locator('.widget__value')).not.toHaveText(/^\s*$/);
  });
});
