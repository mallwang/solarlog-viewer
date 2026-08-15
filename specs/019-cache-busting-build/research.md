# Phase 0 Research: Cache-Busting Production Build

> Retroactive: these are the decisions embodied in the shipped implementation
> (`scripts/build.js`, commits `02c338c`/`76632f8`/`38f505e`), reconstructed from the code and its
> comments rather than from a forward-looking research spike.

## Decision: git short SHA as the build/version identifier

**Decision**: Use `git rev-parse --short HEAD` as `buildId`, embedded in filenames
(`main-<buildId>.js`, `styles-<buildId>.css`) and query strings (`?v=<buildId>`).

**Rationale**: Free (no new state to maintain), unique per commit, reproducible from source
control alone with no manual bookkeeping — satisfies FR-008 (build must be reproducible from
source + git history alone). Matches the project's deploy cadence (small team, commit-per-deploy
granularity is sufficient).

**Alternatives considered**:

- **Content hash (e.g. hash of the bundled output)**: more precise (identical content across
  commits would reuse the same hash), but adds a hashing step and a second identifier scheme (one
  for the JS/CSS filenames, a different content hash for query-string-versioned assets which
  aren't independently hashed) — rejected as unnecessary complexity for this project's scale.
- **Build counter / timestamp**: requires persisted state (a counter) or loses reproducibility
  (a timestamp isn't derivable from source alone, so two builds of the same commit would produce
  different, spuriously "changed" URLs) — rejected.

## Decision: esbuild for JS bundling+minification and CSS minification

**Decision**: Use `esbuild`'s `build()` API for the JS entry point (`bundle: true, minify: true,
format: 'esm'`) and its `transform()` API for CSS minification.

**Rationale**: Single dependency covers both JS bundling and CSS minification, fast enough to run
on every deploy without becoming friction, ESM-native (matches the project's `type="module"`
convention — see constitution Technical Standards → Frontend).

**Alternatives considered**:

- **Rollup/webpack**: heavier configuration surface for a single-entry-point app with no
  code-splitting requirement — rejected as disproportionate to scope.
- **No bundler, per-file content hashing**: rejected — see plan.md Complexity Tracking (would
  require rewriting every import specifier across the module graph on every build).

## Decision: query-string versioning (`?v=<buildId>`) for runtime-resolved assets

**Decision**: i18n JSON, plant photos, and vendor SVGs referenced from CSS keep their original
filenames in `dist/`, but every _reference_ to them gets a `?v=<buildId>` suffix appended.

**Rationale**: These paths are not known at build time — i18n files are fetched by a runtime
language-code variable, plant photos are operator drop-in files named by the site operator (not
the build), and vendor SVGs are referenced from `app.css` via absolute `url('/vendor/...')` paths
that esbuild's bundler would misresolve as literal filesystem paths rather than web-root-relative
URLs if brought into the asset pipeline. A query string cache-busts without requiring the
filename itself to be known ahead of time.

**Alternatives considered**:

- **Bring these into esbuild's asset pipeline with content hashes**: rejected for i18n/plant
  photos because their reference is constructed from a runtime value (language code / operator
  filename), not a static import esbuild can see; rejected for vendor SVGs specifically because
  the absolute `/vendor/...` CSS URL pattern is not filesystem-relative, which esbuild's asset
  resolution requires.

## Decision: symlink `dist/data` and `dist/hist`, never copy

**Decision**: `scripts/build.js` creates relative symlinks `dist/data → ../web/data` and
`dist/hist → ../web/hist` instead of copying their contents.

**Rationale**: Those directories are the SolarLog device's own live/frozen data mirror (constitution
Principle I) — thousands of files, growing continuously, and explicitly out of scope for any build
transformation. Copying would (a) be wasteful for large, frequently-changing trees and (b) risk the
build script being mistaken for a legitimate place to filter/transform device data. A symlink
makes the "hands off" boundary structural, not just documented.

**Alternatives considered**:

- **Copy `web/data`/`web/hist` into `dist/`**: rejected — see Rationale above.
- **Exclude them from `dist/` and have the FTP sync step union both directories at upload time**:
  rejected as more moving parts than a symlink for the same outcome.

## Decision: exclude `vendor/apexcharts` from the plain-copy step

**Decision**: `scripts/build.js`'s copy of `web/vendor/` filters out the `apexcharts` subdirectory.

**Rationale**: `web/js/charts/chart-factory.js` already `import`s `vendor/apexcharts/apexcharts.esm.js`
directly, so esbuild pulls it into the JS bundle automatically. Shipping the standalone vendored
file _as well_ would be dead, unreferenced weight in the deploy artifact.

**Alternatives considered**: None seriously considered — shipping unreferenced duplicate weight has
no upside.

## Decision: silence the `commonjs-variable-in-esm` warning for the bundled apexcharts import

**Decision**: `logOverride: { 'commonjs-variable-in-esm': 'silent' }` in the esbuild `build()` call.

**Rationale**: `apexcharts.esm.js` is a UMD bundle that feature-detects its environment via
`typeof module !== 'undefined'`. esbuild's static analysis flags any reference to `module` inside
an ESM bundle as a likely CommonJS/ESM mismatch, but this specific branch is never taken in a
browser bundle (`module` is `undefined` there) — the warning is a false positive for this
particular vendored file, verified by inspection (see `76632f8`).

**Alternatives considered**:

- **Patch the vendored file to remove the `typeof module` check**: rejected — modifies a
  third-party vendored file, creating an ongoing diff to maintain against upstream updates, for a
  warning that's already a documented false positive.
