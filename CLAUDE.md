<!-- SPECKIT START -->

For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

## Local Development Server

Always use `npm start` to serve the site — it uses `browser-sync` with hot-reload on HTML/CSS/JS changes (SolarLog data files excluded). Copy the URL from the terminal into your browser; WSL2 cannot auto-open a browser. **Do not use the VS Code built-in preview** — it returns 404s for the frameset.

## Debugging with Playwright

When the site behaves unexpectedly (wrong view, blank page, redirect), use Playwright to diagnose before guessing:

```js
// Capture all console errors and page errors
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(err.message));

await page.goto('/visu.html?mode=1&offset=0');
await page.waitForLoadState('networkidle');

// Check the URL wasn't redirected and stripped of query params
console.log('final URL:', page.url());
// Sample rendered text to verify which view is active
console.log('body:', (await page.locator('body').innerText()).substring(0, 300));
console.log('errors:', errors);
```

Run with: `npx playwright test --reporter=line`

The test suite in `tests/e2e/navigation.spec.js` covers all four modes and frameset structure — run it after any change to navigation, `serve.json`, or `visu.html`.
