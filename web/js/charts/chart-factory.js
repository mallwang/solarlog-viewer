import '../../vendor/apexcharts/apexcharts.esm.js';
import { t } from '../i18n.js';
import { formatNumber, formatKwh, formatDate, formatDayMonth } from '../format.js';
import { efficiencyPercent, efficiencySums } from '../data/efficiency.js';
import {
  isDayUdcVisible,
  setDayUdcVisible,
  isDayEfficiencyVisible,
  setDayEfficiencyVisible,
} from '../settings.js';
import {
  DAY_CHART_AXES,
  DAY_CHART_X_AXIS_RANGE,
  DAY_CHART_X_AXIS_PADDING_MINUTES,
} from '../config.js';

// vendor/apexcharts/apexcharts.esm.js is ApexCharts' UMD build; loaded as an ES module for its
// side effect of attaching `window.ApexCharts` (no bundler-free single-file ESM build is
// published for the browser). Guarded for node:test, which imports view modules (for their pure
// helper exports) without a DOM.
const ApexCharts = typeof window !== 'undefined' ? window.ApexCharts : undefined;

const CHART_COLOR_VARS = [
  '--chart-color-1',
  '--chart-color-2',
  '--chart-color-3',
  '--chart-color-4',
  '--chart-color-5',
  '--chart-color-6',
];

/** @returns {string[]} Resolved `--chart-color-1..6` values (SVG fill/stroke need resolved colors, not `var()` strings). */
function getChartColors() {
  if (typeof window === 'undefined') return [];
  const styles = getComputedStyle(document.documentElement);
  return CHART_COLOR_VARS.map((name) => styles.getPropertyValue(name).trim());
}

/**
 * Resolved `--color-text-muted` — the fixed gray used for a trend chart's "if this continues"
 * forecast segment (see buildLifetimeCumulativeOptions/buildSpecificYieldTrendOptions), kept
 * separate from the numbered `--chart-color-*` palette since a forecast isn't a real data series.
 * @returns {string}
 */
function getForecastColor() {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim();
}

const charts = new WeakMap();

// Fixed palette slots for the day chart's non-feed-in series, kept aligned with what the
// month/year/total bar charts already use for "Gesamt"/WR1/WR2 (colors[0]/colors[1] — see
// buildBarOptions) so the same series means the same color across every chart: feed-in total or
// WR1 stays colors[0] (orange), WR2 colors[1] (green), Wirkungsgrad colors[2] (blue), UDC
// colors[3] (red). NB: a blue Wirkungsgrad line washes out somewhat against the blue sky
// background in transparency mode — accepted for cross-chart color consistency.
const EFFICIENCY_COLOR_INDEX = 2;
const UDC_COLOR_INDEX = 3;

/** `{ max, step }` → the ApexCharts `{ min: 0, max, tickAmount }` triple for a fixed-range axis (see `DAY_CHART_AXES` in config.js). */
function fixedAxisRange({ max, step }) {
  return { min: 0, max, tickAmount: max / step };
}

/**
 * Day chart x-axis bounds per `DAY_CHART_X_AXIS_RANGE` (config.js):
 * - `'data'` — spans the timestamps actually present, each end padded outward by
 *   `DAY_CHART_X_AXIS_PADDING_MINUTES` so the first/last points sit clear of the plot edge (easier
 *   to see where the day's data starts/ends, and easier to hover). `{}` when there's no data to
 *   derive a range from (empty day), so ApexCharts falls back to its own default.
 * - `'fullDay'` — the full local 00:00–24:00 day (derived from the first timestamp's own date);
 *   the padding doesn't apply since midnight-to-midnight is already maximal margin.
 * @param {number[]} timestamps - epoch ms of every reading on the day being charted.
 * @returns {{ min?: number, max?: number }}
 */
function dayXAxisRange(timestamps) {
  if (timestamps.length === 0) return {};
  if (DAY_CHART_X_AXIS_RANGE === 'fullDay') {
    const d = new Date(timestamps[0]);
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return { min: startOfDay, max: startOfDay + 24 * 60 * 60 * 1000 };
  }
  const paddingMs = DAY_CHART_X_AXIS_PADDING_MINUTES * 60 * 1000;
  return { min: Math.min(...timestamps) - paddingMs, max: Math.max(...timestamps) + paddingMs };
}

function formatTimeLabel(isoTimestamp) {
  return isoTimestamp.slice(11, 16);
}

/**
 * Renders one series row for the day chart's custom tooltip (see `buildDayOptions`), reusing
 * ApexCharts' own tooltip CSS classes so it inherits the built-in light/dark theming. `detail`,
 * when given, adds a muted sub-line under the value — used to show the Wirkungsgrad calculation
 * (PAC ⁄ PDC) beneath its percentage.
 * @param {{ color: string, label: string, value: string, detail?: string }} opts
 * @returns {string}
 */
function tooltipRow({ color, label, value, detail }) {
  return `<div class="apexcharts-tooltip-series-group apexcharts-active" style="display:flex">
    <span class="apexcharts-tooltip-marker" style="background-color:${color}"></span>
    <div class="apexcharts-tooltip-text">
      <div class="apexcharts-tooltip-y-group">
        <span class="apexcharts-tooltip-text-y-label">${label}: </span>
        <span class="apexcharts-tooltip-text-y-value">${value}</span>
        ${detail ? `<div style="color:var(--apx-tt-color-muted);font-size:11px;margin-top:2px;">${detail}</div>` : ''}
      </div>
    </div>
  </div>`;
}

function baseOptions(colors) {
  return {
    chart: {
      height: '100%',
      width: '100%',
      toolbar: { show: false },
      // Pinch/drag zoom is disabled everywhere: on mobile it fights the page's own
      // finger-scroll over the chart rather than being a usable gesture.
      zoom: { enabled: false },
      animations: { enabled: false },
      fontFamily: 'inherit',
      foreColor: 'var(--color-text-muted)',
    },
    colors,
    dataLabels: { enabled: false },
    grid: { borderColor: 'var(--color-border)' },
    legend: { labels: { colors: 'var(--color-text)' } },
  };
}

/** Sums each reading/day's per-inverter values into a single total, keeping `null` (no data) as `null` rather than 0. */
function sumPerInverter(values) {
  const present = values.filter((v) => v !== null && v !== undefined);
  return present.length ? present.reduce((s, v) => s + v, 0) : null;
}

/**
 * Summarizes a reading's UDC (DC string voltage) across every reporting inverter string as
 * average/min/max. `udcV` is per-inverter *array*-valued (one element per DC string on that
 * inverter — see `web/js/data/min-file.js`'s `parseSb4200Block`/`parseSb2100Block`, mirroring how
 * `pdcW` is flattened by `efficiencySums`), so this flattens all strings' arrays first. The
 * average (not a sum — a sum would read as an implausible >1000 V) drives the day chart's UDC
 * line; min/max drive the shaded band around it and the tooltip's "Min: … / Max: …" detail.
 * `null` when no string reports a value for that point, per FR-001/Edge Cases.
 * @param {Record<string|number, { udcV?: number[] | null }>} perInverter
 * @returns {{ avg: number, min: number, max: number } | null}
 */
function udcStats(perInverter) {
  const allStrings = Object.values(perInverter ?? {}).flatMap((inv) => inv?.udcV ?? []);
  const present = allStrings.filter((v) => v !== null && v !== undefined);
  if (present.length === 0) return null;
  return {
    avg: present.reduce((s, v) => s + v, 0) / present.length,
    min: Math.min(...present),
    max: Math.max(...present),
  };
}

