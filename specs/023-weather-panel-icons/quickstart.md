# Quickstart: Weather Panel Icons

Validation guide for confirming the reworked weather/forecast panel renders correctly end-to-end.
No contracts/ directory: this feature has no external interface (no new API, CLI, or file
format) — see plan.md's Constitution Check.

## Prerequisites

- `npm install` already run.
- Dev server running: `npm start` (browser-sync with hot reload; copy the printed URL into your
  browser — do not use the VS Code built-in preview, see `CLAUDE.md`).
- Playwright installed (`npx playwright install` if this is a fresh checkout).

## Unit tests (pure logic)

```bash
node --test web/js/weather/weather-icon.test.js web/js/weather/daytime.test.js
```

Expected: all five categories (`sunny`, `mixed`, `cloudy`, `rain`, `snow`) each resolve to a
distinct glyph; no category is left unmapped. `daytime.test.js`: `isDaytime()` returns `true`
between sunrise and sunset, `false` before sunrise and at/after sunset.

## Manual visual check

1. `npm start`, open the printed URL.
2. Look at the nav bar's info panel (desktop: right side of the nav row; mobile: full-width bar
   below the nav — resize the browser or use device emulation to see both).
3. Confirm the current-conditions line has **no** "Aktuell:" text — it starts directly with an
   icon, e.g. "☀️ Sonnig, 24°C".
4. Confirm the forecast line still starts with "Heute:", now followed by an icon, the label, and
   a low–high range in parentheses, e.g. "Heute: 🌧️ Regen (13°C - 19°C)".
5. Resize down to a 320px-wide viewport (or use Playwright device emulation) and confirm neither
   line wraps in a way that separates the icon from its label, and nothing is clipped/overlapping
   (FR-010, SC-003).
6. With DevTools' accessibility tree open (or a screen reader), confirm the icon glyph is not
   announced as its own item — only the label/temperature text is (FR-009).
7. To check the nighttime "sunny" override without waiting for actual nighttime: open DevTools,
   override the browser's clock to a time after local sunset (or before sunrise) via Playwright's
   `page.clock.install()` in a quick script, or temporarily patch `Date` in the console — confirm
   the current-conditions line shows 🌙 "Klar" instead of ☀️ "Sonnig" while weather is otherwise
   classified "sunny" (FR-011), and that the forecast ("Heute:"/"Morgen:") line is unaffected
   (FR-012).
8. To check the Heute→Morgen cutoff (FR-004/FR-014, default hour 18): with the browser clock set
   to just before 18:00 local, confirm the forecast line reads "Heute:" + today's icon/label/
   range; set it to 18:00 or later and confirm it switches to "Morgen:" + tomorrow's
   icon/label/range, with no page reload required once the panel's next weather poll fires.

## Automated end-to-end check

```bash
npx playwright test tests/e2e/info-panel.spec.js --reporter=line
```

Expected (after implementation): passes, including the updated/new assertions for:

- current-conditions line contains an icon element and no "Aktuell:" text
- forecast line retains "Heute:" and now shows the "(low°C - high°C)" range format
- the icon element carries `aria-hidden="true"`
- the "weather data unavailable" fallback for both lines is unchanged (no icon shown)
- with a mocked nighttime clock + "sunny" weather code + mocked `sunrise`/`sunset`, the
  current-conditions line shows the moon icon and "Klar"/"Clear" label, and the forecast line
  still shows the regular sunny icon/label (FR-011/FR-012)
- with the mocked clock set before vs. at/after `FORECAST_DAY_SWITCH_HOUR` (18 by default), the
  forecast line switches between "Heute:" + today's mocked daily[0] data and "Morgen:" +
  tomorrow's mocked daily[1] data (FR-004/FR-014)
- with daily[1] fields missing from the mocked response while daily[0]/current fields are present
  and the clock is past the cutoff, the forecast line falls back to its empty "unavailable" state
  (FR-015)

## Full regression gate (per constitution Development Workflow)

```bash
npm run lint
npm run format:check
npx playwright test --reporter=line
```

All three MUST pass before this feature is considered done.
