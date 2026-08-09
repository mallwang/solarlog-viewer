import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber, formatKwh, formatCurrency, formatDate } from './format.js';

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