/**
 * Builds the day chart's feed-in (AC power) series — either a single pre-summed area (default
 * "total" mode, unchanged from before per-inverter breakdown existed) or one area series per
 * reporting inverter string (`breakdown: 'inverters'`), mirroring the month/year/total bar
 * charts' own total/per-inverter toggle (see `buildBarOptions`). Both segments share the same
 * gradient-fade fill as the total-mode area (see `buildDayOptions`'s `fill` option) rather than
 * being stacked: each inverter string gets its own `yaxis` entry so it can be bound by name,
 * which puts them in different ApexCharts axis groups — `chart.stacked` only stacks series
 * sharing one axis group, so it can't produce a true additive stack here the way the bar charts'
 * single-axis `stacked: true` does; two directly comparable per-string areas read better for a
 * power-over-time chart anyway.
 * @param {{ readings: object[] }} data
 * @param {number[]} timestamps
 * @param {'total' | 'inverters'} breakdown
 * @param {string[]} stringKeys
 * @returns {{ name: string, type: string, data: { x: number, y: number | null }[] }[]}
 */
function buildFeedInSeries(data, timestamps, breakdown, stringKeys) {
  if (breakdown === 'inverters' && stringKeys.length > 1) {
    return stringKeys.map((key) => ({
      name: inverterLabel(key),
      type: 'area',
      unit: 'W',
      data: data.readings.map((r, i) => ({
        x: timestamps[i],
        y: r.perInverter[key]?.pacW ?? null,
      })),
    }));
  }
  return [
    {
      name: t('chart.feedInAxis'),
      type: 'area',
      unit: 'W',
      data: data.readings.map((r, i) => ({
        x: timestamps[i],
        y: sumPerInverter(Object.values(r.perInverter).map((inv) => inv?.pacW)),
      })),
    },
  ];
}

/**
 * The feed-in column(s) for the *table* specifically (user correction): always Gesamt+WR1+WR2
 * together when there's more than one inverter string, regardless of the diagram's own
 * Gesamt/Wechselrichter breakdown toggle — unlike `buildFeedInSeries` above (which returns
 * whichever *one* of those the chart itself is currently plotting). With only one string there's
 * nothing to break out, so it's just that string's own single "Einspeisung (W)" series, same as
 * `buildFeedInSeries('total', …)`.
 * @param {{ readings: object[] }} data
 * @param {number[]} timestamps
 * @param {string[]} stringKeys
 * @returns {{ name: string, type: string, unit: string, data: { x: number, y: number | null }[] }[]}
 */
function buildFeedInTableSeries(data, timestamps, stringKeys) {
  if (stringKeys.length <= 1) return buildFeedInSeries(data, timestamps, 'total', stringKeys);
  const [total] = buildFeedInSeries(data, timestamps, 'total', stringKeys);
  const perInverter = buildFeedInSeries(data, timestamps, 'inverters', stringKeys);
  return [{ ...total, name: t('chart.total') }, ...perInverter];
}

/**
 * Tooltip rows for the feed-in series/segment(s) — a single "Einspeisung" row in total mode, or
 * (mirroring `buildBarOptions`' tooltip) a "Gesamt" sum row followed by one row per inverter
 * string when in per-inverter mode, so the total stays visible alongside the breakdown.
 */
function feedInTooltipRows({ hoveredSeries, dataPointIndex, feedInSeries, colors, lang }) {
  if (feedInSeries.length === 1) {
    const pacValue = hoveredSeries[0][dataPointIndex];
    return [
      tooltipRow({
        color: colors[0],
        label: t('chart.feedInAxis'),
        value:
          pacValue === null || pacValue === undefined
            ? '—'
            : `${formatNumber(pacValue, { decimals: 0, lang })} W`,
      }),
    ];
  }
  const values = feedInSeries.map((_, i) => hoveredSeries[i][dataPointIndex]);
  const total = sumPerInverter(values);
  const rows = [
    tooltipRow({
      color: colors[0],
      label: t('chart.total'),
      value: total === null ? '—' : `${formatNumber(total, { decimals: 0, lang })} W`,
    }),
  ];
  feedInSeries.forEach((s, i) => {
    rows.push(
      tooltipRow({
        color: colors[i],
        label: s.name,
        value:
          values[i] === null || values[i] === undefined
            ? '—'
            : `${formatNumber(values[i], { decimals: 0, lang })} W`,
      }),
    );
  });
  return rows;
}

