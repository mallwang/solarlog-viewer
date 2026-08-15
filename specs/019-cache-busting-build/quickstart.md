# Quickstart: Validating the Cache-Busting Production Build

> Retroactive: these steps validate the already-shipped behavior against spec.md's acceptance
> scenarios and success criteria — run them to confirm the feature still works as documented, not
> to build it for the first time.

## Prerequisites

- Repository checked out with git history intact (`git rev-parse --short HEAD` must succeed).
- `npm install` run at least once (installs `esbuild` and existing devDependencies).

## 1. Verify the build produces a hashed artifact (FR-001, FR-002, FR-003)

```bash
npm run build
```

**Expected**: exits 0, prints `Built dist/ (buildId <sha>)`. Then:

```bash
ls dist/js dist/css
grep -o 'main-[a-f0-9]*\.js' dist/index.html
grep -o 'styles-[a-f0-9]*\.css' dist/index.html
```

**Expected**: `dist/js/main-<sha>.js` and `dist/css/styles-<sha>.css` exist, and `dist/index.html`
references those exact filenames (same `<sha>` as the build's printed `buildId`).

## 2. Verify rebuilding after a change produces a new filename (User Story 1, SC-001)

```bash
git commit --allow-empty -m "test: trigger new buildId"
npm run build
grep -o 'main-[a-f0-9]*\.js' dist/index.html
```

**Expected**: the referenced filename's hash changed from step 1 — a browser that cached the old
`main-<old-sha>.js` will fetch the new URL on next load rather than reusing the stale file.

## 3. Verify runtime-resolved assets are query-string versioned (User Story 3, FR-004)

```bash
grep -o "url([^)]*vendor[^)]*)" dist/css/styles-*.css | head -3
```

**Expected**: every `/vendor/*.svg` URL inside the built CSS carries a `?v=<sha>` suffix matching
the current build.

(i18n fetch versioning lives in `web/js/i18n.js`'s runtime code, not a static file — verify via the
`build.test.js` unit tests, or by inspecting a network request in the browser against `dist/`.)

## 4. Verify device data directories are never touched (FR-007, Edge Cases)

```bash
readlink dist/data dist/hist
```

**Expected**: both resolve to `../web/data` and `../web/hist` respectively — symlinks, not
copied directory trees. Confirm no files under `web/data/`/`web/hist/` show as modified:

```bash
git status --porcelain web/data web/hist
```

**Expected**: no output (clean).

## 5. Verify apexcharts isn't duplicated (Edge Cases, FR-005)

```bash
find dist/vendor -iname "apexcharts*"
grep -c "apexcharts" dist/js/main-*.js
```

**Expected**: no `apexcharts` directory under `dist/vendor/`; the string appears inside the bundled
`main-<sha>.js` (it was pulled in via the static import in `chart-factory.js`).

## 6. Run the build's own unit tests

```bash
node --test scripts/build.test.js
```

**Expected**: all tests pass — covers `rewriteIndexHtml`, `appendVersionToVendorUrls`, and
`bundleCss` against inline fixture strings.

## 7. Verify the FTP sync workflow builds before diffing (User Story 2, FR-006)

See the `sync-ftp` skill (`.claude/skills/sync-ftp/SKILL.md`) for the full diff/apply workflow;
confirm its documented steps run `npm run build` before comparing against the remote server, and
that it diffs/uploads `dist/`, not `web/`.

## Cleanup

```bash
git reset --hard HEAD~1   # drop the empty test commit from step 2, if created
rm -rf dist/               # dist/ is gitignored; safe to delete and regenerate anytime
```
