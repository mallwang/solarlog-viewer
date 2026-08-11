import { test } from 'node:test';
import assert from 'node:assert/strict';
import { efficiencyPercent, efficiencySums } from './efficiency.js';

test('efficiencySums sums pacW and every pdcW element across inverters', () => {
  const perInverter = {
    1: { pacW: 300, pdcW: [150, 150] },
    2: { pacW: 100, pdcW: [50] },
  };
  assert.deepEqual(efficiencySums(perInverter), { pacW: 400, pdcW: 350 });
});

test('efficiencySums returns zeroes for an empty map', () => {
  assert.deepEqual(efficiencySums({}), { pacW: 0, pdcW: 0 });
});

test('computes a normal ratio as a percentage', () => {
  const perInverter = { 1: { pacW: 900, pdcW: [1000] } };
  assert.equal(efficiencyPercent(perInverter), 90);
});

test('returns null when summed PDC is 0', () => {
  const perInverter = { 1: { pacW: 500, pdcW: [0, 0] } };
  assert.equal(efficiencyPercent(perInverter), null);
});

test('returns null when pdcW is missing', () => {
  const perInverter = { 1: { pacW: 500 } };
  assert.equal(efficiencyPercent(perInverter), null);
});

test('returns null when pdcW is an empty array', () => {
  const perInverter = { 1: { pacW: 500, pdcW: [] } };
  assert.equal(efficiencyPercent(perInverter), null);
});

test('returns null when perInverter is empty', () => {
  assert.equal(efficiencyPercent({}), null);
});

test('returns null for non-finite sums (e.g. NaN pacW)', () => {
  const perInverter = { 1: { pacW: Number.NaN, pdcW: [1000] } };
  assert.equal(efficiencyPercent(perInverter), null);
});

test('returns an uncapped value above 100 when PAC exceeds PDC', () => {
  const perInverter = { 1: { pacW: 1200, pdcW: [1000] } };
  assert.equal(efficiencyPercent(perInverter), 120);
});

test('sums pacW and every pdcW element across multiple inverters and strings', () => {
  const perInverter = {
    1: { pacW: 300, pdcW: [150, 150] },
    2: { pacW: 100, pdcW: [50] },
  };
  // sumPac = 400, sumPdc = 350 -> ~114.2857%
  assert.equal(efficiencyPercent(perInverter), (400 / 350) * 100);
});

test('sums whatever PDC values are present when one inverter lacks pdcW (partial data)', () => {
  const perInverter = {
    1: { pacW: 300, pdcW: [150, 150] },
    2: { pacW: 100, pdcW: [] },
  };
  assert.equal(efficiencyPercent(perInverter), (400 / 300) * 100);
});
