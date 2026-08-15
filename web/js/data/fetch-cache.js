import { fetchText } from './fetch-text.js';

/** @type {Map<string, { result: { ok: true, text: string } | { ok: false, status: number | null }, expiresAt: number }>} */
const cache = new Map();

/**
 * `fetchText` wrapped with an in-memory cache, keyed by path. A cache hit within its TTL
 * skips the network call entirely; a failed fetch (`ok: false`) is never cached, so a
 * transient network error doesn't stick around for the TTL. The cache lives for the
 * lifetime of the page (module-level `Map`) — a full reload starts fresh.
 * @param {string} path - Page-relative path, e.g. 'hist/months.js'.
 * @param {number} ttlMs - How long a successful result stays fresh. `Infinity` caches for
 *   the lifetime of the page (used for immutable files that never change once written).
 * @param {typeof fetchText} [fetchImpl] - Injectable for tests; defaults to `fetchText`.
 * @returns {Promise<{ ok: true, text: string } | { ok: false, status: number | null }>}
 */
export async function fetchTextCached(path, ttlMs, fetchImpl = fetchText) {
  const cached = cache.get(path);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.result;

  const result = await fetchImpl(path);
  if (result.ok) cache.set(path, { result, expiresAt: now + ttlMs });
  return result;
}

/**
 * Resets the module-level cache. Test-only — real usage relies on the cache persisting
 * for the page's lifetime.
 */
export function clearFetchCache() {
  cache.clear();
}
