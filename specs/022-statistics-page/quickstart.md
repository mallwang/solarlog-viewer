# Quickstart: Statistics Page

Validates the feature end-to-end once implemented, against the acceptance scenarios in
[spec.md](spec.md).

## Prerequisites

- `npm install` (once per checkout).
- `npm start` — serves `web/` via browser-sync with `/data/*`/`/hist/*` proxied to the live
  device (see project `CLAUDE.md` / `README.md`'s "Dev server" section). Copy the printed URL into
  a browser (WSL2 cannot auto-open one).

## Unit tests (data layer)

```bash
node --test web/js/data/statistics.test.js
```

Expected: every exported function in [contracts/statistics-module.md](contracts/statistics-module.md)
has passing coverage against inline `DailyTotal[]`/`MonthlyTotal[]`/`YearlyTotal[]` fixtures,
including:

- `bestWorstMonth`/`bestWorstYear`/`maxDaily*` pick the correct extremum and ignore months/years
  with zero entries.
- `buildCalendarHeatmap` marks a date absent from the input as `value: null` (not `0`), and scales
  `relativeIntensity` to that year's own min/max, not a fixed global scale (FR-015).
- `computeLongestStreak` correctly identifies an ongoing streak (`endDate` = the fixture's last
  date) as `isOngoing: true`, and that a gap breaks the run.
- `computeYoyCumulative` aligns Feb 29 without shifting later day-of-year values in non-leap-year
  series (mirrors the existing Mode 4 precedent's tested behavior).
- `hasEnoughHistory` returns `false` for `trends`/`yoy` given only one year of data, `true` given
  two.

## Chart factory tests

```bash
node --test web/js/charts/chart-factory.test.js
```

Expected: the three new modes (`yoy-cumulative`, `lifetime-cumulative`, `specific-yield-trend`)
each produce valid ApexCharts option objects (same assertion style as existing mode tests).

## Manual / Playwright validation (per user story)

Run: `npx playwright test tests/e2e/statistics-view.spec.js --reporter=line`

1. **US1 — Common overview** (P1): open `#/statistics` (or `#/statistics/common`) → all 8 tiles
   (best/worst month, best/worst year, max daily power, max Ist %, max daily CO2, max daily €)
   render with a value + period; clicking the best-month tile navigates to `#/month/YYYY/MM` for
   that exact month.
2. **US2 — Heatmaps** (P2): open `#/statistics/heatmaps`, pick a year with data → three heatmaps
   render, one cell per calendar day; a day with no recorded data renders visually distinct
   (hatch) from a real zero-value day; switching the year re-renders all three.
3. **US3 — Streaks & Trends** (P3): open `#/statistics/streaks` → streak length + start/end dates
   render, with an "ongoing" badge if applicable. Open `#/statistics/trends` → YoY comparison,
   lifetime cumulative, and specific-yield charts each render with the degradation caveat text
   always visible (not a hover-only tooltip).
4. **US4 — Best vs. Worst** (P4): open `#/statistics/best-worst` → every paired stat shows both
   sides with independent source-view links.
5. **Edge cases**: with a fixture/test plant under one year of history, Heatmaps/Streaks/Trends
   each show the "not enough data yet" empty state (not a blank/broken chart) while Common/Best
   vs. Worst still render normally (FR-012, SC-005).
6. **Responsive**: resize to 320px and 2560px — topic nav collapses to a horizontal button row on
   mobile, tile grids drop from 4 to 2 columns, no horizontal scroll at either width.

## Constitution gate

Before calling the feature done: `npm run lint`, `npm run format:check`, `npm test` (Playwright)
all pass; `docs/user-guide.md` / `docs/user-guide.de.md` and `README.md` / `README.de.md` updated
per Documentation Standards.
