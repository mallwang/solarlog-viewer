# Quickstart: Validate Parent Navigation

## Prerequisites

- `npm install` (once, if not already done)
- `npm start` — serves the site via browser-sync with hot reload; copy the printed URL into your browser (WSL2 cannot auto-open one)

## Manual validation

1. Navigate to a day view, e.g. `#/day/2026/3/15`.
   - **Expect**: a new "go to month" link/control next to the existing prev/next/"Heute" row.
   - Click it → URL becomes `#/month/2026/3` and the March 2026 month view renders.
2. Navigate to a month view, e.g. `#/month/2026/3`.
   - **Expect**: a "go to year" link next to prev/next/"Dieser Monat".
   - Click it → URL becomes `#/year/2026` and the 2026 year view renders.
3. Navigate to a year view, e.g. `#/year/2026`.
   - **Expect**: a "go to total" link next to prev/next/"Dieses Jahr".
   - Click it → URL becomes `#/total` and the overview/total view renders.
4. Navigate to the total view (`#/total`).
   - **Expect**: no parent-navigation link is present (top of hierarchy).
5. Switch language (DE ⇄ EN, per existing language toggle) and repeat steps 1–3.
   - **Expect**: parent-link label text is translated, no raw i18n keys visible.
6. Deep-link directly to a day view with no prior in-app navigation (e.g. paste `#/day/2020/6/1` fresh into the address bar) and click the parent link.
   - **Expect**: still navigates correctly to `#/month/2020/6` — proves the link derives from routed params, not browser history.

## Automated validation

- Unit tests: `node --test web/js/views/period-nav.test.js` — covers the new parent-derivation helpers and `periodNavMarkup`'s parent-link rendering/omission logic.
- E2E: `npx playwright test --reporter=line` — extend `tests/e2e/navigation.spec.js` with assertions for each of the manual steps above (link presence/absence, correct href, correct destination view after click).

## Reference

- Contract: [contracts/period-nav-markup.md](./contracts/period-nav-markup.md)
- Data model: [data-model.md](./data-model.md)
