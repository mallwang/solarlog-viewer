<!-- SPECKIT START -->

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at specs/020-explanatory-tooltips/plan.md
<!-- SPECKIT END -->

## Local Development Server

Always use `npm start` to serve the site — it uses `browser-sync` with hot-reload on HTML/CSS/JS changes (SolarLog data files excluded). Copy the URL from the terminal into your browser; WSL2 cannot auto-open a browser. **Do not use the VS Code built-in preview** — it returns 404s for the frameset.

`bs-config.cjs` proxies `/data/*` and `/hist/*` requests to the live device (`https://wolfsbach.synology.me`) instead of serving from disk — `web/data/` and `web/hist/` no longer exist in this repo's working tree at all. See the "Dev server" section in `README.md` for details. Filesystem-reading scripts (backfill, `gap:detect`, sqlite sync) are **not** covered by this proxy and need those directories manually, temporarily repopulated before they'll do anything — `scripts/ftp-sync.js`/`sync-ftp` no longer fetch `data`/`hist` either (out of scope, app assets only now); see the "Validation & Aggregation Scripts" warning in `README.md`.

## Debugging with Playwright

When the site behaves unexpectedly (wrong view, blank page, redirect), use Playwright to diagnose before guessing:

```js
// Capture all console errors and page errors
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(err.message));

await page.goto('/index.html#/month/2026/06');
await page.waitForLoadState('networkidle');

// Check the URL wasn't redirected and stripped of the hash route
console.log('final URL:', page.url());
// Sample rendered text to verify which view is active
console.log('body:', (await page.locator('body').innerText()).substring(0, 300));
console.log('errors:', errors);
```

Run with: `npx playwright test --reporter=line`

`tests/e2e/detail-views.spec.js` and friends cover the day/month/year/total hash-routed views — run them after any change to routing or those views.

## Helper scripts

All helper scripts must be **ESM JavaScript** (`scripts/*.js`). Do not create or extend Python scripts. New scripts require a co-located `*.test.js` file using `node:test` and JSDoc on every exported function.

### Test-driven development

Write tests in `scripts/*.test.js` **before** implementing the script. Export every logic function so tests can import them directly without hitting the filesystem. Use inline fixture strings as test data — no real file I/O in unit tests. Only wire the CLI entry point (`if (process.argv[1] === ...)`) after all tests pass.

Run script tests with: `node --test scripts/backfill-min-day.test.js`

### Linting (mandatory before finishing)

Fix all ESLint errors and SonarLint warnings before considering a script done. Run:

```bash
npx eslint scripts/your-script.js scripts/your-script.test.js
```

Zero errors required. SonarLint issues visible in the IDE must also be resolved before finishing — they surface real problems even when ESLint passes. Common ones to watch for:

- Prefer `Number.parseInt` / `Number.parseFloat` / `Number.isNaN` over the global equivalents (`S7773`)
- Missing assertions in test cases (`S2699`) — only suppress if the test framework is not recognised by SonarLint (e.g. `node:test`)
