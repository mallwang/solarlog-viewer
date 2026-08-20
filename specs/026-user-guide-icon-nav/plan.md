# Implementation Plan: User Guide Icon Next to Transparency Toggle

**Branch**: `026-user-guide-icon-nav` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-user-guide-icon-nav/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Move the "Benutzerhandbuch" (user guide) link out of the collapsible main nav list and into
`.app-header__actions` as a standalone, icon-only header button, placed immediately to the left
of the existing `.transparency-toggle` button, matching its size/border/background/radius. The
link target logic (language-specific GitHub URL, new tab, `noopener noreferrer`) is unchanged —
only where and how it's rendered changes. `NAV_ITEMS` in `main.js` loses its `userGuide` entry so
there is exactly one way to reach the guide, per design.md.

## Technical Context

<!--
  These fields are fixed for this repository (solarlog-viewer) — a single static web app with no
  backend, per .specify/memory/constitution.md. Only override a field below if this feature
  genuinely changes it (e.g. adds a real dependency, needs a constitution amendment for a new
  storage mechanism) — note the override and why. Performance Goals/Constraints/Scale still vary
  per feature and MUST be filled in for real, not left as the example text.
-->

**Language/Version**: Vanilla JavaScript (ES2022+), native ES modules (`type="module"`) — no
bundler, no JS framework (constitution Technical Standards → Frontend).

**Primary Dependencies**: ApexCharts (vendored at `web/vendor/apexcharts/`, via
`web/js/charts/chart-factory.js`); Tailwind CSS (approved exception — compiled offline via
`npm run build:css` into `web/css/tailwind.generated.css`, never loaded from a CDN at runtime).
No feature-specific addition — this feature only rearranges existing markup/JS/CSS/i18n keys.

**Storage**: Browser `localStorage` for user preferences (see `web/js/settings.js` for the
existing key pattern); the SolarLog device's static `.js` data files under `web/data/` /
`web/hist/` are the source of truth for plant data and MUST NOT be modified (constitution
Principle I). Not touched by this feature — no new storage keys.

**Testing**: `node --test` (via `npm run test:scripts`) for pure logic in `scripts/*.js` and
`web/js/**/*.test.js`; Playwright (`npx playwright test --reporter=line`) as the primary quality
gate for visible UI changes — every feature with a UI-visible effect MUST get at least one
Playwright test (constitution Testing standard). This feature adds/extends a Playwright spec
covering: icon visibility at desktop and mobile widths, click opens the correct language's guide
URL in a new tab, nav list no longer contains a "userGuide" entry, accessible name present
(axe or explicit `aria-label` assertion), language switch updates the `href`/`aria-label` without
reload.

**Target Platform**: Static site, deployable to any plain web host (Apache, nginx, GitHub Pages,
S3) with no runtime dependencies; must render correctly 320px–2560px without horizontal scrolling
(constitution Principle IV).

**Project Type**: Single static web app (`web/`) — no frontend/backend split, no server component
(constitution Principle III).

**Performance Goals**: No measurable perf target — this is a markup/CSS/small-JS reshuffle with
no new network requests, data parsing, or render loop; existing chrome-height/ResizeObserver sync
(see `main.js`'s `updateChromeHeight`) must keep working since the header's child count/layout
changes slightly.

**Constraints**: The user guide icon MUST NOT collapse into the burger menu at any viewport width
(FR-007) — it lives in `.app-header__actions`, which (unlike `.app-nav__list` and
`.info-panel--desktop`) is already visible at every width, so no new breakpoint CSS is needed.
Icon ordering MUST be guide-then-Transparency, left to right (FR-009).

**Scale/Scope**: One new button element in `index.html`, its wiring in `main.js` (new
`initUserGuideLink()`-style function analogous to `initTransparencyToggle`/
`renderTransparencyToggle`), removal of one entry from `NAV_ITEMS`, a few lines of CSS reusing
`.transparency-toggle`'s existing rules (shared class or new sibling selector), and updated
Playwright coverage. No new i18n keys — `nav.userGuideView` and `nav.opensNewTab` already exist
and are reused for the `aria-label`/`title`.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Static-File Data Model is Sacred)**: N/A — feature touches only header
  chrome/nav, no `.js` data files read or written. ✅ Pass.
- **Principle II (Zero Historical Data Loss)**: N/A — no historical data rendering touched. ✅
  Pass.
