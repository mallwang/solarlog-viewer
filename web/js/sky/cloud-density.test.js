import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloudCoverToTier, CLOUD_TIER_RENDER_CONFIG } from './cloud-density.js';

test('cloudCoverToTier boundary values', () => {
  assert.equal(cloudCoverToTier(0), 'clear');
  assert.equal(cloudCoverToTier(19), 'clear');
  assert.equal(cloudCoverToTier(20), 'partly');
  assert.equal(cloudCoverToTier(70), 'partly');
  assert.equal(cloudCoverToTier(71), 'overcast');
  assert.equal(cloudCoverToTier(100), 'overcast');
});

test('CLOUD_TIER_RENDER_CONFIG defines a render config for every tier', () => {
  for (const tier of ['clear', 'partly', 'overcast']) {
    const config = CLOUD_TIER_RENDER_CONFIG[tier];
    assert.ok(config, `missing render config for tier "${tier}"`);
    assert.equal(typeof config.opacity, 'number');
    assert.equal(typeof config.animationDurationScale, 'number');
    assert.equal(typeof config.visibleCount, 'number');
  }
});

test('the overcast tier is denser (higher opacity, more visible clouds) than clear', () => {
  const clear = CLOUD_TIER_RENDER_CONFIG.clear;
  const overcast = CLOUD_TIER_RENDER_CONFIG.overcast;

  assert.ok(overcast.opacity > clear.opacity);
  assert.ok(overcast.visibleCount > clear.visibleCount);
  assert.ok(overcast.animationDurationScale > clear.animationDurationScale);
});

test('visibleCount never exceeds the six existing .cloud elements', () => {
  for (const tier of Object.values(CLOUD_TIER_RENDER_CONFIG)) {
    assert.ok(tier.visibleCount >= 0 && tier.visibleCount <= 6);
  }
});
