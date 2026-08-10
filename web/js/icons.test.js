import { test } from 'node:test';
import assert from 'node:assert/strict';
import { icon } from './icons.js';

test('icon renders an svg with the requested icon name', () => {
  const html = icon('bolt');
  assert.match(html, /^<svg[^>]*>/);
  assert.match(html, /<\/svg>$/);
  assert.match(html, /viewBox="0 0 24 24"/);
});

test('icon defaults to size-4 shrink-0 and is decorative', () => {
  const html = icon('eye');
  assert.match(html, /class="size-4 shrink-0"/);
  assert.match(html, /aria-hidden="true"/);
});

test('icon accepts a custom className', () => {
  const html = icon('forward', 'size-5');
  assert.match(html, /class="size-5"/);
});

test('every documented icon name renders distinct path content', () => {
  const names = [
    'bolt',
    'calendarDateRange',
    'calendar',
    'presentationChartBar',
    'eyeSlash',
    'eye',
    'forward',
    'backward',
  ];
  const rendered = names.map((name) => icon(name));
  assert.equal(new Set(rendered).size, names.length);
  for (const html of rendered) assert.match(html, /<path /);
});
