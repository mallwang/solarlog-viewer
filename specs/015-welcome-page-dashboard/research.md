# Phase 0 Research: Welcome Page (Default Landing View)

## 1. Where does the welcome page hook into routing?

**Decision**: Change `router.js`'s `defaultRoute()` to return `{ view: 'welcome', params: {} }`
instead of today's day-view route. Add a `'welcome'` case to `formatRoute()` that serializes to
`'#/'` (matching the existing brand-logo `href="#/"` in `index.html`, which needs no change).
`parseRoute()` already falls through to `defaultRoute()` for both the empty-hash and
unrecognized/malformed-hash cases, so no change is needed there — both cases correctly become the
welcome page per FR-001, matching the spec's "empty or unrecognized route" wording.

**Rationale**: `defaultRoute()` is the single chokepoint every fallback path already funnels
through (empty hash, `#/bogus`, malformed `#/day/2099/13/40`, etc.) — reusing it is the minimal
change and keeps FR-002 (explicit valid routes unaffected) automatically true, since those routes
never call `defaultRoute()`.

**Alternatives considered**:

- A special-case check in `main.js`'s `dispatch()` before calling `parseRoute` — rejected, it
  would duplicate the "what counts as empty/unrecognized" logic `parseRoute` already owns.
- Keeping `defaultRoute()` returning `'day'` and having `main.js` redirect to `'welcome'` only when
  `location.hash` was literally empty — rejected, it would leave malformed explicit routes (e.g. a
  stale bookmark to a deleted day) falling through to the bare day-view instead of the welcome
  page, inconsistent with "unrecognized route" in FR-001.

## 2. How are plant photos supplied without a backend or build step?

**Decision**: A new `web/img/plant/` directory holds static image files (operator adds a file
directly, per FR-007). A new `PLANT_PHOTOS: string[]` constant in `config.js` lists the filenames
to show, in display order — matching the file's existing manual-override pattern
(`SITE_TITLE`, `SKY_LOCATION_OVERRIDE`). Empty array (the default) → FR-008's placeholder state.

**Rationale**: `config.js` already is the project's designated "hand-edited, human-facing
override" file — no new convention introduced. It requires no directory-listing capability (which
static hosts don't uniformly support) and no manifest-generation build step, keeping Principle III
(No Backend Introduction / no new pipeline) trivially satisfied. The one extra edit (filename in
config.js, alongside dropping the file in the folder) is a one-line, low-friction cost for an
operator who is already comfortable editing `base_vars.js`-adjacent config.

**Alternatives considered**:

- A generated JSON manifest via a new `scripts/generate-photo-manifest.js` (run by the operator
  after adding photos, per the project's ESM+TDD script conventions) — rejected as unnecessary
  process for a handful of files; would need its own tests/lint pass for marginal benefit over a
  config array, and adds a step the operator must remember to run.
- Runtime directory listing via `fetch()` of the folder — rejected, not supported by static file
  servers in general (Apache/nginx return listings only if directory indexing is enabled, which
  isn't guaranteed and returns HTML, not JSON — fragile to parse and inconsistent across hosts).

## 3. How does the "today total" chart avoid efficiency/UDC series entirely (not just hide them)?

**Decision**: Add a new `chart-factory.js` mode, `'day-total'`, with its own small option-builder
function (`buildDayTotalOptions`) rather than passing new flags into the existing
`buildDayOptions`. It reuses the existing `sumPerInverter`, `dayXAxisRange`, and
`fixedAxisRange(DAY_CHART_AXES.feedInW)` helpers already exported/available in that module, but
constructs only one series (the summed total feed-in line) and one y-axis (the feed-in axis) — no
Wirkungsgrad series/axis, no UDC series/axis/band, no legend-toggle wiring, no custom tooltip
per-series branching.

**Rationale**: `buildDayOptions` always constructs the Wirkungsgrad series and (conditionally) the
UDC series/band as part of one large function; even hiding them via `chart.hideSeries` (as the
existing UDC/efficiency toggle does) leaves them present in `options.series` and clickable back on
via the legend — which would violate FR-015's "MUST NOT show" (not "MUST default to hidden").
Introducing a second, deliberately minimal mode keeps `buildDayOptions` unchanged (no risk to the
five preserved visualization modes, constitution Principle VI) while giving the welcome page a
chart with genuinely nothing to toggle on.

**Alternatives considered**:

- A `series: ['total']` filter option on the existing `'day'` mode — rejected: still builds the
  efficiency/UDC axis entries and struggles to also suppress their legend entries cleanly; more
  branching added to an already-large function for one caller.
- Building the mini chart with a totally separate, hand-rolled SVG/pixel layout — rejected outright
  by constitution Principle V (no custom pixel-math chart engines).

## 4. Where does today's raw trace data come from for the welcome page?

**Decision**: Reuse `day-view.js`'s existing fetch path — `fetchText`/`parseMinFile` via
`sourceDirForDate`/`DATA_DIR` — for today's date, in `welcome-view.js`. No new data-fetch/parsing
module.

**Rationale**: This is exactly the same `min{yymmdd}.js` file and parser the day view already
reads for "today"; duplicating it in a new module would violate the project's terse review
standards and constitution Principle I (parsing already correctly implemented once).

**Alternatives considered**: None — this is a direct reuse, not a genuine design choice.

## 5. Carousel implementation approach

**Decision**: A small, dependency-free `photo-carousel.js` helper (markup builder + an `init`
function that wires auto-rotation via `setInterval` and prev/next button handlers), returned
alongside a cleanup function the same way `chart-breakdown-toggle.js`/`chart-table-toggle.js`
return `init*` functions consumed by `day-view.js`'s cleanup contract (`dispatch()` in `main.js`
calls the view's returned cleanup on route change). Uses Tailwind utility classes for layout;
crossfade/slide transition (if used) via a small CSS class swap in `app.css`, not a JS animation
library.

**Rationale**: Matches the existing "view + co-located helper module" pattern used throughout
`web/js/views/` (`period-nav.js`, `chart-breakdown-toggle.js`) and avoids introducing any new
dependency (constitution Technical Standards → Frontend: no framework, no bundler-requiring lib).

**Alternatives considered**:

- A vendored third-party carousel library — rejected as unnecessary weight for cycling through a
  handful of `<img>` elements; the constitution's chart-library exception (Principle V) is
  chart-specific and doesn't extend a general precedent for vendoring UI widgets.
- CSS-only (`:target`/scroll-snap) carousel with no JS — considered viable for the "manual
  controls" half of FR-010, but auto-rotation (one of FR-010's two acceptable mechanisms) needs
  JS regardless, so a small JS module is added either way; CSS scroll-snap MAY still be used
  _inside_ that module for the visual mechanics if simpler than absolute positioning — an
  implementation detail deferred to the tasks phase, not a research blocker.
