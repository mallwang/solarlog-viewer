# Research: Statistics Page

## R1: Which files supply the full-history daily series (heatmaps/streaks/trends)?

**Decision**: Fetch `hist/days_hist.js` + `data/days_hist.js` (via the existing
`fetchFromBothSources('days_hist.js')` helper), merge with `mergeDailyTotals`, then fold in
today's live entry from `data/days.js` the same way month-view.js/total-view.js already do.

**Rationale**: `hist/days_hist.js` is documented (see
`specs/001-website-modernization/data-model.md`'s corrected `YearComparisonSeries` note) as the
full frozen 2006–2026-07-28 archive; `data/days_hist.js` is the live device's own rolling archive
from 2026-07-29 on. Together, merged, they cover the plant's entire recorded history in one
`DailyTotal[]` series — exactly the shape `parseDailyTotalsFile` already produces and every other
view already consumes. This is also the file `fetchFromBothSources` already caches at
`Infinity`/`DATA_REFRESH_INTERVAL_MS` TTLs respectively, so a session that has already visited
month/year/total pays zero extra bytes to open Statistics.

**Alternatives considered**:

- `daysall.js` (named in spec.md FR-010's file list, inherited from the original spec text) — the
  app has never actually fetched this file; `specs/001-website-modernization/data-model.md`
  explicitly corrects an earlier draft that assumed it, noting `days_hist.js` was used instead
  throughout. Also, per `specs/002-data-validation-aggregation/spec.md`, `daysall.js`'s wire
  format is a single flat Wh total per day (`dal[dxl++]="DD.MM.YY|<Wh>"`), not the per-inverter
  `yield;peak` blocks `parseDailyTotalsFile` expects — using it would need a second parser for no
  benefit. Rejected: redundant with `days_hist.js`, format mismatch, no existing precedent.
- Re-deriving daily totals by summing `min{YYMMDD}.js` minute files per day across a year+ range —
  explicitly prohibited by FR-010 (data-cost constraint) and constitution Principle III's
  client-side-only, no-heavy-refetch spirit.

## R2: How should the three calendar heatmaps render — ApexCharts `heatmap` type, or CSS Grid?

**Decision**: Plain CSS Grid (7 rows × ~53 columns) with a `--v` custom property per cell driving
`color-mix()` against each metric's own accent hue, plus a `repeating-linear-gradient` hatch for
missing-data cells — exactly as approved in [design.md](design.md) / `mockup.html`.

**Rationale**: The approved UX mockup already built and reviewed this exact treatment (three
distinctly-hued heatmaps, per-year relative scale via FR-015, a hatch pattern for missing data
distinct from any real value at any opacity per FR-005) — re-implementing it as CSS is the
straight path from approved design to shipped code, no re-review needed. ApexCharts' `heatmap`
type is tuned for a rectangular series/category matrix with per-cell tooltips and legend bands; a
371-cell GitHub-style calendar (day-of-week rows, ISO-week columns, missing-day hatching, three
independently-hued instances stacked per topic) doesn't map cleanly onto it and would fight the
library rather than use it. Constitution Principle V's "no custom pixel math" is about the
original `diagram.js`'s JS-computed absolute offsets; CSS Grid with relative units/`fr` tracks and
a CSS custom property per cell involves no such per-pixel JS positioning — it is standard
responsive layout, consistent with Principle IV. Chart.js/ECharts's calendar-heatmap plugins would
be a new library dependency for one visual (again the no-new-dependency default).

**Alternatives considered**:

- ApexCharts `heatmap` series type — rejected per above (poor fit for a calendar layout + missing-
  day hatch requirement; ApexCharts has no built-in "missing data" cell state distinct from a
  data point).
- A dedicated calendar-heatmap library (e.g. `cal-heatmap`) — rejected: new vendored dependency for
  a single visual the CSS approach already renders correctly per the approved mockup.

## R3: How should the year-over-year, lifetime-cumulative, and specific-yield trend charts render?

**Decision**: Extend `chart-factory.js`'s existing ApexCharts `buildOptions` switch with three new
modes (`yoy-cumulative`, `lifetime-cumulative`, `specific-yield-trend`), following the same
pattern as the existing `year`/`year-months` bar builders (shared axis/tooltip formatting, one
`buildXOptions(data, colors, config)` function per mode).

**Rationale**: Keeps all charting behind the one constitution-mandated library (Principle V) and
the one existing chart module, rather than the inline-SVG placeholders the mockup used (explicitly
flagged in design.md as "out of scope for this mockup — plan-time concern"). Reuses
`renderChart(container, mode, data, config)`'s existing destroy-and-remount lifecycle, dark/light
`getChartColors()` theming, and `onDataPointClick` drill-down convention (used here for the
specific-yield-trend bar → that year's `#/year/YYYY` view, mirroring `total-view.js`'s year-bar
click-through).

**Alternatives considered**: A separate mini chart module scoped to Statistics only — rejected,
splits chart theming/testing conventions across two places for no benefit; the three new modes are
a small, additive extension of the existing switch statement.

## R4: Should the Heatmaps topic's selected year live in the URL?

**Decision**: No — the year `<select>` is in-page UI state (defaulting to the most recent year
with data), not encoded in the route. Only the five topics themselves are distinct routes
(`#/statistics/heatmaps`, etc.), satisfying FR-014 ("a topic can be bookmarked, shared, or opened
directly") without over-specifying a requirement the spec doesn't ask for.

**Rationale**: FR-014 and SC-004 both scope "directly linkable" / "reachable via its own link" to
_topics_, not to every piece of in-topic UI state (the Heatmaps year selector is the same kind of
transient view state as, e.g., the month-view chart's breakdown toggle, which also isn't
URL-encoded). Keeping the year out of the route avoids a second routing dimension (and a second
set of "invalid year" edge cases) for a requirement that was never asked for.

**Alternatives considered**: `#/statistics/heatmaps/:year` — rejected as scope creep beyond
FR-014's literal ask; can be added later as a non-breaking route extension if a future spec wants
deep-linkable heatmap years.

## R5: Streak threshold value

**Decision**: Reuse the existing `specificYieldKwhPerKwp`-derived framing already established for
"Ist %" rather than invent a new unit: the streak's "meaningful generation day" threshold is a
fixed constant expressed in **kWh** of daily yield (not kWh/kWp), calibrated to roughly 10% of the
plant's average historical daily yield in the productive (Mar–Sep) season, i.e. a threshold low
enough that a normal cloudy day still counts but a near-zero fault/outage day does not. Concretely
computed once at implementation time from the merged full daily history's own median, and
hardcoded as a constant in `statistics.js` (not user-configurable, per spec.md's Assumptions).

**Rationale**: Spec.md's Assumptions section already settles this as "a fixed constant... not
user-configurable in this first version" — the only remaining question was units/derivation
method, resolved here so `computeStreak` has one unambiguous, testable definition.

**Alternatives considered**: A percentage of that day's Soll (auflaufend) target — rejected: Soll
is a _period_ target (month/year), not a per-day one outside of `dailySollKwh`'s even 1/N split,
which would make winter days structurally fail the threshold even in a fault-free run; a plain kWh
constant calibrated from the plant's own history avoids that seasonal skew for a "did the plant
generate a meaningful amount" check.
