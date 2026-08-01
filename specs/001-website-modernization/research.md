# Phase 0 Research: Website Modernization

## 1. No SPA framework (React/Angular/Vue)

**Decision**: Vanilla JavaScript (ES2022+, native ES modules), no framework.

**Rationale**: The site is a read-only dashboard over static files with no forms, auth, or complex
cross-component state — a framework's data-binding and component-lifecycle machinery buys nothing
here. Constitution Technical Standards already mandates this explicitly ("Vanilla HTML5, CSS3, and
JavaScript ... no framework ... unless explicitly approved as a constitution amendment"), and
Principle III requires the site stay deployable to any plain static host with no build-time
pipeline — most framework workflows assume a bundler/compiler step, which would need justifying as
an amendment. Native ES modules (`<script type="module">`) give file-per-concern organization
without a build step.

**Alternatives considered**: React/Preact (small footprint, but still needs JSX transpilation for
ergonomic use, and its component model isn't needed for 6 largely-static views); a micro-framework
like Alpine.js/lit-html (viable, but adds a dependency for a problem vanilla DOM APIs already solve
at this scale) — rejected as unnecessary given the constitution's explicit "no framework" default.

## 2. Charting library

**Decision**: Chart.js, used via its ESM build vendored as a single committed file
(`vendor/chart.js/chart.esm.js`), imported with a native `<script type="module">` import — no CDN
dependency at runtime, no bundler.

**Rationale**: Constitution Principle V requires "an established, maintained charting library"
(explicitly names Chart.js, Apache ECharts, or Recharts) to replace the old pixel-math engine.
Chart.js covers every shape the 5 modes need out of the box: a time-series line/area chart (Mode
0), grouped bar charts (Modes 1–2), a stacked/cumulative bar (Mode 3), and a multi-series line
overlay (Mode 4) — all with built-in responsiveness (`responsive: true` + `maintainAspectRatio`)
satisfying FR-015 without extra code. It ships an ESM build that runs directly as a static file
with no bundler, matching Principle III. Recharts is React-only (ruled out by §1). ECharts is more
capable for very large series and has richer zoom/brush interactions, but is heavier and its API
has a steeper learning curve for what are fundamentally line/bar charts here — Chart.js is the
better fit for scope and constitution's "avoid unnecessary complexity" spirit.

Vendoring (copying the single ESM dist file into the repo under `vendor/`, checked into git)
rather than referencing `node_modules/` directly is necessary because `node_modules/` is not
deployed to a static host. `chart.js` is still added as an npm `devDependency` (per Technical
Standards, npm is the sole package manager) purely so the vendored file has a tracked source
version and update path (`npm ls chart.js` documents the pinned version; a one-line copy step
documented in quickstart.md re-vendors it on version bumps) — it is never imported from
`node_modules` at runtime.

**Alternatives considered**: Loading Chart.js from a public CDN via `<script src="https://...">` —
rejected: makes the page's data-visualization capability depend on third-party-host availability,
which the deployability requirement (FR-004, "any plain static file host") is meant to avoid, and
complicates offline/local development. A hand-rolled SVG chart renderer — explicitly the thing
Principle V prohibits (repeats the old custom-pixel-math mistake).

## 3. Deep-link routing strategy

**Decision**: Hash-based client-side routing (`#/year/2019`, `#/month/2019/07`,
`#/day/2019/07/15`, `#/total`, `#/compare`, and `#/` or no hash for the dashboard), implemented as
a small `router.js` module listening to `hashchange` and parsing `location.hash` on load.

**Rationale**: The spec (FR context / user's stated requirement) wants deep links like
`/data/2006` to be shareable/bookmarkable from a single `index.html` with no server-side routing.
History-API `pushState` routing produces prettier URLs but requires the static host to rewrite
every path back to `index.html` (a `.htaccess`/`_redirects`/host-specific rule) — a server-side
configuration dependency that Principle III's "deployable to any plain static file host ... no
runtime dependencies" explicitly rules out as a hard requirement, not a nice-to-have. Hash routes
need zero host configuration: `GET /index.html#/year/2019` is, to any static file server, simply a
request for `/index.html`; the fragment never reaches the server at all. This guarantees FR-004
holds regardless of hosting choice (Apache, nginx, GitHub Pages, S3+CloudFront, ...).

**Alternatives considered**: History API + `pushState` with a documented rewrite rule per host —
rejected as the default because it reintroduces a per-host configuration step this project has
never needed before; could be revisited later as a purely additive enhancement (progressive
enhancement to pretty URLs) without breaking hash links, but is out of scope here.

## 4. Data-file loading and parsing

**Decision**: Fetch every data file's raw text via `fetch(url).then(r => r.text())`, then extract
each record with a regex matching the file's `arr[idx++]="..."` assignment pattern
(`/^\w+\[\w+\+\+\]\s*=\s*"([^"]*)"/`) run per line — never injecting the file as a `<script src>`
tag and never calling `eval()` on its contents.

**Rationale**: Directly satisfies FR-007 ("`document.write()` script chaining MUST be eliminated")
and the Modernization Scope item "Replace `document.write()` script-chaining data loading with
`fetch()`-based async loading." The old site's `evalsafe.js` pattern relied on the file being
executed as a classic script that mutates global arrray variables (`m`, `da`, `mo`, `ye`) — fragile
(load-order dependent) and, more importantly, means treating third-party-pushed content (the
SolarLog device's FTP payload) as executable code. A plain-text fetch plus regex line extraction
reads the same `key[idx++]="value"` records (documented in `docs/data-format.md` /
`docs/data-format-daily.md`) as inert strings, which are then parsed field-by-field — no code from
the fetched file is ever executed, closing off injection risk from a compromised/corrupted device
payload while also removing the global-variable/script-order fragility. This single shared
extraction step lives in `src/js/data/parse-lines.js` and is reused by every file-specific parser
(`plant.js`, `min-file.js`, `aggregates.js`), so each parser only needs to know its own field
layout (per-file formats documented in `docs/data-format.md`), matching FR-006's requirement to
derive plant/inverter/string structure dynamically from `base_vars.js` on every load rather than
hard-coding it.

**Alternatives considered**: Loading files as classic `<script>` tags with pre-declared global
arrays (matches the original mechanism exactly) — rejected per FR-007; also incompatible with
`fetch()`-based error handling (FR-019) since a 404'd `<script src>` fails silently with no
inspectable response. `eval()` of fetched text — rejected outright as an unnecessary and unsafe way
to parse what is fundamentally line-oriented, quoted-string data.

## 5. Reusing epoch-detection logic for `min*.js` parsing

**Decision**: `src/js/data/min-file.js` imports `epochFromDate` and `epochFromFieldCounts`
directly from `scripts/utils.js` (`import { epochFromDate, epochFromFieldCounts } from
'../../../scripts/utils.js'`) rather than re-implementing the three-epoch block-layout logic.

**Rationale**: `scripts/utils.js` is plain ESM with no Node-only APIs (no `fs`, `path`, etc. in the
functions being reused), so it loads unmodified in a browser via a relative `<script
type="module">` import — no porting needed. It already encodes the exact epoch boundaries
(2006-11-03 archive start, 2007-03-28, 2013-01-04) and is exercised by `scripts/utils.test.js` and
consumed by `scripts/backfill-min-day.js`; re-deriving the same date-boundary math in browser code
would duplicate subtle logic (per Constitution Data Preservation Constraints: multi-inverter
block-position/field-count decoding "MUST be handled correctly for both WR1 ... and WR2").

**Alternatives considered**: Copying the epoch logic into `src/js/data/min-file.js` — rejected,
DRY violation and drift risk identical to the one already avoided in `scripts/sync-sqlite.js`
(feature 004, research.md §2 there reached the same conclusion for the same reason).

## 6. Internationalization source of truth

**Decision**: New curated `src/i18n/de.json` / `src/i18n/en.json` string tables, containing only
the strings the new UI actually uses (nav labels, widget titles, chart axis labels, error/empty
states) — not a runtime fetch of the archived `legacy-site/lang_DE.js` / `lang_EN.js` files.

**Rationale**: The user's explicit instruction when archiving the old site was that translation
files, like all other old HTML/CSS/JS, move into `legacy-site/` and are not treated as a "source
file" to keep live (unlike `base_vars.js`/`min*.js`/etc.). Fetching `legacy-site/lang_*.js` at
runtime from the new site would make the archive a live dependency again, contradicting the intent
that `legacy-site/` is a read-only, frozen snapshot. FR-017 only requires that DE/EN labels be
available, not that the specific old file format be reused — a small hand-written JSON pair is
simpler to consume with `fetch()` + `JSON.parse()` (no regex extraction needed, unlike §4's data
files) and only needs the strings the new, smaller UI actually surfaces (the new dashboard has far
fewer distinct labels than the old multi-page site). The old `lang_*.js` files remain available
under `legacy-site/` for one-time copy/reference when authoring the new JSON tables.

**Alternatives considered**: Fetching and regex-parsing `legacy-site/lang_DE.js` /
`legacy-site/lang_EN.js` directly (would reuse 100% of the existing translated strings) — rejected
per the rationale above; also would carry over strings for pages (e.g. `events.html`,
`anlageninfo.html`) that may not exist in the new single-dashboard structure, most of which
wouldn't be used, adding dead weight.

## 7. Live production widget refresh

**Decision**: `dashboard.js` fetches `min_cur.js` on mount and re-fetches it every 5 minutes via
`setInterval`, matching the SolarLog device's own push interval.

**Rationale**: Directly satisfies FR-016 and User Story 4 (Live Current Production Widget); 5
minutes matches the device's actual push cadence (Constitution Principle I), so polling more
frequently would never observe fresher data, and polling less frequently would miss the
"refreshed within 5 minutes" success criterion (SC-005).

**Alternatives considered**: WebSocket/SSE push — explicitly out of scope per constitution
("Real-time WebSocket or server-push updates ... polling `min_cur.js` is acceptable").
