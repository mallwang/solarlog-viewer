# Contract: `npm run build` (production build CLI)

This project has no network API; the interface this feature exposes is a CLI contract for
developers/operators (and the `sync-ftp` skill, which invokes it programmatically).

## Command

```bash
npm run build
```

Internally invokes `npm run build:css` (existing Tailwind compilation step) followed by
`node scripts/build.js`.

## Preconditions

- Run from the repository root, inside a git checkout (the build reads `HEAD`'s short SHA via
  `git rev-parse --short HEAD` — it fails if not inside a git working tree).
- `web/index.html` contains the exact `<link rel="stylesheet">` block (tokens/app/tailwind, in that
  order) and the `<script type="module" src="js/main.js">` tag the rewrite logic expects.

## Behavior

1. Runs `npm run build:css` (Tailwind compilation into `web/css/tailwind.generated.css`).
2. Computes `buildId` from `git rev-parse --short HEAD`.
3. Deletes any existing `dist/` and recreates `dist/js/`, `dist/css/`.
4. Bundles+minifies `web/js/main.js`'s import graph into `dist/js/main-<buildId>.js`.
5. Concatenates+minifies `tokens.css` + `app.css` + `tailwind.generated.css` into
   `dist/css/styles-<buildId>.css`, with `/vendor/*.svg` URLs query-string versioned.
6. Writes `dist/index.html` — a rewritten copy of `web/index.html` referencing the two files
   above and a versioned `favicon-v2.ico`.
7. Copies `web/i18n/`, `web/img/`, `web/vendor/` (excluding `vendor/apexcharts`), and
   `web/favicon-v2.ico` through to `dist/` unchanged.
8. Symlinks `dist/data → ../web/data` and `dist/hist → ../web/hist`.

## Postconditions / Output contract

- **Success**: exits 0, prints `Built dist/ (buildId <sha>)`, and `dist/` is a complete,
  self-contained deployable tree (aside from the `data`/`hist` symlinks, which resolve relative to
  the checkout).
- **Failure**: exits non-zero with `Fatal: <message>` on stderr — e.g. if `web/index.html`'s
  expected stylesheet block or script tag isn't found (see data-model.md's validation rules). The
  build MUST NOT leave a partially-written, silently-broken `dist/` that a subsequent deploy step
  could mistake for a valid artifact — a hard failure here should block the calling workflow
  (`sync-ftp`) from proceeding to diff/upload.

## Consumers

- **`scripts/ftp-sync.js`**: runs this build before diffing/uploading, per the `sync-ftp` skill's
  updated workflow — treats `dist/` as its sync source, never `web/` directly.
- **Developers**: run manually to inspect the production artifact locally before a deploy; `npm
start` (the dev server) does **not** depend on this build — it continues to serve `web/`
  directly, unbundled.
