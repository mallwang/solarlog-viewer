# Feature Specification: Cache-Busting Production Build

**Feature Branch**: `019-cache-busting-build`

**Created**: 2026-08-15

**Status**: Backfilled (implementation already complete — see Note below)

**Input**: User description: "Retroactive spec for the cache-busting production build step already implemented on branch feat/cache-busting-build (commits 02c338c, 76632f8, 38f505e): a production build step that produces a hashed, cache-busted `dist/` artifact from `web/` and FTP-syncs that instead of `web/` directly, so browsers stop serving stale cached JS/CSS after a deploy."

> **Note on this document**: This spec was written _after_ the feature was implemented, to bring the change under the project's normal spec-kit process retroactively. Requirements and success criteria below describe behavior the shipped implementation already satisfies, not upcoming work. See commits `02c338c`, `76632f8`, `38f505e` on this branch for the actual change.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Viewer sees the latest deploy without manually clearing cache (Priority: P1)

A visitor to the dashboard (a plant owner checking their solar production) loads the page shortly after the operator has pushed an update. Previously, their browser kept serving a cached copy of `js/main.js`/`css/app.css` because those files kept the same URL across deploys, so the visitor silently ran stale code — sometimes indefinitely — until they thought to hard-refresh. After this change, the visitor's browser fetches the new JS/CSS automatically because the deployed page now points at build-specific, uniquely named files.

**Why this priority**: This is the core problem the feature exists to solve — stale-cache bugs reaching real users — and the only story with end-user-visible impact.

**Independent Test**: Deploy two different builds in succession and load the dashboard in a browser between them; confirm the second load fetches the second build's assets without a manual cache clear or hard refresh.

**Acceptance Scenarios**:

1. **Given** a dashboard page previously loaded and cached by a browser, **When** the operator deploys a new build, **Then** the next page load fetches the new build's JS and CSS rather than reusing the previously cached files.
2. **Given** a browser that has never visited the dashboard, **When** it loads the page for the first time, **Then** it receives the current build's assets and functions identically to a page served the old, uncached way.

---

### User Story 2 - Operator deploys via the existing FTP sync workflow (Priority: P2)

The operator (project maintainer) runs the existing FTP sync process to publish a change to the SolarLog webserver. Previously this uploaded `web/` byte-for-byte; now it must upload the built, hashed `dist/` artifact instead, without the operator needing to remember an extra manual step or risk uploading stale/unbuilt source files.

**Why this priority**: Without this, User Story 1 is unreachable in practice — the deploy tooling has to actually ship the built artifact, not the raw source tree.

**Independent Test**: Run the FTP sync workflow end-to-end and confirm it builds first, then diffs/uploads `dist/`, not `web/`, and that live device data directories are left untouched.

**Acceptance Scenarios**:

1. **Given** local source changes in `web/`, **When** the operator runs the deploy/sync workflow, **Then** a build is produced before any diffing or uploading occurs.
2. **Given** a completed build, **When** the sync workflow diffs against the remote server, **Then** it compares against `dist/`'s contents, not `web/`'s.
3. **Given** the SolarLog device's own live/frozen data directories on the remote server, **When** a sync runs, **Then** those directories are never overwritten or deleted by the build or sync step.

---

### User Story 3 - Runtime-resolved assets remain cache-busted without renaming (Priority: P3)

Some assets can't be given a build-specific filename because their path is determined at runtime rather than at build time: translation files fetched by language code, operator-supplied plant photos, and vendor icons referenced by absolute CSS URL. These still need to bypass stale browser caches after a deploy, just via a versioned query string instead of a renamed file.

