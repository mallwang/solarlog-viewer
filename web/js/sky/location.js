/**
 * @file Resolves the installation's coordinates for the dynamic sky background, in priority
 * order: manual `SKY_LOCATION_OVERRIDE` (config.js) → `localStorage` geocode cache → live
 * Open-Meteo geocoding of the plant's `HPStandort` address → `null` if all three fail. See
 * data-model.md §Installation Location for the full derivation and validation rules.
 */

import { geocodeAddress, GEOCODE_CACHE_PREFIX } from './geocode.js';

/**
 * @param {{ lat?: number, lon?: number } | null | undefined} coords
 * @returns {boolean}
 */
function isValidCoords(coords) {
  return (
    !!coords &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lon) &&
    coords.lat >= -90 &&
    coords.lat <= 90 &&
    coords.lon >= -180 &&
    coords.lon <= 180
  );
}

/**
 * @param {Storage} storage
 * @param {string} key
 * @returns {{ lat: number, lon: number } | null}
 */
function readCache(storage, key) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the coordinates to use for weather/solar-time lookups for one installation.
 * @param {{ location?: string } | null | undefined} plant - Parsed plant metadata
 *   (`web/js/data/plant.js`); only `location` (the raw `HPStandort` string) is used.
 * @param {{ lat: number, lon: number } | null | undefined} override -
 *   `SKY_LOCATION_OVERRIDE` from `config.js`.
 * @param {{ storage?: Storage, geocode?: typeof geocodeAddress }} [deps] - Injectable
 *   `localStorage` and geocoding implementations, overridable for tests.
 * @returns {Promise<{ lat: number, lon: number, source: 'override' | 'cache' | 'geocoded' } | null>}
 */
export async function resolveInstallationLocation(
  plant,
  override,
  { storage = localStorage, geocode = geocodeAddress } = {},
) {
  if (override) {
    return isValidCoords(override)
      ? { lat: override.lat, lon: override.lon, source: 'override' }
      : null;
  }

  const address = plant?.location;
  if (!address) return null;

  const cached = readCache(storage, `${GEOCODE_CACHE_PREFIX}${address}`);
  if (cached) {
    return isValidCoords(cached) ? { lat: cached.lat, lon: cached.lon, source: 'cache' } : null;
  }

  const geocoded = await geocode(address, { storage });
  if (!isValidCoords(geocoded)) return null;
  return { lat: geocoded.lat, lon: geocoded.lon, source: 'geocoded' };
}
