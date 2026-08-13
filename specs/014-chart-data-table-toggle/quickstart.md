# Quickstart: Chart Data Table Toggle

Validation guide for confirming the feature works end-to-end once implemented. See
[contracts/chart-data-table.md](./contracts/chart-data-table.md) for the exact module/DOM contract
and [data-model.md](./data-model.md) for the preference/row shapes referenced below.

## Prerequisites

- Dependencies installed: `npm install`
- Tailwind CSS build running (bundled into `npm start`, or run once via `npm run build:css`)
- Local dev server running: `npm start` (browser-sync + Tailwind watcher — see project
  `CLAUDE.md`); copy the printed URL into your browser (WSL2 cannot auto-open one)

## Manual validation

1. Open the dashboard, then navigate into any month view (e.g. `#/month/2026/07`).
2. Confirm a toggle button is visible in the top-right corner of the chart card, in its default
   (off) state — no table below the chart yet.
3. Click the toggle button.
   - **Expect**: a condensed table appears directly below the chart within ~200ms
     ([SC-001](./spec.md#success-criteria-mandatory)), one row per bar/day shown in the chart, one
     column per series (matches current breakdown mode — total vs. per-inverter).
   - **Expect**: the button now shows a pressed/active appearance (FR-008).
4. Navigate to a different chart page (e.g. `#/year`) without reloading.
   - **Expect**: that chart's table is shown automatically too (FR-006,
     [SC-002](./spec.md#success-criteria-mandatory)).
5. Reload the browser.
   - **Expect**: the table is still shown by default on whatever chart page loads (FR-005).
6. Click the toggle button again (on any chart).
   - **Expect**: that chart's table disappears; navigate elsewhere and confirm every chart's table
     is now hidden too (single app-wide preference, FR-004).
7. With the table shown, use the existing "Gesamt" / per-inverter breakdown toggle on a month/year
   view.
   - **Expect**: the table's columns update to match the newly selected breakdown (FR-003, FR-007).
8. Navigate to a period with no data (e.g. a future month) with the table preference on.
   - **Expect**: the table still renders, showing a "no data" row rather than erroring or a blank
     table (Edge Cases).
9. Resize the browser to a narrow (≈360px) width with the table shown on a full day/month view.
   - **Expect**: the table scrolls horizontally within its own container; the page itself does not
     scroll horizontally ([SC-003](./spec.md#success-criteria-mandatory), constitution Principle
     IV).

## Automated validation

```bash
# Unit tests for the pure row-extraction logic
node --test web/js/views/chart-data-table.test.js

# Full script/unit test suite (regression check)
npm run test:scripts

# End-to-end coverage of toggle/persistence/sync behavior
npx playwright test tests/e2e/chart-data-table.spec.js --reporter=line

# Full E2E suite (regression check, especially navigation.spec.js)
npx playwright test --reporter=line

# Lint
npx eslint web/js/views/chart-table-toggle.js web/js/views/chart-data-table.js web/js/views/chart-data-table.test.js
```

## Expected outcomes summary

| Check                 | Pass condition                                                                    |
| --------------------- | --------------------------------------------------------------------------------- |
| Toggle button present | Visible top-right of every chart-container, all 4 view modes                      |
| Table content         | Rows/columns match the chart's currently plotted series exactly                   |
| Persistence           | `localStorage.getItem('solarlog-chart-table')` reflects last toggle after reload  |
| Cross-page sync       | Toggling on one page shows the table on the next page visited, no re-click needed |
| Graceful degradation  | Toggle still works with `localStorage` disabled (session-only, no throw)          |
| Responsive            | No page-level horizontal scroll at 320px with table shown                         |
