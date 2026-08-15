# Implementation Plan: Cache-Busting Production Build

**Branch**: `019-cache-busting-build` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-cache-busting-build/spec.md`

> **Note**: This plan is a retroactive backfill. The design described below is not a proposal —
> it is what commits `02c338c`, `76632f8`, and `38f505e` on this branch already built and merged.
> Where the design deviates from constitution defaults (bundler introduction, see Constitution
> Check), that deviation already exists in the shipped code; this document surfaces it for the
> record rather than gating work that hasn't happened yet.

## Summary

Add an offline production build step (`scripts/build.js`, run via `npm run build`) that turns the
hand-authored `web/` source tree into a cache-busted `dist/` artifact: esbuild bundles+minifies
the whole JS import graph into one `js/main-<buildId>.js` and the three stylesheets into one
`css/styles-<buildId>.css`, where `buildId` is the current git short SHA; `dist/index.html` is
rewritten to reference the hashed filenames; runtime-resolved assets (i18n JSON, plant photos,
vendor SVGs referenced from CSS) keep their filenames but get a `?v=<buildId>` query string.
`scripts/ftp-sync.js` and the `sync-ftp` skill were updated to build `dist/` first and diff/upload
that instead of `web/` directly. `dist/data` and `dist/hist` are relative symlinks to
`web/data`/`web/hist`, never copies, so the SolarLog device's live/frozen data mirror is never
touched by the build.

## Technical Context

**Language/Version**: Vanilla JavaScript (ES2022+), native ES modules in the `web/` source tree
(constitution Technical Standards → Frontend) — **unchanged for the app itself**. The build step
introduced by this feature is Node.js tooling (`scripts/build.js`, ESM), consistent with the
project's existing `scripts/*.js` helper convention.

**Primary Dependencies**: `esbuild` (new devDependency) — bundles and minifies `web/js/main.js`'s
full import graph into a single hashed file, and minifies the concatenated stylesheet output.
Existing dependencies (ApexCharts vendored, Tailwind CLI for `tailwind.generated.css`) are
consumed by the build unchanged; ApexCharts specifically is pulled into the JS bundle via its
existing static import in `web/js/charts/chart-factory.js`, so it needs no separate handling.

**Storage**: Unchanged — browser `localStorage` for preferences, SolarLog `.js` data files as the
untouched source of truth. This feature explicitly symlinks (not copies) `web/data`/`web/hist`
into `dist/`, reinforcing rather than weakening that boundary.

**Testing**: `node --test scripts/build.test.js` covers the build's pure logic functions
(`rewriteIndexHtml`, `appendVersionToVendorUrls`, `bundleCss`) with inline fixture strings, per the
project's script-testing convention — no real file I/O in unit tests. No Playwright test was added
because this feature has no browser-visible UI surface of its own (it changes deploy plumbing, not
page behavior); the existing e2e suite continues to run unmodified against `web/`.

**Target Platform**: Unchanged — static site deployable to a plain web host. `dist/` is that
deployable output; the build step itself runs on the developer/operator's machine (or CI), never
in the browser.

**Project Type**: Single static web app (`web/`) with a new, purely additive build/deploy step
(`scripts/build.js` → `dist/`) — no frontend/backend split introduced.

**Performance Goals**: A production build completes in well under the time it takes to notice
(single-digit seconds on a developer machine) — it runs on every deploy, so it must never become a
reason to skip building before an FTP sync.

**Constraints**: The build MUST NOT read, write, or delete `web/data/` or `web/hist/` content —
those are symlinked through, never processed. The build MUST be fully reproducible from committed
source and git history alone (no manual/undocumented inputs to the version identifier).

**Scale/Scope**: One JS entry point (`web/js/main.js`) and three source stylesheets bundled per
build; a handful of runtime-resolved asset classes (i18n JSON, plant photos, vendor SVGs) query-
string versioned. Scope does not include splitting the bundle, code-splitting per route, or a
service-worker/offline cache layer — out of scope per spec Assumptions.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Static-File Data Model is Sacred)** — PASS. `dist/data` and `dist/hist` are
  relative symlinks to `web/data`/`web/hist`; the build never reads, copies, or transforms the
  SolarLog device's `.js` data files.
- **Principle II (Zero Historical Data Loss)** — PASS. Not touched; historical data isn't part of
  the build's input or output.
- **Principle III (No Backend Introduction)** — PASS. The build step is an offline, one-shot
  script run by a developer/operator (or CI), not a long-running service; the deployed artifact
  (`dist/`) remains 100% static files served with no runtime dependency on the build tooling.
- **Principle IV (Responsive-First Layout)** — PASS. No layout change; the build only renames/
  concatenates existing assets.
- **Principle V / VI (Charting, five visualization modes)** — PASS. Not touched.
- **Technical Standards → Frontend ("no bundler is required unless bundle size or tree-shaking
  becomes a documented concern")** — **CONDITIONAL / FLAGGED, see Complexity Tracking below.**
  This feature introduces `esbuild` as a JS bundler for the _deploy artifact only_ — `web/`
  itself still ships hand-authored native ES modules with no bundler involved in day-to-day
  development (`npm start` continues to serve `web/` directly, unbundled). The constitution's
  narrow precedent for an offline build step is currently scoped to Tailwind CSS compilation
  (005-tailwind-css-dashboard-ui) and explicitly does not extend to introducing a JS framework —
  it is silent on JS _bundling_ specifically. Given the shipped implementation already bundles
  JS for the production artifact, this plan treats that as a **documented deviation requiring a
  constitution amendment** (see Complexity Tracking), not a violation to redesign away.

**Recommendation**: file a constitution amendment (via `/speckit-constitution`) adding an
approved, narrowly-scoped exception for an offline production-build JS bundler, mirroring the
existing Tailwind CSS exception's shape (offline/build-time only, never a runtime/CDN dependency,
`web/`'s day-to-day development experience unchanged). Until that amendment lands, this plan
records the gap rather than silently treating it as compliant.

## Project Structure

### Documentation (this feature)

```text
specs/019-cache-busting-build/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks — not yet generated)
```

### Source Code (repository root)

```text
scripts/
├── build.js              # NEW — production build orchestrator (npm run build)
├── build.test.js         # NEW — node:test coverage for build.js's pure logic functions
└── ftp-sync.js            # CHANGED — now builds, then diffs/uploads dist/ instead of web/

web/
├── index.html             # unchanged source; scripts/build.js rewrites a copy into dist/index.html
├── js/
│   ├── build-info.js      # NEW — exposes the injected __BUILD_ID__ define at runtime (favicon/asset versioning helpers)
│   ├── i18n.js             # CHANGED — i18n JSON fetch now appends ?v=<buildId>
│   ├── views/welcome-view.js  # CHANGED — minor reference update for versioned asset path
│   └── ... (all other modules unchanged; esbuild bundles them into dist/js/main-<buildId>.js as-is)
├── css/                    # tokens.css, app.css, tailwind.generated.css — unchanged sources;
│                              concatenated + minified into dist/css/styles-<buildId>.css
├── i18n/, img/, vendor/    # copied through to dist/ unchanged, cache-busted via ?v=<buildId>
│                              query string (vendor/apexcharts excluded — already in the JS bundle)
└── data/, hist/            # untouched; dist/data, dist/hist are relative symlinks to these

dist/                       # NEW, generated (gitignored) — the FTP deploy target
.claude/skills/sync-ftp/SKILL.md  # CHANGED — documents build-then-diff-dist/ workflow
```

**Structure Decision**: The build lives entirely in `scripts/` (matching the project's existing
helper-script convention) and produces a new top-level, gitignored `dist/` directory. No change to
`web/`'s internal module layout was required — `scripts/build.js` treats it as an opaque input
tree and bundles/copies it through, so `web/js/views/`, `web/js/charts/`, etc. keep their existing
structure and conventions for day-to-day (unbundled) development via `npm start`.

## Complexity Tracking

> Constitution Check flagged one deviation from a Technical Standards default. Recorded here per
> that section's process, pending a formal amendment.

| Violation                                                               | Why Needed                                                                                                                                                                                                                                                                                                                                                                                                                                   | Simpler Alternative Rejected Because                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Introduces `esbuild` as a JS bundler for the production deploy artifact | `web/js/main.js` pulls in dozens of ES modules via native imports; giving every one of them an individually content-hashed filename would require rewriting every `import` specifier across the whole graph on every build (effectively hand-rolling a bundler's job worse). Bundling into a single `main-<buildId>.js` reduces the versioning surface to one file + one query-string convention for the handful of runtime-resolved assets. | **Per-module hashed filenames without bundling**: rejected — every changed module would cascade into rewriting every importer's specifier recursively, which is more moving parts and more failure modes than one bundling step, for no benefit since the app is already served as one page. **HTTP cache-control headers instead of filename hashing**: rejected per spec Assumptions — the remote SolarLog webserver offers no server-side cache-control configuration the operator can rely on. |

## Phase 0: Research

See [research.md](./research.md).

## Phase 1: Design

See [data-model.md](./data-model.md), [contracts/](./contracts/), and [quickstart.md](./quickstart.md).