**Why this priority**: Narrower in scope than Stories 1–2 (a handful of asset classes), but still required for the feature to fully close the stale-cache gap — a partial fix that missed these would leave visible bugs (e.g. an operator's updated plant photo not showing up).

**Independent Test**: Change one file in each affected category (a translation string, a plant photo, a vendor icon) and confirm each is fetched fresh after the next deploy without a filename change.

**Acceptance Scenarios**:

1. **Given** an updated translation file, **When** a new build is deployed, **Then** the reference to that file in the deployed page includes a version marker tied to the new build.
2. **Given** an updated vendor icon referenced from CSS, **When** a new build is deployed, **Then** the deployed CSS's reference to that icon includes a version marker tied to the new build.

---

### Edge Cases

- What happens when the build step is run but the FTP sync step is skipped? The stale-cache problem is not solved for that deploy, since nothing was published — this is an operator process gap, not something the build step itself needs to prevent.
- What happens to the SolarLog device's own live data (readings, historical records) during a build or sync? It must never be regenerated, copied, or overwritten by the build — it is treated as external state owned by the device, not as source content.
- What happens if two consecutive builds are produced from the same source with no changes? They should still be safe to deploy repeatedly (idempotent from the visitor's perspective — same content, same or equivalent cache behavior), even if the version identifier differs per commit.
- What happens to a vendored third-party library that's already pulled into the bundled JS by another file? It should not additionally be shipped as a separate, unbundled copy — that would be redundant weight with no behavioral benefit.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST produce a distinct, deployable build artifact separate from the editable source tree, so that source edits are never published to visitors without going through the build.
- **FR-002**: Each build MUST give the page's core script and stylesheet a filename (or reference) that changes whenever their content changes, so browsers cannot serve a stale copy under the same URL as a newer deploy.
- **FR-003**: The deployed page MUST reference the current build's script and stylesheet outputs; it must never point at a filename from a previous build once a new one is deployed.
- **FR-004**: Assets whose reference path is determined at runtime rather than at build time (translations, operator-supplied images, vendor icons referenced by absolute URL) MUST still be cache-busted on each new build, via a version marker on their reference rather than a renamed file.
- **FR-005**: A vendored library that is already incorporated into the bundled script via a normal import MUST NOT also be shipped again as a separate, unbundled file in the build output.
- **FR-006**: The deploy/publish workflow MUST operate on the built artifact, not the raw source tree, and MUST perform the build before comparing against or uploading to the remote server.
- **FR-007**: The build and deploy workflow MUST NOT modify, replace, or delete the remote server's live or historical device-data directories under any circumstances.
- **FR-008**: The build MUST be reproducible from source and git history alone — it must not depend on manual, undocumented steps to produce a correct, current version marker.
- **FR-009**: The build process MUST fail loudly (non-zero exit, clear error) if it cannot locate the source structure it expects to rewrite (e.g. the page's script/stylesheet references), rather than silently producing a broken or unversioned deploy artifact.

### Key Entities

- **Build artifact**: The generated, deployable output tree produced from the editable source tree on each build; what actually gets published to the remote server. Contains version-specific filenames for the core script/stylesheet and version-marked references for runtime-resolved assets.
- **Build/version identifier**: A value unique to the current state of the source (derived from source control history) that ties every cache-busted filename or reference in one build together and changes whenever the source changes.
- **Device data directories**: The remote server's own live and historical readings, owned and produced by the SolarLog device itself — explicitly out of scope for the build and never touched by it.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: After any deploy, a returning visitor's browser loads the newly deployed script and stylesheet on the very next page visit, with no manual cache-clearing action required.
- **SC-002**: A visitor's first-ever page load behaves identically (visually and functionally) whether their browser has cached nothing or cached an older build.
- **SC-003**: Publishing a change requires no manual, error-prone steps beyond the operator's existing single sync action — the build step is invoked automatically as part of that action, not a separate thing the operator must remember.
- **SC-004**: Zero incidents, across all deploys since this change, of the remote device's live or historical data directories being altered by a build or sync.
- **SC-005**: Updating a translation string, an operator plant photo, or a vendor icon becomes visible to visitors within one deploy cycle, with no additional manual cache-busting step from the operator.

## Assumptions

- The remote SolarLog webserver has no server-side cache-control configuration the operator can rely on instead — this is why cache-busting happens at the filename/query-string level rather than via HTTP headers.
- The page is a single-page application with client-side routing already in place, so no navigation/routing architecture change was required to support build-time restructuring of asset references.
- Git short-SHA is an acceptable and sufficiently unique version identifier for this project's deploy frequency and team size; a more elaborate versioning scheme (semver, build counter) is out of scope.
- The existing FTP-based sync workflow (diff-then-upload against a remote target) remains the deploy mechanism; this feature changes what that workflow points at (`dist/` instead of `web/`) but not the transport or diffing approach itself.
- `i18n/*.json`, operator plant photos, and vendor SVGs are the complete set of runtime-resolved (not build-time-renameable) asset classes for this codebase; any future asset class added to the app in the same category would need equivalent handling, which is out of this feature's scope to anticipate.
