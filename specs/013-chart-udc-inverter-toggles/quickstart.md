# Quickstart: Chart UDC Toggle & Per-Inverter Stacked Bars

## Prerequisites

- Node.js + npm installed, dependencies installed (`npm install`).
- Local dev server running: `npm start` (browser-sync with hot-reload). Copy the printed URL into
  a browser — WSL2 cannot auto-open one (see project `CLAUDE.md`).

## Validate User Story 1 — Day chart UDC toggle

1. Start the dev server and navigate to a day view with recorded UDC data, e.g.:
   `/visu.html?mode=0&offset=0` (today) or any historical day known to have both strings reporting.
2. **Legend present, line hidden by default**: confirm the chart legend shows a "UDC" entry
   alongside the existing feed-in/efficiency entries, and that no third line is drawn on first
   load.
3. **Reveal on click**: click the "UDC" legend entry. Confirm a voltage line appears on the chart.
4. **Hide on second click**: click "UDC" again. Confirm the line disappears and the other two
   series are unaffected.
5. **Tooltip**: with UDC visible, hover a data point and confirm the tooltip includes a UDC row.
6. **No-data day**: navigate to a day rendered via the `day-yield` fallback (a backfilled day with
   no `udcV` data — see `.claude/skills/backfill-min-day`). Confirm no "UDC" legend entry appears.

Automate with Playwright (add to `tests/e2e/detail-views.spec.js`, mirroring the existing
`Day view efficiency curve` describe block's pattern for locating series/legend elements).

## Validate User Story 2 — Per-inverter stacked bars

1. Navigate to the monthly totals view for a month with two active inverter strings, e.g.:
   `/visu.html?mode=1&offset=0`.
2. **Stacked segments**: confirm each bar shows two visually distinct segments (WR1, WR2) rather
   than one solid bar.
3. **Total preserved**: confirm the combined bar height/tooltip total for a given day matches what
   was previously shown as the single-series total (cross-check against `days.js`/aggregate data
   for that period, or against the pre-change screenshot if available).
4. **Tooltip breakdown**: hover a bar and confirm the tooltip lists WR1 and WR2 individually.
5. **Drill-down unaffected**: click a bar (any segment) and confirm navigation proceeds to the
   next-finer view exactly as before (day view for a clicked month-bar day, etc.).
6. Repeat steps 1–5 for the yearly view (`/visu.html?mode=2&offset=0`) and the all-time/lifetime
   view (`/visu.html?mode=3`), confirming the same stacking, totals, tooltip, and drill-down
   behavior on their respective bar charts (months-in-year, years-in-lifetime).

## Run the automated test suite

```bash
npm test                 # full Playwright suite, includes tests/e2e/detail-views.spec.js
npx playwright test tests/e2e/detail-views.spec.js --reporter=line   # scoped run
```

Expected: all existing `detail-views.spec.js` assertions continue to pass unmodified except where
this feature's tasks explicitly update them, plus new assertions for both user stories above pass.

## Linting / formatting gate (required before commit, per constitution)

```bash
npm run lint
npm run format:check
```
