import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWetteronlineSearchUrl } from './wetteronline-link.js';

test('a plain address is URL-encoded into the search URL', () => {
  const url = buildWetteronlineSearchUrl('92266 Ensdorf-Wolfsbach');
  assert.equal(url, 'https://www.wetteronline.de/suche?q=92266%20Ensdorf-Wolfsbach');
});

test('an address with characters requiring encoding is escaped correctly', () => {
  const url = buildWetteronlineSearchUrl('Straße & Co, 12345 Müllerstadt');
  assert.equal(
    url,
    'https://www.wetteronline.de/suche?q=Stra%C3%9Fe%20%26%20Co%2C%2012345%20M%C3%BCllerstadt',
  );
});

test('leading/trailing whitespace is trimmed before encoding', () => {
  const url = buildWetteronlineSearchUrl('  Ensdorf  ');
  assert.equal(url, 'https://www.wetteronline.de/suche?q=Ensdorf');
});

test('an empty address returns null rather than a broken URL', () => {
  assert.equal(buildWetteronlineSearchUrl(''), null);
});

test('a whitespace-only address returns null', () => {
  assert.equal(buildWetteronlineSearchUrl('   '), null);
});

test('a missing address returns null', () => {
  assert.equal(buildWetteronlineSearchUrl(undefined), null);
  assert.equal(buildWetteronlineSearchUrl(null), null);
});
