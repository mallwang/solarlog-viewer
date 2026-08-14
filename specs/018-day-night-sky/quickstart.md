# Quickstart: Day/Night Sky Background

Validation scenarios that prove this feature works end-to-end. Assumes familiarity with
`017-background-weather-config/quickstart.md`'s dev-server and mock-based approach — this file
only covers what's new.

## Prerequisites

- `npm start` running (`bs-config.cjs` proxy; see project `CLAUDE.md`).
- `npx playwright test --reporter=line` runnable locally.
- `web/js/config.js`'s `BACKGROUND_WEATHER` left at its default (`'auto'`) for the day/night
  scenarios below — day/night state is independent of that setting (FR-010), but leaving it
  `'auto'` also exercises the live weather-category path alongside it.

## Manual validation

1. **Night appearance, live**: Since the plant's local sunset/sunrise won't line up with every
   dev session, use Playwright's Open-Meteo mock (`mockOpenMeteo()` in `tests/e2e/sky.spec.js`) to
   force a `sunrise`/`sunset` window that puts "now" on either side of it — see Automated
   validation below for the concrete pattern. For a quick manual look, temporarily edit the
   mocked `sunrise`/`sunset` values in a scratch Playwright script to bracket the current wall-clock
   time on the night side, load the page, and confirm the sky renders with the dark night gradient,
   dimmed/hidden moon crossfading in (not the sun), while clouds/flying objects for the mocked
   category still render and animate.
2. **Starfield gating**: With the same night-side mock, cycle `weatherCode` through one
   representative code per category (see `CATEGORY_CODES` already in `sky.spec.js`) and confirm
   stars are visible only for `sunny`/`mixed`, absent for `cloudy`/`rain`/`snow`.
3. **Day unaffected**: With `sunrise`/`sunset` bracketing "now" on the day side, confirm the sky
   looks byte-for-byte like it does today (bright gradient, sun, existing cloud/rain/snow
   treatment) and that no stars or falling star ever appear regardless of category.
4. **Gradual transition**: Mock `sunrise`/`sunset` so "now" falls inside the existing 5-minute
   crossfade window (`CROSSFADE_WINDOW_MS` in `solar-arc.js`) and confirm the sky renders a
   partial blend (partial night gradient, partial starfield opacity) rather than a hard cut —
   matching the sun/moon crossfade that already partially blends in that window today.
5. **Falling star, reduced motion**: With the starfield visible (per step 2), use Playwright's
   `page.emulateMedia({ reducedMotion: 'reduce' })` (already used elsewhere in the suite for the
   existing flying-object reduced-motion tests) and confirm no falling-star replay ever plays,
   while the static starfield itself remains visible.
6. **Last-known-good on fetch failure**: Load with a working mock, capture the resulting
   `data-sky` value, then force a subsequent poll to fail (`mockOpenMeteo` failure pattern already
   used in `sky.spec.js`'s "a weather fetch failure leaves the default unchanged appearance" test)
   and confirm `data-sky` stays at its last value rather than reverting.

## Automated validation (Playwright)

Extend `tests/e2e/sky.spec.js` — it already has the mocking/fixture infrastructure this feature
needs (`mockOpenMeteo()` accepts `sunrise`/`sunset`/`nextSunrise` overrides and `weatherCode`;
`CATEGORY_CODES` gives one representative code per category). New test groups to add:

```js
test.describe('Day/night sky background — User Story 1', () => {
  test('night window renders data-sky="night" with moon crossfade, clouds unaffected', async ({
    page,
  }) => {
    // mock sunrise/sunset so Date.now() falls in the night range; assert .sky-clouds[data-sky="night"]
    // and .sky-clouds[data-weather=<mocked category>] both hold, and .cloud/.sky-flying-objects
    // behavior is unchanged from the existing day-mode assertions.
  });

  test('day window renders data-sky="day" unchanged from today', async ({ page }) => {
    /* ... */
  });
});

test.describe('Starfield — User Story 2', () => {
  for (const [category, weatherCode] of Object.entries(CATEGORY_CODES)) {
    test(`night + ${category}: starfield visible only for sunny/mixed`, async ({ page }) => {
      // mock night window + weatherCode; assert .sky-star visibility matches
      // ['sunny', 'mixed'].includes(category).
    });
  }

  test('day window: no stars regardless of category', async ({ page }) => {
    /* ... */
  });
});

test.describe('Falling star — User Story 3', () => {
  test('reduced motion suppresses the falling-star replay, starfield stays visible', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // mock night + sunny; wait past a scheduler interval; assert .sky-falling-star never gains
    // its play class while .sky-star dots remain visible.
  });

  test('never plays during day or night+cloudy/rain/snow', async ({ page }) => {
    /* ... */
  });
});
```

Run with: `npx playwright test tests/e2e/sky.spec.js --reporter=line`

For the new `falling-star-scheduler.js` pure logic, follow the `flying-objects.test.js` pattern:

```bash
node --test web/js/sky/falling-star-scheduler.test.js
```

## Expected outcomes

- All scenarios above pass locally before this feature is considered done (constitution Testing
  standard — "a feature is not considered done until its Playwright tests pass locally").
- No new console errors in any scenario, including the fetch-failure case (matches the existing
  `017-background-weather-config` bar).
- `npm run lint` and `npm run format:check` exit 0.
