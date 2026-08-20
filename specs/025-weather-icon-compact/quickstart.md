# Quickstart: Compact Weather Display with Hover Detail

Validation guide for confirming the compact weather indicators render and behave correctly
end-to-end. No `contracts/` directory: this feature has no external interface (no new API, CLI,
or file format) — see plan.md's Constitution Check.

## Prerequisites

- `npm install` already run.
- Dev server running: `npm start` (browser-sync with hot reload; copy the printed URL into your
  browser — do not use the VS Code built-in preview, see `CLAUDE.md`).
- Playwright installed (`npx playwright install` if this is a fresh checkout).

## Unit tests (pure logic)

```bash
node --test web/js/weather/weather-text.test.js
```

Expected: for both the current-conditions and forecast indicators, the compact value text and
the full text are each correct for the available case (including both "today"/"tomorrow"
forecast prefixes) and the unavailable case; the compact value never contains the condition
label or day prefix, and the full text always matches the previous inline wording exactly.

## Manual visual check

1. `npm start`, open the printed URL.
2. Look at the nav bar's info panel (desktop: right side of the nav row; mobile: full-width bar
   below the nav — resize the browser or use device emulation to see both).
3. Confirm the weather area now shows two small icon-over-value stacks side by side (e.g. "☀️"
   over "24°C", then a divider, then "🌧️" over "15° - 19°"), with **no** condition label or
   "Heute:"/"Morgen:" text visible by default.
4. Confirm a visible vertical divider separates the two indicators.
5. Hover the mouse over the current-conditions icon — confirm a tooltip appears with the full
   previous text (e.g. "Klar, 21°C"); move the mouse away and confirm it disappears.
6. Hover the forecast icon — confirm its tooltip shows the day prefix too (e.g. "Heute: Regen
   (15°C - 19°C)").
7. Tab to each indicator with the keyboard — confirm the same tooltip reveal happens on focus,
   and confirm (via DevTools' accessibility tree or a screen reader) that each indicator's
   accessible name is the full text, present even without hovering.
8. On a touch device or Chrome DevTools' touch emulation, tap each icon — confirm the tooltip
   opens, and tapping elsewhere closes it.
9. Resize down to a 320px-wide viewport (or use Playwright device emulation) and confirm neither
   indicator/tooltip clips, overlaps, or overflows the viewport edge (FR from Principle IV).
10. Temporarily force a weather-fetch failure (e.g. block the Open-Meteo request in DevTools'
    Network tab) and confirm both indicators show the dimmed dash "unavailable" state, each
    still reachable and each still announcing "Nicht verfügbar"/"unavailable" via `aria-label`.

## Automated end-to-end check

```bash
npx playwright test tests/e2e/info-panel.spec.js --reporter=line
```

Expected (after implementation): passes, including:

- the compact value text is visible by default and contains no condition label/day prefix
- each indicator's `aria-label` equals the full previous inline text (current: `"<label>,
<temp>°C"`; forecast: `"<prefix>: <label> (<low>°C - <high>°C)"`)
- hovering or focusing an indicator reveals its tooltip with that same full text; moving away/
  blurring hides it
- a visible divider element sits between the two indicators
- current-conditions and forecast unavailable states are independent of each other (one can be
  unavailable while the other renders normally) and each renders the dimmed dash icon, not blank
- at a 320px viewport, neither indicator nor its tooltip overflows or overlaps

## Full regression gate (per constitution Development Workflow)

```bash
npm run lint
npm run format:check
npx playwright test --reporter=line
```

All three MUST pass before this feature is considered done.
