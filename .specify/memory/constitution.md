<!--
SYNC IMPACT REPORT
==================
Version change: 2.2.0 → 2.3.0
Modified sections:
  - Principle I (Static-File Data Model is Sacred) — removed the "Narrow
    exception — local offline sync cache" paragraph that permitted an
    offline sync script to copy .js data into a local disk-based database
    cache.
  - Principle III (No Backend Introduction) — removed the "Narrow exception
    — local database cache" paragraph.
  - Technical Standards → Backend — removed the sentence permitting a local
    database cache populated by an offline sync script; section now states
    plainly there is no application server and all viewer logic runs
    client-side.
  - Modernization Scope → in-scope list — removed the "Optional: a local
    database cache of decoded .js data..." bullet.
  - Modernization Scope → out-of-scope list — removed the database-cache
    derived-aggregates carve-out from the "Reprocessing or re-aggregating
    historical minute data" bullet, restoring it to a plain statement.
Rationale for MINOR bump: this is a material contraction of existing
guidance (retracting a previously-permitted, narrowly-scoped exception),
not removal of a whole principle or a redefinition of a principle's core
meaning — no principle heading changed. Driven by feature 024 (see
specs/024-*/spec.md), which deletes the offline sync script, its test,
the corresponding npm script, and any generated database artifact, so
the constitution no longer documents a data-storage path that no longer
exists in the codebase (see that feature's spec/plan for exact file
paths).
Added sections: none
Removed sections: none
Templates checked:
  - .specify/templates/plan-template.md     ✅ no changes needed (generic)
  - .specify/templates/spec-template.md     ✅ no changes needed (generic)
  - .specify/templates/tasks-template.md    ✅ no changes needed (generic)
Deferred TODOs: none
-->

# Photovoltaikanlage Allwang — Modernization Constitution

## Core Principles

### I. Static-File Data Model is Sacred

The SolarLog 500 datalogger FTP-pushes plain `.js` files to the server on a
5-minute interval. This push mechanism is controlled entirely by the hardware
device and MUST NOT be changed. All `.js` data files (`base_vars.js`,
`min_cur.js`, `min{YYMMDD}.js`, `days.js`, `months.js`, `years.js`,
`days_hist*.js`, `daysall.js`) MUST remain in their current directory structure
and format, unmodified by the modernization effort.

The new frontend MUST be able to consume these files exactly as they are
produced today. No server-side preprocessing or transformation pipelines that
alter, replace, or sit in front of the `.js` files may be introduced.

### II. Zero Historical Data Loss

The plant has been logging since 2006-03-15. As of 2026-07-29 there are 7,148+
daily minute-data files and 20 years of monthly/yearly aggregates. Every record
in these files represents real energy generation and has financial relevance
(EEG feed-in tariff records).

All historical data MUST be accessible and correctly rendered in the modernized
site. A modernization that silently drops or misrenders historical records is a
regression regardless of visual improvement.

### III. No Backend Introduction

The current system is 100% static file serving — no application server, no
build-time pipeline beyond what the SolarLog device pushes. This constraint
MUST be preserved. The modernized site MUST remain deployable to any plain web
host or static file server (Apache, nginx, GitHub Pages, S3, etc.) with no
runtime dependencies.

All data parsing, aggregation, and chart rendering the browser-based viewer
performs MUST run client-side in the browser, reading the `.js` files
directly. This principle does not require every capability the viewer offers
today to remain client-side forever, but any change to that must go through
the amendment procedure below — it MUST NOT be assumed via a feature spec
alone.

### IV. Responsive-First Layout

The original site is hard-coded to 800 px width with a frameset layout.
Frameset HTML is invalid in HTML5 and unusable on mobile. The modernized site
MUST render correctly at all viewport widths from 320 px (phone) to 2560 px
(wide monitor) without horizontal scrolling.

Fixed-pixel layouts and frameset-based navigation are prohibited in any new
file.

### V. Modern Charting — No Custom Pixel Math

The original `diagram.js` / `diagram_dom.js` engine positions chart elements
by computing absolute pixel offsets in JavaScript. This approach is fragile,
not responsive, and unmaintainable.

The modernized site MUST use an established, maintained charting library
(e.g., Chart.js, Apache ECharts, or Recharts) for all data visualization.
Custom pixel-positioning chart engines MUST NOT be introduced. The five
visualization modes (daily 5-min trace, monthly bar, yearly bar, all-years bar,
all-years line comparison) MUST all be preserved and implemented via the chosen
library.

