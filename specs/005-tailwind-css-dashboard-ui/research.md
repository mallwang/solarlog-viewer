# Research: Tailwind CSS Dashboard Redesign

**Feature**: 005-tailwind-css-dashboard-ui | **Date**: 2026-08-06

## 1. Tailwind CSS build integration (static site, no runtime bundler)

**Decision**: Use the standalone **Tailwind CSS CLI** (`tailwindcss` npm package, v4) invoked via
an `npm run build:css` script that compiles `web/css/tailwind.css` (an `@import "tailwindcss";`
entry file plus `@theme` token mapping) into a single static `web/css/tailwind.generated.css`,
committed to the repo like the existing `web/css/app.css`/`tokens.css`. `npm start` runs the
Tailwind CLI in `--watch` mode alongside `browser-sync` so hot-reload keeps working in dev.

**Rationale**:

- Satisfies the constitution's amended Frontend exception: a compiled, offline build step
  producing a static CSS file, not a CDN/runtime script (FR-012).
- Tailwind v4's CLI needs no PostCSS config file or bundler for JS — it only touches CSS, so the
  existing native-ES-module JavaScript loading (Principle III / Technical Standards) is untouched.
- Keeps the project's "single project" structure (Option 1) and npm-only tooling intact — no new
  package manager, no webpack/vite pulled in for what is a CSS-only concern.

**Alternatives considered**:

- _Tailwind Play CDN script_: rejected outright — explicitly a runtime script, violates FR-012 and
  the constitution amendment's "never at page-view time" clause.
- _Full bundler (Vite) for the whole frontend_: rejected as disproportionate — the codebase has no
  bundler today and Chart.js is loaded via a vendored ESM file specifically to avoid one; pulling
  in Vite for CSS alone would be a much larger, unrequested change to the JS module system.
- _PostCSS with a custom config + `postcss-cli`_: viable but more moving parts than the Tailwind
  CLI, which wraps PostCSS internally; CLI-only was chosen for minimal `devDependencies` surface.

## 2. Reconciling Tailwind with existing CSS custom-property tokens

**Decision**: Keep `web/css/tokens.css` (light/dark `--color-*`, `--space-*`, `--font-*`,
`--chart-color-*` variables) as the single source of design-token truth. Tailwind's `@theme`
block in `tailwind.css` maps Tailwind's generated utility classes (`bg-primary`, `text-muted`,
etc.) to `var(--color-primary)`, `var(--color-text-muted)`, etc., rather than redefining raw hex
values. `app.css`'s existing component rules (`.app-header`, `.app-nav`, view-specific classes)
are progressively replaced by Tailwind utility classes in the HTML/JS template strings, but the
CSS variables underneath do not change.

**Rationale**: Directly satisfies the constitution amendment's requirement that "Tailwind's
configuration MUST read from (or be kept in sync with) those tokens rather than duplicating them."
Also means dark mode (`@media (prefers-color-scheme: dark)` already in `tokens.css`) keeps working
without Tailwind's separate `dark:` variant system — one source of truth for theme switching, no
duplicated dark-mode logic.

**Alternatives considered**:

- _Let Tailwind own all theme values via `tailwind.config` colors, drop `tokens.css`_: rejected —
  would duplicate/replace the token system the constitution explicitly protects ("CSS custom
  properties MUST be used for all theme values... so the design can be reskinned in one place");
  also loses the existing dark-mode CSS with no equivalent gain.
- _Use Tailwind's built-in `dark:` class/media variant instead of existing `prefers-color-scheme`
  block_: rejected for this feature — existing dark mode already satisfies FR-006 automatically;
  reimplementing it via Tailwind variants adds risk without benefit under a "presentation only, no
  behavior change" mandate (FR-007).

## 3. Navigation pattern: responsive persistent nav vs. collapsible menu

**Decision**: A single `<nav>` component, styled with Tailwind responsive utilities: rendered as a
persistent sidebar/top bar at `md:` (768px) and above, and as a collapsible (hamburger-triggered)
menu below that breakpoint. Implemented as plain markup/CSS classes toggled via a small amount of
vanilla JS (an `aria-expanded` boolean on a `<button>`), not a new router or framework component
system — the existing `router.js`/`main.js` hash-based routing and `renderNav()` in `main.js`
are extended, not replaced.

**Rationale**: Satisfies FR-004 (usable 320px–2560px) and User Story 3's acceptance scenarios
(collapses on narrow screens, persistent on desktop) using Tailwind's existing `sm:`/`md:`/`lg:`
breakpoint utilities — no extra JS library needed for responsive behavior. Keeps navigation
state changes client-side without a full page reload (FR-011), consistent with the current
`onRouteChange`/`dispatch()` flow in `main.js`.

**Alternatives considered**:

- _Two separate DOM trees (mobile nav + desktop nav) toggled via `display`_: rejected — doubles
  markup and active-state bookkeeping for no behavioral benefit over a single responsive component.
- _Third-party nav/drawer component library_: rejected — adds a dependency for something Tailwind's
  utility classes and ~20 lines of vanilla JS already cover; conflicts with "no framework unless
  approved" for anything beyond the CSS exception already granted.

## 4. ApexCharts integration replacing Chart.js

**Decision**: Vendor ApexCharts the same way Chart.js is vendored today — download the ESM/UMD
distributable into `web/vendor/apexcharts/` (replacing `web/vendor/chart.js/`), imported for its
`window.ApexCharts` side effect exactly like `chart-factory.js` does for `window.Chart` today.
`web/js/charts/chart-factory.js` is rewritten (same exported function signatures consumed by the
five view modules) to build ApexCharts option objects instead of Chart.js configs; the module's
public API (`renderChart`/equivalent, called from `dashboard.js`, `day-view.js`, `month-view.js`,
`year-view.js`, `compare-view.js`, `total-view.js`) stays the same so view modules need minimal
changes.

**Rationale**: FR-013 requires ApexCharts as the sole rendering engine for all five modes.
Vendoring (vs. an npm-only devDependency pulled in by a bundler) matches the existing pattern for
Chart.js and requires no bundler for JavaScript, preserving Principle III / Technical Standards.
ApexCharts ships responsive/tooltip behavior out of the box, satisfying FR-013's "equivalent or
better... tooltip/hover behavior, and responsiveness" bar without custom pixel math (Principle V).

**Alternatives considered**:

- _`npm install apexcharts` and import from `node_modules` directly in the browser_: rejected —
  browsers can't resolve bare module specifiers without an import map or bundler; the existing
  vendoring pattern (copy a browser-ready build into `web/vendor/`) already solves this problem
  for Chart.js and is reused unchanged.
- _Keep Chart.js for some modes, ApexCharts for others_: rejected — FR-013 explicitly requires
  ApexCharts as "the single rendering engine for all five visualization modes"; mixing libraries
  would also reintroduce the "no view visibly unstyled/inconsistent" risk FR-001/SC-003 guard
  against.

## 5. Testing approach for the redesign

**Decision**: Extend the existing Playwright suite (`tests/e2e/`) with new specs covering: (a) all
six views render Tailwind-styled markup with no console/page errors, (b) nav active-state
highlighting per route, (c) viewport resize from 320px–2560px with zero horizontal scroll
(`document.documentElement.scrollWidth <= viewport width` assertion), (d) dark-mode rendering via
`page.emulateMedia({ colorScheme: 'dark' })`, (e) ApexCharts renders an `.apexcharts-svg` (or
equivalent) element for each of the five chart modes in place of the previous `<canvas>` Chart.js
element. Existing acceptance scenarios from 001-website-modernization must continue to pass
unchanged (SC-005) — re-run, not rewritten.

**Rationale**: Matches the constitution's Testing standard (Playwright as primary quality gate,
one test per visible UI change, behavior + visual/accessibility assertion) and directly encodes
this spec's Independent Test statements and Success Criteria (SC-001–SC-005) as executable checks.

**Alternatives considered**:

- _Visual regression screenshots (pixel-diffing) for every view_: considered for SC-003's "no view
  visibly inconsistent" claim, but deferred — Playwright's built-in `toHaveScreenshot()` is
  available if needed during `/speckit-tasks`/implementation but is not mandated by the
  constitution beyond "screenshot or accessibility assertion", so DOM/class-based assertions (e.g.
  shared Tailwind utility classes across views) are the primary mechanism, with screenshots as an
  optional supplement decided at task-authoring time.