function buildDayOptions(data, colors, { lang, breakdown = 'total' } = {}) {
  const timestamps = data.readings.map((r) => new Date(r.timestamp).getTime());
  // Omitted entirely (not merely hidden) when the day has no UDC readings at all — e.g. an
  // older epoch whose min-file format predates volt reporting — so no "UDC" legend entry is
  // offered at all, per FR-005.
  const hasUdcData = data.readings.some((r) => udcStats(r.perInverter) !== null);
  const stringKeys = inverterKeysAcross(data.readings);
  const feedInSeries = buildFeedInSeries(data, timestamps, breakdown, stringKeys);
  // Series order is always feed-in segment(s), then efficiency, then (optionally) the UDC
  // min/max band followed by the UDC average line — indices below are derived from that rather
  // than hard-coded, since the feed-in segment count now varies with the breakdown toggle. The
  // band comes *before* the line so the line paints on top of it (later entries in `series` are
  // drawn on top in ApexCharts).
  const efficiencyIndex = feedInSeries.length;
  const udcBandIndex = efficiencyIndex + 1;
  const udcIndex = udcBandIndex + 1;

  // Pulled into their own consts (rather than built inline in `series` below) so `tableSeries`
  // can reuse the exact same objects — they don't depend on the breakdown toggle at all, only the
  // feed-in segment(s) do (see `buildFeedInTableSeries` above).
  const efficiencySeries = {
    name: t('chart.efficiencyAxis'),
    type: 'line',
    unit: '%',
    data: data.readings.map((r, i) => ({
      x: timestamps[i],
      y: efficiencyPercent(r.perInverter),
    })),
  };
  const udcBandSeries = hasUdcData
    ? {
        name: t('chart.udcRangeAxis'),
        type: 'rangeArea',
        unit: 'V',
        data: data.readings.map((r, i) => {
          const stats = udcStats(r.perInverter);
          return { x: timestamps[i], y: stats ? [stats.min, stats.max] : null };
        }),
      }
    : null;
  const udcLineSeries = hasUdcData
    ? {
        name: t('chart.udcAxis'),
        type: 'line',
        unit: 'V',
        data: data.readings.map((r, i) => ({
          x: timestamps[i],
          y: udcStats(r.perInverter)?.avg ?? null,
        })),
      }
    : null;

  const series = [
    ...feedInSeries,
    efficiencySeries,
    ...(hasUdcData ? [udcBandSeries, udcLineSeries] : []),
  ];
  // The table's own series list (user correction): always Gesamt+WR1+WR2 feed-in columns
  // together (see `buildFeedInTableSeries`) plus Wirkungsgrad/UDC — independent of `series`
  // above, which still varies with the diagram's own breakdown toggle.
  const tableSeries = [
    ...buildFeedInTableSeries(data, timestamps, stringKeys),
    efficiencySeries,
    ...(hasUdcData ? [udcBandSeries, udcLineSeries] : []),
  ];
  // Feed-in segment(s) use colors[0] (total, or WR1) / colors[1] (WR2) — the same slots the
  // month/year/total bar charts already use for "Gesamt"/WR1/WR2 — while Wirkungsgrad and UDC
  // sit in their own fixed slots regardless of how many feed-in segments there are, so neither
  // ever collides with a feed-in color. The UDC band reuses the UDC line's own color at a lower
  // fill opacity (see `fill.opacity` below) rather than a separate slot, so the shading reads as
  // "this line's own range" instead of a distinct series.
  const seriesColors = [
    ...feedInSeries.map((_, i) => colors[i]),
    colors[EFFICIENCY_COLOR_INDEX],
    ...(hasUdcData ? [colors[UDC_COLOR_INDEX], colors[UDC_COLOR_INDEX]] : []),
  ];

  return {
    ...baseOptions(colors),
    chart: {
      ...baseOptions(colors).chart,
      type: 'line',
      // Persists the Wirkungsgrad and UDC lines' shown/hidden state across visits (per updated
      // Edge Cases — unlike the feed-in series, these two are remembered). Fires on every legend
      // click, so it's guarded to each series' own index (derived above — series order is fixed:
      // feed-in segment(s), efficiency, UDC band, UDC line) and dispatched to that series' own
      // setter. The UDC band has no legend entry of its own (hidden via CSS — see
      // `hideUdcRangeLegendEntry`) and no persisted state: its visibility just mirrors the UDC
      // line's every time the line is toggled here, via `toggleSeries`, so the two act as one
      // single activation point in the legend despite being two ApexCharts series internally.
      // ApexCharts applies its own default show/hide toggle after invoking this callback, so the
      // resulting visibility is read one tick later via `collapsedSeriesIndices` (same check the
      // tooltip already uses) rather than assumed from the click alone.
      events: {
        legendClick: (chartContext, seriesIndex) => {
          const setVisible = {
            [efficiencyIndex]: setDayEfficiencyVisible,
            [udcIndex]: setDayUdcVisible,
          }[seriesIndex];
          if (!setVisible) return;
          window.setTimeout(() => {
            const hidden = chartContext.w.globals.collapsedSeriesIndices.includes(seriesIndex);
            setVisible(!hidden);
            // UDC also gets its own right-hand axis (see the `yaxis` entry below) — toggling the
            // series doesn't touch axis definitions on its own, so it's shown/hidden in step here
            // rather than left stranded either always-on or always-off regardless of the line.
            if (seriesIndex === udcIndex) {
              chartContext.toggleSeries(t('chart.udcRangeAxis'));
              chartContext.updateOptions(
                {
                  yaxis: chartContext.w.config.yaxis.map((y, i) =>
                    i === udcIndex ? { ...y, show: !hidden } : y,
                  ),
                },
                false,
                false,
              );
            }
          }, 0);
        },
      },
    },
    colors: seriesColors,
    stroke: {
      // The UDC band has no outline of its own (`width: 0`) — just a soft fill between min and
      // max, with the UDC line's own 2px stroke drawn on top of it as the visible boundary.
      width: series.map((s) => (s.type === 'rangeArea' ? 0 : 2)),
      curve: 'smooth',
    },
    fill: {
      type: [
        ...feedInSeries.map((s) => (s.type === 'area' ? 'gradient' : 'solid')),
        'solid',
        ...(hasUdcData ? ['solid', 'solid'] : []),
      ],
      gradient: {
        type: 'vertical',
        shade: 'light',
        shadeIntensity: 0.3,
        opacityFrom: 0.8,
        opacityTo: 0.25,
      },
      // Only the UDC band needs a translucent fill (so the min/max range reads as a soft shadow
      // around its line rather than a solid block) — every other series keeps its existing full
      // opacity.
      opacity: [...feedInSeries.map(() => 1), 1, ...(hasUdcData ? [0.2, 1] : [])],
    },
    // Explicit per-series colors: without this, ApexCharts' hover markers both pick up the
    // area series' color (mixed area+line charts don't reliably fall back to the top-level
    // `colors` array for marker fills), so the Wirkungsgrad hover dot showed up orange too.
    markers: { size: 0, hover: { size: 5 }, colors: seriesColors },
    series,
    tableSeries,
    xaxis: {
      type: 'datetime',
      title: { text: t('chart.timeAxis') },
      labels: { datetimeUTC: false, format: 'HH:mm' },
      ...dayXAxisRange(timestamps),
    },
    yaxis: [
      // One axis entry per feed-in segment, all sharing the same (left, Watt) scale — only the
      // first is actually drawn (title/labels), the rest stay `show: false` so per-inverter mode
      // doesn't draw duplicate axis lines/labels on top of each other. Each ApexCharts yaxis
      // entry with `forceNiceScale` picks its own "nice" max from *its own* series' data unless
      // told otherwise, so — since only the WR1 axis is actually drawn — a smaller WR2 (or WR3…)
      // area was being read off a hidden axis that topped out well above WR1's, making it look
      // artificially shrunk (e.g. a 1600 W WR2 peak plotted under WR1's 3200 W gridline). Passing
      // the same explicit range (fixed via `DAY_CHART_AXES.feedInW` in config.js — not derived
      // per-day) to every entry keeps them all on one identical scale, both across segments within
      // a day and across days.
      ...feedInSeries.map((s, i) => ({
        seriesName: s.name,
        show: i === 0,
        title: i === 0 ? { text: t('chart.feedInAxis') } : undefined,
        ...fixedAxisRange(DAY_CHART_AXES.feedInW),
        labels: { formatter: (value) => formatNumber(value, { decimals: 0, lang }) },
      })),
      {
        seriesName: t('chart.efficiencyAxis'),
        opposite: true,
        title: { text: t('chart.efficiencyAxis') },
        ...fixedAxisRange(DAY_CHART_AXES.efficiencyPercent),
        labels: { formatter: (value) => formatNumber(value, { decimals: 0, lang }) },
      },
      ...(hasUdcData
        ? [
            {
              // The band shares the UDC line's own axis range/scale (so its shading lines up
              // exactly with the line) but is never itself drawn — it exists purely so the band
              // series has a y-axis to bind to at all; the visible axis below is the one users see.
              seriesName: t('chart.udcRangeAxis'),
              show: false,
              opposite: true,
              ...fixedAxisRange(DAY_CHART_AXES.udcV),
            },
            {
              seriesName: t('chart.udcAxis'),
              // Shown as its own right-hand axis (stacked outward from the Wirkungsgrad axis by
              // ApexCharts, since both are `opposite: true`) whenever the UDC series itself is
              // visible, so the line's actual voltage scale reads directly off the chart instead
              // of only being discoverable via the tooltip. Toggling the UDC legend entry
              // hides/shows the series but not this axis definition, so `show` is tied to the
              // persisted visibility (`isDayUdcVisible`) rather than left permanently on — an
              // axis with no visible line would otherwise sit there unexplained.
              show: isDayUdcVisible(),
              opposite: true,
              title: { text: t('chart.udcAxis') },
              // Fixed via `DAY_CHART_AXES.udcV` in config.js rather than derived per-day, for the
              // same reason as the feed-in axis above: a day whose strings only reached ~200 V
              // shouldn't fill the same chart height as one reaching ~400 V.
              ...fixedAxisRange(DAY_CHART_AXES.udcV),
              labels: { formatter: (value) => formatNumber(value, { decimals: 0, lang }) },
            },
          ]
        : []),
    ],
    tooltip: {
      // Custom (rather than per-series `y.formatter`) so the Wirkungsgrad row can show its
      // PAC ⁄ PDC calculation as a sub-line under the percentage.
      custom: ({ series: hoveredSeries, dataPointIndex, w }) => {
        const { pacW, pdcW } = efficiencySums(data.readings[dataPointIndex]?.perInverter);
        const rows = [
          ...feedInTooltipRows({
            hoveredSeries,
            dataPointIndex,
            feedInSeries,
            colors: w.globals.colors,
            lang,
          }),
        ];
        // Wirkungsgrad/UDC rows only appear while their series is currently visible (FR-004) —
        // checked via ApexCharts' own collapsed-series tracking on `w.globals`, consistent with
        // how this function already reads `w.globals.colors` for the other rows' markers.
        if (!w.globals.collapsedSeriesIndices.includes(efficiencyIndex)) {
          const pctValue = hoveredSeries[efficiencyIndex][dataPointIndex];
          rows.push(
            tooltipRow({
              color: w.globals.colors[efficiencyIndex],
              label: t('chart.efficiencyAxis'),
              value:
                pctValue === null || pctValue === undefined
                  ? '—'
                  : `${formatNumber(pctValue, { decimals: 0, lang })}%`,
              detail:
                pctValue === null || pctValue === undefined
                  ? undefined
                  : `AC: ${formatNumber(pacW, { decimals: 0, lang })} W / DC: ${formatNumber(pdcW, { decimals: 0, lang })} W`,
            }),
          );
        }
        // Computed straight from the reading (rather than read off `hoveredSeries`) so it doesn't
        // depend on the band/line series' ApexCharts indices — reflects the UDC line's own
        // shown/hidden state (FR-004) regardless of whether the separate band toggle is on.
        if (hasUdcData && !w.globals.collapsedSeriesIndices.includes(udcIndex)) {
          const stats = udcStats(data.readings[dataPointIndex]?.perInverter);
          rows.push(
            tooltipRow({
              color: w.globals.colors[udcIndex],
              label: t('chart.udcAxis'),
              value: stats ? `${formatNumber(stats.avg, { decimals: 0, lang })} V` : '—',
              detail: stats
                ? `Min: ${formatNumber(stats.min, { decimals: 0, lang })} V / Max: ${formatNumber(stats.max, { decimals: 0, lang })} V`
                : undefined,
            }),
          );
        }
        return `<div class="apexcharts-tooltip-title">${formatTimeLabel(data.readings[dataPointIndex]?.timestamp ?? '')}</div>${rows.join('')}`;
      },
    },
  };
}

