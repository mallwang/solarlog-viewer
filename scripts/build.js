/**
 * build.js — produce `dist/`, the FTP deploy artifact, from `web/`.
 *
 * The problem this solves: `web/` used to be FTP'd to the SolarLog webserver byte-for-byte, so
 * `js/main.js`/`css/app.css` etc. kept their exact filenames across deploys and browsers cached
 * them indefinitely — customers kept seeing stale versions after an update. `web/index.html` is
 * already a single-page app (client-side routing via `web/js/router.js`), so no architecture
 * change is needed, only a build step that gives changed assets a new, guaranteed-uncached URL
 * on every deploy.
 *
 * Strategy: bundle+minify the whole JS import graph into one `js/main-<buildId>.js` and the three
 * stylesheets into one `css/styles-<buildId>.css` (esbuild), where `buildId` is the current git
 * short SHA. Everything else is copied through unchanged but cache-busted with a `?v=<buildId>`
 * query string instead of a renamed file, because those paths aren't build-time-known filenames:
 * `i18n/*.json` is fetched at runtime by language code (`web/js/i18n.js`), `img/plant/*.jpg` are
 * operator drop-in files (`PLANT_PHOTOS` in `web/js/config.js`), and `vendor/*.svg` is referenced
 * from `app.css` via **absolute** `url('/vendor/...')` paths that esbuild's bundler would
 * misresolve as literal filesystem paths rather than web-root-relative ones — so those get a
 * plain text-replace instead of esbuild's asset pipeline.
 *
 * `vendor/apexcharts/apexcharts.esm.js` needs no separate handling at all: it's a static
 * `import` in `web/js/charts/chart-factory.js`, so esbuild pulls it straight into the JS bundle.
 *
 * `dist/` no longer includes a `data`/`hist` directory at all — those trees are the SolarLog
 * device's own live/frozen data mirror, live on the device itself and out of scope for this
 * project entirely (see the doc comment atop `ftp-sync.js`).
 *
 * Usage:
 *   npm run build
 *
 * @module build
 */

import { build as esbuildBuild, transform } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_DIR = resolve('web');
const DIST_DIR = resolve('dist');

// ---------------------------------------------------------------------------
// Pure logic (unit-tested in build.test.js)
// ---------------------------------------------------------------------------

/**
 * Rewrite `web/index.html` for production: collapse the three `<link rel="stylesheet">` tags
 * into one hashed `styles-<buildId>.css`, point the module `<script>` at `main-<buildId>.js`, and
 * append `?v=<buildId>` to every `favicon-v2.ico` reference (the `<link rel="icon">` and the
 * header logo `<img>`).
 *
 * @param {string} html - raw contents of `web/index.html`
 * @param {string} buildId - short identifier (git short SHA) unique to this build
 * @returns {string} rewritten HTML
 */
export function rewriteIndexHtml(html, buildId) {
  const stylesheetBlockRe =
    /([ \t]*)<link rel="stylesheet" href="css\/tokens\.css" \/>\r?\n[ \t]*<link rel="stylesheet" href="css\/app\.css" \/>\r?\n[ \t]*<link rel="stylesheet" href="css\/tailwind\.generated\.css" \/>/;
  if (!stylesheetBlockRe.test(html)) {
    throw new Error(
      'rewriteIndexHtml: could not find the expected tokens/app/tailwind stylesheet <link> block',
    );
  }
  let out = html.replace(
    stylesheetBlockRe,
    (_match, indent) => `${indent}<link rel="stylesheet" href="css/styles-${buildId}.css" />`,
  );

  const scriptTag = '<script type="module" src="js/main.js"></script>';
  if (!out.includes(scriptTag)) {
    throw new Error('rewriteIndexHtml: could not find the expected js/main.js <script> tag');
  }
  out = out.replace(scriptTag, `<script type="module" src="js/main-${buildId}.js"></script>`);

  return out.replaceAll('favicon-v2.ico"', `favicon-v2.ico?v=${buildId}"`);
}

