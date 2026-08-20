/**
 * @file Unit tests for weather-text.js's compact/full text builders (025-weather-icon-compact).
 * Covers both indicators (current-conditions, forecast) × available/unavailable × today/tomorrow
 * prefix, per plan.md's Testing section and quickstart.md's "Unit tests" section. weather-text.js
 * takes already-translated fragments (label, prefix text, unavailable text) rather than i18n keys
 * — it's pure string assembly, no `t()` dependency of its own (research.md §4/§6).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCurrentWeatherText,
  buildForecastWeatherText,
  UNAVAILABLE_ICON,
} from './weather-text.js';

test('buildCurrentWeatherText: available — compact value is just the rounded temperature', () => {
  const result = buildCurrentWeatherText({
    available: true,
    icon: '☀️',
    label: 'Klar',
    temperatureC: 21.4,
  });

  assert.equal(result.icon, '☀️');
  assert.equal(result.compactValue, '21°C');
  assert.equal(result.fullText, 'Klar, 21°C');
  assert.equal(result.available, true);
  assert.doesNotMatch(result.compactValue, /Klar/);
});

test('buildCurrentWeatherText: available — nighttime "clear" override wording flows through as-is', () => {
  // weather-text.js doesn't decide the nighttime override itself (that stays in
  // info-panel-controller.js per research.md §6) — it just assembles whatever icon/label it's
  // handed, so the moon-glyph/"clear" case is exercised the same way as any other label.
  const result = buildCurrentWeatherText({
    available: true,
    icon: '🌙',
    label: 'Klar',
    temperatureC: 12,
  });

  assert.equal(result.icon, '🌙');
  assert.equal(result.compactValue, '12°C');
  assert.equal(result.fullText, 'Klar, 12°C');
});

test('buildCurrentWeatherText: unavailable — dash icon, no compact value, pass-through unavailable text', () => {
  const result = buildCurrentWeatherText({ available: false, unavailableText: 'Nicht verfügbar' });

  assert.equal(result.icon, UNAVAILABLE_ICON);
  assert.equal(result.compactValue, '');
  assert.equal(result.fullText, 'Nicht verfügbar');
  assert.equal(result.available, false);
});

test('buildForecastWeatherText: available (today) — compact range has no repeated "C"/label/prefix', () => {
  const result = buildForecastWeatherText({
    available: true,
    icon: '🌧️',
    label: 'Regen',
    prefixText: 'Heute',
    minC: 15.2,
    maxC: 18.6,
  });

  assert.equal(result.icon, '🌧️');
  assert.equal(result.compactValue, '15° - 19°');
  assert.equal(result.fullText, 'Heute: Regen (15°C - 19°C)');
  assert.equal(result.available, true);
  assert.doesNotMatch(result.compactValue, /Regen|Heute|Morgen|°C/);
});

test('buildForecastWeatherText: available (tomorrow) — prefix text switches to "Morgen"', () => {
  const result = buildForecastWeatherText({
    available: true,
    icon: '❄️',
    label: 'Schnee',
    prefixText: 'Morgen',
    minC: -2,
    maxC: 1,
  });

  assert.equal(result.compactValue, '-2° - 1°');
  assert.equal(result.fullText, 'Morgen: Schnee (-2°C - 1°C)');
});

test('buildForecastWeatherText: unavailable — dash icon, no compact value, pass-through unavailable text', () => {
  const result = buildForecastWeatherText({ available: false, unavailableText: 'Nicht verfügbar' });

  assert.equal(result.icon, UNAVAILABLE_ICON);
  assert.equal(result.compactValue, '');
  assert.equal(result.fullText, 'Nicht verfügbar');
  assert.equal(result.available, false);
});
