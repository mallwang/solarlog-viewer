# Implementation Plan: Navigate to Parent Period

**Branch**: `008-navigate-parent-level` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-navigate-parent-level/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a "zoom out to parent period" link to the day, month, and year views (day→month, month→year, year→total), rendered inline in the existing prev/next/"jump to current" navigation row via `periodNavMarkup` in [period-nav.js](../../web/js/views/period-nav.js). The total view gets no parent link since it is the top of the hierarchy. Each link is always enabled (a parent period always exists) and derives its target purely from the currently routed period's params — no dependency on browser history.

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2022+), native ES modules, no bundler

**Primary Dependencies**: None new. Reuses existing `formatRoute`/`parseRoute` ([router.js](../../web/js/router.js)), `t()` i18n lookup ([i18n.js](../../web/js/i18n.js)), and `periodNavMarkup` ([period-nav.js](../../web/js/views/period-nav.js))

**Storage**: N/A — no data storage involved, purely client-side navigation/routing

**Testing**: `node --test` for unit tests (period-nav.js already has `period-nav.test.js`); Playwright e2e (new `tests/e2e/parent-nav.spec.js`, alongside existing `tests/e2e/detail-views.spec.js`/`dashboard-nav.spec.js`) for behavior + visual verification per constitution — note `tests/e2e/navigation.spec.js` covers only the legacy frameset site and is not the right place for this feature

**Target Platform**: Browser (static site), same as rest of project

**Project Type**: Single static web app ([web/](../../web/))

**Performance Goals**: N/A — purely a UI link addition, no perceptible performance impact

**Constraints**: Must preserve existing prev/next/"jump to current" behavior unchanged; must not introduce a framework, bundler, or backend (constitution Principles III, Technical Standards/Frontend)

**Scale/Scope**: Touches 4 files (`period-nav.js`, `day-view.js`, `month-view.js`, `year-view.js`) plus 2 i18n JSON files (`de.json`, `en.json`); `total-view.js` is unaffected (no parent link there)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle III (No Backend)**: Pass — purely client-side link/routing addition, no new data fetch or server dependency.
- **Principle IV (Responsive-First Layout)**: Pass — new control reuses the existing `.period-nav` flex row and its responsive CSS; no fixed-pixel layout introduced.
- **Technical Standards/Frontend (vanilla JS, ES modules, no framework/bundler)**: Pass — extends existing vanilla JS modules only.
- **Testing standard (Playwright e2e required for UI changes)**: Will extend `tests/e2e/navigation.spec.js` with new assertions per Phase 1/2.

No violations. Complexity Tracking section not needed.

## Project Structure

### Documentation (this feature)

```text
specs/008-navigate-parent-level/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
web/
├── js/
│   ├── router.js                     # formatRoute()/parseRoute() — reused unchanged
│   ├── i18n.js                       # t() lookup — reused unchanged
│   └── views/
│       ├── period-nav.js             # extend periodNavMarkup() with an optional parent link
│       ├── period-nav.test.js        # unit tests for the new parent-link markup/logic
│       ├── day-view.js                # wire parentHref -> month route + label
│       ├── month-view.js              # wire parentHref -> year route + label
│       ├── year-view.js               # wire parentHref -> total route + label
│       └── total-view.js              # unchanged (no parent link, top of hierarchy)
├── i18n/
│   ├── de.json                       # add parent-link labels (day/month/year sections)
│   └── en.json                       # add parent-link labels (day/month/year sections)

tests/
└── e2e/
    └── parent-nav.spec.js             # new: parent-link presence/absence + click-through per view

```

**Structure Decision**: Single existing static web app under [web/](../../web/); this feature is additive within the existing `views/` navigation module — no new directories or projects.

## Complexity Tracking

_No violations — section not applicable._
