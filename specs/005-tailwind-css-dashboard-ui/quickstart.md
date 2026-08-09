# Quickstart: Validating the Tailwind CSS Dashboard Redesign

**Feature**: 005-tailwind-css-dashboard-ui | **Date**: 2026-08-06

## Prerequisites

- Node.js + npm installed; run `npm install` at the repo root (adds `tailwindcss` CLI and
  `apexcharts` vendored build tooling — see `research.md` §1, §4).
- Repo checked out on branch `005-tailwind-css-dashboard-ui`.

## Setup

```bash
npm install
npm run build:css        # compiles web/css/tailwind.css -> web/css/tailwind.generated.css
npm start                 # browser-sync + Tailwind CLI in --watch mode; copy the printed URL into a browser
```

WSL2 cannot auto-open a browser — copy the `npm start` URL manually. Do not use the VS Code
built-in preview (see project `CLAUDE.md`).

## Validation scenarios

Each scenario below maps to an acceptance scenario / success criterion in `spec.md`.

### 1. Consistent visual design across all views (User Story 1, SC-003)

1. Open the site; navigate to each of the six views (dashboard/current, day, month, year, total,
   compare) via the nav.
2. Confirm headings, body text, numeric values, and chart containers share one visual style
   (colors, spacing, typography) — no view looks visibly "unstyled" relative to the others.
3. Toggle OS dark mode; reload each view and confirm the redesigned presentation adapts with
   sufficient contrast (FR-006).

**Expected outcome**: no view stands out as inconsistent; dark mode renders legibly on all six.

### 2. Navigation lists all views and marks the active one (User Story 2, SC-001, SC-004)

1. From any view, open the nav (persistent on desktop, hamburger on narrow viewports).
2. Confirm all six views are listed with human-readable labels and reachable in one click/tap.
3. Click through views; confirm the nav highlights the current view (`aria-current="page"`) within
   2 seconds of navigating, without a full page reload.

**Expected outcome**: `tests/e2e/` navigation spec asserts `aria-current` follows the active route
and no `load` event fires on in-app navigation.

### 3. Responsive layout, 320px–2560px (User Story 3, SC-002)

1. Resize the browser (or use Playwright's `page.setViewportSize`) from 320px to 2560px wide.
2. At each width, confirm: no horizontal scrollbar, nav is reachable (collapsible below ~768px,
   persistent above), and the yearly comparison chart (heaviest content) reflows without overlap
   or clipping.

**Expected outcome**: `document.documentElement.scrollWidth` never exceeds the viewport width at
any tested breakpoint (e.g. 320, 375, 768, 1024, 1440, 2560).

### 4. Empty/placeholder states (FR-009, Edge Cases)

1. Navigate to a `day`/`month`/`year` route for a period with no data (e.g. a future date, or a
   year outside 2006–present).
2. Confirm a styled empty/placeholder state renders — not a blank page or console error.

### 5. Non-color status communication (FR-010, Edge Cases)

1. View the current-production summary stat at night / when output is 0 W.
2. Confirm the "not producing" state is conveyed via icon or text label, not color alone (verify
   with a grayscale/colorblind simulation or by checking the DOM for a text/icon node alongside
   any color class).

### 6. ApexCharts renders all five modes (FR-013)

1. Open day, month, year, total, and compare views.
2. Confirm each renders an ApexCharts SVG chart (inspect for `.apexcharts-svg` or equivalent —
   not a `<canvas>` element) with working tooltips on hover and correct units (W for day, kWh for
   month/year/total/compare).

### 7. Regression: prior modernization behavior preserved (SC-005)

```bash
npm test                  # full Playwright suite, including pre-existing specs from 001-website-modernization
npm run test:scripts      # node:test unit suites (aggregates, parsing, router, etc.)
npm run lint
npm run format:check
```

**Expected outcome**: all pre-existing specs pass unchanged (data, interactions, and view content
are untouched — only presentation, navigation chrome, and the charting engine changed), and the
new specs added for this feature (per `research.md` §5) pass.

## Rollback

Since this feature is presentation/build-tooling only (no data format or file-location changes per
FR-008), reverting is `git revert`-safe: no data migration or backfill is required to return to the
pre-redesign UI.
