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

// The current-production stat moved from the (now-unreachable) dashboard.js widget grid into the
// persistent nav info panel — see web/js/info-panel/info-panel-controller.js's top comment and
// web/js/views/dashboard.js's own doc comment ("Current production moved to the global nav info
// panel"). It has no `.widget-grid`/`.status-icon`/`data-status` markup any more (grep confirms
// those classes/attributes don't exist anywhere in web/); the non-color indicator is the
// `[data-role="pulse"]` dot's `data-intensity`/`data-available` state plus the always-present text
// label (see productionValueText in info-panel-controller.js), matching FR-010's "icon/text, not
// color alone" intent.
test.describe('Non-color status communication for the current-production stat (FR-010)', () => {
  test('"not producing" is conveyed via icon/text, not color alone', async ({ page }) => {
    await page.route('**/data/min_cur.js', (route) =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: ZERO_PRODUCTION_FIXTURE }),
    );

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const production = page.locator('[data-info-panel="desktop"] [data-role="production"]');
    await expect(production).toHaveAttribute('data-available', 'true');
    // A non-color indicator (the pulse dot's intensity attribute) must accompany the text label.
    await expect(production.locator('[data-role="pulse"]')).toHaveAttribute(
      'data-intensity',
      'idle',
    );
    const valueEl = production.locator('[data-role="production-value"]');
    await expect(valueEl).not.toHaveText(/^\s*$/);
    await expect(valueEl).toHaveText(/not producing|keine Einspeisung/);
  });
});
