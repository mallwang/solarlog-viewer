# Phase 0 Research: Chart UDC Toggle & Per-Inverter Stacked Bars

No `NEEDS CLARIFICATION` markers remained in the Technical Context, so this phase confirms the
chosen ApexCharts mechanisms against the vendored library version already in the project rather
than evaluating alternative libraries or architectures.

## Decision 1: Legend-gated, initially-hidden UDC series

**Decision**: Add UDC as an ordinary third series in `buildDayOptions`' `series` array (so it gets
a normal legend entry, color, and tooltip participation for free), then hide it immediately after
mount via ApexCharts' own `chart.hideSeries(seriesName)` API. Leave `legend.onItemClick` at its
default (`toggleDataSeries: true`), which already makes clicking a legend entry toggle that series'
visibility with no extra event wiring.

**Rationale**: ApexCharts v6.7.0 (vendored at `web/vendor/apexcharts/apexcharts.esm.js`) natively
supports both hiding a series programmatically and toggling visibility via legend click — this is
the built-in interaction model the library ships with, not a custom affordance. Building a bespoke
show/hide toggle (e.g. a custom checkbox, or conditionally including/excluding the series from
`options.series` on click) would duplicate work the library already does and would violate
Constitution Principle V ("No Custom Pixel Math" / no custom chart engines — extends in spirit to
not hand-rolling interaction logic ApexCharts already provides).

**Alternatives considered**:
- *Omit the UDC series entirely until clicked, injecting it into `series` on a custom legend
  click handler*: rejected — requires listening for legend DOM clicks outside ApexCharts' event
  model (fragile, needs manual legend markup) and re-rendering the whole chart on every toggle,
  which is slower and loses the "instant toggle" goal in the Technical Context.
- *Use a separate on/off UI control (e.g. a checkbox next to the chart) instead of the legend
  itself*: rejected — the user explicitly asked for "click in the legend on the UDC", so the
  native legend entry is the correct interaction surface, and ApexCharts already supports it.

## Decision 2: Stacked bars via `chart.stacked: true` + one series per inverter string

**Decision**: In `buildBarOptions`, replace the single `series: [{ name: t('chart.total'), data:
seriesData }]` with one series object per inverter-string key present in the data (derived via
`Object.keys(perInverter)` unioned across all categories, not hard-coded to `['1', '2']`), and add
`chart: { stacked: true }`. Series values per category come from that string's existing per-period
figure (`d.perInverter[key]?.yieldWh` / `y.perInverter[key]` / `m.perInverter[key]`, depending on
caller), each divided by 1000 for kWh exactly as today's summed total already is.

**Rationale**: ApexCharts' `chart.stacked` option renders exactly the stacked-bar shape requested
("the current single bar can simply be changed to a stacked bar") without any custom stacking math
— the library computes segment offsets itself. Deriving the string keys from the data (rather than
assuming exactly 2) satisfies FR-010 (generalizes to however many strings exist) with no added
complexity, since `Object.keys()` already works for any count.

**Alternatives considered**:
- *Keep a single series but pass a 2D/nested value shape ApexCharts doesn't natively support for
  bars*: rejected — ApexCharts stacked bars are configured via multiple series + `stacked: true`,
  which is the documented, supported shape; inventing an alternative encoding would be non-standard
  and harder to test.
- *Hard-code two series (`WR1`, `WR2`)*: rejected per FR-010 / Edge Cases — must generalize to
  however many strings the data contains.

## Decision 3: Click-to-drill-down compatibility with stacked bars

**Decision**: No change needed to the existing `dataPointSelection` wiring in `buildBarOptions`.

**Rationale**: `dataPointSelection` fires with a `dataPointIndex` corresponding to the clicked
category (bar), regardless of which series/segment within a stacked bar was clicked — ApexCharts
reports the category index the same way for stacked and non-stacked bar charts. This was confirmed
against the vendored library's event model; the existing `onDataPointClick(config.dataPointIndex)`
call requires no modification, satisfying FR-009 for free.

**Alternatives considered**: None — this is a compatibility check, not a design choice with
competing options.

## Decision 4: UDC value in the day chart's custom tooltip

**Decision**: Extend the existing `tooltip.custom` renderer in `buildDayOptions` to add a third
`tooltipRow` for UDC, but only render that row when the UDC series is currently visible (checked
via `w.globals.collapsedSeriesIndices`/`w.globals.seriesXvalues` visibility state already exposed
on the ApexCharts tooltip callback's `w` argument, consistent with how the function already reads
`w.globals.colors`).

**Rationale**: The chart already uses a fully custom tooltip (not per-series `y.formatter`)
specifically so the Wirkungsgrad row can show its PAC/PDC sub-line — the same custom-tooltip
mechanism is the natural extension point for a third, conditionally-shown row, keeping all
tooltip-row formatting in one place (the existing `tooltipRow` helper).

**Alternatives considered**:
- *Switch back to per-series default tooltip formatting*: rejected — would lose the existing
  Wirkungsgrad PAC/PDC sub-line, a regression outside this feature's scope.
