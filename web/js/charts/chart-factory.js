import '../../vendor/apexcharts/apexcharts.esm.js';
import { t } from '../i18n.js';

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

function buildDayOptions(data, colors) {
  const inverterIndices = data.readings.length
    ? Object.keys(data.readings[0].perInverter).map(Number)
    : [];
  const categories = data.readings.map((r) => formatTimeLabel(r.timestamp));
  const series = inverterIndices.map((idx) => ({
    name: `WR${idx}`,
    data: data.readings.map((r) => r.perInverter[idx]?.pacW ?? null),
  }));

  return {
    ...baseOptions(colors),
    chart: { ...baseOptions(colors).chart, type: 'line' },
    stroke: { width: 2, curve: 'smooth' },
    markers: { size: 0 },
    series,
    xaxis: {
      categories,
      title: { text: t('chart.timeAxis') },
      tickAmount: 12,
    },
    yaxis: {
      title: { text: 'W' },
      min: 0,
    },
    tooltip: {
      y: { formatter: (value) => (value === null || value === undefined ? '—' : `${value} W`) },
    },
  };
}

function buildMonthOptions(data, colors) {
  const inverterIndices = data.dailyBreakdown.length
    ? Object.keys(data.dailyBreakdown[0].perInverter).map(Number)
    : [];
  const categories = data.dailyBreakdown.map((d) => d.date.slice(8, 10));
  const series = inverterIndices.map((idx) => ({
    name: `WR${idx}`,
    data: data.dailyBreakdown.map((d) => (d.perInverter[idx]?.yieldWh ?? 0) / 1000),
  }));

  return {
    ...baseOptions(colors),
    chart: { ...baseOptions(colors).chart, type: 'bar', stacked: true },
    plotOptions: { bar: { columnWidth: '70%' } },
    series,
    xaxis: { categories },
    yaxis: { title: { text: 'kWh' }, min: 0 },
    tooltip: {
      y: { formatter: (value) => `${value.toFixed(2)} kWh` },
    },
  };
}

function buildYearOptions(yearlyTotalsList, colors) {
  const inverterIndices = yearlyTotalsList.length
    ? Object.keys(yearlyTotalsList[0].perInverter).map(Number)
    : [];
  const categories = yearlyTotalsList.map((y) => String(y.year));
  const series = inverterIndices.map((idx) => ({
    name: `WR${idx}`,
    data: yearlyTotalsList.map((y) => (y.perInverter[idx] ?? 0) / 1000),
  }));

  return {
    ...baseOptions(colors),
    chart: { ...baseOptions(colors).chart, type: 'bar', stacked: true },
    plotOptions: { bar: { columnWidth: '60%' } },
    series,
    xaxis: { categories },
    yaxis: { title: { text: 'kWh' }, min: 0 },
    tooltip: {
      y: { formatter: (value) => `${value.toFixed(2)} kWh` },
    },
  };
}

function buildTotalOptions(lifetimeSummary, colors) {
  const byYearAscending = [...lifetimeSummary.byYear].sort((a, b) => a.year - b.year);
  const categories = byYearAscending.map((y) => String(y.year));
  let running = 0;
  const cumulativeKwh = byYearAscending.map((y) => {
    running += Object.values(y.perInverter).reduce((s, wh) => s + wh, 0) / 1000;
    return running;
  });

  return {
    ...baseOptions(colors),
    chart: { ...baseOptions(colors).chart, type: 'bar' },
    plotOptions: { bar: { columnWidth: '50%' } },
    series: [{ name: t('chart.cumulativeYield'), data: cumulativeKwh }],
    xaxis: { categories },
    yaxis: { title: { text: 'kWh' }, min: 0 },
    tooltip: {
      y: { formatter: (value) => `${value.toFixed(2)} kWh` },
    },
  };
}

function buildCompareOptions(yearComparisonSeries, colors) {
  const maxDay = yearComparisonSeries.reduce(
    (max, s) => Math.max(max, ...s.points.map((p) => p.dayOfYear)),
    0,
  );
  const categories = Array.from({ length: maxDay }, (_, i) => i + 1);
  const series = yearComparisonSeries.map((s) => {
    const byDay = new Map(s.points.map((p) => [p.dayOfYear, p.totalWh / 1000]));
    return {
      name: String(s.year),
      data: categories.map((day) => byDay.get(day) ?? null),
    };
  });

  return {
    ...baseOptions(colors),
    chart: { ...baseOptions(colors).chart, type: 'line' },
    stroke: { width: 2, curve: 'straight' },
    markers: { size: 0 },
    series,
    xaxis: {
      categories,
      title: { text: t('chart.dayOfYearAxis') },
      tickAmount: 12,
    },
    yaxis: { title: { text: 'kWh' }, min: 0 },
    tooltip: {
      y: {
        formatter: (value) =>
          value === null || value === undefined ? '—' : `${value.toFixed(2)} kWh`,
      },
    },
  };
}

function buildOptions(mode, data, colors) {
  switch (mode) {
    case 'day':
      return buildDayOptions(data, colors);
    case 'month':
      return buildMonthOptions(data, colors);
    case 'year':
      return buildYearOptions(data, colors);
    case 'total':
      return buildTotalOptions(data, colors);
    case 'compare':
      return buildCompareOptions(data, colors);
    default:
      throw new Error(`chart-factory: unsupported mode "${mode}"`);
  }
}

/**
 * Creates (or updates, if `container` already hosts a chart) an ApexCharts chart for one of the
 * 5 visualization modes. Calling again on the same container with new data destroys the previous
 * chart instance before mounting a fresh one — no stacked/duplicate charts.
 * @param {HTMLElement} container - A plain `<div>` (was `<canvas>` under Chart.js); ApexCharts
 *   renders an inline SVG into it.
 * @param {'day' | 'month' | 'year' | 'total' | 'compare'} mode
 * @param {object} data - Same shape per mode as before (readings/dailyBreakdown/
 *   yearlyTotalsList/lifetimeSummary/yearComparisonSeries).
 * @returns {import('apexcharts')} The ApexCharts instance (for tests/cleanup).
 */
export function renderChart(container, mode, data) {
  const existing = charts.get(container);
  if (existing) {
    existing.destroy();
    charts.delete(container);
  }
  const options = buildOptions(mode, data, getChartColors());
  const chart = new ApexCharts(container, options);
  chart.render();
  charts.set(container, chart);
  return chart;
}
