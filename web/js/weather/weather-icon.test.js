import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weatherCategoryToIcon, MOON_ICON } from './weather-icon.js';
import { WEATHER_CATEGORIES } from './weather-category.js';

test('every weather category maps to its documented glyph', () => {
  assert.equal(weatherCategoryToIcon('sunny'), '☀️');
  assert.equal(weatherCategoryToIcon('mixed'), '⛅');
  assert.equal(weatherCategoryToIcon('cloudy'), '☁️');
  assert.equal(weatherCategoryToIcon('rain'), '🌧️');
  assert.equal(weatherCategoryToIcon('snow'), '❄️');
});

test('is a total function over all WEATHER_CATEGORIES values', () => {
  for (const category of WEATHER_CATEGORIES) {
    assert.equal(typeof weatherCategoryToIcon(category), 'string');
    assert.ok(weatherCategoryToIcon(category).length > 0);
  }
});

test('MOON_ICON is exported and distinct from all five category glyphs', () => {
  assert.equal(MOON_ICON, '🌙');
  for (const category of WEATHER_CATEGORIES) {
    assert.notEqual(weatherCategoryToIcon(category), MOON_ICON);
  }
});
