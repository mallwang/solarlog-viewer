/**
 * Build-time metadata injected by `scripts/build.js` via esbuild's `define`. In the unbundled dev
 * server (`npm start`, `web/` served as-is by browser-sync) `__BUILD_ID__` was never defined, so
 * the `typeof` guard below falls back to an empty string — no cache-busting query string, which is
 * fine locally since there's no stale-cache problem to solve there.
 * @module build-info
 */

/** @returns {string} the current build's short git SHA, or '' outside a production build */
export function getBuildId() {
  return typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : '';
}
