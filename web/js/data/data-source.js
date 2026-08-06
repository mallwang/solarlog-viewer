import { fetchText } from './fetch-text.js';
import { INSTALLATION_DATE, DATA_DIR, HIST_DIR } from '../config.js';

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
 * @param {string} filename - e.g. 'months.js'.
 * @returns {Promise<{ hist: Awaited<ReturnType<typeof fetchText>>, data: Awaited<ReturnType<typeof fetchText>> }>}
 */
export async function fetchFromBothSources(filename) {
  const [hist, data] = await Promise.all([
    fetchText(`${HIST_DIR}/${filename}`),
    fetchText(`${DATA_DIR}/${filename}`),
  ]);
  return { hist, data };
}