- **Principle III (No Backend Introduction)**: No server component added; the guide link still
  points to a static GitHub URL, resolved client-side exactly as today. ✅ Pass.
- **Principle IV (Responsive-First Layout)**: Directly relevant — FR-007 requires the icon stay
  visible/operable 320px–2560px. Satisfied by placing it in `.app-header__actions`, which already
  has no breakpoint-driven `hidden`/collapse behavior (unlike `.info-panel--desktop` and
  `.app-nav__list`). Playwright coverage MUST assert this at both a desktop and a mobile viewport
  (see design.md's Responsive behavior section). ✅ Pass, verified in Phase 1.
- **Principle V / VI (Charting, five visualization modes)**: N/A — no chart/visualization code
  touched. ✅ Pass.
- **Frontend Technical Standards**: No framework added, native ES modules only, existing CSS
  custom properties reused (`--color-border`, `--color-bg`, `--radius-md`, `--space-xs`,
  `--space-sm` already used by `.transparency-toggle`, reused/shared rather than duplicated). ✅
  Pass.
- **Testing standard**: A Playwright test is required for this UI-visible change (icon presence,
  click behavior, a11y name, nav-list removal) — planned under `tests/e2e/`. ✅ Pass, planned in
  Phase 1 quickstart.
- **Documentation Standards (README, user guides, JSDoc, file-level description)**: `README.md` /
  `README.de.md` MUST be updated if they describe the nav-based path to the user guide (verify
  during implementation). `docs/user-guide.md` / `docs/user-guide.de.md` MUST be updated to
  describe the new icon location. New/modified functions in `main.js` MUST carry JSDoc per the
  constitution's JSDoc standard. ⚠️ Action item carried into tasks, not a plan-time violation.

No violations requiring justification — Complexity Tracking table is not needed for this feature.

## Project Structure

### Documentation (this feature)

```text
specs/026-user-guide-icon-nav/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command) — skipped, see below
├── design.md             # Already exists — approved mockup/layout (input to this plan)
├── mockup.html           # Already exists — reviewed static mockup
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
web/
├── index.html            # CHANGED: new <button class="user-guide-link" id="user-guide-link">
│                            (or equivalent) added to .app-header__actions, immediately before
│                            #transparency-toggle
├── css/
│   └── app.css            # CHANGED: new rule(s) for the user guide icon button, sharing/
│                             extending .transparency-toggle's existing chrome (border,
│                             background, radius, padding) minus the aria-pressed state rule
├── js/
│   ├── main.js             # CHANGED: NAV_ITEMS loses the `userGuide` entry; new
│   │                          renderUserGuideLink()/initUserGuideLink() pair (mirrors
│   │                          renderTransparencyToggle/initTransparencyToggle) sets href/
│   │                          aria-label/title and re-resolves them on language switch
│   │                          (called from renderLangSwitcher's setLanguage handler, same as
│   │                          renderNav already is)
│   ├── icons.js            # UNCHANGED — documentText icon already exists, reused as-is
│   └── i18n.js              # UNCHANGED — nav.userGuideView / nav.opensNewTab already exist
├── i18n/
│   ├── de.json              # UNCHANGED (existing keys reused) — verify wording still fits an
│   │                          aria-label-only context (no visible text) during implementation
│   └── en.json              # UNCHANGED, same verification
└── (no other files touched)

docs/
├── user-guide.md           # CHANGED: update description of where the user guide link lives
└── user-guide.de.md        # CHANGED: same update, German

README.md, README.de.md     # CHANGED if either currently documents nav-based access

tests/e2e/
├── dashboard-nav.spec.js   # Possibly CHANGED if it asserts nav-list contents including userGuide
└── (new or extended spec, e.g. header-actions.spec.js or extending transparency-mode.spec.js)
                              — CHANGED/NEW: covers icon visibility at desktop+mobile widths,
                              click-through URL, accessible name, language-switch re-resolution,
                              absence from nav list
```

**Structure Decision**: No new top-level directory or module. Changes are confined to the
existing `index.html` header markup, `app.css`'s existing toggle-button rule block, `main.js`'s
nav/header wiring section (alongside `renderTransparencyToggle`/`initTransparencyToggle`, which
this closely mirrors), and their existing Playwright coverage areas. Contracts/ is skipped — this
app has no external API surface; the "contract" here is purely the DOM/CSS/i18n shape already
documented in design.md.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations — table not applicable.