/**
 * Append a `?v=<buildId>` cache-busting query string to every `/vendor/*.svg` reference inside a
 * CSS `url(...)`. Absolute (web-root-relative) paths, so this is a text-replace rather than
 * something esbuild's bundler can resolve as a filesystem asset.
 *
 * @param {string} css - CSS source
 * @param {string} buildId - short identifier (git short SHA) unique to this build
 * @returns {string} CSS with vendor svg urls versioned
 */
export function appendVersionToVendorUrls(css, buildId) {
  return css.replace(
    /url\((['"]?)\/vendor\/([^'")]+)\1\)/g,
    (_match, quote, path) => `url(${quote}/vendor/${path}?v=${buildId}${quote})`,
  );
}

/**
 * Concatenate the three production stylesheets in load order and minify the result.
 *
 * @param {string} tokensCss - `web/css/tokens.css` contents
 * @param {string} appCss - `web/css/app.css` contents
 * @param {string} tailwindCss - `web/css/tailwind.generated.css` contents
 * @returns {Promise<string>} minified, combined CSS
 */
export async function bundleCss(tokensCss, appCss, tailwindCss) {
  const combined = [tokensCss, appCss, tailwindCss].join('\n');
  const result = await transform(combined, { loader: 'css', minify: true });
  return result.code;
}

// ---------------------------------------------------------------------------
// Build orchestration
// ---------------------------------------------------------------------------

/**
 * @returns {string} the current commit's short SHA, used as this build's cache-busting id
 */
function getBuildId() {
  return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
}

/**
 * @returns {Promise<void>}
 */
async function main() {
  execFileSync('npm', ['run', 'build:css'], { stdio: 'inherit' });
  const buildId = getBuildId();

  rmSync(DIST_DIR, { recursive: true, force: true });
  mkdirSync(join(DIST_DIR, 'js'), { recursive: true });
  mkdirSync(join(DIST_DIR, 'css'), { recursive: true });

  await esbuildBuild({
    entryPoints: [join(WEB_DIR, 'js', 'main.js')],
    bundle: true,
    minify: true,
    format: 'esm',
    outfile: join(DIST_DIR, 'js', `main-${buildId}.js`),
    define: { __BUILD_ID__: JSON.stringify(buildId) },
    logOverride: {
      // vendor/apexcharts/apexcharts.esm.js is a UMD bundle that feature-detects its environment
      // via `typeof module !== 'undefined'` — never dereferenced, so it's safe in a browser
      // bundle (where `module` is undefined) despite esbuild's static-analysis warning here.
      'commonjs-variable-in-esm': 'silent',
    },
  });

  const tokensCss = readFileSync(join(WEB_DIR, 'css', 'tokens.css'), 'utf8');
  const appCss = readFileSync(join(WEB_DIR, 'css', 'app.css'), 'utf8');
  const tailwindCss = readFileSync(join(WEB_DIR, 'css', 'tailwind.generated.css'), 'utf8');
  const css = appendVersionToVendorUrls(await bundleCss(tokensCss, appCss, tailwindCss), buildId);
  writeFileSync(join(DIST_DIR, 'css', `styles-${buildId}.css`), css);

  const indexHtml = readFileSync(join(WEB_DIR, 'index.html'), 'utf8');
  writeFileSync(join(DIST_DIR, 'index.html'), rewriteIndexHtml(indexHtml, buildId));

  cpSync(join(WEB_DIR, 'i18n'), join(DIST_DIR, 'i18n'), { recursive: true });
  cpSync(join(WEB_DIR, 'img'), join(DIST_DIR, 'img'), { recursive: true });
  cpSync(join(WEB_DIR, 'vendor'), join(DIST_DIR, 'vendor'), {
    recursive: true,
    // apexcharts is bundled into main.js via a static import (chart-factory.js) — shipping the
    // vendored UMD build separately too would just be dead weight.
    filter: (src) => !src.includes(join('vendor', 'apexcharts')),
  });
  cpSync(join(WEB_DIR, 'favicon-v2.ico'), join(DIST_DIR, 'favicon-v2.ico'));

  console.log(`Built dist/ (buildId ${buildId})`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (err) {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
  }
}
