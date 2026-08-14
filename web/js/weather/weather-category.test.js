import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weatherCodeToCategory, WEATHER_CATEGORIES } from './weather-category.js';

test('WEATHER_CATEGORIES lists exactly the five valid category names', () => {
  assert.deepEqual(WEATHER_CATEGORIES, ['sunny', 'mixed', 'cloudy', 'rain', 'snow']);
});

test('weatherCodeToCategory classifies one representative code per bucket', () => {
  assert.equal(weatherCodeToCategory(0), 'sunny');
  assert.equal(weatherCodeToCategory(2), 'mixed');
  assert.equal(weatherCodeToCategory(3), 'cloudy');
  assert.equal(weatherCodeToCategory(61), 'rain');
  assert.equal(weatherCodeToCategory(71), 'snow');
});

test('weatherCodeToCategory folds fog and thunderstorm into their documented buckets', () => {
  assert.equal(weatherCodeToCategory(45), 'cloudy');
  assert.equal(weatherCodeToCategory(48), 'cloudy');
  assert.equal(weatherCodeToCategory(95), 'rain');
  assert.equal(weatherCodeToCategory(99), 'rain');
});

test('weatherCodeToCategory falls back to cloudy for an unrecognized code', () => {
  assert.equal(weatherCodeToCategory(100), 'cloudy');
});
