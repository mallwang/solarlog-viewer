# Implementation Plan: Ereignisse (Events) Datatable

**Branch**: `016-events-datatable` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/016-events-datatable/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add a new "Ereignisse" page reachable from the main nav that reads `web/data/events.js` and
`web/data/events_day.js` (SolarLog's per-inverter status/fault event log, `start;end;WR;status;
error` per line — reverse-engineered from `legacy-site/events.html`'s parser), decodes each
event's status/error code into its per-inverter human-readable label using `StatusCodes[]`/
`FehlerCodes[]` from `base_vars.js`, and renders the combined, deduplicated list as a sortable
(start time / inverter / duration), filterable (inverter / day / status / error) table with an
"ongoing" indicator for events with no end time and safe fallbacks for unmatched codes. Approved
layout is documented in [design.md](design.md). Purely client-side, read-only, additive to the
existing static site — no new dependency, no data-file changes.

## Technical Context

<!--
  These fields are fixed for this repository (solarlog-viewer) — a single static web app with no
  backend, per .specify/memory/constitution.md. Only override a field below if this feature
  genuinely changes it (e.g. adds a real dependency, needs a constitution amendment for a new
  storage mechanism) — note the override and why. Performance Goals/Constraints/Scale still vary
  per feature and MUST be filled in for real, not left as the example text.
-->

**Language/Version**: Vanilla JavaScript (ES2022+), native ES modules (`type="module"`) — no
bundler, no JS framework (constitution Technical Standards → Frontend). No override for this
feature.

**Primary Dependencies**: None added. No charting is involved (this is a table, not a chart), so
ApexCharts is not pulled in by this feature. Tailwind utility classes are used inline for the
table/filter-bar markup, matching the existing `chart-data-table.js` / `stats-panel.js`
convention, with `app.css` carrying only what those utilities don't cover.

**Storage**: `web/data/events.js` (historical archive) and `web/data/events_day.js` (current
day, may include one still-open/"ongoing" event) are the source of truth, read client-side and
never modified (constitution Principle I, FR-011). `web/data/base_vars.js` supplies the
per-inverter `StatusCodes[]`/`FehlerCodes[]` label lists (already fetched once at bootstrap into
the shared `plant` object — see Project Structure below). No `localStorage` persistence is
required for this feature: filter/sort selections are session-only UI state, reset on navigating
away, matching how the legacy `events.html` page behaved (its filters lived in the URL query
string, not storage) — this feature keeps them as in-memory component state instead (simpler,
no new route-param surface needed per the spec's Assumptions).

**Testing**: `node --test` (`npm run test:scripts`) for the new pure parsing/merge/dedupe/label-
resolution/sort/filter functions (`web/js/data/events.js`, `web/js/views/events-view.js`'s
exported pure helpers); Playwright (`npx playwright test --reporter=line`) for the visible page —
new `tests/e2e/events-view.spec.js` covering: table renders with data, ongoing badge, filter
narrows rows, sort toggles order, empty state, mobile viewport scroll (constitution Testing
standard — every UI-visible change needs at least one Playwright test).

**Target Platform**: Static site, deployable to any plain web host, no runtime dependencies;
renders correctly 320px–2560px without horizontal _page_ scroll — the table itself scrolls
horizontally inside its own container on narrow viewports (constitution Principle IV; see
design.md's Responsive behavior section).

**Project Type**: Single static web app (`web/`) — no frontend/backend split, no server
component (constitution Principle III).

**Performance Goals**: Full combined event table (currently ~416 events, designed to scale into
the low thousands as history grows) renders within 3 seconds on a typical broadband connection
(spec SC-001); applying a filter or changing sort re-renders the visible rows in under 300ms
(no perceptible lag) since it's a pure in-memory array operation with no re-fetch.

**Constraints**: No new dependency. Must not modify `web/data/events.js` or
`web/data/events_day.js` on disk (Principle I, FR-011). Must reuse the existing
`fetchText`/`extractAssignedStrings` data-loading pattern rather than inventing a new one. Status/
error code resolution must be per-inverter (the same numeric code means different things on WR1
vs. WR2 — see `StatusCodes[0]` vs. `StatusCodes[1]` in `base_vars.js`).

**Scale/Scope**: `events.js` currently holds 401 lines, `events_day.js` 15 (two inverters,
~13 days of history retained by the device) — small enough that no pagination/virtualization is
needed for v1 (spec Assumptions defers that decision; this plan resolves it as "render the full
filtered/sorted set, no pagination," revisit only if a future plant's history grows enough to
make that a measured problem).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                   | Applies? | How satisfied                                                                                                                                                                                                             |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Static-File Data Model is Sacred         | Yes      | `events.js`/`events_day.js`/`base_vars.js` are read via `fetchText` and parsed client-side only; never written to, never preprocessed server-side (FR-011).                                                               |
| II. Zero Historical Data Loss               | Yes      | Every valid event line from both files is included in the merged list (FR-001); only genuinely malformed lines are skipped (FR-009), and deduplication removes exact repeats, never distinct events (FR-008).             |
| III. No Backend Introduction                | Yes      | All parsing, merging, deduplication, filtering, and sorting run in the browser; no new server/service.                                                                                                                    |
| IV. Responsive-First Layout                 | Yes      | Filter bar wraps, table scrolls horizontally inside its own container on narrow viewports — no fixed-pixel layout, no horizontal page scroll (design.md Responsive behavior).                                             |
| V. Modern Charting — No Custom Pixel Math   | N/A      | This feature adds a table, not a chart; no pixel-math positioning is introduced.                                                                                                                                          |
| VI. Preserve All Five Visualization Modes   | N/A      | Unrelated to the five chart modes; none are touched.                                                                                                                                                                      |
| Data Preservation Constraints               | Partial  | Doesn't touch minute/day/month/year multi-inverter encoding; does newly parse `StatusCodes[]`/`FehlerCodes[]` from `base_vars.js`, extending `parseBaseVars` rather than duplicating a second `base_vars.js` fetch/parse. |
| Testing (Playwright + node:test)            | Yes      | New `tests/e2e/events-view.spec.js` (Playwright) + `web/js/data/events.test.js` / `web/js/views/events-view.test.js` (node:test) — see Testing above.                                                                     |
| Documentation Standards (README/user-guide) | Yes      | `README.md`/`README.de.md` and `docs/user-guide.md`/`docs/user-guide.de.md` MUST be updated to document the new Ereignisse page — tracked as a task, not optional.                                                        |

No violations requiring justification — Complexity Tracking table is empty/not needed.

## Project Structure

### Documentation (this feature)

```text
specs/016-events-datatable/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── design.md             # Approved UX mockup + requirement traceability (/speckit-ux-review)
├── contracts/
│   └── events.md          # Phase 1 output (/speckit-plan command)
├── checklists/
│   └── requirements.md
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

<!--
  This repo has one fixed layout (below) — there is no frontend/backend or mobile/API split to
  choose between. ACTION REQUIRED: expand the tree with the actual new/changed files for this
  feature (mirroring how prior specs/*/plan.md did it), not just the unchanged skeleton.
-->

```text
web/
├── css/
│   └── app.css                     # CHANGED — .events-page/.filter-bar/.events-table styles
│                                      (only what Tailwind utilities don't cover, per existing
│                                      .summary-table/.chart-table convention)
├── js/
│   ├── data/
│   │   ├── plant.js                 # CHANGED — parseBaseVars() also returns statusCodes[]/
│   │   │                              errorCodes[] (per-inverter label lists), reusing the
│   │   │                              already-fetched base_vars.js instead of a second fetch
│   │   ├── plant.test.js            # CHANGED — cases for the new statusCodes/errorCodes fields
│   │   ├── events.js                # NEW — parseEventLines, mergeAndDedupeEvents, enrichEvent
│   │   │                              (Date parsing, ongoing flag, duration, label resolution)
│   │   ├── events.test.js           # NEW
│   │   └── parse-lines.js           # UNCHANGED — its existing `arr[idx++]="..."` extractor
│   │                                  already matches events.js/events_day.js's `e[ev++]=...`
│   │                                  lines; reused as-is
│   ├── views/
│   │   ├── events-view.js           # NEW — render(container, {plant, route}); exports
│   │   │                              sortEvents/filterEvents/buildFilterOptions for testing
│   │   ├── events-view.test.js      # NEW
│   │   └── empty-state.js           # UNCHANGED — reused for the "no events at all" case
│   ├── router.js                    # CHANGED — new `events` route (`#/events`)
│   └── main.js                      # CHANGED — NAV_ITEMS entry + viewModules['events']
├── i18n/
│   ├── de.json                      # CHANGED — new `events.*` namespace + `nav.eventsView`
│   └── en.json                      # CHANGED — same keys, English copy
└── data/, hist/                     # UNCHANGED — read-only source files (Principle I)

tests/e2e/
└── events-view.spec.js              # NEW — Playwright coverage (constitution Testing standard)

README.md, README.de.md              # CHANGED — document the new page (Documentation Standards)
docs/user-guide.md, docs/user-guide.de.md   # CHANGED — same
```

**Structure Decision**: Follows the existing `web/js/views/` + `web/js/data/` split exactly —
`events.js` (data layer: parse/merge/dedupe/enrich, no DOM) lives beside the other pure parsers
in `web/js/data/`; `events-view.js` (rendering, DOM, event wiring) lives beside the other route
views in `web/js/views/`. No new top-level directory. `parseBaseVars` in the existing
`web/js/data/plant.js` is extended rather than adding a second `base_vars.js` fetch, since
`main.js` already fetches and parses that file once at bootstrap and passes the result as `plant`
to every view (see `main.js`'s `dispatch()`).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No entries — no violations.
