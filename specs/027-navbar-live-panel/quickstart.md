# Quickstart: Validating the Live Navbar Watt Reading

## Prerequisites

- `npm install` done once.
- Dev server running: `npm start` (browser-sync; copy the printed URL into your browser — see
  project `CLAUDE.md`, "Local Development Server"). `web/data/`/`web/hist/` don't need to exist
  locally — this feature's endpoint is fetched by absolute URL and isn't covered by
  `bs-config.cjs`'s `/data`/`/hist` proxy either way (research.md §1), so no extra local setup is
  needed to see the live panel attempt a real fetch against the live device.

## Manual validation (User Story 1 — see true current production)

1. Load any page; watch the navbar's live panel value.
2. Compare it against a direct browser tab open on
   `https://wolfsbach.synology.me/live/index.php` — the panel's wattage should match that
   response's top-level `watt`.
3. Wait one `LIVE_REFRESH_INTERVAL_MS` interval (1 minute by default) with the endpoint's `watt`
   changing between checks (e.g. across a cloud passing over, or dusk/dawn) — confirm the panel
   updates without a page reload, while any diagram/chart currently on screen does _not_ re-fetch
   (open dev tools' Network tab and confirm `data/*.js`/`hist/*.js` requests only appear on the
   existing 10-minute cadence, unaffected — SC-002).

## Manual validation (User Story 2 — graceful degradation)

1. In dev tools, block requests to `**/live/index.php` (or use offline mode) and wait for a
   scheduled poll to fire.
2. Confirm the panel keeps showing its last successfully-fetched wattage and "as of" time — no
   page error, no blank/frozen-loading state (SC-003).
3. Reload the page with the block still active (so no successful fetch has ever occurred) —
   confirm the panel shows the distinct "no data yet" state (`t('infoPanel.unavailable')`), not a
   zero or blank value (FR-006).
4. Unblock the endpoint and confirm the very next scheduled poll recovers to a normal reading
   (FR-005's "continues retrying" clause).

## Manual validation (User Story 3 — configurable cadence)

1. Edit `web/js/config.js`'s `LIVE_REFRESH_INTERVAL_MS` to a different value (e.g. `10 * 1000`).
2. Reload the site and confirm (via dev tools Network tab) the live endpoint is now polled at the
   new cadence, with the 10-minute diagram/yield cadence unaffected.
3. Revert the edit (or confirm the default of `60 * 1000` is what ships).

## Automated tests

```bash
node --test web/js/info-panel/live-reading-client.test.js
npx playwright test tests/e2e/info-panel.spec.js --reporter=line
```

- `live-reading-client.test.js` (new) exercises the FR-004 classification rules (research.md §7)
  against inline fixture JSON strings — success, network failure, non-2xx, malformed JSON,
  missing/non-numeric `watt`, `sources.solarlog.ok: false` — with an injected `fetchImpl`, no real
  network calls (per project `CLAUDE.md`'s TDD conventions for scripts, applied here to this
  client module).
- `tests/e2e/info-panel.spec.js` (updated) mocks `**/live/index.php` via `page.route()` (replacing
  or alongside its existing `**/data/min_cur.js` mock) and patches `LIVE_REFRESH_INTERVAL_MS` down
  to a small value the same way it already patches other config constants (see its existing
  `**/js/config.js` route handler), to assert: initial render, update after one interval, last-
  known-good fallback on a simulated failure, "no data yet" on first-load failure, and the
  decoupling from the diagram/yield refresh cadence (SC-002).
