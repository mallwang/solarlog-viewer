/**
 * @file Live PV status endpoint fetch for the global info panel (research.md §1/§7 of
 * specs/027-navbar-live-panel/). Deliberately separate from `weather-forecast-client.js` — a
 * different host, response shape, and refresh cadence (`LIVE_REFRESH_INTERVAL_MS`). Stateless:
 * this module never remembers a previous reading — the controller owns last-known-good state
 * (research.md §3) — and never throws, mirroring `fetchWeatherAndForecast()`'s contract.
 */

import { LIVE_ENDPOINT_URL } from '../config.js';

/**
 * Fetches and validates the live status endpoint's reading. A response counts as successful only
 * when the fetch doesn't throw, `response.ok` is true, the body parses as JSON, the top-level
 * `watt` is `Number.isFinite`, and `sources.solarlog.ok === true` (FR-004, contracts/live-
 * endpoint.md); anything else resolves to `{ available: false }` with no further detail
 * surfaced (data-model.md). `sources`/`sources.solarlog.*`/`inverters[]` are deliberately not
 * passed through (research.md §6) — only `watt`/`timestamp` reach the caller.
 * @param {{ fetchImpl?: typeof fetch }} [deps] - Injectable `fetch` implementation for tests.
 * @returns {Promise<{ available: true, watt: number, timestamp: string } | { available: false }>}
 */
export async function fetchLiveReading({ fetchImpl = fetch } = {}) {
  try {
    const response = await fetchImpl(LIVE_ENDPOINT_URL);
    if (!response.ok) return { available: false };
    const data = await response.json();

    const watt = data?.watt;
    const solarlogOk = data?.sources?.solarlog?.ok;
    if (!Number.isFinite(watt) || solarlogOk !== true) return { available: false };

    return { available: true, watt, timestamp: data.timestamp };
  } catch {
    return { available: false };
  }
}
