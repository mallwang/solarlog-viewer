import '../../vendor/apexcharts/apexcharts.esm.js';
import { t } from '../i18n.js';
import { formatNumber, formatKwh } from '../format.js';
import { efficiencyPercent, efficiencySums } from '../data/efficiency.js';
import {
  isDayUdcVisible,
  setDayUdcVisible,
  isDayEfficiencyVisible,
  setDayEfficiencyVisible,
} from '../settings.js';
import { DAY_CHART_AXES, DAY_CHART_X_AXIS_RANGE, DAY_CHART_X_AXIS_PADDING_MINUTES } from '../config.js';

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
 * Averages a reading's UDC (DC string voltage) across every reporting inverter string. `udcV` is
 * per-inverter *array*-valued (one element per DC string on that inverter — see
 * `web/js/data/min-file.js`'s `parseSb4200Block`/`parseSb2100Block`, mirroring how `pdcW` is
 * flattened by `efficiencySums`), so this flattens all strings' arrays first. Averaged rather
 * than summed: a string's voltage is the same kind of quantity regardless of how many strings are
 * reporting, so summing them (as the chart previously did) produced a "UDC" north of 1000 V that
 * doesn't correspond to any real voltage in the system — the average is the representative single
 * value the single legend entry implies. `null` when no string reports a value for that point,
 * per FR-001/Edge Cases.
 * @param {Record<string|number, { udcV?: number[] | null }>} perInverter
 * @returns {number | null}
 */
function averageUdcVolts(perInverter) {
  const allStrings = Object.values(perInverter ?? {}).flatMap((inv) => inv?.udcV ?? []);
  const present = allStrings.filter((v) => v !== null && v !== undefined);
  return present.length ? present.reduce((s, v) => s + v, 0) / present.length : null;
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
      data: data.readings.map((r, i) => ({
        x: timestamps[i],
        y: sumPerInverter(Object.values(r.perInverter).map((inv) => inv?.pacW)),
      })),
    },
  ];
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
  const hasUdcData = data.readings.some((r) => averageUdcVolts(r.perInverter) !== null);
  const stringKeys = inverterKeysAcross(data.readings);
  const feedInSeries = buildFeedInSeries(data, timestamps, breakdown, stringKeys);
  // Series order is always feed-in segment(s), then efficiency, then (optionally) UDC — indices
  // below are derived from that rather than hard-coded, since the feed-in segment count now
  // varies with the breakdown toggle.
  const efficiencyIndex = feedInSeries.length;
  const udcIndex = efficiencyIndex + 1;

  const series = [
    ...feedInSeries,
    {
      name: t('chart.efficiencyAxis'),
      type: 'line',
      data: data.readings.map((r, i) => ({
        x: timestamps[i],
        y: efficiencyPercent(r.perInverter),
      })),
    },
    ...(hasUdcData
      ? [
          {
            name: t('chart.udcAxis'),
            type: 'line',
            data: data.readings.map((r, i) => ({
              x: timestamps[i],
              y: averageUdcVolts(r.perInverter),
            })),
          },
        ]
      : []),
  ];
  // Feed-in segment(s) use colors[0] (total, or WR1) / colors[1] (WR2) — the same slots the
  // month/year/total bar charts already use for "Gesamt"/WR1/WR2 — while Wirkungsgrad and UDC
  // sit in their own fixed slots regardless of how many feed-in segments there are, so neither
  // ever collides with a feed-in color.
  const seriesColors = [
    ...feedInSeries.map((_, i) => colors[i]),
    colors[EFFICIENCY_COLOR_INDEX],
    ...(hasUdcData ? [colors[UDC_COLOR_INDEX]] : []),
  ];

  return {
    ...baseOptions(colors),
    chart: {
      ...baseOptions(colors).chart,
      type: 'line',
      // Persists the Wirkungsgrad and UDC lines' shown/hidden state across visits (per updated
      // Edge Cases — unlike the feed-in series, these two are remembered). Fires on every legend
      // click, so it's guarded to each series' own index (derived above — series order is fixed:
      // feed-in segment(s), efficiency, UDC) and dispatched to that series' own setter.
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
              chartContext.updateOptions(
                { yaxis: chartContext.w.config.yaxis.map((y, i) => (i === udcIndex ? { ...y, show: !hidden } : y)) },
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
      width: series.map(() => 2),
      curve: 'smooth',
    },
    fill: {
      type: [
        ...feedInSeries.map((s) => (s.type === 'area' ? 'gradient' : 'solid')),
        'solid',
        ...(hasUdcData ? ['solid'] : []),
      ],
      gradient: {
        type: 'vertical',
        shade: 'light',
        shadeIntensity: 0.3,
        opacityFrom: 0.8,
        opacityTo: 0.25,
      },
    },
    // Explicit per-series colors: without this, ApexCharts' hover markers both pick up the
    // area series' color (mixed area+line charts don't reliably fall back to the top-level
    // `colors` array for marker fills), so the Wirkungsgrad hover dot showed up orange too.
    markers: { size: 0, hover: { size: 5 }, colors: seriesColors },
    series,
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
        if (hasUdcData && !w.globals.collapsedSeriesIndices.includes(udcIndex)) {
          const udcValue = hoveredSeries[udcIndex]?.[dataPointIndex];
          rows.push(
            tooltipRow({
              color: w.globals.colors[udcIndex],
              label: t('chart.udcAxis'),
              value:
                udcValue === null || udcValue === undefined
                  ? '—'
                  : `${formatNumber(udcValue, { decimals: 0, lang })} V`,
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
 * @param {{ categories: string[], totalData: number[], stringSeries: { name: string, data:
 *   number[] }[], breakdown: 'total' | 'inverters', colors: string[], columnWidth: string,
 *   xAxisTitle: string, onDataPointClick?: (dataPointIndex: number) => void }} opts
 * @returns {object} Full ApexCharts options.
 */
function buildBarOptions({
  categories,
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
  const series = showInverters ? stringSeries : [{ name: t('chart.total'), data: totalData }];

  return {
    ...baseOptions(colors),
    chart: { ...baseOptions(colors).chart, type: 'bar', stacked: showInverters, ...clickEvents },
    plotOptions: { bar: { columnWidth } },
    ...(onDataPointClick ? { states: { hover: { filter: { type: 'darken' } } } } : {}),
    series,
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

function buildOptions(mode, data, colors, config) {
  switch (mode) {
    case 'day':
      return buildDayOptions(data, colors, config);
    case 'day-yield':
      return buildDayYieldOptions(data, colors, config);
    case 'month':
      return buildMonthOptions(data, colors, config);
    case 'year-months':
      return buildYearMonthsOptions(data, colors, config);
    case 'year':
      return buildYearOptions(data, colors, config);
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
 * @param {'day' | 'day-yield' | 'month' | 'year-months' | 'year'} mode
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
  // omits it entirely, per FR-005); Wirkungsgrad is always present for mode 'day'. Chained on the
  // render Promise rather than called synchronously right after `render()`, since `hideSeries`
  // manipulates legend/series DOM that only exists once rendering has actually finished.
  if (mode === 'day') {
    const udcSeriesName = t('chart.udcAxis');
    const efficiencySeriesName = t('chart.efficiencyAxis');
    Promise.resolve(rendered).then(() => {
      if (options.series.some((s) => s.name === udcSeriesName) && !isDayUdcVisible()) {
        chart.hideSeries(udcSeriesName);
      }
      if (!isDayEfficiencyVisible()) {
        chart.hideSeries(efficiencySeriesName);
      }
    });
  }
  charts.set(container, chart);
  return chart;
}