/**
 * Fallback for days where only the cumulative daily yield survived (backfilled/archived
 * min files — see .claude/skills/backfill-min-day: PDC/PAC/Volt are zeroed, only Wh is
 * reconstructed). Plots each inverter's running Wh total instead of a flat 0 W line, so the
 * day still shows something meaningful rather than looking like "no data".
 */
function buildDayYieldOptions(data, colors, { lang } = {}) {
  const timestamps = data.readings.map((r) => new Date(r.timestamp).getTime());
  const series = [
    {
      name: t('chart.total'),
      unit: 'Wh',
      data: data.readings.map((r, i) => ({
        x: timestamps[i],
        y: sumPerInverter(Object.values(r.perInverter).map((inv) => inv?.dailyYieldWh)),
      })),
    },
  ];

  return {
    ...baseOptions(colors),
    chart: { ...baseOptions(colors).chart, type: 'area' },
    stroke: { width: 2, curve: 'stepline' },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.8, opacityTo: 0.25 } },
    markers: { size: 0 },
    series,
    xaxis: {
      type: 'datetime',
      title: { text: t('chart.timeAxis'), offsetY: -8 },
      labels: { datetimeUTC: false, format: 'HH:mm' },
      ...dayXAxisRange(timestamps),
    },
    yaxis: {
      title: { text: 'Wh' },
      min: 0,
      forceNiceScale: true,
      labels: { formatter: (value) => formatNumber(value, { decimals: 0, lang }) },
    },
    tooltip: {
      y: {
        formatter: (value) =>
          value === null || value === undefined
            ? '—'
            : `${formatNumber(value, { decimals: 0, lang })} Wh`,
      },
    },
  };
}

/**
 * Minimal single-series day chart for the welcome page (015-welcome-page-dashboard): today's
 * combined feed-in total on the existing fixed `DAY_CHART_AXES.feedInW` axis only - no
 * Wirkungsgrad/UDC series or axes at all (not merely hidden), unlike `buildDayOptions`, so there
 * is nothing a legend click could reveal (FR-014/015/016). Deliberately its own small
 * option-builder rather than a flag on `buildDayOptions`, reusing that function's own
 * `sumPerInverter`/`dayXAxisRange`/`fixedAxisRange` helpers (research.md §3).
 * @param {{ readings: object[] }} data
 * @param {string[]} colors
 * @param {{ lang?: string }} [config]
 * @returns {object} ApexCharts options.
 */
function buildDayTotalOptions(data, colors, { lang } = {}) {
  const timestamps = data.readings.map((r) => new Date(r.timestamp).getTime());
  const series = [
    {
      name: t('chart.feedInAxis'),
      type: 'area',
      unit: 'W',
      data: data.readings.map((r, i) => ({
        x: timestamps[i],
        y: sumPerInverter(Object.values(r.perInverter).map((inv) => inv?.pacW)),
      })),
    },
  ];

  return {
    ...baseOptions(colors),
    chart: { ...baseOptions(colors).chart, type: 'area' },
    stroke: { width: 2, curve: 'smooth' },
    fill: {
      type: 'gradient',
      gradient: {
        type: 'vertical',
        shade: 'light',
        shadeIntensity: 0.3,
        opacityFrom: 0.8,
        opacityTo: 0.25,
      },
    },
    markers: { size: 0, hover: { size: 5 } },
    series,
    xaxis: {
      type: 'datetime',
      title: { text: t('chart.timeAxis') },
      labels: { datetimeUTC: false, format: 'HH:mm' },
      ...dayXAxisRange(timestamps),
    },
    yaxis: {
      title: { text: t('chart.feedInAxis') },
      ...fixedAxisRange(DAY_CHART_AXES.feedInW),
      labels: { formatter: (value) => formatNumber(value, { decimals: 0, lang }) },
    },
    tooltip: {
      x: { format: 'HH:mm' },
      y: {
        formatter: (value) =>
          value === null || value === undefined
            ? '—'
            : `${formatNumber(value, { decimals: 0, lang })} W`,
      },
    },
  };
}

/**
 * Human-readable label for an inverter-string key, used for stacked-bar series names/tooltip rows
 * (FR-011). Not previously surfaced as user-facing text (only used as the internal `perInverter`
 * object key `1`/`2`) — matches data-model.md's Inverter String Label table and generalizes to
 * any key present in the data rather than hard-coding `1`/`2` (FR-010).
 * @param {string | number} key
 * @returns {string}
 */
function inverterLabel(key) {
  return `WR${key}`;
}

/**
 * Union of inverter-string keys present across a set of per-period entries, numerically sorted so
 * `WR1`/`WR2`/… come out in a stable, expected order regardless of object-key iteration order.
 * @param {Array<{ perInverter: object }>} entries
 * @returns {string[]}
 */
function inverterKeysAcross(entries) {
  const keys = new Set(entries.flatMap((entry) => Object.keys(entry.perInverter)));
  return [...keys].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}

