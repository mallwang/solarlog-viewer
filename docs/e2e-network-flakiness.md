# Task: investigate and fix intermittent Playwright timeouts against the live device proxy

**Status: mitigated (2026-08-15).** See "Fix applied" below. Not filed as a GitHub issue —
write-up for whoever (agent or human) picks this up next if it resurfaces.
Related but distinct from [#46](https://github.com/mallwang/solarlog-viewer/issues/46) (stale
routes/labels, now fixed) — this is a separate problem found while verifying #46's fix.

## Symptom

A full `npx playwright test --reporter=line` run is not reliably green. Across 5 consecutive
full-suite runs (default parallelism, `--workers=4`, `--workers=2`, and fully serial
`--workers=1`), each run failed somewhere between 2 and 6 tests — but:

- **A different random set of tests failed each time** — observed failures included, at various
  points, `dashboard-nav.spec.js`, `dashboard-responsive.spec.js`, `dashboard.spec.js`,
  `detail-views.spec.js`, `events-view.spec.js`, `explanatory-tooltips.spec.js`,
  `parent-nav.spec.js`, `transparency-mode.spec.js`, and `welcome-page.spec.js` — no consistent
  culprit file or test.
- **Every failing test passed when that one spec file was re-run in isolation**
  (`npx playwright test tests/e2e/<file>.spec.js --reporter=line`).
- **It still happened at `--workers=1`** (fully serial, one page open at a time) — ruling out
  Playwright workers contending with each other for local CPU/browser resources.

Every failure has the identical shape:

```
Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
> await page.waitForLoadState('networkidle');
```

## Root cause (hypothesis, not yet confirmed)

Per `bs-config.cjs` and root `CLAUDE.md`: the dev server does **not** serve `/data/*` and
`/hist/*` from local files — it proxies those requests over the real internet to the live
SolarLog device at `https://wolfsbach.synology.me`. Most e2e tests load a view and then
`await page.waitForLoadState('networkidle')`, which only resolves once there have been no
network requests for 500ms straight.

Because those requests are real round-trips to a physical device outside this machine (and some
views — the info panel, weather widget — also poll periodically), `networkidle` is at the mercy
of that device's live response latency at the exact moment each test runs, plus whatever a
concurrent poll happens to do. Occasionally that combination doesn't settle within the 30s
default test timeout. This would explain: the random/rotating victim (it's about which request
was in flight when the poll landed, not a specific test's code), why it survives serial
execution (it's not local resource contention), and why the same test is fine moments later run
alone (the network conditions at that instant were fine).

**This is a hypothesis, not a confirmed diagnosis** — nobody has yet, e.g., captured HAR/network
timing during a failure to see what request(s) were actually still in flight, or confirmed the
live device's typical response time distribution.

## Suggested next steps

1. Reproduce with request logging: run a full suite with `DEBUG=pw:api` or a custom
   `page.on('request'/'requestfinished')` logger wired into a couple of the historically-flaky
   spec files, and capture what's still in flight when a `networkidle` timeout fires.
2. Consider whether `waitForLoadState('networkidle')` is even the right wait condition for tests
   against a live-polling proxy — it's discouraged upstream by the Playwright team for exactly
   this class of flakiness (a page can poll forever and never truly go idle). Waiting for a
   specific rendered element/selector instead of `networkidle` may be both faster and more
   robust — but that's a broad rewrite across ~30 spec files, so weigh cost against benefit here.
3. Alternatively (probably cheaper first step): raise the per-test timeout for specs that hit
   the live proxy, or add a small number of automatic retries in `playwright.config.js`
   (`retries: 1` or 2) scoped to local/dev runs — flakiness that clears on retry is consistent
   with the live-network-latency hypothesis above and would unblock a reliable "exit 0" without
   masking a real bug (a genuine regression would still fail on retry too).
4. If reproducing this needs the live device and it's slow/unreliable to depend on for CI later,
   consider whether `/data`/`/hist` should be mockable for e2e runs (a local fixture server) even
   though `bs-config.cjs` intentionally proxies live for day-to-day dev use — that's a bigger
   architectural call, flag it to the user rather than deciding unilaterally.
5. Once a fix is in place, verify it by running the full suite multiple times in a row (not just
   once) — a single green run does not disprove flakiness this intermittent; the investigation
   in this doc needed 5 runs to characterize the pattern.

## Fix applied

Went with the "cheap mitigation" option from the next-steps list above rather than the broader
`networkidle` → selector-wait rewrite. In [`playwright.config.js`](../playwright.config.js):

- `timeout: 45_000` (up from Playwright's 30s default) — gives `waitForLoadState('networkidle')`
  more room to absorb live-device latency before the test itself times out.
- `retries: 2` — a test that trips on live-network jitter gets re-run automatically; a genuine
  regression still fails on retry too, so this doesn't mask real bugs.

### Verification

Ran the full suite 3 times in a row after the change (`npx playwright test --reporter=line`):

1. 211 passed, no retries triggered (59.6s)
2. 211 passed, no retries triggered (1.1m)
3. 211 passed, **but 5 tests were flaky** — failed on their first attempt with the same
   `networkidle` timeout shape described above, then passed on retry — final exit was still green.

Run 3 both reproduces the original hypothesis (live-proxy network jitter causes intermittent
`networkidle` timeouts, different test each time) and confirms the mitigation works as intended:
the flaky tests no longer fail the suite.

### Still open

The root cause (live-device latency vs. `networkidle`) is unchanged and step 1 (HAR/request
logging to fully confirm it) was not done — this fix treats the symptom, which was judged
sufficient for now per the "cheap first" plan. Step 2 (rewrite ~30 specs to wait on selectors
instead of `networkidle`) and step 4 (mockable `/data`/`/hist` fixtures for e2e) remain
unimplemented if the 2-retry budget ever proves insufficient or CI is added later.

## Evidence trail

Full run outputs (5 runs: default/4/2/1 workers) were reviewed in the session that produced this
doc (2026-08-15); see conversation history if that level of raw detail is needed again. Not
saved as artifacts here to avoid rot — the reproduction steps above are enough to regenerate
equivalent evidence.

## Environment notes

- Dev server: `npm start` (browser-sync on `:3000`), proxies `/data` and `/hist` to the live
  device (`https://wolfsbach.synology.me`). Playwright's `webServer` config
  (`reuseExistingServer: true`) reuses an already-running instance rather than starting its own.
- See root `CLAUDE.md` for broader project conventions.
