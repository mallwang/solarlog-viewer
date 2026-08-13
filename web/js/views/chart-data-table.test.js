import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTableData } from './chart-data-table.js';

test('extractTableData: bar-chart options (categories + one total series)', () => {
  const options = {
    series: [{ name: 'Gesamt', data: [10, 20, 30] }],
    xaxis: { categories: ['01.07.', '02.07.', '03.07.'] },
  };
  const { columns, rows } = extractTableData(options);
  assert.deepEqual(columns, ['Gesamt']);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { label: '01.07.', values: [10] });
  assert.deepEqual(rows[2], { label: '03.07.', values: [30] });
});

test('extractTableData: prefers options.tableCategories over xaxis.categories for row labels', () => {
  const options = {
    series: [{ name: 'Gesamt', data: [10, 20] }],
    xaxis: { categories: ['01', '02'] },
    tableCategories: ['01.07.2008', '02.07.2008'],
  };
  const { rows } = extractTableData(options);
  assert.deepEqual(
    rows.map((r) => r.label),
    ['01.07.2008', '02.07.2008'],
  );
});

test('extractTableData: prefers options.tableSeries over options.series (always Gesamt+WR1+WR2, independent of the diagram breakdown toggle)', () => {
  const options = {
    // Diagram currently shows only the per-inverter breakdown (no "Gesamt" column) …
    series: [
      { name: 'WR1', data: [5, 6] },
      { name: 'WR2', data: [7, 8] },
    ],
    // … but the table should show all three regardless.
    tableSeries: [
      { name: 'Gesamt', data: [12, 14] },
      { name: 'WR1', data: [5, 6] },
      { name: 'WR2', data: [7, 8] },
    ],
    xaxis: { categories: ['Jan', 'Feb'] },
  };
  const { columns, rows } = extractTableData(options);
  assert.deepEqual(columns, ['Gesamt', 'WR1', 'WR2']);
  assert.deepEqual(rows[0].values, [12, 5, 7]);
});

test('extractTableData: bar-chart options with multiple per-inverter series (breakdown mode)', () => {
  const options = {
    series: [
      { name: 'WR1', data: [5, 6] },
      { name: 'WR2', data: [7, 8] },
    ],
    xaxis: { categories: ['Jan', 'Feb'] },
  };
  const { columns, rows } = extractTableData(options);
  assert.deepEqual(columns, ['WR1', 'WR2']);
  assert.deepEqual(rows, [
    { label: 'Jan', values: [5, 7] },
    { label: 'Feb', values: [6, 8] },
  ]);
});

test('extractTableData: day-chart options (datetime xaxis, {x,y} series pairs)', () => {
  const t0 = Date.UTC(2026, 6, 1, 6, 0);
  const t1 = Date.UTC(2026, 6, 1, 6, 5);
  const options = {
    xaxis: { type: 'datetime' },
    series: [
      {
        name: 'Einspeisung (W)',
        data: [
          { x: t0, y: 100 },
          { x: t1, y: null },
        ],
      },
      {
        name: 'Wirkungsgrad (%)',
        data: [
          { x: t0, y: 95 },
          { x: t1, y: 96 },
        ],
      },
    ],
  };
  const { columns, rows } = extractTableData(options);
  assert.deepEqual(columns, ['Einspeisung (W)', 'Wirkungsgrad (%)']);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].values, [100, 95]);
  assert.deepEqual(rows[1].values, [null, 96]);
  // Label is derived from the timestamp, not hard-coded — just confirm it's a non-empty string.
  assert.equal(typeof rows[0].label, 'string');
  assert.ok(rows[0].label.length > 0);
});

test('extractTableData: day-chart UDC range band series (y as [min,max] tuple)', () => {
  const t0 = Date.UTC(2026, 6, 1, 6, 0);
  const options = {
    xaxis: { type: 'datetime' },
    series: [
      {
        name: 'UDC-Bereich',
        data: [{ x: t0, y: [220, 235] }],
      },
    ],
  };
  const { rows } = extractTableData(options);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].values[0], [220, 235]);
});

test('extractTableData: zero data points produces zero rows (empty state)', () => {
  const options = {
    series: [{ name: 'Gesamt', data: [] }],
    xaxis: { categories: [] },
  };
  const { columns, rows } = extractTableData(options);
  assert.deepEqual(columns, ['Gesamt']);
  assert.deepEqual(rows, []);
});

test('extractTableData: no series at all produces zero columns and zero rows', () => {
  const { columns, rows } = extractTableData({ series: [], xaxis: { categories: [] } });
  assert.deepEqual(columns, []);
  assert.deepEqual(rows, []);
});