/**
 * Shared shape for the month/year/year-months bar charts: same axis/tooltip formatting, differing
 * only in categories, per-period values and bar width. Two mutually-exclusive display modes,
 * chosen by the user via the chart-breakdown-toggle (see views/chart-breakdown-toggle.js) and
 * persisted (see settings.js's getChartBreakdownMode) rather than shown together as a per-series
 * legend toggle — `'total'` (default) renders the single pre-summed "Gesamt" bar exactly as
 * before this feature; `'inverters'` renders one stacked segment per inverter string
 * (FR-006/FR-010), `chart.stacked: true` making ApexCharts compute the segment offsets so the
 * combined bar height still matches the total-mode bar exactly (FR-007). Also wires optional
 * click-through navigation to the next-finer view (FR: click a bar to drill down) — when
 * `onDataPointClick` is given, it's bound to ApexCharts' `dataPointSelection` event (receiving the
 * clicked bar's data-point index, the same regardless of mode or which stacked segment was
 * clicked — see research.md Decision 3, satisfying FR-009 with no extra wiring) and the
 * hover-darken affordance is turned on; left off entirely rather than defaulted to a no-op so a
 * chart without a drill-down target doesn't pretend to be clickable. The pointer/hand cursor
 * itself isn't set here — ApexCharts has no `plotOptions.bar.cursor` option, so `renderChart`
 * toggles a `chart-mount--clickable` class on the container instead (see app.css).
 * @param {{ categories: string[], tableCategories?: string[], totalData: number[], stringSeries:
 *   { name: string, data: number[] }[], breakdown: 'total' | 'inverters', colors: string[],
 *   columnWidth: string, xAxisTitle: string, onDataPointClick?: (dataPointIndex: number) => void
 *   }} opts - `tableCategories`, when given, is the chart-data-table's own row-label text (e.g.
 *   full "01.07.2008" dates) — kept separate from the bar chart's own short `categories` axis
 *   ticks ("01") so the table can read out full dates without widening the chart's x-axis labels
 *   to match (see extractTableData in chart-data-table.js).
 * @returns {object} Full ApexCharts options.
 */
function buildBarOptions({
  categories,
  tableCategories,
  totalData,
  stringSeries,
  breakdown,
  colors,
  columnWidth,
  xAxisTitle,
  onDataPointClick,
  lang,
}) {
  const clickEvents = onDataPointClick
    ? {
        events: {
          dataPointSelection: (event, chartContext, config) => {
            onDataPointClick(config.dataPointIndex);
          },
        },
      }
    : {};
  const showInverters = breakdown === 'inverters';
  const series = (showInverters ? stringSeries : [{ name: t('chart.total'), data: totalData }]).map(
    (s) => ({ ...s, unit: 'kWh' }),
  );
  // The table's own series list (user correction): always Gesamt+WR1+WR2 together, independent
  // of `series` above, which only holds whichever one the diagram's own breakdown toggle
  // currently selects. `totalData`/`stringSeries` are already computed unconditionally by every
  // caller (buildMonthOptions/buildYearOptions/buildYearMonthsOptions), so this is free.
  const tableSeries = [
    { name: t('chart.total'), data: totalData, unit: 'kWh' },
    ...stringSeries.map((s) => ({ ...s, unit: 'kWh' })),
  ];

  return {
    ...baseOptions(colors),
    chart: { ...baseOptions(colors).chart, type: 'bar', stacked: showInverters, ...clickEvents },
    plotOptions: { bar: { columnWidth } },
    ...(onDataPointClick ? { states: { hover: { filter: { type: 'darken' } } } } : {}),
    series,
    tableSeries,
    tableCategories,
    xaxis: { categories, title: { text: xAxisTitle } },
    yaxis: {
      title: { text: 'kWh' },
      min: 0,
      forceNiceScale: true,
      labels: { formatter: (value) => formatNumber(value, { decimals: 0, lang }) },
    },
    tooltip: showInverters
      ? {
          // Explicit `shared`/`intersect` — without it, hovering one stacked segment only shows
          // that segment's own row, not every string's value. Custom (rather than per-series
          // `y.formatter`) so a "Gesamt" row can be shown above the per-string rows (FR-008).
          shared: true,
          intersect: false,
          custom: ({ series: hoveredSeries, dataPointIndex, w }) => {
            const total = hoveredSeries.reduce(
              (sum, seriesData) => sum + (seriesData[dataPointIndex] ?? 0),
              0,
            );
            const rows = [
              tooltipRow({
                color: colors[0],
                label: t('chart.total'),
                value: formatKwh(total, { decimals: 2, lang }),
              }),
              ...stringSeries.map((s, i) =>
                tooltipRow({
                  color: w.globals.colors[i],
                  label: s.name,
                  value: formatKwh(hoveredSeries[i][dataPointIndex], { decimals: 2, lang }),
                }),
              ),
            ];
            return `<div class="apexcharts-tooltip-title">${categories[dataPointIndex]}</div>${rows.join('')}`;
          },
        }
      : { y: { formatter: (value) => formatKwh(value, { decimals: 2, lang }) } },
  };
}

function buildMonthOptions(data, colors, { onDataPointClick, lang, breakdown } = {}) {
  const stringKeys = inverterKeysAcross(data.dailyBreakdown);
  return buildBarOptions({
    categories: data.dailyBreakdown.map((d) => d.date.slice(8, 10)),
    // Full date for the data-table's own row labels (user correction) — chart-data-table.js
    // reads this instead of `categories` above, which stays the short day-of-month the bar
    // chart's x-axis already showed before this feature.
    tableCategories: data.dailyBreakdown.map((d) => {
      const [y, m, dd] = d.date.split('-').map(Number);
      return formatDate(new Date(y, m - 1, dd), { lang });
    }),
    totalData: data.dailyBreakdown.map(
      (d) => Object.values(d.perInverter).reduce((s, i) => s + (i?.yieldWh ?? 0), 0) / 1000,
    ),
    stringSeries: stringKeys.map((key) => ({
      name: inverterLabel(key),
      data: data.dailyBreakdown.map((d) => (d.perInverter[key]?.yieldWh ?? 0) / 1000),
    })),
    breakdown,
    colors,
    columnWidth: '70%',
    xAxisTitle: t('chart.dayAxis'),
    onDataPointClick,
    lang,
  });
}

function buildYearOptions(yearlyTotalsList, colors, { onDataPointClick, lang, breakdown } = {}) {
  const stringKeys = inverterKeysAcross(yearlyTotalsList);
  return buildBarOptions({
    categories: yearlyTotalsList.map((y) => String(y.year)),
    totalData: yearlyTotalsList.map(
      (y) => Object.values(y.perInverter).reduce((s, v) => s + (v ?? 0), 0) / 1000,
    ),
    // Unlike dailyBreakdown/monthlyBreakdown, yearlyTotalsList's perInverter values are plain
    // numbers (Wh), not nested under `.yieldWh` — see data-model.md's Period Breakdown Entry table.
    stringSeries: stringKeys.map((key) => ({
      name: inverterLabel(key),
      data: yearlyTotalsList.map((y) => (y.perInverter[key] ?? 0) / 1000),
    })),
    breakdown,
    colors,
    columnWidth: '60%',
    xAxisTitle: t('chart.yearAxis'),
    onDataPointClick,
    lang,
  });
}

/**
 * Bars for each calendar month of a single year (Mode 2 "Jahreserträge" detail view) — same
 * shape/rendering as buildMonthOptions' daily bars, one level up: `data.monthlyBreakdown` always
 * has 12 entries (Jan-Dec, missing months zero-filled by the caller) so the x-axis spans the
 * whole year regardless of how much of it has data yet.
 */
