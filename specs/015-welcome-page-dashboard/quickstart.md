# Quickstart: Validate the Welcome Page

## Prerequisites

- `npm install` (once).
- `npm start` — serves `web/` via browser-sync with hot reload. Copy the printed URL into a
  browser (WSL2 cannot auto-open one).
- At least one file dropped into `web/img/plant/` and listed in `PLANT_PHOTOS` (`web/js/config.js`)
  to exercise the non-empty carousel states; leave `PLANT_PHOTOS` empty to test the placeholder
  state (FR-008).

## Manual validation (per user story)

### User Story 1 — fast plant overview at the base URL

1. Open the base URL with no hash (or `#/`).
2. **Expect**: welcome page renders — not a day-view chart. Left ~2/3 shows the carousel above
   plant details; right ~1/3 shows today's chart (desktop width).
3. Resize below ~768px (or use device emulation).
4. **Expect**: the layout stacks into a single column: carousel → plant details → today's chart,
   still fully readable, no overlap/cut-off content (SC-003).

### User Story 2 — photo carousel

1. With 2+ files in `PLANT_PHOTOS`: confirm more than one image is reachable (auto-rotation and/or
   visible prev/next controls).
2. Set `PLANT_PHOTOS` to exactly one filename: confirm the single image shows with no dead/disabled
   next-arrow rendered.
3. Set `PLANT_PHOTOS` to `[]`: confirm a neutral placeholder appears (no broken `<img>`, no gap).

### User Story 3 — today's generation at a glance

1. On a day with recorded `min{yymmdd}.js` data for today: confirm the right-hand chart shows a
   single line (the combined total) — no WR1/WR2 legend entries, no Wirkungsgrad %, no UDC V.
2. Compare its y-axis gridlines/max against the existing day view's (`#/day/yyyy/mm/dd` for today)
   feed-in axis — they MUST match (same `DAY_CHART_AXES.feedInW`), so the two are visually
   comparable (FR-016).
3. Before today has any readings (or by temporarily pointing at a date with an empty/missing min
   file, if testing outside real-time): confirm a neutral empty state, not a console error or blank
   chart mount.

### Regression: explicit routes unaffected (FR-002 / SC-002)

Navigate to each of, and confirm each still shows its own existing view (not the welcome page):

- `#/day/2026/08/01`
- `#/month/2026/08`
- `#/year/2026`
- `#/total`

### Failure isolation (SC-004)

Independently simulate each of the three failures (e.g. via DevTools request-blocking or renaming
a file locally) and confirm the _other two_ regions still render normally each time:

- Block `data/base_vars.js` → plant-details panel shows its empty state; carousel and chart
  unaffected.
- Empty `PLANT_PHOTOS` → carousel shows placeholder; plant details and chart unaffected.
- Block/empty today's `min{yymmdd}.js` → chart shows its empty state; carousel and plant details
  unaffected.

## Automated tests

- `npx playwright test tests/e2e/welcome-page.spec.js --reporter=line` — new spec covering the
  scenarios above.
- `npx playwright test --reporter=line` (full suite) — confirms the existing `dashboard-*.spec.js`
  files (updated for this feature, since `'/'` now serves the welcome page rather than the day
  view) and `detail-views.spec.js` / `navigation.spec.js` still pass unaffected.
- `node --test scripts/*.test.js` — only relevant if a helper script was touched (none expected;
  see research.md §2 for why no manifest-generation script was introduced).
- `npm run lint` and `npm run format:check` MUST both pass before commit (constitution Development
  Workflow gate 5).
