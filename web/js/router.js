/**
 * Empty/unrecognized hashes and the brand-logo link resolve to the welcome page (015-welcome-
 * page-dashboard) rather than any specific period view - it has no params of its own, but this
 * stays a function (not a module-level constant) for symmetry with the other route builders.
 * @returns {{ view: 'welcome', params: {} }}
 */
function defaultRoute() {
  return { view: 'welcome', params: {} };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function isValidDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const STATISTICS_TOPICS = new Set(['common', 'heatmaps', 'streaks', 'trends', 'best-worst']);

/** @param {string | undefined} rawTopic @returns {string} A valid topic, defaulting to 'common' (per contracts/statistics-module.md's Router contract). */
function parseStatisticsTopic(rawTopic) {
  return STATISTICS_TOPICS.has(rawTopic) ? rawTopic : 'common';
}

/** @param {string[]} rest - segments after 'year'. @returns {{ view: string, params: object } | null} */
function parseYearRoute(rest) {
  if (rest.length !== 1) return null;
  const year = Number.parseInt(rest[0], 10);
  if (!Number.isInteger(year) || !/^\d{4}$/.test(rest[0])) return null;
  return { view: 'year', params: { year } };
}

/** @param {string[]} rest - segments after 'month'. @returns {{ view: string, params: object } | null} */
function parseMonthRoute(rest) {
  if (rest.length !== 2) return null;
  const year = Number.parseInt(rest[0], 10);
  const month = Number.parseInt(rest[1], 10);
  if (!/^\d{4}$/.test(rest[0]) || !/^\d{2}$/.test(rest[1]) || month < 1 || month > 12) return null;
  return { view: 'month', params: { year, month } };
}

/** @param {string[]} rest - segments after 'day'. @returns {{ view: string, params: object } | null} */
function parseDayRoute(rest) {
  if (rest.length !== 3) return null;
  const year = Number.parseInt(rest[0], 10);
  const month = Number.parseInt(rest[1], 10);
  const day = Number.parseInt(rest[2], 10);
  const shapeOk = /^\d{4}$/.test(rest[0]) && /^\d{2}$/.test(rest[1]) && /^\d{2}$/.test(rest[2]);
  if (
    !shapeOk ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    !isValidDate(year, month, day)
  ) {
    return null;
  }
  return { view: 'day', params: { year, month, day } };
}

const SIMPLE_ROUTE_PARSERS = {
  year: parseYearRoute,
  month: parseMonthRoute,
  day: parseDayRoute,
};

/**
 * Parses the current location.hash into a Route.
 * @param {string} hash
 * @returns {{ view: string, params: { year?: number, month?: number, day?: number } }}
 *   Defaults to the welcome page (see defaultRoute) for empty/unrecognized hashes.
 */
export function parseRoute(hash) {
  const path = (hash ?? '').replace(/^#\/?/, '');
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return defaultRoute();

  const [kind, ...rest] = segments;

  if (kind === 'total' && rest.length === 0) return { view: 'total', params: {} };
  if (kind === 'events' && rest.length === 0) return { view: 'events', params: {} };
  if (kind === 'statistics') {
    return { view: 'statistics', params: { topic: parseStatisticsTopic(rest[0]) } };
  }

  return SIMPLE_ROUTE_PARSERS[kind]?.(rest) ?? defaultRoute();
}

/**
 * Serializes a Route back into a location.hash-compatible string (for building links).
 * @param {{ view: string, params: { year?: number, month?: number, day?: number } }} route
 * @returns {string} e.g. '#/month/2019/07'
 */
export function formatRoute(route) {
  const { view, params = {} } = route;
  switch (view) {
    case 'day':
      return `#/day/${params.year}/${pad2(params.month)}/${pad2(params.day)}`;
    case 'month':
      return `#/month/${params.year}/${pad2(params.month)}`;
    case 'year':
      return `#/year/${params.year}`;
    case 'total':
      return '#/total';
    case 'events':
      return '#/events';
    case 'statistics':
      return `#/statistics/${params.topic ?? 'common'}`;
    case 'welcome':
    default:
      return '#/';
  }
}

/**
 * Subscribes to hash changes and initial load; invokes `onRoute(route)` with the parsed Route
 * both immediately and on every subsequent `hashchange`.
 * @param {(route: { view: string, params: object }) => void} onRoute
 * @returns {() => void} Unsubscribe function.
 */
export function onRouteChange(onRoute) {
  const handler = () => onRoute(parseRoute(window.location.hash));
  window.addEventListener('hashchange', handler);
  handler();
  return () => window.removeEventListener('hashchange', handler);
}
