import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productionIntensity } from './production-animation.js';

const CAPACITY_W = 6200;

test('0 W (idle/nighttime) maps to the idle tier', () => {
  assert.equal(productionIntensity(0, CAPACITY_W), 'idle');
});

test('a ratio just below the low threshold maps to idle', () => {
  assert.equal(productionIntensity(CAPACITY_W * 0.04, CAPACITY_W), 'idle');
});

test('a ratio in the low band maps to low', () => {
  assert.equal(productionIntensity(CAPACITY_W * 0.2, CAPACITY_W), 'low');
});

test('a ratio in the medium band maps to medium', () => {
  assert.equal(productionIntensity(CAPACITY_W * 0.45, CAPACITY_W), 'medium');
});

test('a ratio in the high band maps to high', () => {
  assert.equal(productionIntensity(CAPACITY_W * 0.75, CAPACITY_W), 'high');
});

test('a ratio at/above ~90% of capacity maps to peak', () => {
  assert.equal(productionIntensity(CAPACITY_W * 0.9, CAPACITY_W), 'peak');
  assert.equal(productionIntensity(CAPACITY_W, CAPACITY_W), 'peak');
});

test('a reading above nameplate capacity clamps to peak rather than overflowing', () => {
  assert.equal(productionIntensity(CAPACITY_W * 1.5, CAPACITY_W), 'peak');
});

test('a missing/zero capacity falls back to idle rather than throwing or dividing by zero', () => {
  assert.equal(productionIntensity(1200, 0), 'idle');
  assert.equal(productionIntensity(1200, undefined), 'idle');
});

test('a non-finite current reading falls back to idle', () => {
  assert.equal(productionIntensity(Number.NaN, CAPACITY_W), 'idle');
});
