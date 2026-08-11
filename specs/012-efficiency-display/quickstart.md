# Quickstart: Validating the Efficiency Display

Prerequisites: repo installed (`npm install`), dev server running via
`npm start` (per CLAUDE.md — do not use the VS Code preview).

## 1. Unit tests (pure calculation)

```bash
node --test web/js/data/efficiency.test.js
```

Expected: covers `efficiencyPercent()` for — normal ratio, `sumPdc === 0`
→ `null`, missing/empty `pdcW` → `null`, `sumPac > sumPdc` (>100%, returned
uncapped), and multi-inverter/multi-string summing.

Run the full script suite to confirm no regressions:

```bash
npm run test:scripts
```

## 2. Info panel (User Story 1)

1. `npm start`, open the printed URL.
2. With the plant currently producing (daytime, real `data/min_cur.js` with
   non-zero PAC/PDC): confirm the info panel (desktop nav row ≥`md:`, or the
   mobile bar below `md:`) shows a percentage next to the current wattage,
   e.g. `1234 W · 94%`.
3. Simulate PDC = 0 / missing (e.g. edit a local copy of `data/min_cur.js`'s
   `PdcArr` to `[[0],[0]]` or remove it) and reload: confirm the wattage still
   renders but no percentage is shown, and nothing errors in the console.
4. Simulate fetch failure (rename/move `data/min_cur.js` temporarily):
   confirm the existing "unavailable" state renders, still with no percentage.

Automated: `npx playwright test tests/e2e/info-panel.spec.js --reporter=line`.

## 3. Day view chart (User Story 2)

1. Navigate to `visu.html?mode=0&...` (or via UI) for a day known to have full
   power data (e.g. a recent sunny day).
2. Confirm a second curve (efficiency %) is visible alongside the power area
   chart, using a secondary y-axis.
3. Hover a daytime point: tooltip shows both the W value and the efficiency
   %.
4. Hover a pre-sunrise/post-sunset point (PDC = 0): confirm the efficiency
   series is gapped there (no 0% plotted) while the power series still shows
   its real (near-zero) value.
5. Navigate to a backfilled/archived day (see `day.powerUnavailable` fallback
   — a day rendered via the `day-yield` chart mode): confirm no efficiency
   curve appears, consistent with the existing yield-only fallback.

Automated: `npx playwright test tests/e2e/detail-views.spec.js --reporter=line`.

## Done criteria

All of the above pass, plus:

```bash
npm run lint
npm run format:check
```