### VI. Preserve All Five Visualization Modes

The existing site exposes five distinct views that users rely on:

- **Mode 0** — Daily 5-minute power trace (per inverter, per string)
- **Mode 1** — Monthly energy bar chart (per inverter)
- **Mode 2** — Yearly energy bar chart (all years)
- **Mode 3** — All-years cumulative bar (total lifetime)
- **Mode 4** — All-years daily line comparison (year-over-year overlay)

All five modes MUST be implemented in the modernized site with equivalent or
better data fidelity. No mode may be silently dropped or merged without an
explicit decision recorded as a constitution amendment.

## Data Preservation Constraints

- The SolarLog data format (pipe `|` / semicolon `;` field encoding, `m[mi++]=`,
  `da[dx++]=`, `mo[mx++]=`, `ye[yx++]=` assignment patterns) MUST be parsed
  client-side exactly as the device produces it.
- Plant metadata sourced from `base_vars.js` (`AnlagenKWP`, `AnzahlWR`,
  `WRInfo[]`, `HPTitel`, `HPBetreiber`, `Verguetung`, etc.) MUST continue to
  drive the UI dynamically so that any future SolarLog push automatically
  reflects in the page without manual edits.
- The CO₂ savings calculation and the feed-in tariff display (Verguetung) MUST
  be retained; they appear on the existing summary table and hold informational
  value for the owner.
- Multi-inverter encoding (pipe-separated blocks, variable field count based on
  string count per inverter) MUST be handled correctly for both WR1 (2 strings,
  SB 4200 TL) and WR2 (1 string, SB 2100 TL) as defined in `base_vars.js`.

## Modernization Scope

The following ARE in scope:

- Replace frameset layout with a single-page HTML5 application or simple
  multi-page static site.
- Replace the Word-generated `links.html` navigation with clean HTML/CSS.
- Replace custom pixel-math chart engine with a modern charting library.
- Make layout responsive (mobile-friendly).
- Update charset from ISO-8859-1 to UTF-8 throughout.
- Replace `document.write()` script-chaining data loading with `fetch()`-based
  async loading.
- Optional: add a live "current production" widget using `min_cur.js`.
- Optional: retain multi-language support (DE/EN at minimum).

The following are explicitly OUT of scope unless amended:

- Changing any `.js` data file format or location.
- Adding a server-side application layer (a long-running application server
  that the static site or browser viewer depends on to function).
- Replacing or modifying the SolarLog logging hardware.
- Real-time WebSocket or server-push updates (polling `min_cur.js` is acceptable).
- Reprocessing or re-aggregating historical minute data for display in the
  browser viewer (display only).

## Technical Standards

### Frontend

- Vanilla HTML5, CSS3, and JavaScript (ES2022+) only — no framework (React, Vue,
  Svelte, etc.) unless explicitly approved as a constitution amendment.
- Modules are loaded via native ES modules (`type="module"`); no bundler is required
  unless bundle size or tree-shaking becomes a documented concern.
- CSS custom properties (variables) MUST be used for all theme values (colours, spacing,
  typography) so the design can be reskinned in one place.

**Approved exception — Tailwind CSS compiled build step**: Per feature
005-tailwind-css-dashboard-ui, **Tailwind CSS** MAY be used as the project's
CSS framework, compiled via its CLI (or a minimal PostCSS pipeline) into a
single static, optimized CSS file that is committed to or produced for the
deployed site. This exception is scoped narrowly:

- The compiled Tailwind build step MUST run offline/at build time (an `npm
run build:css`-style script) — never as a runtime/CDN script loaded by the
  browser at page-view time.
- The resulting static CSS file is what ships to the browser; no bundler is
  introduced for JavaScript, which continues to load via native ES modules
  per the rule above.
- Existing CSS custom properties (theme tokens for colour, spacing, and
  typography) MUST remain the single source of design-token truth; Tailwind's
  configuration MUST read from (or be kept in sync with) those tokens rather
  than duplicating them, so the design remains reskinnable in one place.
- This exception does not extend to introducing a JavaScript UI framework
  (React, Vue, Svelte, etc.) — that still requires a separate, explicit
  constitution amendment.

**Approved exception — offline production-build JS bundler**: Per feature
019-cache-busting-build, an **offline production build step** (an `npm run
build`-style script, e.g. `scripts/build.js`) MAY use a JS bundler (e.g.
`esbuild`) to bundle and minify `web/`'s native ES module import graph into a
single hashed file (e.g. `main-<buildId>.js`) for the deployable artifact.
This exception is scoped narrowly:

