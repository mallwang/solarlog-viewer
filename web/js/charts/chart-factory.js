import '../../vendor/apexcharts/apexcharts.esm.js';
import { t } from '../i18n.js';
import { formatNumber, formatKwh } from '../format.js';
import { efficiencyPercent } from '../data/efficiency.js';

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

function formatTimeLabel(isoTimestamp) {
  return isoTimestamp.slice(11, 16);
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

function buildDayOptions(data, colors, { lang } = {}) {
  const categories = data.readings.map((r) => formatTimeLabel(r.timestamp));
  const series = [
    {
      name: t('chart.total'),
      data: data.readings.map((r) =>
        sumPerInverter(Object.values(r.perInverter).map((i) => i?.pacW)),
      ),
    },
    {
      name: t('chart.efficiencyAxis'),
      data: data.readings.map((r) => efficiencyPercent(r.perInverter)),
    },
  ];

  return {
    ...baseOptions(colors),
    chart: { ...baseOptions(colors).chart, type: 'area' },
    stroke: { width: 2, curve: 'smooth' },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.8, opacityTo: 0.25 } },
    markers: { size: 0 },
    series,
    xaxis: {
      categories,
      title: { text: t('chart.timeAxis') },
      tickAmount: 12,
    },
    yaxis: [
      {
        seriesName: t('chart.total'),
        title: { text: 'W' },
        min: 0,
      },
      {
        seriesName: t('chart.efficiencyAxis'),
        opposite: true,
        title: { text: t('chart.efficiencyAxis') },
      },
    ],
    tooltip: {
      y: [
        {
          formatter: (value) =>
            value === null || value === undefined
              ? '—'
              : `${formatNumber(value, { decimals: 0, lang })} W`,
        },
        {
          formatter: (value) =>
            value === null || value === undefined
              ? '—'
              : `${formatNumber(value, { decimals: 0, lang })}%`,
        },
      ],
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
  const categories = data.readings.map((r) => formatTimeLabel(r.timestamp));
  const series = [
    {
      name: t('chart.total'),
      data: data.readings.map((r) =>
        sumPerInverter(Object.values(r.perInverter).map((i) => i?.dailyYieldWh)),
      ),
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
      categories,
      title: { text: t('chart.timeAxis') },
      tickAmount: 12,
    },
    yaxis: {
      title: { text: 'Wh' },
      min: 0,
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
 * Shared shape for the month/year/year-months bar charts: same axis/tooltip formatting, differing
 * only in categories, series values and bar width. Also wires optional click-through navigation to
 * the next-finer view (FR: click a bar to drill down) — when `onDataPointClick` is given, it's
 * bound to ApexCharts' `dataPointSelection` event (receiving the clicked bar's data-point index)
 * and the hover-darken affordance is turned on; left off entirely rather than defaulted to a no-op
 * so a chart without a drill-down target doesn't pretend to be clickable. The pointer/hand cursor
 * itself isn't set here — ApexCharts has no `plotOptions.bar.cursor` option, so `renderChart`
 * toggles a `chart-mount--clickable` class on the container instead (see app.css).
 * @param {{ categories: string[], seriesData: number[], colors: string[], columnWidth: string,
 *   onDataPointClick?: (dataPointIndex: number) => void }} opts
 * @returns {object} Full ApexCharts options.
 */
function buildBarOptions({ categories, seriesData, colors, columnWidth, onDataPointClick, lang }) {
  const clickEvents = onDataPointClick
    ? {
        events: {
          dataPointSelection: (event, chartContext, config) => {
            onDataPointClick(config.dataPointIndex);
          },
        },
      }
    : {};

  return {
    ...baseOptions(colors),
    chart: { ...baseOptions(colors).chart, type: 'bar', ...clickEvents },
    plotOptions: { bar: { columnWidth } },
    ...(onDataPointClick ? { states: { hover: { filter: { type: 'darken' } } } } : {}),
    series: [{ name: t('chart.total'), data: seriesData }],
    xaxis: { categories },
    yaxis: {
      title: { text: 'kWh' },
      min: 0,
      forceNiceScale: true,
      labels: { formatter: (value) => formatNumber(value, { decimals: 0, lang }) },
    },
    tooltip: {
      y: { formatter: (value) => formatKwh(value, { decimals: 2, lang }) },
    },
  };
}

function buildMonthOptions(data, colors, { onDataPointClick, lang } = {}) {
  return buildBarOptions({
    categories: data.dailyBreakdown.map((d) => d.date.slice(8, 10)),
    seriesData: data.dailyBreakdown.map(
      (d) => Object.values(d.perInverter).reduce((s, i) => s + (i?.yieldWh ?? 0), 0) / 1000,
    ),
    colors,
    columnWidth: '70%',
    onDataPointClick,
    lang,
  });
}

function buildYearOptions(yearlyTotalsList, colors, { onDataPointClick, lang } = {}) {
  return buildBarOptions({
    categories: yearlyTotalsList.map((y) => String(y.year)),
    seriesData: yearlyTotalsList.map(
      (y) => Object.values(y.perInverter).reduce((s, v) => s + (v ?? 0), 0) / 1000,
    ),
    colors,
    columnWidth: '60%',
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
function buildYearMonthsOptions(data, colors, { onDataPointClick, lang } = {}) {
  return buildBarOptions({
    categories: data.monthlyBreakdown.map((m) => t(`month.short.${m.month.slice(5, 7)}`)),
    seriesData: data.monthlyBreakdown.map(
      (m) => Object.values(m.perInverter).reduce((s, wh) => s + (wh ?? 0), 0) / 1000,
    ),
    colors,
    columnWidth: '60%',
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
  chart.render();
  charts.set(container, chart);
  return chart;
}
