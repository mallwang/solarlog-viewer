# Research: Ereignisse (Events) Datatable

No `[NEEDS CLARIFICATION]` markers remained in spec.md — the data format was reverse-engineered
directly from `legacy-site/events.html` before the spec was written (see spec.md's Assumptions).
This document records the remaining implementation-level decisions needed before Phase 1 design.

## R1: Reuse the existing generic line extractor

**Decision**: Parse `events.js`/`events_day.js` with the existing
`web/js/data/parse-lines.js#extractAssignedStrings`, unchanged.

**Rationale**: Its pattern `/^\w+\[\w+\+\+\]\s*=\s*"([^"]*)"/` already matches
`e[ev++]="13.08.26 06:37:30;13.08.26 06:37:44;0;6;0"` exactly the same shape as the `m[mi++]=`/
`da[dx++]=` lines it was written for — the variable name (`e` vs. `m`/`da`) is a wildcard in the
regex. No new extraction logic needed; `web/js/data/events.js` calls this and then splits each
returned string on `;`.

**Alternatives considered**: A dedicated events-only regex — rejected, pure duplication of
already-tested logic for zero benefit.

## R2: Where StatusCodes[]/FehlerCodes[] get parsed

**Decision**: Extend `parseBaseVars()` in `web/js/data/plant.js` to also return `statusCodes:
string[][]` and `errorCodes: string[][]` (outer index = inverter, matching the event lines' 0-
based `WR` field; inner = the comma-split label list for that inverter, e.g.
`statusCodes[0][7] === 'Mpp'`).

**Rationale**: `main.js`'s `bootstrap()` already fetches `base_vars.js` once and parses it via
`parseBaseVars`, storing the result as the shared `plant` object passed into every view's
`render(container, { plant, route })`. Adding these two fields there means `events-view.js` needs
no second network fetch and no separate parser module — it just reads `plant.statusCodes` /
`plant.errorCodes`, the same way it already reads `plant.inverters`.

**Alternatives considered**: A standalone `web/js/data/event-codes.js` that `events-view.js`
fetches and parses independently — rejected: doubles the `base_vars.js` fetch for data that's
already sitting in memory by the time any view renders, and splits one file's parsing across two
modules for no isolation benefit (nothing else needs `statusCodes`/`errorCodes` without also
needing the rest of `plant`).

**Parsing shape** (from `web/data/base_vars.js`):

```js
var StatusCodes = new Array(2);
var FehlerCodes = new Array(2);
StatusCodes[0] = 'Offset,Stop,Netzueb.,Warten,...,Der. Idc,';
FehlerCodes[0] = '-------,NUW-UAC,NUW-FAC,...,';
StatusCodes[1] = 'Offset,Stop,...,Calib,';
FehlerCodes[1] = '-------,NUW-UAC,...,';
```

Regex per line: `/^(StatusCodes|FehlerCodes)\[(\d+)]\s*=\s*"([^"]*)"/`, then
`match[3].split(',')` (trailing empty string from the trailing comma is harmless — index access
by code never reaches it in practice, and if it did it would just render as an empty label,
which is an acceptable degenerate case, not one the spec calls out).

## R3: Status/error code fallback resolution

**Decision**: A single pure function per code type:

- `resolveStatusLabel(statusCodes, inverterIdx, code)`: if `code < statusCodes[inverterIdx]
.length`, return that label; **else return the fixed string `"Offline"`** (FR-010, matching the
  legacy site's exact behavior — `events.html`'s `unique()`/render loop pads every inverter's
  status list to 255 entries and appends `"Offline"` as the 256th, i.e. every out-of-range status
  code is that same catch-all label, not a per-code "unknown" message).
- `resolveErrorLabel(errorCodes, inverterIdx, code)`: if `code === 0`, return `null` (renders as
  the muted dash — "no error", FR-003). Else if `code < errorCodes[inverterIdx].length`, return
  that label. Else return `null` paired with a `rawCode` the caller renders as `"Code {n}
(unbekannt)"` (FR-010's final fallback — raw code shown rather than a blank cell).
- If `inverterIdx >= statusCodes.length` (event references an inverter with no code list at all —
  Edge Case: stale/removed inverter), both functions fall back the same way as an out-of-range
  code, so a genuinely unknown inverter never crashes the lookup.

**Rationale**: Matches the legacy `events.html` parser's own fallback behavior byte-for-byte
(padding to "Offline", `code 0` = `"-------"` treated as no-error), which is the closest thing to
a documented spec this data format has.

**Alternatives considered**: Inventing new fallback copy (e.g. "Unbekannter Status") — rejected,
diverges from the one authoritative source (the legacy parser) for no benefit and risks confusing
an owner who's used to the legacy wording.

## R4: Timestamp parsing

**Decision**: `parseEventTimestamp(raw: string): Date | null` splits `"13.08.26 06:37:30"` into
date (`dd.mm.yy`) and time (`HH:mm:ss`) parts and constructs a local-time `Date` via
`new Date(2000 + yy, mm - 1, dd, HH, mm, ss)`. Empty string → `null` (this is exactly how
"ongoing, no end time yet" is encoded — FR-003).

**Rationale**: All observed data (2006–2026) is unambiguously 20xx; a plain `2000 + yy` offset is
simpler and more obviously correct than replicating the legacy renderer's own date arithmetic
(`events.html`'s `new Date(parseInt(20+data[0].substr(6,4),10), ...)`), which relies on a JS
string/number coercion quirk to reconstruct the year and was written only to compare "is start
and end the same calendar day" for its own display formatting — not a canonical parse worth
copying verbatim. Local time (not UTC) matches how every other view in this codebase reads
SolarLog timestamps (see `chart-data-table.js`'s `formatTimeLabel` comment on the same point).

**Alternatives considered**: Porting the legacy arithmetic exactly — rejected as needlessly
obscure for new code with no behavioral benefit.

## R5: Deduplication strategy (FR-008)

**Decision**: Dedupe on the exact 5-field raw line content (`start;end;WR;status;error`, the
literal string as extracted, before parsing) via a `Set`, when merging `events.js` +
`events_day.js`. First occurrence wins; order of concatenation (history file first, day file
second) does not otherwise matter since duplicate lines are byte-identical by definition.

**Rationale**: The device writes `events_day.js` for "today" and folds it into `events.js` once
the day rolls over; a duplicate, if it ever occurs (e.g. both fetched in the same instant right at
rollover), is byte-for-byte the same event record, not a near-match needing fuzzy time-overlap
logic. Exact-string dedup is simple, deterministic, and cannot accidentally collapse two genuinely
different events that merely share a start time (Principle II — zero historical data loss).

**Alternatives considered**: Time-range overlap detection per inverter — rejected as unnecessary
complexity for a case exact-string matching already covers correctly, and riskier (a fuzzy match
could wrongly merge two distinct short events).

## R6: No new UI/table dependency

**Decision**: Hand-rolled `<table>` markup with Tailwind utility classes inline (matching
`chart-data-table.js`'s existing convention) plus a small amount of hand-written CSS in
`app.css` for what the utilities don't cover (sticky header, status pill colors, ongoing-badge
pulse animation). No datatable/grid library is introduced.

**Rationale**: Constitution's Frontend standard prohibits introducing a JS framework without an
amendment; a full-featured table library would be exactly that kind of addition for a feature
whose actual complexity (client-side sort of an array, filter of an array, render rows) doesn't
need one. Matches every other table already in this codebase (`chart-data-table.js`,
`stats-panel.js`).

**Alternatives considered**: A lightweight sortable-table library (e.g. a CDN-free npm package) —
rejected: no existing precedent in this codebase for a UI dependency of this kind, and the actual
requirement (sort 3 columns, filter 4 dimensions, over a few hundred rows) is well within what
~100 lines of hand-written JS handles clearly and testably.

## R7: Rendering scale / pagination

**Decision**: Render the full filtered/sorted event list with no pagination or virtualization for
v1. Current combined size is 416 events; SC-001's 3-second budget and a several-hundred-row table
are comfortably within what a modern browser renders without special handling.

**Rationale**: Spec Assumptions explicitly defer this decision to planning. The legacy site's own
`max_events` cap (1000–5000, browser-dependent) was an IE6/Netdscape-era workaround, not a
functional requirement — nothing in spec.md asks for a max-row cap or "N more rows" affordance,
and Success Criteria measure the full filtered/sorted set rendering correctly (SC-004).

**Alternatives considered**: Porting the legacy `max_events` truncation with a "N more" notice —
rejected: adds UI complexity and a partial-data risk (Principle II) for a limit that no longer
reflects any real technical constraint on the browsers this site targets today. Revisit only if a
future plant's history measurably exceeds what renders smoothly (not anticipated at this plant's
current growth rate — see spec Scale/Scope).

## R8: Route and navigation entry

**Decision**: New hash route `#/events` (`{ view: 'events', params: {} }`, no params — mirrors
`#/total`'s shape exactly since neither takes a year/month/day). New nav item in `main.js`'s
`NAV_ITEMS`, positioned after "Gesamt" (Total), labeled via a new `nav.eventsView` i18n key
("Ereignisse" / "Events").

**Rationale**: Matches `router.js`'s existing pattern for parameter-less routes (`total`)
exactly — `parseRoute`/`formatRoute` gain one more `if (kind === 'events' ...)` branch shaped
like the `total` one.

**Alternatives considered**: Encoding filter/sort state in the URL (as the legacy `events.html`
did via `?inv=&day=&stati=&err=`) — rejected for v1: spec.md's User Story 2/3 acceptance criteria
don't require shareable/bookmarkable filtered URLs, only that filtering and sorting work in the
UI; adding query-param round-tripping is scope the spec doesn't ask for and can be added later
without breaking the `#/events` route shape.
