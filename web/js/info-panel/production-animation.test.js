import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  productionIntensity,
  productionColor,
  PRODUCTION_COLOR_IDLE,
} from './production-animation.js';

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

test('productionColor: 0 W (no production) is gray', () => {
  assert.equal(productionColor(0, CAPACITY_W), PRODUCTION_COLOR_IDLE);
});

test('productionColor: a non-finite or negative reading is gray', () => {
  assert.equal(productionColor(Number.NaN, CAPACITY_W), PRODUCTION_COLOR_IDLE);
  assert.equal(productionColor(-100, CAPACITY_W), PRODUCTION_COLOR_IDLE);
});

test('productionColor: 0% ratio is pure red (the first color stop)', () => {
  assert.equal(productionColor(0.0001, CAPACITY_W), 'rgb(198, 40, 40)');
});

test('productionColor: 25% ratio is pure orange', () => {
  assert.equal(productionColor(CAPACITY_W * 0.25, CAPACITY_W), 'rgb(245, 124, 0)');
});

test('productionColor: 50% ratio is pure yellow', () => {
  assert.equal(productionColor(CAPACITY_W * 0.5, CAPACITY_W), 'rgb(251, 192, 45)');
});

test('productionColor: 75% ratio and above is pure green', () => {
  assert.equal(productionColor(CAPACITY_W * 0.75, CAPACITY_W), 'rgb(46, 125, 50)');
  assert.equal(productionColor(CAPACITY_W, CAPACITY_W), 'rgb(46, 125, 50)');
  assert.equal(productionColor(CAPACITY_W * 1.5, CAPACITY_W), 'rgb(46, 125, 50)');
});

test('productionColor: 64.5% ratio (4000 W of 6200 W) interpolates between yellow and green', () => {
  // t = (0.6452 - 0.5) / 0.25 ≈ 0.5806 — matches the worked example from the user's request.
  const color = productionColor(4000, 6200);
  assert.equal(color, 'rgb(132, 153, 48)');
});

test('productionColor: a missing/zero capacity falls back to red rather than throwing', () => {
  assert.equal(productionColor(1200, 0), 'rgb(198, 40, 40)');
  assert.equal(productionColor(1200, undefined), 'rgb(198, 40, 40)');
});
