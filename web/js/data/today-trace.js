/**
 * @file Shared fetch+parse+filter for today's rolling `data/min_day.js` trace — extracted from
 * `views/day-view.js`'s `fetchDayTrace()` `isToday` branch (research.md §3 of
 * specs/028-live-panel-fallback/) so it and the navbar info panel controller share one
 * implementation instead of duplicating the "prefer min_day.js, filter to today's date" logic.
 */
import { fetchText } from './fetch-text.js';
import { parseMinFile } from './min-file.js';
import { DATA_DIR } from '../config.js';

function ddmmyyToday() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  return `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${yy}`;
}

function isoToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Fetches and parses `data/min_day.js`, filtered to only today's readings. The SolarLog device
 * only rolls `min_day.js` over to the new day on its next sync, so right after midnight it can
 * still be full of yesterday's finished readings for a while; each reading carries its own date
 * (parsed from the file, not the browser's current date), so anything not actually dated today
 * is dropped.
 * @returns {Promise<{ readings: object[] } | null>} `null` when the file is unfetchable,
 *   doesn't parse, or has zero readings dated today — callers treat that the same as "nothing to
 *   show" rather than an error.
 */
export async function fetchTodayMinuteTrace() {
  const result = await fetchText(`${DATA_DIR}/min_day.js`);
  if (!result.ok) return null;
  const trace = parseMinFile(result.text, ddmmyyToday());
  trace.readings = trace.readings.filter((r) => r.timestamp.startsWith(isoToday()));
  return trace.readings.length === 0 ? null : trace;
}
