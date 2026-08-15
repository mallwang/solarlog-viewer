/**
 * Unit tests for build.js's pure logic functions. Inline fixture strings only — no real file I/O.
 * @module build.test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewriteIndexHtml, appendVersionToVendorUrls, bundleCss } from './build.js';

const SAMPLE_HTML = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="css/tokens.css" />
    <link rel="stylesheet" href="css/app.css" />
    <link rel="stylesheet" href="css/tailwind.generated.css" />
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
  </head>
  <body>
    <img class="app-header__logo" src="favicon.ico" alt="" />
    <script type="module" src="js/main.js"></script>
  </body>
</html>
`;

test('rewriteIndexHtml replaces the three stylesheet links with one hashed link', () => {
  const out = rewriteIndexHtml(SAMPLE_HTML, 'abc123');
  assert.match(out, /<link rel="stylesheet" href="css\/styles-abc123\.css" \/>/);
  assert.doesNotMatch(out, /css\/tokens\.css/);
  assert.doesNotMatch(out, /css\/app\.css/);
  assert.doesNotMatch(out, /css\/tailwind\.generated\.css/);
});

test('rewriteIndexHtml points the module script at the hashed bundle', () => {
  const out = rewriteIndexHtml(SAMPLE_HTML, 'abc123');
  assert.match(out, /<script type="module" src="js\/main-abc123\.js"><\/script>/);
});

test('rewriteIndexHtml appends the build id to every favicon reference', () => {
  const out = rewriteIndexHtml(SAMPLE_HTML, 'abc123');
  assert.match(out, /href="favicon\.ico\?v=abc123"/);
  assert.match(out, /src="favicon\.ico\?v=abc123"/);
});

test('rewriteIndexHtml throws when the stylesheet block is missing (structure changed upstream)', () => {
  assert.throws(() => rewriteIndexHtml('<html></html>', 'abc123'), /stylesheet/);
});

test('rewriteIndexHtml throws when the main.js script tag is missing', () => {
  const html = SAMPLE_HTML.replace('<script type="module" src="js/main.js"></script>', '');
  assert.throws(() => rewriteIndexHtml(html, 'abc123'), /main\.js/);
});

test('appendVersionToVendorUrls appends ?v= to single-quoted vendor svg urls', () => {
  const css = `.bird { background-image: url('/vendor/bird-cells.svg'); }`;
  const out = appendVersionToVendorUrls(css, 'abc123');
  assert.equal(out, `.bird { background-image: url('/vendor/bird-cells.svg?v=abc123'); }`);
});

test('appendVersionToVendorUrls handles multiple occurrences and double quotes', () => {
  const css = `
    .a { background-image: url("/vendor/airplane-cells.svg"); }
    .b { background-image: url('/vendor/balloon-cells.svg'); }
  `;
  const out = appendVersionToVendorUrls(css, 'zzz9');
  assert.match(out, /url\("\/vendor\/airplane-cells\.svg\?v=zzz9"\)/);
  assert.match(out, /url\('\/vendor\/balloon-cells\.svg\?v=zzz9'\)/);
});

test('appendVersionToVendorUrls leaves non-vendor urls untouched', () => {
  const css = `.x { background: url(data:image/svg+xml;base64,AAAA); }`;
  assert.equal(appendVersionToVendorUrls(css, 'abc123'), css);
});

test('bundleCss concatenates and minifies tokens, app, and tailwind css in order', async () => {
  const tokens = `:root { --gap: 4px; }`;
  const app = `.foo {\n  color: red;\n}`;
  const tailwind = `.bar { color: blue; }`;
  const out = await bundleCss(tokens, app, tailwind);
  assert.match(out, /--gap: ?4px/);
  assert.match(out, /\.foo\{color:red\}/);
  assert.match(out, /\.bar\{color:(blue|#00f)\}/);
  // order preserved: tokens before app before tailwind
  assert.ok(out.indexOf('--gap') < out.indexOf('.foo'), 'tokens should precede app');
  assert.ok(out.indexOf('.foo') < out.indexOf('.bar'), 'app should precede tailwind');
});
