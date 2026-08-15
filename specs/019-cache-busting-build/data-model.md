# Phase 1 Data Model: Cache-Busting Production Build

This feature has no persistent application data model (no new entity is stored, queried, or
mutated at runtime by end users). The "entities" below are build-time/deploy-time concepts,
included because the spec's Key Entities section references them and later planning artifacts
benefit from a concrete shape.

## Build Artifact (`dist/`)

The generated, deployable output tree produced by `scripts/build.js` from `web/` on each build.

| Field                                           | Type                   | Description                                                                                                              |
| ----------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `buildId`                                       | string (git short SHA) | Identifier shared by every hashed filename/query-string in one build; see Build/Version Identifier below.                |
| `js/main-<buildId>.js`                          | file                   | Single bundled, minified ESM output of `web/js/main.js`'s full import graph.                                             |
| `css/styles-<buildId>.css`                      | file                   | Concatenated, minified output of `tokens.css` + `app.css` + `tailwind.generated.css`.                                    |
| `index.html`                                    | file                   | Copy of `web/index.html`, rewritten to reference the two hashed files above and to version `favicon-v2.ico`.             |
| `i18n/`, `img/`, `vendor/` (minus `apexcharts`) | directory              | Copied through unchanged from `web/`; references to their contents are query-string versioned, not the files themselves. |
| `data`, `hist`                                  | symlink                | Relative symlinks to `web/data`, `web/hist` — never copied, never transformed.                                           |
| `favicon-v2.ico`                                | file                   | Copied through unchanged; referenced with `?v=<buildId>`.                                                                |

**Validation rules** (enforced by `scripts/build.js`, see FR-009):

- `rewriteIndexHtml` throws if the expected `<link rel="stylesheet">` block or `<script
type="module" src="js/main.js">` tag isn't found in `web/index.html` — a structural change to
  `web/index.html` that the rewrite logic doesn't anticipate MUST fail the build loudly rather than
  silently produce an unversioned or broken `dist/index.html`.

**State transitions**: None — `dist/` is fully regenerated (`rmSync` then rebuilt) on every
`npm run build` invocation; there is no incremental/partial-update state to model.

## Build/Version Identifier (`buildId`)

A short string (the current commit's git short SHA, via `git rev-parse --short HEAD`) that ties
every cache-busted filename or reference in one build together.

| Field      | Type   | Description                                                                                                  |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| value      | string | e.g. `a1b2c3d` — 7-character git short SHA of `HEAD` at build time.                                          |
| scope      | —      | One value per build invocation; every hashed filename and `?v=` query string in that build shares it.        |
| derivation | —      | Computed, never hand-specified — see research.md's "git short SHA as the build/version identifier" decision. |

## Device Data Directories (`web/data/`, `web/hist/`)

Referenced here only to make the boundary explicit for future contributors to this feature area —
not a build-owned entity.

| Field                | Description                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner                | The SolarLog device's FTP push (constitution Principle I) — not this build, not any script in this feature.                                               |
| Role in this feature | Symlinked through into `dist/data`/`dist/hist` so the deployed site can still read them; never read, copied, or transformed by `scripts/build.js` itself. |
