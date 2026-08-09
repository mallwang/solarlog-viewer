import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CO2_FACTOR_KG_PER_KWH_BY_YEAR,
  CO2_FALLBACK_FACTOR_KG_PER_KWH,
  co2FactorForYear,
} from './co2-factors.js';

test('co2FactorForYear returns the exact published factor for a historical year', () => {
  assert.equal(co2FactorForYear(2020), 0.365);
});

test('co2FactorForYear resolves the table lower boundary year (2006)', () => {
  assert.equal(co2FactorForYear(2006), 0.608);
});

test('co2FactorForYear resolves the table upper boundary year (2025)', () => {
  assert.equal(co2FactorForYear(2025), 0.344);
});

test('co2FactorForYear falls back to the constant for a year with no published entry (future year)', () => {
  assert.equal(co2FactorForYear(2026), CO2_FALLBACK_FACTOR_KG_PER_KWH);
});

test('co2FactorForYear falls back to the constant for a year before the table starts', () => {
  assert.equal(co2FactorForYear(1990), CO2_FALLBACK_FACTOR_KG_PER_KWH);
});

test('CO2_FALLBACK_FACTOR_KG_PER_KWH is the specified fallback value', () => {
  assert.equal(CO2_FALLBACK_FACTOR_KG_PER_KWH, 0.363);
});

test('CO2_FACTOR_KG_PER_KWH_BY_YEAR spans 2006 through 2025 with no gaps', () => {
  for (let year = 2006; year <= 2025; year += 1) {
    assert.ok(
      Object.hasOwn(CO2_FACTOR_KG_PER_KWH_BY_YEAR, String(year)),
      `missing entry for ${year}`,
    );
  }
});
