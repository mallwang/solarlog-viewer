# Quickstart: Explanatory Tooltips

Validates the feature end-to-end once implemented. See `data-model.md` for the explanation-entry
shape and `contracts/info-tooltip.md` for the exact function/CSS contracts these steps exercise.

## Prerequisites

```bash
npm install
npm start   # browser-sync dev server — copy the printed URL into your browser (WSL2 can't
            # auto-open one); proxies /data/* and /hist/* to the live device per README.md
```

## Scenario 1 — Desktop hover reveals a stat-specific explanation (User Story 1 / SC-001)

1. Open the app in a desktop-sized browser window (real mouse/trackpad, not a touch emulation).
2. Navigate to any month with data, e.g. `#/month/2026/06`.
3. In the stats panel, hover the "i" icon next to "Monatsertrag in €".
4. **Expect**: a tooltip appears describing that this figure is the month's yield (kWh)
   multiplied by the feed-in tariff rate — not a generic or Soll/Ist/CO2-flavored message.
5. Move the mouse off the icon. **Expect**: the tooltip disappears.
6. Repeat for "Soll (auflaufend)", "Ist", and "Vermiedenes CO2" on the same panel, and for
   "Tagesertrag in €" on a day view (`#/day/2026/06/15`) — each must show wording specific to
   that stat's own calculation.

## Scenario 2 — Keyboard focus reveals the tooltip too (FR-008, SC-005)

1. On the same month view, click into the page then press Tab repeatedly until an "i" icon
   receives visible focus (a focus ring).
2. **Expect**: the same tooltip appears as in Scenario 1, without moving the mouse.
3. Tab away. **Expect**: the tooltip disappears.

## Scenario 3 — Touch-only viewport renders no icon at all (User Story 2 / SC-002)

1. Open Chrome DevTools → toggle device emulation for a phone (e.g. "iPhone 14"), which reports
   `(hover: none)`.
2. Reload the same month view.
3. **Expect**: no "i" icon appears anywhere in the stats panel, and the label/value rows look
   pixel-identical to a stat with no explanation registered — confirm via DevTools that no
   `.info-trigger` element is visibly rendered (CSS `display: none` under this media query) and
   that the row's height/width is unchanged from the non-emulated view.
4. Confirm normal tapping/scrolling of the page is unaffected (nothing intercepts touch events).

## Scenario 4 — Tooltip flips near the viewport edge (FR-007, SC-004)

1. On desktop, narrow the browser window so the stats panel sits close to the right edge (or view
   a panel column whose icon is near the right boundary, e.g. "Ist"/"Vermiedenes CO2" in a
   narrow layout).
2. Hover that icon.
3. **Expect**: the tooltip remains fully visible on-screen — it anchors from the icon's right
   edge instead of centering, rather than being clipped by the viewport or panel boundary.

## Scenario 5 — Adding a new explained stat requires no rendering-code change (User Story 3 / SC-003)

1. Pick any stats row currently rendered as a 2-element tuple (no explanation), e.g. the
   "Maximalwert" row in `month-view.js`'s `monthStatsRows()`.
2. Add an `explanations.maxDaily` entry to both `web/i18n/de.json` and `web/i18n/en.json`.
3. Change that row's tuple in `monthStatsRows()` to
   `['month.stats.maxDaily', value, 'explanations.maxDaily']`.
4. Reload the month view. **Expect**: the new icon appears with a working hover/focus tooltip,
   same visual style as the other five, with zero changes to `stats-panel.js`.
5. Revert the change (this step is a validation drill, not a real feature addition, unless the
   user actually wants "Maximalwert" explained too).

## Automated checks

```bash
node --test web/js/views/stats-panel.test.js   # markup shape: explanation-present vs absent
npx playwright test tests/e2e/explanatory-tooltips.spec.js --reporter=line
npm run lint
npm run format:check
```

All of the above MUST pass before the feature is considered done (constitution Development
Workflow §3/§5).
