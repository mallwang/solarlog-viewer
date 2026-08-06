/**
 * Fetches a data file as raw text.
 * @param {string} path - Page-relative path (no leading slash), e.g. 'base_vars.js' or
 *   'min250715.js', so it resolves correctly whether the site is served from the domain root
 *   or a subpath (e.g. /v2/).
 * @returns {Promise<{ ok: true, text: string } | { ok: false, status: number | null }>}
 *   Never throws — network/HTTP failures resolve to `{ ok: false, status }` so callers render
 *   FR-019's error state instead of an uncaught rejection.
 */
export async function fetchText(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, text: await response.text() };
  } catch {
    return { ok: false, status: null };
  }
}
