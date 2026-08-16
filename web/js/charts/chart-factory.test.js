import { test } from 'node:test';
import assert from 'node:assert/strict';

// chart-factory.js's module-level `ApexCharts` binding is resolved from `window.ApexCharts` at
// import time (guarded for a missing `window` — see its own comment), and its per-mode option
// builders (`buildYoyCumulativeOptions` etc.) aren't exported directly — `renderChart` is the
// only exported entry point that reaches them. These tests stub just enough of
// `window`/`document`/`ApexCharts` for `renderChart` to run under node:test, capturing the
// options object it builds for each new mode (same "valid ApexCharts option object" assertion
// style contracts/statistics-module.md calls for) via a fake `ApexCharts` constructor.
globalThis.window = globalThis.window ?? {};
globalThis.document = globalThis.document ?? {
  documentElement: { style: {} },
};
let lastOptions = null;
class FakeApexCharts {
  constructor(container, options) {
    lastOptions = options;
  }
  render() {
    return Promise.resolve();
  }
  destroy() {}
  hideSeries() {}
}
window.ApexCharts = FakeApexCharts;
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });

const { renderChart } = await import('./chart-factory.js');

function fakeContainer() {
  return { classList: { toggle() {} } };
}

test('yoy-cumulative mode produces a valid multi-series line option object', () => {
  const data = [
    {
      year: 2023,
      points: [
        { dayOfYear: 1, cumulativeKwh: 5 },
        { dayOfYear: 2, cumulativeKwh: 9 },
      ],
    },
    { year: 2024, points: [{ dayOfYear: 1, cumulativeKwh: 4 }] },
  ];
  renderChart(fakeContainer(), 'yoy-cumulative', data, { lang: 'de' });
  assert.equal(lastOptions.series.length, 2);
  assert.equal(lastOptions.series[0].name, '2023');
  assert.deepEqual(lastOptions.series[0].data[0], { x: 1, y: 5 });
  assert.equal(lastOptions.xaxis.type, 'numeric');
});

test('lifetime-cumulative mode produces a dual-axis line option object with year-click drill-down', () => {
  const data = [
    { year: 2020, cumulativeEuro: 100, cumulativeCo2Kg: 50 },
    { year: 2021, cumulativeEuro: 250, cumulativeCo2Kg: 120 },
  ];
  let clickedIndex = null;
  renderChart(fakeContainer(), 'lifetime-cumulative', data, {
    lang: 'de',
    onDataPointClick: (i) => {
      clickedIndex = i;
    },
  });
  assert.equal(lastOptions.series.length, 2);
  assert.deepEqual(lastOptions.xaxis.categories, ['2020', '2021']);
  assert.equal(lastOptions.yaxis.length, 2);
  lastOptions.chart.events.dataPointSelection(null, null, { dataPointIndex: 1 });
  assert.equal(clickedIndex, 1);
});

test('specific-yield-trend mode produces a bar+trend-line combo option object with year-click drill-down', () => {
  const data = [
    { year: 2020, specificYieldKwhPerKwp: 900, trendKwhPerKwp: 890 },
    { year: 2021, specificYieldKwhPerKwp: 880, trendKwhPerKwp: 890 },
  ];
  let clickedIndex = null;
  renderChart(fakeContainer(), 'specific-yield-trend', data, {
    lang: 'de',
    onDataPointClick: (i) => {
      clickedIndex = i;
    },
  });
  assert.equal(lastOptions.series.length, 2);
  assert.equal(lastOptions.series[0].type, 'column');
  assert.deepEqual(lastOptions.series[0].data, [900, 880]);
  assert.equal(lastOptions.series[1].type, 'line');
  assert.deepEqual(lastOptions.series[1].data, [890, 890]);
  lastOptions.chart.events.dataPointSelection(null, null, { dataPointIndex: 0 });
  assert.equal(clickedIndex, 0);
});

test('lifetime-cumulative mode splits forecast years into gray/dashed series and ignores clicks on them', () => {
  const data = [
    { year: 2020, cumulativeEuro: 100, cumulativeCo2Kg: 50 },
    { year: 2021, cumulativeEuro: 250, cumulativeCo2Kg: 120 },
    { year: 2022, cumulativeEuro: 400, cumulativeCo2Kg: 190, forecast: true },
  ];
  let clicked = false;
  renderChart(fakeContainer(), 'lifetime-cumulative', data, {
    lang: 'de',
    onDataPointClick: () => {
      clicked = true;
    },
  });
  assert.equal(lastOptions.series.length, 4);
  // Actual series stop before the forecast year; the forecast series only starts there (plus the
  // last actual point, so it connects) rather than spanning from the beginning.
  assert.deepEqual(lastOptions.series[0].data, [100, 250, null]);
  assert.deepEqual(lastOptions.series[2].data, [null, 250, 400]);
  lastOptions.chart.events.dataPointSelection(null, null, { dataPointIndex: 2 });
  assert.equal(clicked, false);
});

test('specific-yield-trend mode splits forecast years into a gray/dashed trend series and ignores clicks on them', () => {
  const data = [
    { year: 2020, specificYieldKwhPerKwp: 900, trendKwhPerKwp: 890 },
    { year: 2021, specificYieldKwhPerKwp: 880, trendKwhPerKwp: 890 },
    { year: 2022, specificYieldKwhPerKwp: null, trendKwhPerKwp: 890, forecast: true },
  ];
  let clicked = false;
  renderChart(fakeContainer(), 'specific-yield-trend', data, {
    lang: 'de',
    onDataPointClick: () => {
      clicked = true;
    },
  });
  assert.equal(lastOptions.series.length, 3);
  assert.deepEqual(lastOptions.series[0].data, [900, 880, null]);
  assert.deepEqual(lastOptions.series[1].data, [890, 890, null]);
  assert.deepEqual(lastOptions.series[2].data, [null, 890, 890]);
  lastOptions.chart.events.dataPointSelection(null, null, { dataPointIndex: 2 });
  assert.equal(clicked, false);
});
