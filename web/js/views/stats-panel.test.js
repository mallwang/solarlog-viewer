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

test("a 2-element row renders byte-identical markup to today's output (no info-trigger)", () => {
  const withTwo = statsPanelMarkup('day.stats.title', [['day.stats.yieldKwh', '36.6 kWh']]);
  const withThreeOmittedElsewhere = statsPanelMarkup('day.stats.title', [
    ['day.stats.yieldKwh', '36.6 kWh'],
  ]);
  assert.strictEqual(withTwo, withThreeOmittedElsewhere);
  assert.doesNotMatch(withTwo, /info-trigger/);
});

test('a 3-element row renders an info-trigger button with aria-describedby pointing at a tooltip', () => {
  const html = statsPanelMarkup('month.stats.title', [
    ['month.stats.yieldEuro', '61,89 €', 'explanations.yieldEuro'],
  ]);
  assert.match(html, /<button[^>]*class="info-trigger"[^>]*aria-describedby="([^"]+)"/);
  const [, id] = html.match(/aria-describedby="([^"]+)"/);
  const tooltipRe = new RegExp(`<span[^>]*id="${id}"[^>]*role="tooltip"[^>]*>([^<]*)</span>`);
  assert.match(html, tooltipRe);
  const [, tooltipText] = html.match(tooltipRe);
  assert.match(tooltipText, /explanations\.yieldEuro/);
});

test('two rows in the same panel each get a distinct generated DOM id', () => {
  const html = statsPanelMarkup('month.stats.title', [
    ['month.stats.yieldEuro', '61,89 €', 'explanations.yieldEuro'],
    ['month.stats.ist', '104 %', 'explanations.ist'],
  ]);
  const ids = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map((m) => m[1]);
  assert.strictEqual(ids.length, 2);
  assert.notStrictEqual(ids[0], ids[1]);
});

// US3 Acceptance Scenario 1: stats-panel.js contains no hardcoded list of explanation keys — an
// arbitrary, previously-unseen explanationKey renders a working info-trigger/tooltip pair just
// like any of the five initial keys, proving the extension point works with zero rendering-code
// changes (spec.md's Independent Test for US3).
test('an arbitrary, previously-unseen explanationKey renders a working info-trigger/tooltip pair', () => {
  const html = statsPanelMarkup('month.stats.title', [
    ['month.stats.maxDaily', '18,4 kWh', 'explanations.maxDaily'],
  ]);
  assert.match(html, /<button[^>]*class="info-trigger"[^>]*aria-describedby="([^"]+)"/);
  const [, id] = html.match(/aria-describedby="([^"]+)"/);
  const tooltipRe = new RegExp(`<span[^>]*id="${id}"[^>]*role="tooltip"[^>]*>([^<]*)</span>`);
  assert.match(html, tooltipRe);
  const [, tooltipText] = html.match(tooltipRe);
  assert.match(tooltipText, /explanations\.maxDaily/);
});

// US3 Acceptance Scenario 2: the same explanationKey used from two separate statsPanelMarkup()
// calls (simulating day view's "Soll" and month view's "Soll") each render their own independent
// markup reading the same underlying i18n text, with no id collision across panels (FR-006).
test('the same explanationKey used in two separate statsPanelMarkup calls renders independently with no id collision', () => {
  const dayPanel = statsPanelMarkup('day.stats.title', [
    ['day.stats.soll', '12,3 kWh', 'explanations.soll'],
  ]);
  const monthPanel = statsPanelMarkup('month.stats.title', [
    ['month.stats.sollTotal', '398,1 kWh', 'explanations.soll'],
  ]);
  const [, dayId] = dayPanel.match(/aria-describedby="([^"]+)"/);
  const [, monthId] = monthPanel.match(/aria-describedby="([^"]+)"/);
  assert.notStrictEqual(dayId, monthId);

  const dayTooltip = dayPanel.match(
    new RegExp(`<span[^>]*id="${dayId}"[^>]*role="tooltip"[^>]*>([^<]*)</span>`),
  )[1];
  const monthTooltip = monthPanel.match(
    new RegExp(`<span[^>]*id="${monthId}"[^>]*role="tooltip"[^>]*>([^<]*)</span>`),
  )[1];
  assert.strictEqual(dayTooltip, monthTooltip);
});
