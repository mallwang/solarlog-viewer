# Implementation Plan: Website Modernization

**Branch**: `001-website-modernization` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-website-modernization/spec.md`

## Summary

Replace the archived frameset-based site (now preserved read-only under `legacy-site/`) with a
single fresh HTML5 page (`web/index.html`) that renders a dashboard of every summary value
(current production, Gesamt-/Jahres-/Monats-/Tageserträge) at once, and lets the user drill into a
detail chart for any year/month/day via client-side hash routing (`#/year/2019`,
`#/month/2019/07`, `#/day/2019/07/15`, `#/total`, `#/compare`). No SPA framework is used — vanilla
ES modules are sufficient for a read-only dashboard over static files, and a framework would add a
build step the constitution's static-host requirement rules out. One established charting library
(Chart.js, vendored as a static ESM file, no bundler) replaces the old custom pixel-math engine
for all five visualization modes. All data files (`base_vars.js`, `min*.js`, `days.js`,
`days_hist.js`, `months.js`, `years.js`, `min_cur.js`) are fetched client-side and parsed exactly
as produced by the SolarLog device — untouched, per Constitution Principle I.

**Post-launch restructuring (2026-08-04)**: everything the site needs at runtime — HTML, CSS, JS,
and the SolarLog data files — now lives under one `web/` directory, so deploying to the Synology
DiskStation is a single FTP folder copy with no `src`/`dist`/build step. Separately, a SolarLog
device replacement on 2026-07-29 cannot append to the old device's `days_hist.js`/`months.js`/
`years.js` — it only overwrites them with its own totals since installation — so historical data
through 2026-07-28 is frozen under `web/hist/` and the new device's live output lands in
`web/data/`; `web/js/data/data-source.js` and `web/js/data/aggregates.js`'s `merge*` functions
resolve and combine the two wherever a query spans that boundary (see data-model.md).

## Technical Context

**Language/Version**: JavaScript ES2022+ via native ES modules (`type="module"`), HTML5, CSS3. No
TypeScript, no transpilation, no bundler.

**Primary Dependencies**: Chart.js, vendored as a single static ESM build file (`web/vendor/chart.js/chart.esm.js`,
committed to the repo — see research.md §2) — the project's only new runtime dependency. Epoch
detection (`epochFromDate`, `epochFromFieldCounts`) is canonically defined in
`web/js/data/epoch.js` — since `web/` is the only directory shipped to the SolarLog device's
static host, this browser-facing logic cannot depend on repo-root `scripts/`; the Node-side
tooling in `scripts/utils.js` re-exports from `web/js/data/epoch.js` instead of duplicating it
(see research.md §5, updated 2026-08-04).

**Storage**: N/A for this feature — the browser reads `.js` data files directly over HTTP; no
database. (The local SQLite cache from feature 004 is a separate, optional CLI-tooling path per
Constitution Principle I/III exceptions and is not a dependency of this feature.)

**Testing**: Playwright e2e (`tests/e2e/*.spec.js`, run via `npm test`), per constitution's primary
quality gate. New spec file(s) cover the dashboard and each of the 5 detail views; the existing
`tests/e2e/navigation.spec.js` continues to exercise the archived `legacy-site/` pages unchanged.

**Target Platform**: Evergreen browsers (last 2 major versions of Chrome/Firefox/Safari/Edge),
viewport widths 320px–2560px. No IE11 support (per spec Assumptions).

**Project Type**: Single project (static frontend). All code and data live under `web/`
(`web/js`, `web/css`, `web/i18n`, `web/vendor`, `web/index.html`, `web/data/`, `web/hist/`), the
sole directory FTP'd to the Synology DiskStation's `/web` folder — no `src`/`dist`/build step
(updated 2026-08-04; `package.json`'s `lint`/`format`/`test:scripts` globs and `bs-config.cjs`
match this layout).

**Performance Goals**: Charts render within 3s on standard broadband for any selected date,
including a full 288-point daily trace (SC-004). Dashboard-to-any-chart navigation completes in ≤2
interactions (SC-003).

**Constraints**: Zero build pipeline — deployable to any plain static file host (FR-004). Deep
links MUST work without server-side rewrite rules, ruling out History-API `pushState` routing in
favor of hash-based routing (see research.md §3). MUST NOT modify, move, or reformat any source
`.js` data file (Constitution Principle I) — the files this feature reads were only relocated
within the repo root by a prior housekeeping change, never altered in content.

**Scale/Scope**: 20+ years of data (2006-03-15–present), 7,000+ daily minute files, 5 preserved
visualization modes, DE + EN UI language minimum (FR-017).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Constitution version in effect: **2.0.0**.