- The bundler MUST run offline/at build time only — never as a runtime/CDN
  script loaded by the browser at page-view time.
- Day-to-day development MUST continue to serve `web/` directly, unbundled,
  via native ES modules (`npm start` / the dev server) — the bundler applies
  only to producing the separate deploy artifact (e.g. `dist/`), never to the
  editable source tree itself.
- The build MUST give bundled/hashed outputs a filename (or reference) that
  changes whenever their content changes, so the bundling step also serves
  cache-busting — it MUST NOT be used merely to obscure or restructure source
  without that cache-busting benefit.
- This exception does not extend to introducing a JavaScript UI framework
  (React, Vue, Svelte, etc.) — that still requires a separate, explicit
  constitution amendment, same as the Tailwind CSS exception above.

### Backend

Per Principle III, there is no application server. All browser-viewer logic
runs client-side.

### Package Manager

**npm** is the sole package manager for this project. Do not use yarn, pnpm, or bun.
`package-lock.json` MUST be committed.

### Testing

- **End-to-end tests with Playwright** are the primary quality gate. Every feature
  addition or visible UI change MUST be accompanied by at least one Playwright test
  that verifies both behaviour and visual appearance (screenshot or accessibility assertion).
- Tests live in `tests/e2e/` and are run with `npm test`.
- A feature is not considered done until its Playwright tests pass locally.
- Unit tests (plain Node `assert` or a zero-config runner) MAY be added for pure data-
  parsing functions, but are not required unless the logic is non-trivial.

### Linting

- **ESLint** with the `eslint:recommended` rule set (no external plugin unless explicitly
  needed). Config lives in `eslint.config.js`.
- `npm run lint` MUST exit with code 0 before any commit.

### Formatting

- **Prettier** with default settings (2-space indent, single quotes). Config lives in
  `.prettierrc`.
- `npm run format` MUST be run before any commit; CI checks formatting with
  `npm run format:check`.

---

## Documentation Standards

### README

Both `README.md` (English) and `README.de.md` (German) MUST be updated after every
feature implementation. The two files MUST remain consistent with each other.

### User guides

Both `docs/user-guide.md` (English) and `docs/user-guide.de.md` (German) MUST be updated
after every feature implementation to document the new functionality from a user
perspective — what the feature does, how to reach it, and any relevant edge cases. The two
files MUST remain consistent with each other.

### JSDoc

Every new or modified function MUST carry a JSDoc comment with:

- A one-sentence description in imperative mood.
- `@param` entries for every parameter.
- A `@returns` entry describing the return value.
- An optional prose paragraph for non-trivial logic (hidden constraints, subtle invariants,
  surprising behaviour). Omit when the implementation is self-explanatory.

### File-level description

Every source file MUST include a file-level JSDoc block placed after imports and before the
first exported symbol, class, or function. One or two sentences describing the module's role.

---

## Development Workflow

1. **Specification first**: Every feature MUST have an approved `spec.md` before planning.
2. **Plan before code**: Every feature MUST have an approved `plan.md` before any code is
   written.
3. **Tests before implementation**: Failing Playwright tests MUST exist before
   implementation begins. Write the test, confirm it fails for the right reason, then write
   the code that makes it pass.
4. **Independent stories**: Each user story MUST be independently testable and releasable.
5. **Lint and format gate**: `npm run lint` and `npm run format:check` MUST pass before any
   commit is pushed.
6. **Constitution check**: Every spec and plan document MUST include a Constitution Check
   section confirming which principles apply and how they are satisfied.

---

## Governance

This constitution supersedes all prior implicit conventions of the original
2006–2008 codebase. Any modernization task that conflicts with a principle above
MUST be raised as a proposed amendment before implementation proceeds.

Amendment procedure:

1. Open a discussion describing the principle conflict and the proposed change.
2. Update this file with the amended text, increment the version per semver rules,
   and update `LAST_AMENDED_DATE`.
3. Verify no existing spec or plan documents contradict the amended principle;
   update them if they do.

Versioning policy:

- **MAJOR**: Removal or fundamental redefinition of a principle (e.g., allowing
  a backend to be introduced).
- **MINOR**: New principle or material expansion of guidance added.
- **PATCH**: Clarifications, wording, typo fixes, non-semantic refinements.

All feature specifications and implementation plans MUST include a Constitution
Check section confirming which principles apply and how they are satisfied.

**Version**: 2.3.0 | **Ratified**: 2026-07-29 | **Last Amended**: 2026-08-18
