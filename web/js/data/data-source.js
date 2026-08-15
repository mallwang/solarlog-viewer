import { fetchTextCached } from './fetch-cache.js';
import { INSTALLATION_DATE, DATA_DIR, HIST_DIR, DATA_REFRESH_INTERVAL_MS } from '../config.js';

/**
 * Picks which source directory a given date's data lives in. The old device's data through
 * the day before INSTALLATION_DATE is frozen in HIST_DIR; the new device's output from
 * INSTALLATION_DATE on lives in DATA_DIR.
 * @param {string} dateIso - 'YYYY-MM-DD'.
 * @returns {'hist' | 'data'}
 */
export function sourceDirForDate(dateIso) {
  return dateIso >= INSTALLATION_DATE ? DATA_DIR : HIST_DIR;
}

/**
 * Fetches the same filename from both HIST_DIR and DATA_DIR in parallel, for aggregate files
 * (days_hist.js/months.js/years.js) that may hold data on both sides of the installation date.
 * Both sides are cached (`fetchTextCached`): HIST_DIR is documented as frozen and never
 * rewritten, so it's cached for the page's lifetime; DATA_DIR is live but only rewritten once
 * a day when the device boots, so it's cached for DATA_REFRESH_INTERVAL_MS — the same "fresh
 * enough" cadence the rest of the app already uses for live data. This avoids re-downloading
 * these files (hist/days_hist.js alone is ~250 KB) on every month/year navigation.
 * @param {string} filename - e.g. 'months.js'.
 * @returns {Promise<{ hist: Awaited<ReturnType<typeof fetchTextCached>>, data: Awaited<ReturnType<typeof fetchTextCached>> }>}
 */
export async function fetchFromBothSources(filename) {
  const [hist, data] = await Promise.all([
    fetchTextCached(`${HIST_DIR}/${filename}`, Infinity),
    fetchTextCached(`${DATA_DIR}/${filename}`, DATA_REFRESH_INTERVAL_MS),
  ]);
  return { hist, data };
}
