# Quickstart: Validating the Ereignisse Datatable

## Prerequisites

- Repo checked out on branch `016-events-datatable`, dependencies installed (`npm install`).
- Dev server running: `npm start` (browser-sync with hot reload; copy the printed URL into your
  browser — see project `CLAUDE.md`, WSL2 cannot auto-open one).

## Unit tests (pure logic, no browser)

```bash
node --test web/js/data/events.test.js web/js/data/plant.test.js web/js/views/events-view.test.js
```

Expected: all pass, covering (per contracts/events.md):

- `parseEventLine` / `parseEventsFile` — valid lines parsed, malformed lines skipped (FR-009).
- `mergeAndDedupeEvents` — a line duplicated across both fixture files appears once (FR-008).
- `enrichEvent` — ongoing (`end: null`) event, an out-of-range status code resolving to
  `"Offline"` (FR-010), error code `0` resolving to `null` (no-error), a genuinely unknown error
  code carrying `errorRawCode`.
- `parseBaseVars` — `statusCodes`/`errorCodes` arrays match the fixture `base_vars.js`'s
  `StatusCodes[i]`/`FehlerCodes[i]` lines.
- `filterEvents` / `sortEvents` / `buildFilterOptions` — each dimension in isolation and combined.

## End-to-end validation (Playwright)

```bash
npx playwright test tests/e2e/events-view.spec.js --reporter=line
```

Expected: all six scenarios in contracts/events.md's Playwright contract pass, including the
mobile-viewport horizontal-scroll check.

## Manual walkthrough (matches spec.md's Independent Test for each user story)

1. Open the dev server URL, click "Ereignisse" in the nav (or navigate to `#/events` directly).
2. **User Story 1**: Confirm the table shows one row per event, most-recent first; find the
   event with a blank end time in `web/data/events_day.js` (last line, WR2/`"1"`, currently
   `"14.08.26 06:20:00;;1;7;0"`) and confirm its row shows an ongoing indicator, not a blank
   end-time cell.
3. **User Story 2**: Select an inverter from the "Wechselrichter" filter; confirm only that
   inverter's rows remain and the other dropdowns' options update. Select a day; confirm only
   events overlapping that day remain. Combine both, then click "Filter zurücksetzen" and
   confirm the full list returns.
4. **User Story 3**: Click the "Von – Bis" column header; confirm order reverses on a second
   click. Click the "WR" column header; confirm rows group by inverter.
5. Pick a filter combination with no matches (e.g. an inverter + a day it never reported on);
   confirm the empty state from design.md renders instead of an empty table.

## Constitution/documentation checklist (before calling the feature done)

- `npm run lint` and `npm run format:check` both exit 0.
- `README.md`/`README.de.md` mention the new Ereignisse page.
- `docs/user-guide.md`/`docs/user-guide.de.md` document how to reach it and its filter/sort
  behavior.
