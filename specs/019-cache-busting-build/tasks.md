---
description: 'Task list template for feature implementation'
---

# Tasks: Cache-Busting Production Build

**Input**: Design documents from `/specs/019-cache-busting-build/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — `scripts/build.test.js` (`node:test`) was written for the build's pure logic
functions, per this project's helper-script convention (CLAUDE.md).

**Organization**: Tasks are grouped by user story, matching spec.md's priorities.

> **Note**: This is a retroactive backfill. Every task below is already **done** — implemented in
> commits `02c338c`, `76632f8`, `38f505e` on this branch (build feature) plus this session's
> follow-up documentation commits (spec/plan/constitution backfill). Checkboxes are marked
> complete to reflect shipped state, not as a forward plan to execute.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Could have run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in each description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Add `esbuild` as a devDependency in `package.json` / `package-lock.json`
- [x] T002 [P] Add `dist/` to `.gitignore` (generated deploy artifact, never committed)
- [x] T003 [P] Add `npm run build` script to `package.json` (`node scripts/build.js`, run after
      `npm run build:css`)
- [x] T004 [P] Add an ESLint override in `eslint.config.js` for `scripts/build.js` (Node ESM
      globals, `import.meta`, etc.)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core build orchestration that every user story's cache-busting behavior depends on

**⚠️ CRITICAL**: No user story's cache-busting behavior is reachable until this phase exists

- [x] T005 Create `scripts/build.js` orchestration skeleton: `getBuildId()` (git short SHA via
      `git rev-parse --short HEAD`), `dist/` recreation (`rmSync` + `mkdirSync`), and the
      `main()`/CLI entry-point wiring (`scripts/build.js`)
- [x] T006 Implement `linkDeviceDataDirs()` — relative symlinks `dist/data → ../web/data` and
      `dist/hist → ../web/hist`, never copies (`scripts/build.js`, satisfies FR-007)
- [x] T007 [P] Add fatal-error handling so the build exits non-zero with a clear message on
      failure rather than leaving a partial/broken `dist/` (`scripts/build.js` `main()` catch
      block, satisfies FR-009)

**Checkpoint**: `npm run build` produces an empty-but-safe `dist/` with correctly symlinked device
data directories — user story implementation can now build on top of this.

---

## Phase 3: User Story 1 - Viewer sees the latest deploy without manually clearing cache (Priority: P1) 🎯 MVP

**Goal**: Every build gives the page's core script and stylesheet content-hashed filenames, so
browsers never serve stale cached JS/CSS after a deploy.

**Independent Test**: Deploy two different builds in succession and load the dashboard in a
browser between them; confirm the second load fetches the second build's assets without a manual
cache clear.

### Tests for User Story 1

- [x] T008 [P] [US1] Unit tests for `rewriteIndexHtml()` in `scripts/build.test.js` — covers the
      stylesheet-block replacement, script-tag replacement, and favicon versioning, plus the
      thrown-error cases when the expected HTML structure isn't found
- [x] T009 [P] [US1] Unit tests for `bundleCss()` in `scripts/build.test.js` — covers
      concatenation order (tokens → app → tailwind) and minification

### Implementation for User Story 1

- [x] T010 [US1] Implement esbuild JS bundling: `bundle: true, minify: true, format: 'esm'` from
      `web/js/main.js` into `dist/js/main-<buildId>.js`, with `__BUILD_ID__` injected via
      `define` (`scripts/build.js`)
- [x] T011 [US1] Add `logOverride: { 'commonjs-variable-in-esm': 'silent' }` to the esbuild call to
      silence the false-positive warning on the vendored apexcharts UMD bundle's
      `typeof module !== 'undefined'` environment check (`scripts/build.js`, commit `76632f8`)
- [x] T012 [P] [US1] Create `web/js/build-info.js` exposing the injected `__BUILD_ID__` value at
      runtime (`web/js/build-info.js`)
- [x] T013 [US1] Implement `bundleCss()`: concatenate `tokens.css` + `app.css` +
      `tailwind.generated.css` and minify via esbuild's `transform()` into
      `dist/css/styles-<buildId>.css` (`scripts/build.js`)
- [x] T014 [US1] Implement `rewriteIndexHtml()`: collapse the three `<link rel="stylesheet">` tags
      into the hashed CSS filename, point the module `<script>` at the hashed JS filename, and
      append `?v=<buildId>` to `favicon-v2.ico` references, throwing if the expected structure
      isn't found (`scripts/build.js`)
- [x] T015 [US1] Wire `main()` to read `web/index.html`, call `rewriteIndexHtml()`, and write the
      result to `dist/index.html` (`scripts/build.js`)

**Checkpoint**: User Story 1 is fully functional and independently testable — a rebuild after any
source change produces a new `buildId`-hashed filename referenced from `dist/index.html`.

---

## Phase 4: User Story 2 - Operator deploys via the existing FTP sync workflow (Priority: P2)

**Goal**: The FTP sync workflow builds `dist/` first, then diffs/uploads that instead of `web/`
directly, without an extra manual step for the operator.

**Independent Test**: Run the FTP sync workflow end-to-end and confirm it builds first, then
diffs/uploads `dist/`, not `web/`, and that live device data directories are left untouched.

### Implementation for User Story 2

- [x] T016 [US2] Update `scripts/ftp-sync.js` to run the build before diffing/uploading, and to
      treat `dist/` as the local sync source instead of `web/` (`scripts/ftp-sync.js`, commit
      `02c338c`)
- [x] T017 [US2] Update `.claude/skills/sync-ftp/SKILL.md` to document the build-then-diff-`dist/`
      workflow and correct all `web/`-relative path references throughout (commit `38f505e`)

**Checkpoint**: User Stories 1 AND 2 both work independently — a deploy via the sync workflow
publishes the hashed build artifact, not raw source.

---

## Phase 5: User Story 3 - Runtime-resolved assets remain cache-busted without renaming (Priority: P3)

**Goal**: Assets whose reference path is resolved at runtime (i18n JSON, plant photos, vendor
SVGs referenced from CSS) still bypass stale caches via a versioned query string.

**Independent Test**: Change one file in each affected category (a translation string, a plant
photo, a vendor icon) and confirm each is fetched fresh after the next deploy without a filename
change.

### Tests for User Story 3

- [x] T018 [P] [US3] Unit tests for `appendVersionToVendorUrls()` in `scripts/build.test.js` —
      covers single and multiple `/vendor/*.svg` `url(...)` references, with and without quotes

### Implementation for User Story 3

- [x] T019 [US3] Implement `appendVersionToVendorUrls()`: regex-based `?v=<buildId>` suffix on
      every `/vendor/*.svg` reference inside `url(...)` in the built CSS (`scripts/build.js`)
- [x] T020 [US3] Update `web/js/i18n.js` so the runtime `fetch()` of `i18n/<lang>.json` appends
      `?v=<buildId>` (reads `web/js/build-info.js`'s exposed build id) (`web/js/i18n.js`)
- [x] T021 [P] [US3] Update `web/js/views/welcome-view.js` for the corresponding versioned asset
      reference (`web/js/views/welcome-view.js`)
- [x] T022 [P] [US3] Copy `web/i18n/`, `web/img/`, `web/favicon-v2.ico` through to `dist/`
      unchanged (`scripts/build.js`, satisfies FR-004's "keep filename, version the reference"
      requirement)
- [x] T023 [US3] Copy `web/vendor/` through to `dist/`, excluding `vendor/apexcharts` (already
      pulled into the JS bundle via T010's static import — satisfies FR-005) (`scripts/build.js`)

**Checkpoint**: All three user stories are independently functional — the full cache-busting
surface (core bundle, deploy workflow, runtime-resolved assets) is covered.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and process work spanning all three user stories, including this
session's retroactive spec-kit backfill

- [x] T024 [P] Update `README.md` documenting the `npm run build` step and the new `dist/` deploy
      artifact (commit `02c338c`)
- [x] T025 Run `node --test scripts/build.test.js` and confirm all unit tests pass
- [x] T026 Run `npx eslint scripts/build.js scripts/build.test.js` and confirm zero errors
- [x] T027 Run `quickstart.md`'s validation steps end-to-end against the current `dist/` build
      (`specs/019-cache-busting-build/quickstart.md`)
- [x] T028 [P] Write retroactive `specs/019-cache-busting-build/spec.md` and requirements
      checklist, bringing the already-shipped feature under the project's normal spec-kit process
- [x] T029 [P] Write retroactive `specs/019-cache-busting-build/plan.md`, `research.md`,
      `data-model.md`, `contracts/build-cli.md`, `quickstart.md`
- [x] T030 Amend `.specify/memory/constitution.md` to v2.2.0, adding the approved exception for an
      offline production-build JS bundler that this feature's design required (resolves the
      Constitution Check gap `plan.md` originally flagged)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (no story's output has
  anywhere to land without `dist/` existing and device data being safely symlinked)
- **User Stories (Phase 3–5)**: All depend on Foundational; in practice implemented in priority
  order (P1 → P2 → P3) since each was a discrete commit, but US2 and US3 do not depend on each
  other's internals — only on Foundational + (for US2) the artifact US1 produces existing to sync
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational (Phase 2)
- **User Story 2 (P2)**: Depends on Foundational (Phase 2); syncs whatever User Story 1 produces
  into `dist/`, but its own tasks (ftp-sync.js, skill docs) don't modify US1's code
- **User Story 3 (P3)**: Depends on Foundational (Phase 2) and on `build-info.js`/`__BUILD_ID__`
  existing from US1 (T012) for its own versioning references

### Parallel Opportunities (as actually landed)

- T002–T004 (Setup) were independent of each other
- T008/T009 (US1 tests) were independent of each other and could run before T010–T015
- T012 (build-info.js) was independent of T013/T014 (CSS/HTML rewrite logic)
- T018 (US3 test) was independent of the rest of Phase 5
- T024, T028, T029 (Polish/docs) were independent of each other

---

## Implementation Strategy (as actually delivered)

1. Setup + Foundational landed together in commit `02c338c`'s first pass
2. User Story 1 (hashed JS/CSS bundle, `rewriteIndexHtml`) landed in the same commit — the MVP:
   a browser stops seeing stale JS/CSS after this alone
3. User Story 2 (`ftp-sync.js` build-then-diff) landed in the same commit, since without it the
   MVP has no deploy path
4. A follow-up commit (`76632f8`) fixed a build-time warning noticed after landing US1
5. User Story 3 pieces (i18n/vendor query versioning) landed alongside US1/US2 in `02c338c`
6. Documentation (`sync-ftp` skill) landed in a dedicated follow-up commit (`38f505e`)
7. This session: retroactive spec-kit backfill (spec → plan → constitution amendment → tasks)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All tasks in this document are already complete; this file exists to bring the feature under the
  project's normal spec-kit task-tracking convention retroactively — see spec.md's Status note
