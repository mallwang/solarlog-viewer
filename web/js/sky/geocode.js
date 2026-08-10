/**
 * @file Open-Meteo geocoding wrapper. Resolves a free-text address (e.g. an `HPStandort`
 * value) to coordinates via the free, keyless Open-Meteo geocoding API, caching the first
 * result in `localStorage` so repeat lookups for the same address never hit the network
 * again. Used as the automatic fallback tier of `web/js/sky/location.js`'s resolution order.
 */

/** Prefix for the localStorage cache key, followed by the raw address string. */
export const GEOCODE_CACHE_PREFIX = 'sky-geocode:';

/**
 * Geocodes a free-text address via Open-Meteo's geocoding API. On success, caches
 * `{ lat, lon }` in `localStorage` under `sky-geocode:<address>` and returns it. Never throws
 * — any network error, non-2xx status, or malformed response resolves to `null` instead.
 * @param {string} address - Free-text address to resolve (e.g. a parsed `HPStandort` value).
 * @param {{ fetchImpl?: typeof fetch, storage?: Storage }} [deps] - Injectable `fetch` and
 *   `localStorage` implementations, overridable for tests.
 * @returns {Promise<{ lat: number, lon: number } | null>}
 */
export async function geocodeAddress(address, { fetchImpl = fetch, storage = localStorage } = {}) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}`;
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    const data = await response.json();
    const first = data?.results?.[0];
    if (!first || !Number.isFinite(first.latitude) || !Number.isFinite(first.longitude)) {
      return null;
    }
    const coords = { lat: first.latitude, lon: first.longitude };
    storage.setItem(`${GEOCODE_CACHE_PREFIX}${address}`, JSON.stringify(coords));
    return coords;
  } catch {
    return null;
  }
}
