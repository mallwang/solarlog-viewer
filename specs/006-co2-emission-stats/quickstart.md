# Quickstart: Validating CO2 Emission Avoidance Statistics

## Prerequisites

- `npm install` already run.
- Local dev server running: `npm start` (browser-sync serves `web/`, hot-reloads on JS/HTML/CSS
  changes). Copy the printed URL into a browser (WSL2 cannot auto-open one).

## Unit-level validation

```bash
node --test web/js/data/co2-factors.test.js
node --test web/js/data/aggregates.test.js
node --test web/js/format.test.js
```

Expect: all pass, including a case asserting `deriveLifetimeSummary`'s `co2SavedKg` equals the
sum of each year's `yieldKwh * co2FactorForYear(year)` (SC-005) rather than
`totalYieldKwh * flatFactor`, and a `formatCo2` case each side of the 10,000 kg / tonne boundary
(FR-007).

```bash
npx eslint web/js/data/co2-factors.js web/js/data/co2-factors.test.js web/js/data/aggregates.js web/js/format.js
```

Expect: zero errors (Linting standard).

## End-to-end validation (Playwright)

```bash
npx playwright test --reporter=line
```

Run after adding/updating the relevant spec(s) under `tests/e2e/` (constitution Testing
standard: a failing Playwright test MUST exist before implementation, then pass after).

Manual scenarios to cover per view (mirrors User Story 1 & 2 acceptance scenarios):

1. **Total/lifetime view** (`#/total` or equivalent route): stats panel shows a CO2 avoidance
   row. Confirm SC-005 by hand: sum `yearKwh * co2FactorForYear(year)` across all years shown in
   the year-bar chart and compare to the displayed figure (allow for kg/tonne rounding).
2. **Year view** for a historical year (e.g. 2020): CO2 figure uses that year's specific factor
   (`0.365` kg/kWh for 2020 per research.md R1), not the fallback constant.
3. **Month view** and **day view** within that same historical year: CO2 figure uses the same
   year's factor as the year view (consistency check, Acceptance Scenario 2 of User Story 2).
4. **Current year** (2026) year/month/day views: CO2 figure uses the fallback constant
   (`0.363` kg/kWh), since 2026 has no UBA-published factor yet (Acceptance Scenario 3).
5. **Network check**: open browser DevTools → Network tab, reload any statistics view, confirm
   no request is made for any CO2/emission-factor resource (FR-004, SC-003) — the reference table
   ships as part of the existing JS bundle, not fetched separately.
6. **Maintenance workflow** (User Story 3): add a placeholder entry for a not-yet-real year to
   `CO2_FACTOR_KG_PER_KWH_BY_YEAR` in `web/js/data/co2-factors.js`, reload the corresponding
   year/month/day views, confirm the new factor takes effect immediately with no other code
   touched; then revert the placeholder.

## Expected outcome

All four statistics views (day, month, year, total) display a CO2 avoidance figure consistent
with SC-001–SC-005; no network requests are attributable to emission-factor lookup.