| Principle                                 | Applies? | How satisfied                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Static-File Data Model is Sacred       | Yes      | All data files are fetched and parsed client-side exactly as the SolarLog device produces them; no preprocessing pipeline sits in front of them. Parsing uses `fetch()` + line-pattern extraction (research.md §4), never `eval()` or `<script src>` injection, so file content is read, never executed or rewritten. |
| II. Zero Historical Data Loss             | Yes      | Dashboard and detail views cover the full 2006–present range (FR-010–FR-013); data-model.md's aggregate entities are derived from, not a replacement for, the source files.                                                                                                                                           |
| III. No Backend Introduction              | Yes      | 100% client-side; no server process, no build step; deployable to any static host (FR-004).                                                                                                                                                                                                                           |
| IV. Responsive-First Layout               | Yes      | Single fluid layout (CSS Grid/Flexbox + custom properties per Technical Standards) targeting 320px–2560px (FR-001–FR-003); frameset fully removed (already archived to `legacy-site/`).                                                                                                                               |
| V. Modern Charting — No Custom Pixel Math | Yes      | Chart.js used for all 5 modes (FR-009–FR-014); no custom pixel-positioning engine (the old `diagram*.js` remains only as read-only archive under `legacy-site/`).                                                                                                                                                     |
| VI. Preserve All Five Visualization Modes | Yes      | Modes 0–4 map 1:1 to `day-view`, `month-view`, `year-view`, `total-view`, `compare-view` (see Project Structure).                                                                                                                                                                                                     |

No violations requiring Complexity Tracking. Gate: **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/001-website-modernization/
├── plan.md              # This file (/speckit-plan command output)
├── research.md           # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

Updated 2026-08-04: everything under `web/` is the single directory FTP'd to the Synology
DiskStation. `web/data/` and `web/hist/` hold the SolarLog-device-pushed data files (not shown
below — see data-model.md for the hist/data split); `legacy-site/` and `scripts/` stay at the
repo root (dev/archive-only, never deployed).

```text
web/
├── index.html                 # Single dashboard/detail-view entry point (replaces old frameset index.html)
├── css/
│   ├── tokens.css          # CSS custom properties: colour, spacing, typography (Technical Standards)
│   └── app.css              # Layout, responsive rules, widget/chart styling
├── js/
│   ├── main.js              # Bootstrap: load data/base_vars.js, wire router, mount dashboard
│   ├── router.js            # Hash-based router: parse/serialize #/year/:yyyy, #/month/:yyyy/:mm, #/day/:yyyy/:mm/:dd, #/total, #/compare
│   ├── i18n.js               # DE/EN string lookup + persisted language selection (FR-017/FR-018)
│   ├── config.js             # INSTALLATION_DATE ('2026-07-29'), DATA_DIR ('data'), HIST_DIR ('hist')
│   ├── data/
│   │   ├── fetch-text.js     # fetch() wrapper: retrieves a data file as raw text, surfaces error state (FR-019)
│   │   ├── parse-lines.js    # Shared `arr[idx++]="..."` line-extraction helper (regex-based, no eval)
│   │   ├── plant.js          # Parses base_vars.js -> PlantMetadata (data-model.md)
│   │   ├── epoch.js          # min-file layout epoch detection (epochFromDate/epochFromFieldCounts); canonical copy, scripts/utils.js re-exports from here
│   │   ├── min-file.js        # Parses min{YYMMDD}.js / min_cur.js -> DailyTrace, using epoch.js
│   │   ├── aggregates.js     # Parses days.js / days_hist.js / months.js / years.js -> MonthlyTotals / YearlyTotals / LifetimeSummary; mergeDailyTotals/mergeMonthlyTotals/mergeYearlyTotals combine hist+data across the installation-date boundary
│   │   └── data-source.js    # sourceDirForDate(dateIso) picks 'hist'/'data'; fetchFromBothSources(filename) fetches both in parallel
│   ├── views/
│   │   ├── dashboard.js       # All summary widgets at once (current production + 4 totals)
│   │   ├── day-view.js         # Mode 0 detail
│   │   ├── month-view.js       # Mode 1 detail
│   │   ├── year-view.js        # Mode 2 detail
│   │   ├── total-view.js       # Mode 3 detail
│   │   └── compare-view.js     # Mode 4 detail
│   └── charts/
│       └── chart-factory.js    # One place that configures Chart.js per mode (line/bar/multi-line)
├── i18n/
│   ├── de.json                 # Curated DE strings for the new UI (see research.md §6)
│   └── en.json                 # Curated EN strings for the new UI
└── vendor/
    └── chart.js/
        └── chart.esm.js             # Vendored Chart.js ESM build, committed (research.md §2)

bs-config.cjs                  # Dev server (browser-sync): baseDir 'web', routes /legacy-site for local reference

tests/e2e/
├── navigation.spec.js          # Existing — unchanged, covers archived legacy-site/ pages
├── dashboard.spec.js            # New — US1/US4: mobile viewport, live widget, error state
└── detail-views.spec.js         # New — US2/US3/US5: month/year/total/compare views, i18n switch
```

**Structure Decision**: Single project (Option 1). This feature adds one static frontend rooted at
`index.html` with supporting modules under `src/` — the layout `package.json`'s existing
`lint`/`format` scripts already target. No `backend/`/`frontend/` split is needed since there is no
server component (Constitution Principle III). The previously archived `legacy-site/` directory is
left untouched as a read-only reference/rollback copy and is not imported by any new module.

## Complexity Tracking

_No violations — table intentionally omitted._
