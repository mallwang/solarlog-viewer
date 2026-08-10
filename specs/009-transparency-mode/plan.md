# Implementation Plan: Transparency Mode

**Branch**: `009-transparency-mode` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-transparency-mode/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a single global, persisted toggle ("transparency mode") that a user can switch on to make the header/nav bars fully transparent and all diagrams/statistics panels render at 40% opacity, so the existing animated sky background (clouds, flying objects, blue sky) shows through. Off is today's fully opaque default. The toggle is a small vanilla-JS module (mirroring the existing `i18n.js` localStorage-preference pattern) that persists the choice under a dedicated `localStorage` key and flips a single attribute/class on `<html>` or `<body>`; all opacity/transparency rules live in CSS (custom properties in `tokens.css` + rules in `app.css`/Tailwind `@layer components`) keyed off that attribute, so no chart, view, or panel component needs per-component code changes.

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2022+, native ES modules), HTML5, CSS3 — per constitution Technical Standards → Frontend.

**Primary Dependencies**: None new. Reuses existing stack: Tailwind CSS (compiled, `web/css/tailwind.generated.css`), CSS custom properties (`web/css/tokens.css`), ApexCharts (`web/vendor/apexcharts`), existing `web/js/i18n.js`-style localStorage preference pattern.

**Storage**: Browser `localStorage` only (a single boolean preference key, e.g. `solarlog-transparency`), following the precedent of `solarlog-lang` in `web/js/i18n.js` and the geocode cache in `web/js/sky/geocode.js`. No server-side storage — consistent with Constitution Principle III (No Backend Introduction).

**Testing**: Playwright end-to-end tests (`tests/e2e/`), per constitution Technical Standards → Testing — verifying the toggle flips nav-bar and panel opacity, persists across reload, and applies consistently across day/month/year/dashboard views. Unit tests (`node:test`) for the new preference module if it contains non-trivial logic (mirroring `web/js/i18n.js`/`web/js/sky/location.test.js` conventions).

**Target Platform**: Static, client-side-only web app served to any modern desktop/mobile browser (existing deployment model — plain static file host).

**Project Type**: Web — single static frontend (`web/`), no backend. Existing single-project layout, no new top-level project.

**Performance Goals**: Toggling must be visually instantaneous (no perceptible delay, single CSS repaint) — a CSS-variable/attribute flip, not a re-render of charts or data.

**Constraints**: Must not alter or reprocess any SolarLog data (display-only preference, per Constitution Principle I/II). Must preserve readability of nav labels and chart/stat values while transparent, per FR-008. Must not require a page reload to take effect (FR-007). Must not introduce a JS framework, bundler, or backend (Constitution Principles III, Technical Standards → Frontend).

**Scale/Scope**: One global boolean setting; touches shared layout chrome (header/nav, period-nav) and the shared chart-container/stats-panel styling used by all four view modules (`dashboard.js`, `day-view.js`, `month-view.js`, `year-view.js`, `total-view.js`) — a CSS-and-one-small-module change, not a per-view feature.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Static-File Data Model is Sacred** — PASS. Feature touches only presentation (CSS/JS UI toggle); no `.js` SolarLog data file is read differently or altered.
- **II. Zero Historical Data Loss** — PASS. Purely visual; no data is dropped, filtered, or misrendered — content is still fully present, just rendered at reduced opacity.
- **III. No Backend Introduction** — PASS. Preference lives in browser `localStorage`; no server, no new runtime dependency. Site remains static-host-deployable.
- **IV. Responsive-First Layout** — PASS. No fixed-pixel layout introduced; feature is an opacity/transparency treatment layered onto the existing responsive nav/panel components.
- **V. Modern Charting — No Custom Pixel Math** — PASS. No chart engine changes; ApexCharts continues to render as-is, only wrapped in a container whose CSS opacity changes.
- **VI. Preserve All Five Visualization Modes** — PASS. All five modes remain implemented as-is; the toggle applies uniformly to their shared containers, not to any one mode.
- **Technical Standards → Frontend** — PASS. No framework/bundler introduced; CSS custom properties remain the theme source of truth (new transparency-related tokens added there); Tailwind usage stays within its approved compiled-build-step exception.
- **Technical Standards → Testing** — Will be satisfied by adding a Playwright test per Phase 2 tasks (required, not yet written — tracked as a task, not a gate violation).

No violations requiring justification. Complexity Tracking table is not needed.

## Project Structure

### Documentation (this feature)

```text
specs/009-transparency-mode/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Existing single static-frontend project (web/) — no new top-level directory needed.

web/
├── index.html                    # Header/nav markup; add transparency-mode toggle control here
├── css/
│   ├── tokens.css                # Add transparency-mode CSS custom properties (opacity levels)
│   ├── app.css                   # Add attribute-scoped opacity rules for nav/panels/charts
│   └── tailwind.css / tailwind.generated.css  # Toggle control styling, if expressed via Tailwind utilities
├── js/
│   ├── settings.js                # NEW — transparency-mode preference module (mirrors i18n.js pattern)
│   ├── settings.test.js           # NEW — unit tests for the preference module
│   ├── main.js                    # Wire up: read persisted preference on boot, bind toggle control
│   ├── i18n.js                    # Existing localStorage-preference precedent (pattern reference only)
│   └── views/
│       ├── dashboard.js           # Shared chart-container/stats-panel markup consuming the CSS rules
│       ├── day-view.js
│       ├── month-view.js
│       ├── year-view.js
│       ├── total-view.js
│       ├── period-nav.js          # Secondary nav bar affected by "fully transparent" rule
│       └── stats-panel.js         # Statistics panel affected by "40% opacity" rule

tests/
└── e2e/
    └── transparency-mode.spec.js  # NEW — Playwright coverage for toggle on/off, persistence, cross-view
```

**Structure Decision**: Single existing static-frontend project (`web/`) — no backend, no new top-level project. The feature is delivered as (a) one new small preference module (`web/js/settings.js`, following the `web/js/i18n.js` localStorage-preference pattern) wired into `web/js/main.js` at boot and into a new toggle control in `web/index.html`'s header, and (b) CSS-only changes in `web/css/tokens.css` + `web/css/app.css` that key nav/panel/chart opacity off a single attribute (e.g. `[data-transparency="on"]` on `<html>`), so every existing view module (`dashboard.js`, `day-view.js`, `month-view.js`, `year-view.js`, `total-view.js`, `period-nav.js`, `stats-panel.js`) picks up the effect automatically through its existing shared container classes, with no per-view code changes required.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
