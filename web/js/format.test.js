import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNumber,
  formatKwh,
  formatCurrency,
  formatDate,
  formatMonthYear,
  formatCo2,
} from './format.js';

test('formatNumber uses comma decimal separator for de', () => {
  assert.equal(formatNumber(1234.5, { lang: 'de' }), '1.234,5');
});

test('formatNumber uses period decimal separator for en', () => {
  assert.equal(formatNumber(1234.5, { lang: 'en' }), '1,234.5');
});

test('formatKwh appends the unit with locale-formatted decimals', () => {
  assert.equal(formatKwh(12.34, { decimals: 2, lang: 'de' }), '12,34 kWh');
  assert.equal(formatKwh(12.34, { decimals: 2, lang: 'en' }), '12.34 kWh');
});

test('formatCurrency renders EUR with comma decimal and trailing symbol for de', () => {
  assert.equal(formatCurrency(1234.5, { lang: 'de' }), '1.234,50 €');
});

test('formatCurrency renders EUR with period decimal and leading symbol for en', () => {
  assert.equal(formatCurrency(1234.5, { lang: 'en' }), '€1,234.50');
});

test('formatDate renders DD.MM.YYYY for de', () => {
  assert.equal(formatDate(new Date(Date.UTC(2026, 7, 8, 12)), { lang: 'de' }), '08.08.2026');
});

test('formatDate renders MM/DD/YYYY for en', () => {
  assert.equal(formatDate(new Date(Date.UTC(2026, 7, 8, 12)), { lang: 'en' }), '08/08/2026');
});

test('formatMonthYear renders a localized "Month YYYY" label for de', () => {
  assert.equal(formatMonthYear(2026, 8, { lang: 'de' }), 'August 2026');
});

test('formatMonthYear renders a localized "Month YYYY" label for en', () => {
  assert.equal(formatMonthYear(2026, 8, { lang: 'en' }), 'August 2026');
});

test('formatCo2 renders below the 10,000 kg threshold in kg with 0 decimals', () => {
  assert.equal(formatCo2(1234.7, { lang: 'de' }), '1.234 kg');
});

test('formatCo2 renders at/above the 10,000 kg threshold in tonnes with 2 decimals', () => {
  assert.equal(formatCo2(12345, { lang: 'de' }), '12,34 t');
});

test('formatCo2 uses the German comma decimal convention', () => {
  assert.equal(formatCo2(15000, { lang: 'de' }), '15,00 t');
});

test('formatCo2 uses the English period decimal convention', () => {
  assert.equal(formatCo2(15000, { lang: 'en' }), '15.00 t');
});
