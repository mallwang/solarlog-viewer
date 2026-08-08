import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartWithStatsLayoutMarkup, statsPanelMarkup } from './stats-panel.js';

test('chartWithStatsLayoutMarkup renders a chart-container ready to receive a sibling panel', () => {
  const html = chartWithStatsLayoutMarkup();
  assert.match(html, /class="period-layout[^"]*"/);
  assert.match(html, /class="chart-container[^"]*"/);
  assert.match(html, /class="chart-mount"/);
});

test('statsPanelMarkup renders one row per entry, in order, with the given title', () => {
  const html = statsPanelMarkup('day.stats.title', [
    ['day.stats.yieldKwh', '36.6 kWh'],
    ['day.stats.ist', '169%'],
  ]);
  assert.match(html, /day\.stats\.title/);
  const yieldIndex = html.indexOf('day.stats.yieldKwh');
  const istIndex = html.indexOf('day.stats.ist');
  assert.ok(yieldIndex > -1 && istIndex > -1 && yieldIndex < istIndex);
  assert.match(html, /36\.6 kWh/);
  assert.match(html, /169%/);
});

test('statsPanelMarkup renders an empty table body for no rows', () => {
  const html = statsPanelMarkup('total.stats.title', []);
  assert.match(html, /<tbody>\s*<\/tbody>/);
});