function buildYearMonthsOptions(data, colors, { onDataPointClick, lang, breakdown } = {}) {
  const stringKeys = inverterKeysAcross(data.monthlyBreakdown);
  return buildBarOptions({
    categories: data.monthlyBreakdown.map((m) => t(`month.short.${m.month.slice(5, 7)}`)),
    // Full "Monatsname Jahr" for the data-table's own row labels (user correction), the same
    // "month year" shape month-view.js's own page title uses — kept separate from `categories`
    // above, which stays the short month abbreviation the bar chart's x-axis already showed.
    tableCategories: data.monthlyBreakdown.map(
      (m) => `${t(`month.long.${m.month.slice(5, 7)}`)} ${m.month.slice(0, 4)}`,
    ),
    totalData: data.monthlyBreakdown.map(
      (m) => Object.values(m.perInverter).reduce((s, wh) => s + (wh ?? 0), 0) / 1000,
    ),
    stringSeries: stringKeys.map((key) => ({
      name: inverterLabel(key),
      data: data.monthlyBreakdown.map((m) => (m.perInverter[key] ?? 0) / 1000),
    })),
    breakdown,
    colors,
    columnWidth: '60%',
    xAxisTitle: t('chart.monthAxis'),
    onDataPointClick,
    lang,
  });
}

// First day-of-year (1-366, leap-year scheme with Feb = 29 days — matches data/statistics.js's
// own LEAP_CUMULATIVE_DAYS_BEFORE_MONTH) of each calendar month, 0-based month index. Shared by
// the yoy-cumulative chart's x-axis month labels and its tooltip's exact-date header below.
const YOY_MONTH_START_DAY_OF_YEAR = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];

/** @param {number} value - A dayOfYear x-axis value (1-366). @returns {number} 0-based month index. */
function yoyMonthIndex(value) {
  const rounded = Math.round(value);
  let idx = 0;
  for (let m = 0; m < YOY_MONTH_START_DAY_OF_YEAR.length; m += 1) {
    if (rounded >= YOY_MONTH_START_DAY_OF_YEAR[m]) idx = m;
  }
  return idx;
}

/**
 * Axis-tick label for a dayOfYear value — the short month name (`t('month.short.*')`), shown only
 * for odd months (Jan, Mar, Mai, Jul, Sep, Nov) so the twenty-year-wide chart's x-axis stays
 * readable instead of crowding all twelve in. Apex's own numeric-axis tick placement (min 1, max
 * 366, tickAmount 6) lands close enough to each month's start that rounding to its containing
 * month reads correctly.
 * @param {number} value
 */
function yoyAxisLabel(value) {
  const idx = yoyMonthIndex(value);
  if (idx % 2 !== 0) return '';
  return t(`month.short.${String(idx + 1).padStart(2, '0')}`);
}

/**
 * Exact-date tooltip header for a dayOfYear value, e.g. "01.01." (FR-007 UX follow-up) — a fixed
 * neutral leap year (2000) supplies the Date so Feb 29 always formats even though the actually
 * hovered year may not itself be a leap year; only day+month are ever read back out.
 * @param {number} value
 * @param {string} [lang]
 */
function yoyTooltipDate(value, lang) {
  const idx = yoyMonthIndex(value);
  const day = Math.round(value) - YOY_MONTH_START_DAY_OF_YEAR[idx] + 1;
  return formatDayMonth(new Date(Date.UTC(2000, idx, day)), { lang });
}

/**
 * Year-over-year cumulative yield comparison (022-statistics-page, FR-007) — one line per
 * calendar year present in `data`, aligned by day-of-year (see data/statistics.js's
 * computeYoyCumulative) rather than by date, so every year's curve starts at the same x origin.
 * Informational only — no onDataPointClick (research.md R3/contracts/statistics-module.md).
 * A plant with many years quickly turns this into an unreadable tangle, so `renderChart` starts
 * only the most recent three years checked in the legend (see its post-render `hideSeries` pass,
 * user request — the oldest year(s) rarely have a full year of data anyway) — every year is still
 * present and can be toggled back on to compare it directly.
 * @param {{ year: number, points: { dayOfYear: number, cumulativeKwh: number }[] }[]} data
 * @param {string[]} colors
 * @param {{ lang?: string }} [config]
 */
function buildYoyCumulativeOptions(data, colors, { lang } = {}) {
  const series = data.map((yearSeries, i) => ({
    name: String(yearSeries.year),
    data: yearSeries.points.map((p) => ({ x: p.dayOfYear, y: p.cumulativeKwh })),
    color: colors[i % colors.length],
  }));

  return {
    ...baseOptions(colors),
    chart: { ...baseOptions(colors).chart, type: 'line' },
    stroke: { width: 2, curve: 'smooth' },
    markers: { size: 0 },
    series,
    xaxis: {
      type: 'numeric',
      title: { text: t('chart.monthAxis') },
      min: 1,
      max: 366,
      tickAmount: 6,
      labels: { formatter: yoyAxisLabel },
    },
    yaxis: {
      title: { text: t('chart.cumulativeYieldAxis') },
      min: 0,
      forceNiceScale: true,
      labels: { formatter: (value) => formatNumber(value, { decimals: 0, lang }) },
    },
    tooltip: {
      // Apex's built-in `shared: true` tooltip resolves every series' row by matching
      // *dataPointIndex*, not x-value — fine when every series shares one x-axis, but each
      // year's line here has its own number of points (leap years, years still in progress), so
      // index-based matching silently showed only the one series actually under the cursor. A
      // custom tooltip instead reads the hovered x (dayOfYear) via `seriesX` and looks up each
      // *currently visible* year's nearest point to it directly, so every active year lines up
      // for direct comparison regardless of how its point count differs from the others.
      custom: ({ seriesIndex, dataPointIndex, w }) => {
        const hoveredDayOfYear = w.globals.seriesX[seriesIndex][dataPointIndex];
        const rows = data
          .map((yearSeries, i) => ({ yearSeries, i }))
          .filter(({ i }) => !w.globals.collapsedSeriesIndices.includes(i))
          .map(({ yearSeries, i }) => {
            const nearest = yearSeries.points.reduce((best, p) => {
              const diff = Math.abs(p.dayOfYear - hoveredDayOfYear);
              return !best || diff < Math.abs(best.dayOfYear - hoveredDayOfYear) ? p : best;
            }, null);
            return tooltipRow({
              color: w.globals.colors[i],
              label: String(yearSeries.year),
              value: nearest ? formatKwh(nearest.cumulativeKwh, { decimals: 2, lang }) : '—',
            });
          });
        return `<div class="apexcharts-tooltip-title">${yoyTooltipDate(hoveredDayOfYear, lang)}</div>${rows.join('')}`;
      },
    },
  };
}

/**
 * Lifetime cumulative savings (022-statistics-page, FR-007) — dual-axis line (€ feed-in revenue
 * left, CO2 avoided right), one point per year since the plant's commissioning (see
 * data/statistics.js's computeLifetimeCumulative). Clicking a point drills into that year's
 * `#/year/YYYY` view (contracts/statistics-module.md).
 *
 * `data` may carry trailing `forecast: true` entries (see data/statistics.js's forecastYears,
 * called by trends-topic.js) — "if this trend continues" years appended after the actual ones.
 * Each metric then renders as two series: the actual line in its normal color, and a second gray
 * dashed line covering the forecast years (plus the last actual year, so it connects seamlessly
 * rather than floating disconnected) — sharing the actual line's own y-axis scale (padded to the
 * forecast's own max) rather than an independently auto-scaled one, so the two segments read as
 * one continuous line. Clicking a forecast point is a no-op (user request) — there is no year
 * view for a year that hasn't happened yet.
 * @param {{ year: number, cumulativeEuro: number, cumulativeCo2Kg: number, forecast?: true }[]} data
 * @param {string[]} colors
 * @param {{ onDataPointClick?: (dataPointIndex: number) => void, lang?: string }} [config]
 */
