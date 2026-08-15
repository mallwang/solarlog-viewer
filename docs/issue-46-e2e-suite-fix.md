# Task: fix the 27 pre-existing Playwright e2e failures (issue #46)

Tracking doc for [github.com/mallwang/solarlog-viewer#46](https://github.com/mallwang/solarlog-viewer/issues/46).
Written up because a prior agent session did real, mostly-good work on this but was
interrupted before finishing, and left it **stashed** rather than applied — see
[Current state](#current-state) before doing anything else.

## Root cause

Not 27 independent bugs. The app went through a series of view/route redesigns (specs
013–020) that the e2e suite never caught up with:

- The `dashboard` view was renamed to `welcome` (`web/js/router.js`, `web/js/main.js`
  `NAV_ITEMS`) — there is no `view: 'dashboard'` route any more. `main.js` has a comment noting
  the old dashboard nav item is "temporarily removed... pending a redesign".
- The `compare` view/route was removed entirely — no `#/compare` route, no
  `compare-view.js` anywhere in the tree.
- An `events` view/route was added (`#/events`).
- i18n nav labels changed. Current `web/i18n/de.json` `nav` block:
  `{dashboard: "Übersicht", dayView: "Tagesertrag", monthView: "Monatserträge",
yearView: "Jahreserträge", totalView: "Gesamterträge", welcomeView: "Anlageninfo",
eventsView: "Ereignisse", ...}`. Several stale tests expect old labels
  ("Tageswerte", "Monatswerte", "Jahreswerte", "Gesamtübersicht", "Jahresvergleich") that
  don't exist anywhere in the app any more.
- A couple of failures are **not** stale-test issues but small real gaps found while fixing
  the tests — see [Real app-code fixes](#real-app-code-fixes-not-just-stale-tests) below.

Confirmed concretely early on: running `npx playwright test tests/e2e/dashboard-nav.spec.js`
shows the test expects a 6-item nav with a `compare` route and old German labels, while the
actual rendered `#app-nav-list` has 6 items too (coincidentally the same count) but with
`welcome/day/month/year/total/events` and current i18n labels.

## Current state

**The working tree is clean (`git status` shows nothing) but there is unapplied work sitting
in the stash:**

```
$ git stash list
stash@{0}: 7aab437 chore(license): add MIT license and finalize repo/spec housekeeping (#47)
```

A background agent (spawned to fix this issue) made real edits across 13 files, then stashed
them mid-task to A/B-test whether some remaining flakiness was pre-existing on unmodified
`main` — and was killed (by me, on the user's request, because it had spent ~1.5h/150+ tool
calls without visible progress and kept yielding instead of driving to completion) before it
popped the stash back. **The edits themselves looked substantive and well-reasoned**, not
abandoned guesswork — see the summary below — but they were **never confirmed against a full
clean `npx playwright test` run**, so treat them as a draft to review and verify, not as
finished.

**Do this first:**

```sh
git stash show -p stash@{0}   # review in full before applying
git stash apply stash@{0}     # (or `pop` once you've reviewed and are keeping it)
```

### Files touched in the stash

| File                                         | What changed                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `specs/011-realistic-bird-sprites/tasks.md`  | T013 note updated to claim the full suite now exits 0 (unverified — see above)                                                                                                                                                                                                                                                                           |
| `specs/014-chart-data-table-toggle/tasks.md` | T026 note updated similarly                                                                                                                                                                                                                                                                                                                              |
| `tests/e2e/dashboard-charts.spec.js`         | Dropped `compare` from the chart-mode list, added `welcome`                                                                                                                                                                                                                                                                                              |
| `tests/e2e/dashboard-consistency.spec.js`    | `dashboard`→`welcome`, `compare`→`events` in the views table                                                                                                                                                                                                                                                                                             |
| `tests/e2e/dashboard-dark-mode.spec.js`      | Same view-table swap; reworked the contrast check to read `--color-bg-app`/`--color-text` tokens instead of `body`'s computed background (the sky-gradient backdrop resets `body`'s background-color longhand to transparent, per its own inline comment — worth double-checking this reasoning)                                                         |
| `tests/e2e/dashboard-nav.spec.js`            | View table updated to current routes/labels                                                                                                                                                                                                                                                                                                              |
| `tests/e2e/dashboard-status.spec.js`         | Points at the info-panel's `[data-role="production"]`/`[data-role="pulse"]` markup instead of the removed `.widget-grid`/`.status-icon`                                                                                                                                                                                                                  |
| `tests/e2e/dashboard.spec.js`                | Points at the welcome page's stats panel instead of the dead `dashboard.js` widget grid; refetch interval assertion changed from 5 min to 10 min (matching `DATA_REFRESH_INTERVAL_MS` in `config.js`)                                                                                                                                                    |
| `tests/e2e/detail-views.spec.js`             | Moved the "all years, no drops" assertion from `/#/year/2019` to `/#/total` (single-year view only ever renders one year's 12 months); deleted the compare-view test entirely (feature removed); language-switching tests now force `SHOW_LANGUAGE_SWITCHER` on via a route patch (it's `false` by default per `config.js`) and use current heading text |
| `tests/e2e/sky-birds.spec.js`                | Non-bird flying objects are asserted present rather than absent — per its own comment, "quietly disabled" was true when the test was written but the renderers were since filled in for every kind, and `018-day-night-sky/spec.md` FR-003 now documents them as intentionally always rendering                                                          |
| `tests/e2e/transparency-mode.spec.js`        | Rewrote `readStyles()` to read each style off its own auto-waiting Locator instead of one batched `page.evaluate`, and re-targeted `.app-header` instead of `#app-nav` for the opaque-background check                                                                                                                                                   |
| `web/js/views/events-view.js`                | **App code**, not a test — see below                                                                                                                                                                                                                                                                                                                     |
| `web/js/views/welcome-view.js`               | **App code**, not a test — see below                                                                                                                                                                                                                                                                                                                     |

### Real app-code fixes (not just stale tests)

The stash also touches two _application_ files, both adding a `.view-header`/`.view-title`
block that was apparently missing:

- `web/js/views/events-view.js`
- `web/js/views/welcome-view.js`

Worth a closer look before trusting these: confirm they match the `.view-header` pattern
every other view already uses (check e.g. `web/js/views/total-view.js`), and figure out
whether a test in the stash's own changes newly _requires_ this markup (in which case: was
the missing markup a genuine pre-existing bug, or did the agent add markup to satisfy a test
it wrote rather than the other way around?). Either reading is plausible — verify.

## Remaining steps

1. Review the stash (`git stash show -p stash@{0}`), decide what to keep, apply it.
2. Fix/verify one spec file at a time — `npx playwright test tests/e2e/<file>.spec.js
--reporter=line` — rather than repeatedly re-running the whole ~211-test suite per
   iteration (this is what stalled the previous attempt).
3. Once every file is individually green, run the full suite once:
   `npx playwright test --reporter=line` — must exit 0.
4. Re-run `npm run test:scripts` and `npx eslint --no-error-on-unmatched-pattern web tests` —
   both currently pass cleanly on `main`; make sure they still do.
5. Bookkeeping from the issue:
   - `specs/011-realistic-bird-sprites/tasks.md` → confirm T013 accurately reflects a verified
     (not just claimed) green run.
   - `specs/014-chart-data-table-toggle/tasks.md` → confirm T026/T027 likewise.
   - Both specs' `spec.md` **already say `Status: Done`** — no flip needed, just make sure the
     T013/T026/T027 notes inside them are honest about verification status.
6. Do not commit/push/branch without the user's go-ahead — leave changes in the working tree
   for review first.

## Environment notes

- Dev server: `npm start` (browser-sync on `:3000`), proxies `/data` and `/hist` to the live
  device (`https://wolfsbach.synology.me`) — network access confirmed working. Playwright's
  `webServer` config (`reuseExistingServer: true`) reuses an already-running instance.
- See root `CLAUDE.md` for broader project conventions.
