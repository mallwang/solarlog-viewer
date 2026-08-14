import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEATHER_CATEGORY_RENDER_CONFIG } from './weather-render-config.js';

test('WEATHER_CATEGORY_RENDER_CONFIG defines a render config for every category', () => {
  for (const category of ['sunny', 'mixed', 'cloudy', 'rain', 'snow']) {
    const config = WEATHER_CATEGORY_RENDER_CONFIG[category];
    assert.ok(config, `missing render config for category "${category}"`);
    assert.equal(typeof config.opacity, 'number');
    assert.equal(typeof config.animationDurationScale, 'number');
    assert.equal(typeof config.visibleCount, 'number');
    assert.equal(typeof config.hasRainLayer, 'boolean');
    assert.equal(typeof config.hasSnowLayer, 'boolean');
  }
});

test('the cloudy category is denser (higher opacity, more visible clouds) than sunny', () => {
  const sunny = WEATHER_CATEGORY_RENDER_CONFIG.sunny;
  const cloudy = WEATHER_CATEGORY_RENDER_CONFIG.cloudy;

  assert.ok(cloudy.opacity > sunny.opacity);
  assert.ok(cloudy.visibleCount > sunny.visibleCount);
  assert.ok(cloudy.animationDurationScale > sunny.animationDurationScale);
});

test('visibleCount never exceeds the sixteen existing .cloud elements', () => {
  for (const config of Object.values(WEATHER_CATEGORY_RENDER_CONFIG)) {
    assert.ok(config.visibleCount >= 0 && config.visibleCount <= 16);
  }
});

test('hasRainLayer/hasSnowLayer are true only for their own category', () => {
  for (const [category, config] of Object.entries(WEATHER_CATEGORY_RENDER_CONFIG)) {
    assert.equal(config.hasRainLayer, category === 'rain');
    assert.equal(config.hasSnowLayer, category === 'snow');
  }
});

test("rain and snow reuse cloudy's opacity/duration/visibleCount", () => {
  const cloudy = WEATHER_CATEGORY_RENDER_CONFIG.cloudy;
  for (const category of ['rain', 'snow']) {
    const config = WEATHER_CATEGORY_RENDER_CONFIG[category];
    assert.equal(config.opacity, cloudy.opacity);
    assert.equal(config.animationDurationScale, cloudy.animationDurationScale);
    assert.equal(config.visibleCount, cloudy.visibleCount);
  }
});
