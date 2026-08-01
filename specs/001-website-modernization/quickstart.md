# Quickstart: Website Modernization

## Prerequisites

- Node.js 22+ and npm (per Technical Standards).
- A checkout of this repository with the source `.js` data files present at the repository root
  (`base_vars.js`, `min*.js`, `days.js`, `days_hist.js`, `months.js`, `years.js`).
- The vendored Chart.js build present at `vendor/chart.js/chart.esm.js` (research.md §2). If
  bumping the version: `npm install chart.js@<version>` then copy
  `node_modules/chart.js/dist/chart.esm.js` over the vendored file and commit it.

## Run the dev server

```bash
npm start
```

Copy the printed URL (e.g. `http://localhost:3000`) into a browser — WSL2 cannot auto-open one.
`npm run open` opens it on Windows.

## Validate the dashboard (US1, US4)

1. Open the site at a 375px-wide viewport (browser devtools device toolbar).
2. Confirm no horizontal scrolling and all summary widgets are visible without extra taps
   (current production, Gesamt-/Jahres-/Monats-/Tageserträge).
3. Confirm the current-production widget shows a value (or "0 W — not producing" at night) and
   that it re-fetches `min_cur.js` after 5 minutes without a manual reload.

## Validate deep links (US2, US3)

```text
http://localhost:3000/#/year/2008
http://localhost:3000/#/month/2019/07
http://localhost:3000/#/day/2019/07/15
http://localhost:3000/#/total
http://localhost:3000/#/compare
```

Load each URL directly (not via in-app click) and confirm the corresponding detail chart renders
immediately — this validates the router's initial-load path, not just `hashchange` navigation.

## Validate language switching (US5)

1. Switch the language selector to English; confirm nav labels, chart axis labels, and the summary
   table update without a full page reload (or with a reload that restores the current route).
2. Reload the page; confirm the previously selected language persists.

## Run automated tests

```bash
npm test               # Playwright e2e — tests/e2e/*.spec.js
npm run test:scripts   # node:test unit tests for src/js/data/* parsers (inline fixtures)
npm run lint
npm run format:check
```

Expected: all suites pass, matching the constitution's "feature is not considered done until its
Playwright tests pass locally" gate. `tests/e2e/navigation.spec.js` (unchanged) continues to
validate the archived `legacy-site/` pages as a separate concern from the new dashboard tests.
