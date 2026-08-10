/**
 * @file Builds a wetteronline.de site-search URL for the plant's configured address, per
 * research.md §3. Deliberately a search-results URL rather than a guessed place-page slug:
 * `HPStandort` addresses may include postal codes or hyphenated hamlet names that aren't
 * derivable to a slug without a lookup table this project has no authoritative source for
 * (FR-007's edge case — an unmatched address should still land on a normal search-results
 * page, never a dead link or the wrong location silently shown).
 *
 * The query shape below (`searchstring` + the four `searchpcid`/`searchpid`/`searchsid`/`pid`
 * params) is the URL wetteronline.de's own search form actually submits and lands on directly
 * — confirmed by the user. A plain `?q=<address>` (wetteronline.de's simpler-looking but
 * unofficial pattern) instead lands on an interstitial "refine your search" page that never
 * auto-forwards to a result.
 */

const WETTERONLINE_SEARCH_BASE_URL = 'https://www.wetteronline.de/suche';

/**
 * @param {string | null | undefined} address - The plant's raw configured address
 *   (`plant.location`, i.e. `HPStandort`).
 * @returns {string | null} A wetteronline.de search-results URL, or `null` when there is no
 *   address to search on at all (FR-012's "no location" edge case).
 */
export function buildWetteronlineSearchUrl(address) {
  if (!address || !address.trim()) return null;
  const params = new URLSearchParams({
    searchstring: address.trim(),
    searchpcid: 'pc_city_weather',
    searchpid: '',
    searchsid: '',
    pid: 'p_search',
  });
  return `${WETTERONLINE_SEARCH_BASE_URL}?${params.toString()}`;
}