function buildLifetimeCumulativeOptions(data, colors, { onDataPointClick, lang } = {}) {
  const clickEvents = onDataPointClick
    ? {
        events: {
          dataPointSelection: (event, chartContext, config) => {
            if (data[config.dataPointIndex]?.forecast) return;
            onDataPointClick(config.dataPointIndex);
          },
        },
      }
    : {};

  const forecastStartIndex = data.findIndex((d) => d.forecast);
  const hasForecast = forecastStartIndex !== -1;
  const splitAt = hasForecast ? forecastStartIndex : data.length;
  // The forecast segment includes index `splitAt - 1` (the last actual point) too, so its line
  // starts exactly where the actual line ends instead of leaving a gap.
  const forecastSlice = (values) => values.map((v, i) => (i >= splitAt - 1 ? v : null));
  const actualSlice = (values) => values.map((v, i) => (i < splitAt ? v : null));

  const euroValues = data.map((d) => d.cumulativeEuro);
  const co2Values = data.map((d) => d.cumulativeCo2Kg);
  const euroMax = Math.max(0, ...euroValues);
  const co2Max = Math.max(0, ...co2Values);
  const forecastSuffix = t('chart.forecastSuffix');
  const euroForecastName = `${t('chart.euroAxis')} (${forecastSuffix})`;
  const co2ForecastName = `${t('chart.co2Axis')} (${forecastSuffix})`;
  const forecastColor = getForecastColor();

  const series = [
    { name: t('chart.euroAxis'), data: actualSlice(euroValues) },
    { name: t('chart.co2Axis'), data: actualSlice(co2Values) },
    ...(hasForecast
      ? [
          { name: euroForecastName, data: forecastSlice(euroValues) },
          { name: co2ForecastName, data: forecastSlice(co2Values) },
        ]
      : []),
  ];

  const euroFormatter = (value) =>
    value === null || value === undefined ? '—' : `${formatNumber(value, { decimals: 2, lang })} €`;
  const co2Formatter = (value) =>
    value === null || value === undefined
      ? '—'
      : `${formatNumber(value, { decimals: 0, lang })} kg`;

  return {
    ...baseOptions(colors),
    chart: { ...baseOptions(colors).chart, type: 'line', ...clickEvents },
    ...(onDataPointClick ? { states: { hover: { filter: { type: 'darken' } } } } : {}),
    colors: [colors[0], colors[1], ...(hasForecast ? [forecastColor, forecastColor] : [])],
    stroke: {
      width: 2,
      curve: 'monotoneCubic',
      dashArray: hasForecast ? [0, 0, 6, 6] : [0, 0],
    },
    markers: { size: 4, hover: { size: 6 } },
    series,
    xaxis: { categories: data.map((d) => String(d.year)), title: { text: t('chart.yearAxis') } },
    yaxis: [
      {
        seriesName: t('chart.euroAxis'),
        title: { text: t('chart.euroAxis') },
        min: 0,
        max: euroMax,
        forceNiceScale: true,
        labels: { formatter: (value) => formatNumber(value, { decimals: 0, lang }) },
      },
      {
        seriesName: t('chart.co2Axis'),
        opposite: true,
        title: { text: t('chart.co2Axis') },
        min: 0,
        max: co2Max,
        forceNiceScale: true,
        labels: { formatter: (value) => formatNumber(value, { decimals: 0, lang }) },
      },
      ...(hasForecast
        ? [
            { seriesName: euroForecastName, show: false, min: 0, max: euroMax },
            { seriesName: co2ForecastName, show: false, opposite: true, min: 0, max: co2Max },
          ]
        : []),
    ],
    tooltip: {
      y: hasForecast
        ? [
            { formatter: euroFormatter },
            { formatter: co2Formatter },
            { formatter: euroFormatter },
            { formatter: co2Formatter },
          ]
        : [{ formatter: euroFormatter }, { formatter: co2Formatter }],
    },
  };
}

/**
 * Per-year specific yield (kWh/kWp) trend (022-statistics-page, FR-008) — one bar per year plus a
 * linear-regression trend line overlaid on top (see data/statistics.js's computeSpecificYieldTrend,
 * which fits both). Clicking a bar (or the trend line, aligned to the same year categories) drills
 * into that year's `#/year/YYYY` view; the degradation caveat itself is static UI copy rendered by
 * views/statistics/trends-topic.js, not part of this chart.
 *
 * `data` may carry trailing `forecast: true` entries (see data/statistics.js's forecastYears,
 * called by trends-topic.js) — `specificYieldKwhPerKwp` is `null` on those (no bar; the year
 * hasn't happened), while `trendKwhPerKwp` continues the same linear fit extrapolated forward.
 * The trend line is then split into two series so the forecast portion renders gray/dashed: the
 * actual-years line in its normal color, and a second line covering the forecast years (plus the
 * last actual year, so it connects seamlessly rather than floating disconnected).
 * @param {{ year: number, specificYieldKwhPerKwp: number | null, trendKwhPerKwp: number, forecast?: true }[]} data
 * @param {string[]} colors
 * @param {{ onDataPointClick?: (dataPointIndex: number) => void, lang?: string }} [config]
 */
function buildSpecificYieldTrendOptions(data, colors, { onDataPointClick, lang } = {}) {
  const clickEvents = onDataPointClick
    ? {
        events: {
          dataPointSelection: (event, chartContext, config) => {
            if (data[config.dataPointIndex]?.forecast) return;
            onDataPointClick(config.dataPointIndex);
          },
        },
      }
    : {};

  const forecastStartIndex = data.findIndex((d) => d.forecast);
  const hasForecast = forecastStartIndex !== -1;
  const splitAt = hasForecast ? forecastStartIndex : data.length;
  const trendValues = data.map((d) => d.trendKwhPerKwp);
  // The forecast segment includes index `splitAt - 1` (the last actual point) too, so its line
  // starts exactly where the actual trend line ends instead of leaving a gap.
  const trendActual = trendValues.map((v, i) => (i < splitAt ? v : null));
  const trendForecast = trendValues.map((v, i) => (i >= splitAt - 1 ? v : null));
  const forecastName = `${t('chart.specificYieldTrendAxis')} (${t('chart.forecastSuffix')})`;

  return {
    ...baseOptions(colors),
    // Mixed bar+line series (`chart.height: '100%'` from baseOptions() lets the SVG grow taller
    // than its container once a second legend entry is added, overflowing into whatever follows
    // in the DOM) — pinned to the container's actual CSS pixel height (see .trend-mount--combo)
    // instead, so the rendered SVG never exceeds it.
    chart: { ...baseOptions(colors).chart, type: 'line', height: 340, ...clickEvents },
    plotOptions: { bar: { columnWidth: '60%' } },
    ...(onDataPointClick ? { states: { hover: { filter: { type: 'darken' } } } } : {}),
    colors: hasForecast ? [colors[0], colors[1], getForecastColor()] : [colors[0], colors[1]],
    stroke: {
      width: hasForecast ? [0, 2, 2] : [0, 2],
      curve: 'straight',
      dashArray: hasForecast ? [0, 6, 6] : [0, 6],
    },
    markers: { size: 0 },
    series: [
      {
        name: t('chart.specificYieldAxis'),
        type: 'column',
        data: data.map((d) => d.specificYieldKwhPerKwp),
      },
      { name: t('chart.specificYieldTrendAxis'), type: 'line', data: trendActual },
      ...(hasForecast ? [{ name: forecastName, type: 'line', data: trendForecast }] : []),
    ],
    xaxis: { categories: data.map((d) => String(d.year)), title: { text: t('chart.yearAxis') } },
    yaxis: {
      title: { text: t('chart.specificYieldAxis') },
      min: 0,
      forceNiceScale: true,
      labels: { formatter: (value) => formatNumber(value, { decimals: 0, lang }) },
    },
    tooltip: {
      y: {
        formatter: (value) =>
          value === null || value === undefined ? '—' : formatKwh(value, { decimals: 2, lang }),
      },
    },
  };
}

