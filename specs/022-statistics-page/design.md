# Design: Statistics Page

**Feature**: [spec.md](spec.md)
**Status**: Approved 2026-08-16
**Mockup**: [mockup.html](mockup.html) (local static snapshot, open directly in a browser) —
originally reviewed at https://claude.ai/code/artifact/86ffde46-7760-41fb-8746-ea47126ade7e
(non-functional review artifact; remote link may go stale, the local copy and this document are
the durable record of what was approved).

## Approved layout

A new top-level view, reached from the main app nav (`Statistik`, alongside Tag/Monat/Jahr/
Gesamt/Ereignisse), with a split-view body:

1. **Left topic nav (~20% width, `flex: 0 0 20%`)** — five topics, one active at a time: Allgemein
   (Common), Heatmaps, Serien (Streaks), Trends, Bestwerte vs. Tiefstwerte (Best vs. Worst). Each
   topic is its own hash route (FR-014) so it's directly linkable/bookmarkable; the active topic
   is marked with a left accent bar (`box-shadow: inset 3px 0 0 var(--color-primary)`) and
   bolded/tinted text, matching the existing app-nav "active" convention.
2. **Right content area** — renders the selected topic's stats/charts. Card surfaces reuse the
   existing `--color-bg-elevated` / `--radius-lg` pattern already used by `.chart-container` /
   `.stats-panel`, so the new page reads as the same product rather than a bolted-on section.

### Common topic

An 8-tile grid (4 columns desktop, 2 columns mobile): best/worst month, best/worst year, max
daily power, max Ist %, max daily CO2 saving, max daily € earned. Each tile shows a label, a bold
value, a meta line (date/period), and a "→ view" link to the source day/month/year view
(FR-003). "Worst" tiles get a subtle diagonal-stripe background instead of a red/danger color —
this is comparative data, not an error state, so semantic danger color is reserved and unused
here. The max-daily-power tile carries a small italic caveat ("nur Tag, keine Uhrzeit erfasst")
so the value-only nature of that stat (FR-011, data-cost constraint) is never mistaken for a
missing time-of-day bug.

### Heatmaps topic

A year `<select>` above three stacked heatmap-per-metric blocks (energy/kWh, money/€, CO2/kg),
each a CSS grid of 7-row × ~53-column day cells. Color intensity is driven by a per-cell `--v`
custom property (0–1, relative to that year's own min/max per FR-015) via `color-mix()` against
each metric's own accent hue (primary/accent/chart-color-3 respectively, so the three heatmaps
stay visually distinct from one another). Missing-data days get a diagonal-hatch pattern
(`repeating-linear-gradient`) instead of a solid color at any opacity, so "no data" is never
confused with "real zero" (FR-005). A legend under the first heatmap spells out low/high/missing.

### Streaks topic

One large stat card: an oversized number (streak length in days), the threshold framing, the
start–end date range, and — when the streak is still active — an "● läuft noch" (ongoing) pill
badge next to the heading (Edge Case: open/ongoing streak). Below it, a compact horizontal strip
of small blocks highlights which recent days fall inside the streak, giving a lightweight visual
sense of recency without a full calendar.

### Trends topic

Three stacked chart blocks, each an inline SVG placeholder (polylines for the two comparison/
cumulative charts, bars for the degradation trend) with a small legend:
year-over-year cumulative yield comparison (current year vs. prior years, aligned by
day-of-year), cumulative lifetime € + CO2 savings, and per-year specific yield (kWh/kWp). The
degradation block carries a permanent italic caveat line ("Geht von konstanter installierter
Leistung aus; keine Wetter-Normalisierung") directly under its chart, satisfying FR-008 as an
always-visible note rather than a hover tooltip or modal.

### Best vs. Worst topic

A simple label/best/worst three-column row per paired metric (month, year, daily yield), each
best/worst side rendered as its own link card to the relevant source view (FR-009). Same
worst-tile stripe treatment as the Common topic, for visual consistency between the two places
"worst" values appear.

### Shared states

- **Insufficient history**: Heatmaps, Streaks, and Trends each swap their content for a dashed-
  border empty-state card ("Noch nicht genug Daten…") when the plant doesn't yet have enough
  recorded history for that topic to be meaningful (FR-012, SC-005). Common and Best vs. Worst
  are not gated this way — even a few days of history produces a meaningful "best so far".
- **Mobile**: the left topic nav collapses from a sticky vertical column to a horizontal,
  wrapping button row above the content; tile grids drop from 4 to 2 columns; chart blocks and
  pair rows stack full-width.

## Requirement traceability

| Region / state                                      | Spec item(s) satisfied                                      |
| --------------------------------------------------- | ----------------------------------------------------------- |
| Left topic nav, ~20% width, routable topics         | FR-001, FR-014                                              |
| Common tile grid + source-view links                | FR-002, FR-003, User Story 1 (all acceptance scenarios)     |
| Max-daily-power "no time-of-day" caveat             | FR-011, Edge Case "max daily power value-only"              |
| Heatmaps: year selector, 3 metrics                  | FR-004, User Story 2 acceptance scenarios 1 & 3             |
| Heatmaps: per-year relative color scale             | FR-015                                                      |
| Heatmaps: missing-day hatch treatment               | FR-005, User Story 2 acceptance scenario 2, Edge Cases      |
| Streaks: length, date range, ongoing badge          | FR-006, User Story 3 acceptance scenario 1, Edge Cases      |
| Trends: YoY, cumulative savings, degradation charts | FR-007, User Story 3 acceptance scenarios 2–4               |
| Degradation caveat, always visible                  | FR-008                                                      |
| Best vs. Worst paired rows + links                  | FR-009, User Story 4 (both acceptance scenarios)            |
| Worst stats shown by default, no toggle             | FR-016                                                      |
| "Not enough data yet" empty states                  | FR-012, Edge Case "no qualifying data yet", SC-005          |
| Mobile stacked nav + reflowed grids                 | FR-001 (responsive), User Scenarios (implied cross-cutting) |

## Explicitly out of scope for this mockup

- Real chart rendering — the ApexCharts `heatmap` type and any line/bar chart library wiring
  (FR-004, FR-007) are represented only as CSS-grid cells and inline SVG placeholders here; the
  actual charting integration is a plan-time concern.
- Data-sourcing/computation rules (FR-010, FR-013: aggregate-file-only sourcing, device-swap
  boundary merging) — invisible to layout, verified separately against the research doc.
- i18n/English copy — German shown throughout to match the app's current default language; the
  English strings will follow the existing i18n key pattern at implementation time.
- Exact breakpoint behavior between the 4-column and 2-column tile grid (only the two endpoints,
  desktop and mobile, were reviewed — no intermediate tablet width).
- Final wording for "not enough data yet" messaging — placeholder copy only, to be refined during
  implementation alongside the rest of the app's copy.
- Keyboard/focus and screen-reader behavior of the topic nav and heatmap grid beyond what's
  structurally implied by using real `<button>`/`<select>` elements.
