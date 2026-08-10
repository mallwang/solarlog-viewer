import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWetteronlineSearchUrl } from './wetteronline-link.js';

const FIXED_PARAMS = 'searchpcid=pc_city_weather&searchpid=&searchsid=&pid=p_search';

test('a plain address is URL-encoded (space as +) into the search URL, with the fixed params', () => {
  const url = buildWetteronlineSearchUrl('92266 Ensdorf-Wolfsbach');
  assert.equal(
    url,
    `https://www.wetteronline.de/suche?searchstring=92266+Ensdorf-Wolfsbach&${FIXED_PARAMS}`,
  );
});

test('an address with characters requiring encoding is escaped correctly', () => {
  const url = buildWetteronlineSearchUrl('Straße & Co, 12345 Müllerstadt');
  assert.equal(
    url,
    `https://www.wetteronline.de/suche?searchstring=Stra%C3%9Fe+%26+Co%2C+12345+M%C3%BCllerstadt&${FIXED_PARAMS}`,
  );
});

test('leading/trailing whitespace is trimmed before encoding', () => {
  const url = buildWetteronlineSearchUrl('  Ensdorf  ');
  assert.equal(url, `https://www.wetteronline.de/suche?searchstring=Ensdorf&${FIXED_PARAMS}`);
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