// Singleton <style> element for `hideUdcRangeLegendEntry`, lazily created in `document.head` —
// deliberately *not* a child of the chart container: ApexCharts' `updateOptions`/`toggleSeries`
// calls (used to keep the band in sync with the line — see `legendClick` in `buildDayOptions`)
// were observed to strip a freshly-appended container child (and even a `data-*` attribute set on
// the container itself) during their internal redraw, so anything living inside/on the container
// can't be trusted to survive a toggle. A single `<head>` stylesheet has no such lifecycle tied to
// ApexCharts and simply gets its one rule's target index rewritten on every render.
let udcRangeLegendHideStyleEl;

/**
 * Hides the UDC min/max band's own legend entry so UDC has a single activation point in the
 * legend (the line's) even though it's drawn as two ApexCharts series internally — the band's
 * visibility instead tracks the line's via `toggleSeries` in `buildDayOptions`'s `legendClick`
 * handler. ApexCharts stamps each legend item's `rel` attribute with its 1-based series index;
 * this looks up the band's actual index in *this render's* `options.series` (rather than
 * assuming a fixed position, since it shifts with the feed-in breakdown mode and is absent
 * entirely on days with no UDC data) and writes a rule hiding that one legend item, scoped to
 * `.chart-container` (the app only ever mounts one day chart at a time, so this is unambiguous
 * without needing a per-instance id). A day without UDC data clears the rule rather than leaving
 * a stale one targeting the wrong index.
 * @param {{ series: { name: string }[] }} options
 * @param {string} bandSeriesName
 */
function hideUdcRangeLegendEntry(options, bandSeriesName) {
  if (typeof document === 'undefined') return;
  const bandIndex = options.series.findIndex((s) => s.name === bandSeriesName);
  if (!udcRangeLegendHideStyleEl) {
    udcRangeLegendHideStyleEl = document.createElement('style');
    udcRangeLegendHideStyleEl.dataset.role = 'udc-band-legend-hide';
    document.head.appendChild(udcRangeLegendHideStyleEl);
  }
  udcRangeLegendHideStyleEl.textContent =
    bandIndex === -1
      ? ''
      : `.chart-container .apexcharts-legend-series[rel="${bandIndex + 1}"] { display: none !important; }`;
}

function buildOptions(mode, data, colors, config) {
  switch (mode) {
    case 'day':
      return buildDayOptions(data, colors, config);
    case 'day-yield':
      return buildDayYieldOptions(data, colors, config);
    case 'day-total':
      return buildDayTotalOptions(data, colors, config);
    case 'month':
      return buildMonthOptions(data, colors, config);
    case 'year-months':
      return buildYearMonthsOptions(data, colors, config);
    case 'year':
      return buildYearOptions(data, colors, config);
    case 'yoy-cumulative':
      return buildYoyCumulativeOptions(data, colors, config);
    case 'lifetime-cumulative':
      return buildLifetimeCumulativeOptions(data, colors, config);
    case 'specific-yield-trend':
      return buildSpecificYieldTrendOptions(data, colors, config);
    default:
      throw new Error(`chart-factory: unsupported mode "${mode}"`);
  }
}

/**
 * Creates (or updates, if `container` already hosts a chart) an ApexCharts chart for one of the
 * visualization modes. Calling again on the same container with new data destroys the previous
 * chart instance before mounting a fresh one — no stacked/duplicate charts.
 * @param {HTMLElement} container - A plain `<div>` (was `<canvas>` under Chart.js); ApexCharts
 *   renders an inline SVG into it.
 * @param {'day' | 'day-yield' | 'day-total' | 'month' | 'year-months' | 'year' | 'yoy-cumulative' |
 *   'lifetime-cumulative' | 'specific-yield-trend'} mode
 * @param {object} data - Same shape per mode as before (readings/dailyBreakdown/
 *   monthlyBreakdown/yearlyTotalsList).
 * @param {{ onDataPointClick?: (dataPointIndex: number) => void, breakdown?: 'total' |
 *   'inverters' }} [config] - `onDataPointClick` wires bar-click drill-down (month/year/
 *   year-months only; ignored for the day line/area charts, which have no finer view to drill
 *   into). `breakdown` selects total vs. per-inverter for both the bar charts (stacked segments)
 *   and the day chart (feed-in split into one area per inverter string; ignored for `day-yield`,
 *   which has no per-inverter power data to split).
 * @returns {import('apexcharts')} The ApexCharts instance (for tests/cleanup).
 */
export function renderChart(container, mode, data, config) {
  const existing = charts.get(container);
  if (existing) {
    existing.destroy();
    charts.delete(container);
  }
  container.classList.toggle('chart-mount--clickable', Boolean(config?.onDataPointClick));
  const options = buildOptions(mode, data, getChartColors(), config);
  const chart = new ApexCharts(container, options);
  const rendered = chart.render();
  // Day chart's UDC and Wirkungsgrad series each restore their own persisted shown/hidden state
  // (UDC defaulting to hidden per FR-002, Wirkungsgrad defaulting to shown) — toggled by
  // ApexCharts' own default legend-click behavior (legend.onItemClick.toggleDataSeries) plus the
  // `legendClick` handler in buildDayOptions that persists each choice. UDC's entry is only
  // present when buildDayOptions actually built that series (a day with no UDC readings at all
  // omits it entirely, per FR-005); Wirkungsgrad is always present for mode 'day'. The UDC min/max
  // band has no legend entry or persisted state of its own — it mirrors the UDC line's persisted
  // visibility on load (see `hideUdcRangeLegendEntry`'s doc comment for why it's a separate
  // series at all) and stays in lockstep with it via `legendClick`'s `toggleSeries` call.
  // Chained on the render Promise rather than called synchronously right after `render()`, since
  // `hideSeries` manipulates legend/series DOM that only exists once rendering has actually
  // finished.
  if (mode === 'day') {
    const udcSeriesName = t('chart.udcAxis');
    const udcRangeSeriesName = t('chart.udcRangeAxis');
    const efficiencySeriesName = t('chart.efficiencyAxis');
    Promise.resolve(rendered).then(() => {
      const hasUdc = options.series.some((s) => s.name === udcSeriesName);
      if (hasUdc && !isDayUdcVisible()) {
        chart.hideSeries(udcSeriesName);
        chart.hideSeries(udcRangeSeriesName);
      }
      if (!isDayEfficiencyVisible()) {
        chart.hideSeries(efficiencySeriesName);
      }
      hideUdcRangeLegendEntry(options, udcRangeSeriesName);
    });
  }
  // A plant with many years of history turns the year-over-year chart into an unreadable tangle
  // of overlapping lines (user feedback) — start with only the most recent three years checked in
  // the legend (older years are more likely to be partial, e.g. the commissioning year); every
  // other year stays present and can be toggled back on individually to compare it. No-op for
  // three years or fewer, where there's nothing older to hide.
  if (mode === 'yoy-cumulative' && data.length > 3) {
    Promise.resolve(rendered).then(() => {
      for (const yearSeries of data.slice(0, -3)) {
        chart.hideSeries(String(yearSeries.year));
      }
    });
  }
  charts.set(container, chart);
  return chart;
}
