import '../../vendor/chart.js/chart.esm.js';
import { t } from '../i18n.js';

// vendor/chart.js/chart.esm.js is Chart.js's UMD build; loaded as an ES module for its
// side effect of attaching `window.Chart` (no bundler-free single-file ESM build is published).
// Guarded for node:test, which imports view modules (for their pure helper exports) without a DOM.
const Chart = typeof window !== 'undefined' ? window.Chart : undefined;

const INVERTER_COLORS = [
  'var(--chart-color-1)',
  'var(--chart-color-2)',
  'var(--chart-color-3)',
  'var(--chart-color-4)',
  'var(--chart-color-5)',
  'var(--chart-color-6)',
];

const charts = new WeakMap();

function formatTimeLabel(isoTimestamp) {
  return isoTimestamp.slice(11, 16);
}

function buildDayConfig(data) {
  const inverterIndices = data.readings.length
    ? Object.keys(data.readings[0].perInverter).map(Number)
    : [];
  const labels = data.readings.map((r) => formatTimeLabel(r.timestamp));
  const datasets = inverterIndices.map((idx, i) => ({
    label: `WR${idx}`,
    data: data.readings.map((r) => r.perInverter[idx]?.pacW ?? null),
    borderColor: INVERTER_COLORS[i % INVERTER_COLORS.length],
    backgroundColor: INVERTER_COLORS[i % INVERTER_COLORS.length],
    fill: false,
    tension: 0.15,
    pointRadius: 0,
  }));

  return {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: t('chart.timeAxis') },
          ticks: { maxTicksLimit: 12 },
        },
        y: {
          title: { display: true, text: 'W' },
          beginAtZero: true,
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label(ctx) {
              return `${ctx.dataset.label}: ${ctx.formattedValue} W`;
            },
          },
        },
      },
    },
  };
}

function buildMonthConfig(data) {
  const inverterIndices = data.dailyBreakdown.length
    ? Object.keys(data.dailyBreakdown[0].perInverter).map(Number)
    : [];
  const labels = data.dailyBreakdown.map((d) => d.date.slice(8, 10));
  const datasets = inverterIndices.map((idx, i) => ({
    label: `WR${idx}`,
    data: data.dailyBreakdown.map((d) => (d.perInverter[idx]?.yieldWh ?? 0) / 1000),
    backgroundColor: INVERTER_COLORS[i % INVERTER_COLORS.length],
  }));

  return {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, title: { display: true, text: 'kWh' }, beginAtZero: true },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label(ctx) {
              return `${ctx.dataset.label}: ${ctx.formattedValue} kWh`;
            },
          },
        },
      },
    },
  };
}

function buildYearConfig(yearlyTotalsList) {
  const inverterIndices = yearlyTotalsList.length
    ? Object.keys(yearlyTotalsList[0].perInverter).map(Number)
    : [];
  const labels = yearlyTotalsList.map((y) => String(y.year));
  const datasets = inverterIndices.map((idx, i) => ({
    label: `WR${idx}`,
    data: yearlyTotalsList.map((y) => (y.perInverter[idx] ?? 0) / 1000),
    backgroundColor: INVERTER_COLORS[i % INVERTER_COLORS.length],
  }));

  return {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, title: { display: true, text: 'kWh' }, beginAtZero: true },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label(ctx) {
              return `${ctx.dataset.label}: ${ctx.formattedValue} kWh`;
            },
          },
        },
      },
    },
  };
}

function buildTotalConfig(lifetimeSummary) {
  const byYearAscending = [...lifetimeSummary.byYear].sort((a, b) => a.year - b.year);
  const labels = byYearAscending.map((y) => String(y.year));
  let running = 0;
  const cumulativeKwh = byYearAscending.map((y) => {
    running += Object.values(y.perInverter).reduce((s, wh) => s + wh, 0) / 1000;
    return running;
  });

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: t('chart.cumulativeYield'),
          data: cumulativeKwh,
          backgroundColor: INVERTER_COLORS[0],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { title: { display: true, text: 'kWh' }, beginAtZero: true } },
      plugins: {
        tooltip: {
          callbacks: {
            label(ctx) {
              return `${ctx.dataset.label}: ${ctx.formattedValue} kWh`;
            },
          },
        },
      },
    },
  };
}

function buildCompareConfig(yearComparisonSeries) {
  const maxDay = yearComparisonSeries.reduce(
    (max, s) => Math.max(max, ...s.points.map((p) => p.dayOfYear)),
    0,
  );
  const labels = Array.from({ length: maxDay }, (_, i) => i + 1);
  const datasets = yearComparisonSeries.map((series, i) => {
    const byDay = new Map(series.points.map((p) => [p.dayOfYear, p.totalWh / 1000]));
    return {
      label: String(series.year),
      data: labels.map((day) => byDay.get(day) ?? null),
      borderColor: INVERTER_COLORS[i % INVERTER_COLORS.length],
      backgroundColor: INVERTER_COLORS[i % INVERTER_COLORS.length],
      fill: false,
      pointRadius: 0,
      spanGaps: true,
    };
  });

  return {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: t('chart.dayOfYearAxis') },
        },
        y: { title: { display: true, text: 'kWh' }, beginAtZero: true },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label(ctx) {
              return `${ctx.dataset.label}, day ${ctx.label}: ${ctx.formattedValue} kWh`;
            },
          },
        },
      },
    },
  };
}

function buildConfig(mode, data) {
  switch (mode) {
    case 'day':
      return buildDayConfig(data);
    case 'month':
      return buildMonthConfig(data);
    case 'year':
      return buildYearConfig(data);
    case 'total':
      return buildTotalConfig(data);
    case 'compare':
      return buildCompareConfig(data);
    default:
      throw new Error(`chart-factory: unsupported mode "${mode}"`);
  }
}

/**
 * Creates (or updates, if `canvas` already has a Chart instance) a Chart.js chart for one of the
 * 5 modes. Calling again on the same canvas with new data updates the existing chart in place
 * rather than stacking multiple canvases.
 * @param {HTMLCanvasElement} canvas
 * @param {'day' | 'month' | 'year' | 'total' | 'compare'} mode
 * @param {object} data
 * @param {{ lang: 'de' | 'en' }} [options] - Accepted for contract compatibility; axis/legend
 *   text is sourced from the i18n module's current language directly, so callers may omit it.
 * @returns {import('chart.js').Chart}
 */
export function renderChart(canvas, mode, data) {
  const existing = charts.get(canvas);
  if (existing) {
    existing.destroy();
    charts.delete(canvas);
  }
  const config = buildConfig(mode, data);
  const chart = new Chart(canvas, config);
  charts.set(canvas, chart);
  return chart;
}
