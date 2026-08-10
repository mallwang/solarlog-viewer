/**
 * @file Builds a wetteronline.de site-search URL for the plant's configured address, per
 * research.md §3. Deliberately a search-results URL rather than a guessed place-page slug:
 * `HPStandort` addresses may include postal codes or hyphenated hamlet names that aren't
 * derivable to a slug without a lookup table this project has no authoritative source for
 * (FR-007's edge case — an unmatched address should still land on a normal search-results
 * page, never a dead link or the wrong location silently shown).
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
  return `${WETTERONLINE_SEARCH_BASE_URL}?q=${encodeURIComponent(address.trim())}`;
}
