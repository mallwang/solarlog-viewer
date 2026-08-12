import '../../vendor/apexcharts/apexcharts.esm.js';
import { t } from '../i18n.js';
import { formatNumber, formatKwh } from '../format.js';
import { efficiencyPercent, efficiencySums } from '../data/efficiency.js';
import { isDayUdcVisible, setDayUdcVisible } from '../settings.js';

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

// Fixed (not palette-driven) so "Wirkungsgrad" stays legible against the sky background even
// in transparency mode, where a blue line washes out against the blue sky.
const EFFICIENCY_LINE_COLOR = '#2e7d32';

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
 * Sums a reading's UDC (DC string voltage) across every reporting inverter string. `udcV` is
 * per-inverter *array*-valued (one element per DC string on that inverter — see
 * `web/js/data/min-file.js`'s `parseSb4200Block`/`parseSb2100Block`, mirroring how `pdcW` is
 * flattened by `efficiencySums`), so this flattens all strings' arrays before reusing
 * `sumPerInverter`'s present-value-only summation (`null` when no string reports a value for that
 * point, per FR-001/Edge Cases).
 * @param {Record<string|number, { udcV?: number[] | null }>} perInverter
 * @returns {number | null}
 */
function sumUdcVolts(perInverter) {
  const allStrings = Object.values(perInverter ?? {}).flatMap((inv) => inv?.udcV ?? []);
  return sumPerInverter(allStrings);
}

function buildDayOptions(data, colors, { lang } = {}) {
  const timestamps = data.readings.map((r) => new Date(r.timestamp).getTime());
  // Omitted entirely (not merely hidden) when the day has no UDC readings at all — e.g. an
  // older epoch whose min-file format predates volt reporting — so no "UDC" legend entry is
  // offered at all, per FR-005.
  const hasUdcData = data.readings.some((r) => sumUdcVolts(r.perInverter) !== null);

  const series = [
    {
      name: t('chart.feedInAxis'),
      type: 'area',
      data: data.readings.map((r, i) => ({
        x: timestamps[i],
        y: sumPerInverter(Object.values(r.perInverter).map((inv) => inv?.pacW)),
      })),
    },
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
              y: sumUdcVolts(r.perInverter),
            })),
          },
        ]
      : []),
  ];
  const seriesColors = hasUdcData
    ? [colors[0], EFFICIENCY_LINE_COLOR, colors[2]]
    : [colors[0], EFFICIENCY_LINE_COLOR];

  return {
    ...baseOptions(colors),
    chart: {
      ...baseOptions(colors).chart,
      type: 'line',
      // Persists the UDC line's shown/hidden state across visits (per updated Edge Cases —
      // unlike the day chart's other series, UDC's visibility is now remembered). Fires on every
      // legend click, not only UDC's, so it's guarded to the UDC series index (2 — series order
      // above is fixed: feed-in, efficiency, UDC). ApexCharts applies its own default
      // show/hide toggle after invoking this callback, so the resulting visibility is read one
      // tick later via `collapsedSeriesIndices` (same check the tooltip already uses) rather
      // than assumed from the click alone.
      events: hasUdcData
        ? {
            legendClick: (chartContext, seriesIndex) => {
              if (seriesIndex !== 2) return;
              window.setTimeout(() => {
                const hidden = chartContext.w.globals.collapsedSeriesIndices.includes(seriesIndex);
                setDayUdcVisible(!hidden);
              }, 0);
            },
          }
        : undefined,
    },
    colors: seriesColors,
    stroke: { width: hasUdcData ? [2, 2, 2] : [2, 2], curve: 'smooth' },
    fill: {
      type: hasUdcData ? ['gradient', 'solid', 'solid'] : ['gradient', 'solid'],
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
    },
    yaxis: [
      {
        seriesName: t('chart.feedInAxis'),
        title: { text: t('chart.feedInAxis') },
        min: 0,
        forceNiceScale: true,
        labels: { formatter: (value) => formatNumber(value, { decimals: 0, lang }) },
      },
      {
        seriesName: t('chart.efficiencyAxis'),
        opposite: true,
        title: { text: t('chart.efficiencyAxis') },
        forceNiceScale: true,
        labels: { formatter: (value) => formatNumber(value, { decimals: 0, lang }) },
      },
      ...(hasUdcData
        ? [
            {
              seriesName: t('chart.udcAxis'),
              show: false,
              opposite: true,
              min: 0,
              forceNiceScale: true,
            },
          ]
        : []),
    ],
    tooltip: {
      // Custom (rather than per-series `y.formatter`) so the Wirkungsgrad row can show its
      // PAC ⁄ PDC calculation as a sub-line under the percentage.
      custom: ({ series: hoveredSeries, dataPointIndex, w }) => {
        const pacValue = hoveredSeries[0][dataPointIndex];
        const pctValue = hoveredSeries[1][dataPointIndex];
        const { pacW, pdcW } = efficiencySums(data.readings[dataPointIndex]?.perInverter);
        const rows = [
          tooltipRow({
            color: w.globals.colors[0],
            label: t('chart.feedInAxis'),
            value:
              pacValue === null || pacValue === undefined
                ? '—'
                : `${formatNumber(pacValue, { decimals: 0, lang })} W`,
          }),
          tooltipRow({
            color: w.globals.colors[1],
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
        ];
        // The UDC row only appears while the series is currently visible (FR-004) — checked via
        // ApexCharts' own collapsed-series tracking on `w.globals`, consistent with how this
        // function already reads `w.globals.colors` for the other rows' markers.
        if (hasUdcData && !w.globals.collapsedSeriesIndices.includes(2)) {
          const udcValue = hoveredSeries[2]?.[dataPointIndex];
          rows.push(
            tooltipRow({
              color: w.globals.colors[2],
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
  const series = [
    {
      name: t('chart.total'),
      data: data.readings.map((r) => ({
        x: new Date(r.timestamp).getTime(),
        y: sumPerInverter(Object.values(r.perInverter).map((i) => i?.dailyYieldWh)),
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
 * @param {{ onDataPointClick?: (dataPointIndex: number) => void }} [config] - `onDataPointClick`
 *   wires bar-click drill-down (month/year/year-months only; ignored for the day line/area
 *   charts, which have no finer view to drill into).
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
  // Day chart's UDC series is present in the legend, defaulting to hidden (FR-002) unless the
  // user previously revealed it — toggled by ApexCharts' own default legend-click behavior
  // (legend.onItemClick.toggleDataSeries) plus the `legendClick` handler in buildDayOptions
  // that persists the choice. Only present when buildDayOptions actually built the series (a day
  // with no UDC readings at all omits it entirely, per FR-005). Chained on the render Promise
  // rather than called synchronously right after `render()`, since `hideSeries` manipulates
  // legend/series DOM that only exists once rendering has actually finished.
  const udcSeriesName = t('chart.udcAxis');
  if (
    mode === 'day' &&
    options.series.some((s) => s.name === udcSeriesName) &&
    !isDayUdcVisible()
  ) {
    Promise.resolve(rendered).then(() => chart.hideSeries(udcSeriesName));
  }
  charts.set(container, chart);
  return chart;
}
